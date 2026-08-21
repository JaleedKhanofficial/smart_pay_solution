import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { Customer } from '../database/entities';
import {
  FilesService,
  UPLOAD_FOLDERS,
  type StoredUpload,
  type UploadFolder,
} from '../files/files.service';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

/** The three optional CNIC images a customer save may carry (FR-CUS-04-v2). */
export type CustomerUploads = {
  customerCnic?: Express.Multer.File;
  guarantor1Cnic?: Express.Multer.File;
  guarantor2Cnic?: Express.Multer.File;
};

/**
 * What one save wrote, so the caller can undo it. `written` is deleted if the
 * transaction fails; `replaced` is deleted only once it commits (FR-CUS-07).
 */
export type UploadLedger = {
  written: StoredUpload[];
  replaced: string[];
};

export type ResolvedFiles = {
  customerFileId: string | null;
  /** Keyed by guarantor position. */
  guarantorFileIds: Map<number, string | null>;
};

const UPLOAD_FIELDS = [
  'customerCnic',
  'guarantor1Cnic',
  'guarantor2Cnic',
] as const;

const GUARANTOR_POSITIONS = [1, 2];

function uploadFieldFor(position: number): keyof CustomerUploads {
  return position === 1 ? 'guarantor1Cnic' : 'guarantor2Cnic';
}

function folderFor(position: number): UploadFolder {
  return position === 1 ? UPLOAD_FOLDERS.guarantor1 : UPLOAD_FOLDERS.guarantor2;
}

/**
 * Owns everything about the three CNIC scans attached to a customer: which
 * folder each belongs in, what it is named after, and what happens to the old
 * image when one is replaced. CustomersService is left to deal with the record.
 */
@Injectable()
export class CustomerUploadsService {
  constructor(private readonly files: FilesService) {}

  newLedger(): UploadLedger {
    return { written: [], replaced: [] };
  }

  /**
   * FR-CUS-06: every image is checked before anything is written, so a bad
   * third upload cannot leave the first two on disk.
   */
  validateAll(uploads: CustomerUploads): void {
    for (const field of UPLOAD_FIELDS) {
      const upload = uploads[field];

      if (upload) this.files.assertValidImage(field, upload);
    }
  }

  async forCreate(
    manager: EntityManager,
    dto: CreateCustomerDto,
    uploads: CustomerUploads,
    ledger: UploadLedger,
    actorId: string,
  ): Promise<ResolvedFiles> {
    const customerFileId = await this.store(
      manager,
      ledger,
      actorId,
      uploads.customerCnic,
      'customerCnic',
      UPLOAD_FOLDERS.customer,
      dto.fullName,
      dto.cnicNumber,
    );

    const guarantorFileIds = new Map<number, string | null>();

    for (const guarantor of dto.guarantors) {
      const field = uploadFieldFor(guarantor.position);

      guarantorFileIds.set(
        guarantor.position,
        await this.store(
          manager,
          ledger,
          actorId,
          uploads[field],
          field,
          folderFor(guarantor.position),
          guarantor.fullName,
          guarantor.cnicNumber,
        ),
      );
    }

    return { customerFileId, guarantorFileIds };
  }

  /**
   * FR-CUS-07: an omitted image keeps the existing file; a replacement records
   * the old one on the ledger for deletion once the transaction commits.
   */
  async forUpdate(
    manager: EntityManager,
    before: Customer,
    dto: UpdateCustomerDto,
    uploads: CustomerUploads,
    ledger: UploadLedger,
    actorId: string,
  ): Promise<ResolvedFiles> {
    let customerFileId = before.cnicFileId;

    if (uploads.customerCnic) {
      if (before.cnicFileId) ledger.replaced.push(before.cnicFileId);

      customerFileId = await this.store(
        manager,
        ledger,
        actorId,
        uploads.customerCnic,
        'customerCnic',
        UPLOAD_FOLDERS.customer,
        // Falls back to the stored values when the edit only swaps the image.
        dto.fullName ?? before.fullName,
        dto.cnicNumber ?? before.cnicNumber,
      );
    }

    const guarantorFileIds = new Map<number, string | null>();

    for (const position of GUARANTOR_POSITIONS) {
      const field = uploadFieldFor(position);
      const upload = uploads[field];
      const existing = before.guarantors.find(
        (row) => row.position === position,
      );
      const submitted = dto.guarantors?.find(
        (row) => row.position === position,
      );

      // Nothing to say about a position that is neither on file nor submitted.
      if (!existing && !submitted) continue;

      if (!upload) {
        guarantorFileIds.set(position, existing?.cnicFileId ?? null);

        continue;
      }

      if (existing?.cnicFileId) ledger.replaced.push(existing.cnicFileId);

      guarantorFileIds.set(
        position,
        await this.store(
          manager,
          ledger,
          actorId,
          upload,
          field,
          folderFor(position),
          submitted?.fullName ?? existing?.fullName ?? '',
          submitted?.cnicNumber ?? existing?.cnicNumber ?? '',
        ),
      );
    }

    return { customerFileId, guarantorFileIds };
  }

  /** Removes bytes written by a transaction that then failed. */
  discard(ledger: UploadLedger): Promise<void> {
    return this.files.discard(ledger.written);
  }

  /** Removes images that a committed edit superseded. */
  removeReplaced(ledger: UploadLedger): Promise<void> {
    return this.files.removeAfterCommit(ledger.replaced);
  }

  private async store(
    manager: EntityManager,
    ledger: UploadLedger,
    actorId: string,
    upload: Express.Multer.File | undefined,
    field: string,
    folder: UploadFolder,
    personName: string,
    cnicNumber: string,
  ): Promise<string | null> {
    if (!upload) return null;

    const stored = await this.files.store(
      manager,
      { field, folder, personName, cnicNumber },
      upload,
      actorId,
    );

    ledger.written.push(stored);

    return stored.fileId;
  }
}
