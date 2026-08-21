import 'reflect-metadata';
import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { Role, UserStatus } from '../common/enums';
import dataSource from './data-source';
import { User } from './entities';

// See PasswordService: `Algorithm` is an ambient const enum, which cannot be
// referenced under isolatedModules. 2 is Argon2id.
const ARGON2ID = 2;

/** Creates the first admin (FR-USR-02-v2). Never overwrites an existing one. */
async function seed(): Promise<void> {
  await dataSource.initialize();

  try {
    const users = dataSource.getRepository(User);

    const email = (
      process.env.SEED_ADMIN_EMAIL ?? 'admin@smartpay.local'
    ).toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
    const name = process.env.SEED_ADMIN_NAME ?? 'Administrator';

    if (password.length < 10) {
      throw new Error('SEED_ADMIN_PASSWORD must be at least 10 characters.');
    }

    // withDeleted, so a soft-deleted admin is not silently duplicated.
    const existing = await users.findOne({
      where: { email },
      withDeleted: true,
    });

    if (existing) {
      console.log(`Admin ${email} already exists — password left unchanged.`);

      return;
    }

    await users.save(
      users.create({
        name,
        email,
        passwordHash: await hash(password, { algorithm: ARGON2ID }),
        role: Role.admin,
        status: UserStatus.active,
      }),
    );

    console.log(`Created admin ${email}.`);
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
