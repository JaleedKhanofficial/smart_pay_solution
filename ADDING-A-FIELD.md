# Adding a field, database to screen

A field passes through seven layers. Do them in this order — each one depends on
the one before, and the compiler catches most mistakes if you go top to bottom.

Part 1 is the recipe for any field. Part 2 walks a real one: **a CNIC back
image**, which is the hardest kind because it is a file rather than a value.

---

## Part 1 — the seven layers

| # | Layer | File | What you add |
|---|---|---|---|
| 1 | Entity | `backend/src/database/entities/<name>.entity.ts` | the column |
| 2 | Migration | `backend/src/database/migrations/<ts>-<Name>.ts` | the DDL, **plus register it** |
| 3 | DTO | `backend/src/<module>/dto/create-*.dto.ts` | validation |
| 4 | Service | `backend/src/<module>/<module>.service.ts` | copy it through create and update |
| 5 | Mapper | `backend/src/<module>/<name>.mapper.ts` | the API contract |
| 6 | Frontend type | `frontendapp/src/types/<name>.ts` | mirror the mapper |
| 7 | Form + list | `<module>/…-form.tsx`, `…-manager.tsx`, `actions.ts` | the input and the column |

Optional eighth: **filter or sort** on it — `<module>/<name>.query.ts` plus the
whitelist in `dto/list-*.dto.ts`.

### 1. Entity

```ts
@Column({ type: 'varchar', length: 60, nullable: true })
reference_no: string | null;
```

The rules that matter (SRS §2.8):

- **The property name is the column name.** `full_name`, not `fullName`. No
  `name:` option — TypeORM derives the column from the property, and a second
  spelling is a second thing to keep in sync.
- **Money is `decimal(12,2)` and typed `string`.** Never `number`; `pg` returns
  it as a string and that is what keeps it exact.
- **A new column on a table with rows must be `nullable: true`** or carry a
  default. Existing rows have no value for it.
- Dates are `timestamptz`. Relations stay camelCase — they are objects, not
  columns.

### 2. Migration

Copy the newest file in `migrations/` for the shape. Two things bite here:

**Pin the schema.** TypeORM does *not* set `search_path`, so unqualified SQL
resolves against the role's default and can hit the wrong table entirely:

```ts
const schema = queryRunner.connection.driver.schema ?? 'public';
await queryRunner.query(`SET LOCAL search_path TO "${schema}"`);
```

**Register it.** `migrations` in `src/database/data-source.ts` is an explicit
array, not a glob. A migration missing from it silently never runs:

```ts
migrations: [Baseline1755500000000, IntegerIds1755600000000, YourNew1755700000000],
```

Then `npm run migration:show` to confirm it is pending, and `npm run migration:run`.

### 3. DTO

```ts
@ApiPropertyOptional({ example: 'REF-2026-001' })
@Transform(trim)
@IsOptional()
@IsString()
@Length(2, 60)
reference_no?: string;
```

`UpdateXDto extends PartialType(CreateXDto)`, so **the edit form needs nothing** —
it inherits the field automatically.

### 4. Service

Both write paths, or the field saves on create and silently ignores on edit:

```ts
// create
const customer = manager.create(Customer, { …, reference_no: body.reference_no });

// update — `undefined` is skipped by TypeORM, which is what makes PATCH partial
await manager.update(Customer, { id }, { …, reference_no: dto.reference_no });
```

### 5. Mapper

This is the API contract, so nothing reaches the frontend until it is here:

```ts
export type CustomerResponse = { …; reference_no: string | null };

return { …, reference_no: customer.reference_no };
```

It doubles as the audit snapshot, so the field shows up in the audit log for free.

### 6. Frontend type

Mirror the mapper exactly, in `frontendapp/src/types/`. Get this right and
TypeScript points at every screen that needs updating.

### 7. Form and list

- **Form:** a `TextField` / `SelectField` / `ImageField` from
  `components/form-fields.tsx`. Use `initial("reference_no", customer?.reference_no)`
  so a rejected save re-seeds what was typed.
- **Action:** add the name to `SCALAR_FIELDS` in `actions.ts`, or it is dropped
  on the way to the API *and* lost when a save is rejected.
- **List:** a `<td>` in the table **and** a `<dd>` in the card — the two render
  the same record and must not drift (NFR-12.1). If you add a `<th>`, update the
  `colSpan` on the empty-state row.

### Verify

```bash
cd backend     && npx tsc --noEmit -p tsconfig.build.json && npm run build
cd frontendapp && npx tsc --noEmit && npx eslint src
```

Then exercise it for real. **Restart the API** — `start:prod` never reloads, so
use `npm run start:dev`; a stale server is the single most common "my change did
nothing" in this project.

---

## Part 2 — worked example: CNIC back image

A value field stops at step 7. A **file** field also touches the upload
pipeline, so this is the long version. It applies to the customer and to both
guarantors — each is a person with a CNIC that has two sides.

### Decide the filename first

This is the one that will bite you. `FilesService.baseName()` builds:

```
<person> - <cnic> - <dd-mm-yyyy>.<ext>
```

Front and back would produce the **same name**, so the back image lands as
`… (2).png` and nobody can tell which side it is. Fix that before anything else:

```ts
// files.service.ts
export type UploadTarget = {
  field: string;
  folder: UploadFolder;
  personName: string;
  cnic_number: string;
  side?: 'front' | 'back';   // ← add
};

private baseName(target: UploadTarget): string {
  const name = sanitiseSegment(target.personName) || 'unnamed';
  const cnic = sanitiseSegment(target.cnic_number) || 'no-cnic';
  const side = target.side ? ` ${target.side}` : '';

  return `${name} - ${cnic}${side} - ${stampToday(new Date())}`;
}
```

