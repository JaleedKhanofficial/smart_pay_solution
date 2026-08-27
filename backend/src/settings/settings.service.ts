import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Setting } from '../database/entities';
import {
  SETTING_DEFINITIONS,
  SETTING_KEYS,
  type SettingKey,
  type SettingValues,
} from './settings.registry';

/** One key as the admin screen renders it. */
export type SettingResponse = {
  key: SettingKey;
  group: string;
  label: string;
  description: string;
  value: unknown;
  default: unknown;
  /** False while no module reads it yet — the screen says so. */
  in_effect: boolean;
  /** Null while the row has never been written and the default is in force. */
  updated_at: string | null;
};

/** Module 12 (SRS §4.12): business rules that change without a redeploy. */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(Setting)
    private readonly settings: Repository<Setting>,
    private readonly audit: AuditService,
  ) {}

  /**
   * FR-SET-01. The typed reader every other module uses.
   *
   * A stored value that no longer parses falls back to the default and is
   * logged rather than thrown: a malformed row must not take the invoice or
   * the payment screen down with it, and the admin can see and fix it.
   */
  async get<K extends SettingKey>(key: K): Promise<SettingValues[K]> {
    const row = await this.settings.findOne({ where: { key } });

    return this.coerce(key, row?.value);
  }

  /** Several keys in one round trip, for a caller that needs a pair. */
  async getMany<K extends SettingKey>(
    keys: readonly K[],
  ): Promise<{ [P in K]: SettingValues[P] }> {
    const rows = await this.settings.find();
    const stored = new Map(rows.map((row) => [row.key, row.value]));

    const result = {} as { [P in K]: SettingValues[P] };

    for (const key of keys) {
      result[key] = this.coerce(key, stored.get(key));
    }

    return result;
  }

  /** FR-SET-01. Everything, defaults filled in, for the admin screen. */
  async findAll(): Promise<SettingResponse[]> {
    const rows = await this.settings.find();
    const stored = new Map(rows.map((row) => [row.key, row]));

    return SETTING_KEYS.map((key) => {
      const definition = SETTING_DEFINITIONS[key];
      const row = stored.get(key);

      return {
        key,
        group: definition.group,
        label: definition.label,
        description: definition.description,
        value: this.coerce(key, row?.value),
        default: definition.default,
        in_effect: definition.in_effect,
        updated_at: row?.updated_at.toISOString() ?? null,
      };
    });
  }

  /**
   * FR-SET-02. A partial update: only the keys sent are touched, each one
   * validated against the registry before anything is written. An unknown key
   * is a 400 rather than a silently ignored field — a typo in a key name would
   * otherwise look like a successful save that changed nothing.
   *
   * Audit-logged with the before and after of each key that actually moved.
   */
  async patch(
    changes: Record<string, unknown>,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<SettingResponse[]> {
    const entries = Object.entries(changes);

    if (entries.length === 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'No settings were sent',
      });
    }

    const field_errors: Record<string, string> = {};
    const parsed: { key: SettingKey; value: unknown }[] = [];

    for (const [key, value] of entries) {
      if (!this.isKnown(key)) {
        field_errors[key] = 'Not a setting this system has';
        continue;
      }

      try {
        parsed.push({ key, value: SETTING_DEFINITIONS[key].parse(value) });
      } catch (error) {
        field_errors[key] =
          error instanceof Error ? error.message : 'Not a valid value';
      }
    }

    // Nothing is written unless every key is good: a half-applied settings
    // save leaves the business rules in a state nobody chose.
    if (Object.keys(field_errors).length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Some settings could not be saved',
        field_errors,
      });
    }

    const before = await this.findAll();
    const beforeByKey = new Map(
      before.map((entry) => [entry.key, entry.value]),
    );

    for (const { key, value } of parsed) {
      await this.settings.save(
        // create + save rather than upsert: `key` is the primary key, so this
        // inserts the first time and updates thereafter, and @UpdateDateColumn
        // stamps it either way.
        this.settings.create({ key, value }),
      );
    }

    const after = await this.findAll();

    const moved = parsed.filter(
      ({ key, value }) =>
        JSON.stringify(beforeByKey.get(key)) !== JSON.stringify(value),
    );

    if (moved.length > 0) {
      await this.audit.record({
        actor_id: actor.id,
        entity: 'setting',
        entity_id: moved.map((entry) => entry.key).join(','),
        action: 'update',
        before: Object.fromEntries(
          moved.map(({ key }) => [key, beforeByKey.get(key)]),
        ),
        after: Object.fromEntries(moved.map(({ key, value }) => [key, value])),
        ip,
      });
    }

    return after;
  }

  private isKnown(key: string): key is SettingKey {
    return key in SETTING_DEFINITIONS;
  }

  private coerce<K extends SettingKey>(
    key: K,
    stored: unknown,
  ): SettingValues[K] {
    const definition = SETTING_DEFINITIONS[key];

    if (stored === undefined || stored === null) {
      return definition.default;
    }

    try {
      return definition.parse(stored);
    } catch (error) {
      this.logger.warn(
        `Setting "${key}" holds a value that no longer parses (${
          error instanceof Error ? error.message : 'unknown reason'
        }); using the default until it is corrected.`,
      );

      return definition.default;
    }
  }
}
