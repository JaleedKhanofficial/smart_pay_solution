import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { Customer } from '../database/entities';
import {
  FilesService,
  UPLOAD_FOLDERS,
  type StoredUpload,
  type UploadFolder,
} from '../files/files.service';
import {
  CUSTOMER_UPLOAD_FIELDS,
  type CustomerUploadField,
} from './customer-uploads.fields';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

/**
 * The optional CNIC images a customer save may carry (FR-CUS-04-v2): both sides
 * for the customer and for each guarantor. Derived from the field list so the
 * names are stated once.
 */
export type CustomerUploads = Partial<
  Record<CustomerUploadField, Express.Multer.File>
>;

/**
 * What one save wrote, so the caller can undo it. `written` is deleted if the
 * transaction fails; `replaced` is deleted only once it commits (FR-CUS-07).
 */
export type UploadLedger = {
  written: StoredUpload[];
  replaced: string[];
};

/** Both sides of one person's CNIC. */
export type SidePair = {
  front: string | null;
  back: string | null;
};

export type ResolvedFiles = {
  customerFrontFileId: string | null;
  customerBackFileId: string | null;
  /** Keyed by guarantor position. */
  guarantorFileIds: Map<number, SidePair>;
};

const GUARANTOR_POSITIONS = [1, 2];

export const SIDES = ['front', 'back'] as const;
export type Side = (typeof SIDES)[number];

function uploadFieldFor(position: number, side: Side): keyof CustomerUploads {
  return `guarantor${position === 1 ? 1 : 2}_cnic_${side}` as keyof CustomerUploads;
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
    for (const field of CUSTOMER_UPLOAD_FIELDS) {
      const upload = uploads[field];

      if (upload) this.files.assertValidImage(field, upload);
    }
  }

  async forCreate(
    manager: EntityManager,
    dto: CreateCustomerDto,
    uploads: CustomerUploads,
    ledger: UploadLedger,
    actor_id: number,
  ): Promise<ResolvedFiles> {
    const customerFrontFileId = await this.store(
      manager,
      ledger,
      actor_id,
      uploads.customer_cnic_front,
      'customer_cnic_front',
      UPLOAD_FOLDERS.customer,
      dto.full_name,
      dto.cnic_number,
      'front',
    );

    const customerBackFileId = await this.store(
      manager,
      ledger,
      actor_id,
      uploads.customer_cnic_back,
      'customer_cnic_back',
      UPLOAD_FOLDERS.customer,
      dto.full_name,
      dto.cnic_number,
      'back',
    );

    const guarantorFileIds = new Map<number, SidePair>();

    for (const guarantor of dto.guarantors) {
      const pair: SidePair = { front: null, back: null };

      for (const side of SIDES) {
        const field = uploadFieldFor(guarantor.position, side);

        pair[side] = await this.store(
          manager,
          ledger,
          actor_id,
          uploads[field],
          field,
          folderFor(guarantor.position),
          guarantor.full_name,
          guarantor.cnic_number,
          side,
        );
      }

      guarantorFileIds.set(guarantor.position, pair);
    }

    return { customerFrontFileId, customerBackFileId, guarantorFileIds };
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
    actor_id: number,
  ): Promise<ResolvedFiles> {
    // An omitted image still means "keep" (FR-CUS-07), so clearing one has to
    // be asked for by name — otherwise every edit that skipped the picker
    // would wipe the scans.
    const removals = new Set<CustomerUploadField>(dto.remove_images ?? []);

    let customerFrontFileId = before.cnic_file_front_id;

    if (uploads.customer_cnic_front) {
      if (before.cnic_file_front_id)
        ledger.replaced.push(before.cnic_file_front_id);

      customerFrontFileId = await this.store(
        manager,
        ledger,
        actor_id,
        uploads.customer_cnic_front,
        'customer_cnic_front',
        UPLOAD_FOLDERS.customer,
        // Falls back to the stored values when the edit only swaps the image.
        dto.full_name ?? before.full_name,
        dto.cnic_number ?? before.cnic_number,
        'front',
      );
    } else if (removals.has('customer_cnic_front') && customerFrontFileId) {
      ledger.replaced.push(customerFrontFileId);
      customerFrontFileId = null;
    }

    let customerBackFileId = before.cnic_file_back_id;

    if (uploads.customer_cnic_back) {
      if (before.cnic_file_back_id)
        ledger.replaced.push(before.cnic_file_back_id);

      customerBackFileId = await this.store(
        manager,
        ledger,
        actor_id,
        uploads.customer_cnic_back,
        'customer_cnic_back',
        UPLOAD_FOLDERS.customer,
        // Falls back to the stored values when the edit only swaps the image.
        dto.full_name ?? before.full_name,
        dto.cnic_number ?? before.cnic_number,
        'back',
      );
    } else if (removals.has('customer_cnic_back') && customerBackFileId) {
      ledger.replaced.push(customerBackFileId);
      customerBackFileId = null;
    }

    const guarantorFileIds = new Map<number, SidePair>();

    for (const position of GUARANTOR_POSITIONS) {
      const existing = before.guarantors.find(
        (row) => row.position === position,
      );
      const submitted = dto.guarantors?.find(
        (row) => row.position === position,
      );

      // Nothing to say about a position that is neither on file nor submitted.
      if (!existing && !submitted) continue;

      const stored: SidePair = {
        front: existing?.cnic_file_front_id ?? null,
        back: existing?.cnic_file_back_id ?? null,
      };

      const pair: SidePair = { front: stored.front, back: stored.back };

      for (const side of SIDES) {
        const field = uploadFieldFor(position, side);
        const upload = uploads[field];

        if (upload) {
          if (stored[side]) ledger.replaced.push(stored[side]);

          pair[side] = await this.store(
            manager,
            ledger,
            actor_id,
            upload,
            field,
            folderFor(position),
            submitted?.full_name ?? existing?.full_name ?? '',
            submitted?.cnic_number ?? existing?.cnic_number ?? '',
            side,
          );
        } else if (removals.has(field) && stored[side]) {
          ledger.replaced.push(stored[side]);
          pair[side] = null;
        }
      }

      guarantorFileIds.set(position, pair);
    }

    return { customerFrontFileId, customerBackFileId, guarantorFileIds };
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
    actor_id: number,
    upload: Express.Multer.File | undefined,
    field: string,
    folder: UploadFolder,
    personName: string,
    cnic_number: string,
    /**
     * Passed for a person who has more than one scan, so the two files are
     * told apart on disk. Guarantors have a single image and stay unmarked.
     */
    side?: 'front' | 'back',
  ): Promise<string | null> {
    if (!upload) return null;

    const stored = await this.files.store(
      manager,
      { field, folder, personName, cnic_number, side },
      upload,
      actor_id,
    );

    ledger.written.push(stored);

    return stored.fileId;
  }
}
