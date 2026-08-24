import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { EntityManager, Repository } from 'typeorm';
import { File } from '../database/entities';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Derived so the limit is stated in exactly one place. */
export const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));

/** One sub-directory per subject, so a customer's three scans do not mingle. */
export const UPLOAD_FOLDERS = {
  customer: 'customer',
  guarantor1: 'guarantor_1',
  guarantor2: 'guarantor_2',
} as const;

export type UploadFolder = (typeof UPLOAD_FOLDERS)[keyof typeof UPLOAD_FOLDERS];

export type UploadTarget = {
  /** Form field name, used verbatim in field-level errors (FR-CUS-06). */
  field: string;
  folder: UploadFolder;
  /** Person the scan belongs to; becomes the first part of the filename. */
  personName: string;
  cnic_number: string;
  side?: 'front' | 'back';
};

type Signature = {
  mime: string;
  extension: string;
  matches: (buffer: Buffer) => boolean;
};

/**
 * FR-CUS-04-v2: the declared Content-Type is not trusted. Every upload is
 * identified by its leading bytes, and anything unrecognised is rejected.
 */
const SIGNATURES: Signature[] = [
  {
    mime: 'image/jpeg',
    extension: 'jpg',
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    extension: 'png',
    matches: (b) =>
      b
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/webp',
    extension: 'webp',
    matches: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

// Control characters, written by code point so no raw bytes end up in source.
// Matching control characters is the point here: a filename must not carry them.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp('[\u0000-\u001F]', 'g');

/**
 * Strips anything that is illegal in a filename or could climb out of the
 * upload directory. A name of "../../etc" survives only as "etc".
 */
function sanitiseSegment(value: string): string {
  return value
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 60)
    .trim();
}

/** NFR-02: dates read dd-mm-yyyy. */
function stampToday(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export type StoredUpload = {
  fileId: string;
  storage_path: string;
};

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly uploadDir: string;

  constructor(
    config: ConfigService,
    @InjectRepository(File)
    private readonly files: Repository<File>,
  ) {
    const configured = config.get<string>('UPLOAD_DIR', './storage/uploads');

    // Resolved against the process root, never inside the served bundle
    // (FR-CUS-04-v2: "outside the web root").
    this.uploadDir = isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured);
  }

  /**
   * Validates size and magic bytes. Throws with the field name so the client
   * can show a field-level error (FR-CUS-06).
   */
  assertValidImage(field: string, file: Express.Multer.File): Signature {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `${field}: image must be ${MAX_UPLOAD_MB} MB or smaller`,
        field_errors: {
          [field]: `Image must be ${MAX_UPLOAD_MB} MB or smaller`,
        },
      });
    }

    const signature = SIGNATURES.find((candidate) =>
      candidate.matches(file.buffer),
    );

    if (!signature) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `${field}: only JPG, PNG and WebP images are accepted`,
        field_errors: {
          [field]: 'Only JPG, PNG and WebP images are accepted',
        },
      });
    }

    return signature;
  }

  /**
   * Writes the bytes as "<name> - <cnic> - <dd-mm-yyyy>.<ext>" inside the
   * subject's folder, and records the row inside the caller's transaction so a
   * later failure rolls it back; `discard()` removes the orphaned bytes.
   */
  async store(
    manager: EntityManager,
    target: UploadTarget,
    file: Express.Multer.File,
    uploaded_by: number,
  ): Promise<StoredUpload> {
    const signature = this.assertValidImage(target.field, file);

    const directory = join(this.uploadDir, target.folder);
    await mkdir(directory, { recursive: true });

    const { fileName, storage_path } = await this.writeUnique(
      manager,
      directory,
      this.baseName(target),
      signature.extension,
      file.buffer,
    );

    try {
      await manager.insert(File, {
        // The filename is the key, so cnic_file_id reads as the filename.
        id: fileName,
        original_name: file.originalname.slice(0, 255),
        mime: signature.mime,
        size_bytes: file.size,
        storage_path,
        uploaded_by,
      });

      return { fileId: fileName, storage_path };
    } catch (error) {
      // The bytes are on disk but the row failed, and this path was never
      // handed back to the caller, so its discard list will not cover it.
      await unlink(storage_path).catch(() => undefined);

      throw error;
    }
  }

  findById(id: string): Promise<File | null> {
    return this.files.findOne({ where: { id } });
  }

  /** Removes bytes written by a transaction that then failed. */
  async discard(uploads: StoredUpload[]): Promise<void> {
    await Promise.all(
      uploads.map((upload) =>
        unlink(upload.storage_path).catch(() => undefined),
      ),
    );
  }

  /**
   * FR-CUS-07: replaced files are deleted only after the transaction commits.
   * Failures are logged, never thrown — the customer save already succeeded.
   */
  async removeAfterCommit(fileIds: string[]): Promise<void> {
    for (const fileId of fileIds) {
      try {
        const record = await this.files.findOne({ where: { id: fileId } });

        if (!record) continue;

        await this.files.delete({ id: fileId });
        await unlink(record.storage_path).catch(() => undefined);
      } catch (error) {
        this.logger.warn(
          `Could not remove replaced file ${fileId}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }
  }

  private baseName(target: UploadTarget): string {
    const name = sanitiseSegment(target.personName) || 'unnamed';
    const cnic = sanitiseSegment(target.cnic_number) || 'no-cnic';
    const side = target.side ? ` ${target.side}` : '';

    return `${name} - ${cnic}${side} - ${stampToday(new Date())}`;
  }

  /**
   * Re-uploading the same person's scan on the same day would collide, so the
   * name gains a " (2)" suffix. Because the name is the primary key it has to
   * be free in every folder, not just this one, so both the table and the
   * directory are checked. The `wx` flag makes the write itself atomic.
   */
  private async writeUnique(
    manager: EntityManager,
    directory: string,
    base: string,
    extension: string,
    contents: Buffer,
  ): Promise<{ fileName: string; storage_path: string }> {
    for (let attempt = 1; attempt <= 50; attempt += 1) {
      const fileName =
        attempt === 1
          ? `${base}.${extension}`
          : `${base} (${attempt}).${extension}`;

      const taken = await manager.getRepository(File).existsBy({
        id: fileName,
      });

      if (taken) continue;

      const storage_path = join(directory, fileName);

      try {
        await writeFile(storage_path, contents, { flag: 'wx' });

        return { fileName, storage_path };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;

        if (code !== 'EEXIST') throw error;
      }
    }

    throw new Error(
      `Could not find a free filename for "${base}" after 50 attempts`,
    );
  }
}
