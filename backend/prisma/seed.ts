import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, UserStatus } from '@prisma/client';

// See PasswordService: `Algorithm` is an ambient const enum. 2 is Argon2id.
const ARGON2ID = 2;

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: url },
    { schema: new URL(url).searchParams.get('schema') ?? 'public' },
  ),
});

/** Defaults for FR-SET-01; every one is editable under Settings once built. */
const DEFAULT_SETTINGS: Array<{ key: string; value: unknown }> = [
  { key: 'plan_months_min', value: 1 },
  { key: 'plan_months_max', value: 20 },
  { key: 'allow_overpayment', value: false },
  { key: 'recycle_bin_retention_days', value: null },
  {
    key: 'business_identity',
    value: {
      name: 'SmartPay Solutions',
      tagline: 'Easy Monthly Installments',
      address: '',
      phone: '',
    },
  },
  {
    // BR-06-v2 punctuality bands, in days after the due date.
    key: 'punctuality_bands',
    value: [
      { maxDays: 4, label: 'Early — Excellent' },
      { maxDays: 9, label: 'On Time' },
      { maxDays: 14, label: 'Slight Delay' },
      { maxDays: 19, label: 'Late' },
      { maxDays: 24, label: 'Very Late' },
      { maxDays: null, label: 'Overdue' },
    ],
  },
  {
    // BR-07 loyalty tiers.
    key: 'loyalty_tiers',
    value: {
      platinum: { reductionPct: 5 },
      gold: { reductionPct: 3, minWithinBand9Pct: 80 },
      silver: { reductionPct: 1, maxAt15PlusPct: 50 },
      caution: { reductionPct: 0 },
    },
  },
];

async function main(): Promise<void> {
  const email = (
    process.env.SEED_ADMIN_EMAIL ?? 'admin@smartpay.local'
  ).toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const name = process.env.SEED_ADMIN_NAME ?? 'Administrator';

  if (password.length < 10) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 10 characters');
  }

  const existing = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });

  if (existing) {
    console.log(`Admin ${email} already exists — password left unchanged.`);
  } else {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hash(password, { algorithm: ARGON2ID }),
        role: Role.admin,
        status: UserStatus.active,
      },
    });

    console.log(`Created admin ${email}.`);
  }

  const misc = await prisma.productCategory.findUnique({
    where: { name: 'misc' },
  });

  if (!misc) {
    await prisma.productCategory.create({ data: { name: 'misc' } });
    console.log('Created default product category "misc".');
  }

  for (const setting of DEFAULT_SETTINGS) {
    const current = await prisma.setting.findUnique({
      where: { key: setting.key },
    });

    if (!current) {
      await prisma.setting.create({
        data: { key: setting.key, value: setting.value as never },
      });
    }
  }

  console.log(`Settings ensured: ${DEFAULT_SETTINGS.length} keys.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
