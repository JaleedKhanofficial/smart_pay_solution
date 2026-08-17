import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 7 takes its connection through a driver adapter rather than a `url`
 * in schema.prisma, so the pool is built here from DATABASE_URL. The `schema`
 * option sets the search_path to `sps` (SRS §2.2).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('DATABASE_URL');
    const schema = new URL(url).searchParams.get('schema') ?? 'public';

    super({
      adapter: new PrismaPg({ connectionString: url }, { schema }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