`side` is optional, so every existing call still compiles and a guarantor — who
has a single scan — stays unmarked:

```
Ali Raza - 35201-1234567-1 front - 21-08-2026.png
Ali Raza - 35201-1234567-1 back - 21-08-2026.png
Bilal Ahmed - 35201-7654321-9 - 21-08-2026.png      guarantor, no side
```

Adding it to `UploadTarget` is not enough on its own: `store()` in
`customer-uploads.service.ts` has to take a `side` parameter and forward it, or
nothing ever sets it and both files still collide.

### 1–2. Column and migration

```sql
ALTER TABLE "customers"  ADD COLUMN IF NOT EXISTS "cnic_file_back_id" TEXT;
ALTER TABLE "guarantors" ADD COLUMN IF NOT EXISTS "cnic_file_back_id" TEXT;

ALTER TABLE "customers" ADD CONSTRAINT "customers_cnic_file_back_id_fkey"
  FOREIGN KEY ("cnic_file_back_id") REFERENCES "files"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
-- and the same for guarantors
```

In the entities, the scalar **and** a relation with its own name:

```ts
@Column({ type: 'text', nullable: true })
cnic_file_back_id: string | null;

@ManyToOne(() => File, (file) => file.customerBacks, { nullable: true, onDelete: 'RESTRICT' })
@JoinColumn({ name: 'cnic_file_back_id' })   // ← relations DO keep `name`
cnicBackFile: Relation<File> | null;
```

The inverse side (`customerBacks`) goes on `file.entity.ts`. Two relations on
one entity cannot share a property name.

### 3. Upload field names

Three new ones, in three places:

```ts
// customer-uploads.service.ts
export type CustomerUploads = {
  customer_cnic?: Express.Multer.File;
  customer_cnic_back?: Express.Multer.File;      // ← new
  guarantor1_cnic?: Express.Multer.File;
  guarantor1_cnic_back?: Express.Multer.File;    // ← new
  guarantor2_cnic?: Express.Multer.File;
  guarantor2_cnic_back?: Express.Multer.File;    // ← new
};

const UPLOAD_FIELDS = [ …, 'customer_cnic_back', 'guarantor1_cnic_back', 'guarantor2_cnic_back' ] as const;
```

```ts
// customers.controller.ts
const UPLOAD_FIELDS = [ …, { name: 'customer_cnic_back', maxCount: 1 }, … ];
```

The multipart `files:` limit is `UPLOAD_FIELDS.length`, so **that updates
itself** — one fewer thing to forget.

### 4. Carry the ids through

```ts
export type ResolvedFiles = {
  customerFileId: string | null;
  customerBackFileId: string | null;              // ← new
  guarantorFileIds: Map<number, string | null>;
  guarantorBackFileIds: Map<number, string | null>;   // ← new
};
```

In `forCreate`, store the back image the same way as the front. In `forUpdate`,
the rule from FR-CUS-07 applies to it independently: an omitted back image keeps
the existing one, and a replacement pushes the old id onto `ledger.replaced` so
it is deleted **after** the transaction commits — never before.

Then write both ids in `CustomersService.create`, `update`, and `guarantorFields`.

### 5–7. Out to the screen

```ts
// customer.mapper.ts, then types/customer.ts to match
cnic_file_back_id: customer.cnic_file_back_id,
```

```tsx
// customer-form.tsx — beside the existing one
<ImageField label="CNIC (front)" name="customer_cnic"      existingFileId={customer?.cnic_file_id} />
<ImageField label="CNIC (back)"  name="customer_cnic_back" existingFileId={customer?.cnic_file_back_id} />
```

For the guarantors these are template names — `` `guarantor${position}_cnic_back` `` —
so **grep for the literal before you finish**. A dynamically built field name is
invisible to the compiler, and a mismatch between the form and
`UPLOAD_FIELDS` in `actions.ts` drops the image with no error at all. That
exact bug has already happened here once.

### 8. One list, not four

Image field names used to be restated in four places — the multipart
interceptor, the map narrowing multer's output, the validator, and the removal
whitelist — and a name present in one but missing from another lost the upload
**silently**: no error, no log, no file. That bug landed twice.

They now all derive from `customers/customer-uploads.fields.ts`:

```ts
export const CUSTOMER_UPLOAD_FIELDS = [
  'customer_cnic_front', 'customer_cnic_back',
  'guarantor1_cnic_front', 'guarantor1_cnic_back',
  'guarantor2_cnic_front', 'guarantor2_cnic_back',
] as const;
```

Adding an image on the API side is **one line here**. The type
(`CustomerUploads`), the interceptor, `toUploads()`, `validateAll` and the
`remove_images` whitelist all follow.

The frontend is a separate project and still keeps its own `UPLOAD_FIELDS` in
`actions.ts` — a file input whose name is not listed there never leaves the
browser. That is the one list left to remember.

`cnic_image=with|without` in `list-customers.dto.ts` tests one column. With two
sides, choose deliberately — front only, either, or both — and say which in the
filter label. As built it tests the **front**.

### Verify

Beyond the type checks: create a customer with all six images and confirm the
filenames on disk read ` front ` and ` back `; then edit, replacing only the
back one, and confirm the front survives and the old back file is gone from both
`sps.files` and `storage/uploads/`.

---

## Where the rules live

- **SRS §2.8** — persistence rules (entities, migrations, soft delete, money)
- **SRS §8.2 / §8.3** — list-screen conventions and the component system
- **`frontendapp/STYLING.md`** — which component owns which control
- **`backend/README.md`** — the two gotchas worth knowing before writing a query
