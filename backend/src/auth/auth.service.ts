import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { UserStatus } from '../common/enums';
import { RefreshToken, User } from '../database/entities';
import { UsersService } from '../users/users.service';
import type { AccessTokenPayload, AuthenticatedUser } from './auth.types';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';
import { LoginAttemptsService } from './login-attempts.service';
import { PasswordService } from './password.service';

export type AuthResult = {
  access_token: string;
  /** Access-token lifetime in seconds, for the client's refresh timer. */
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_at: Date;
  user: AuthenticatedUser;
};

const DURATION_UNITS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parses `15m` / `7d` style TTLs into milliseconds. */
function parseDurationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());

  if (!match) {
    throw new Error(
      `Invalid duration "${value}". Use a number followed by s, m, h or d.`,
    );
  }

  return Number(match[1]) * DURATION_UNITS[match[2]];
}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly accessTtl: string;
  private readonly refreshSecret: string;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly attempts: LoginAttemptsService,
    private readonly audit: AuditService,
  ) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.accessTtl = config.get<string>('JWT_ACCESS_TTL', '15m');
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.refreshTtlMs = parseDurationMs(
      config.get<string>('JWT_REFRESH_TTL', '7d'),
    );
  }

  /** FR-AUT-01, FR-AUT-04, FR-AUT-08 */
  async login(dto: LoginDto, ip?: string): Promise<AuthResult> {
    const lockoutMs = this.attempts.lockoutRemainingMs(dto.email);

    if (lockoutMs > 0) {
      await this.audit.record({
        entity: 'auth',
        action: 'login_locked_out',
        after: { email: dto.email },
        ip,
      });

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Too many failed login attempts. Try again in ${Math.ceil(
            lockoutMs / 60000,
          )} minute(s).`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.users.findByEmail(dto.email);
    const passwordMatches = user
      ? await this.passwords.verify(user.password_hash, dto.password)
      : false;

    if (!user || !passwordMatches) {
      this.attempts.recordFailure(dto.email);

      await this.audit.record({
        actor_id: user?.id ?? null,
        entity: 'auth',
        entity_id: user ? String(user.id) : null,
        action: 'login_failed',
        after: { email: dto.email },
        ip,
      });

      // Deliberately generic: never reveal whether the address exists.
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== UserStatus.active) {
      await this.audit.record({
        actor_id: user.id,
        entity: 'auth',
        entity_id: String(user.id),
        action: 'login_disabled_account',
        ip,
      });

      throw new UnauthorizedException('This account is disabled');
    }

    this.attempts.reset(dto.email);
    await this.users.markLoggedIn(user.id);

    const result = await this.issueTokens(user, randomUUID());

    await this.audit.record({
      actor_id: user.id,
      entity: 'auth',
      entity_id: String(user.id),
      action: 'login',
      ip,
    });

    return result;
  }

  /** FR-AUT-02: rotation, with family revocation on reuse of a spent token. */
  async refresh(
    rawToken: string | undefined,
    ip?: string,
  ): Promise<AuthResult> {
    if (!rawToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    const stored = await this.refreshTokens.findOne({
      where: { token_hash: this.hashToken(rawToken) },
      relations: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token is not valid');
    }

    if (stored.revoked_at) {
      // The token was already rotated: treat this as theft and kill the family.
      await this.refreshTokens.update(
        { family_id: stored.family_id, revoked_at: IsNull() },
        { revoked_at: new Date() },
      );

      await this.audit.record({
        actor_id: stored.user_id,
        entity: 'auth',
        entity_id: String(stored.user_id),
        action: 'refresh_reuse_detected',
        after: { family_id: stored.family_id },
        ip,
      });

      throw new UnauthorizedException(
        'Refresh token has already been used. Please sign in again.',
      );
    }

    if (stored.expires_at <= new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // `user` is a @DeleteDateColumn relation, so a soft-deleted account comes
    // back as null rather than as a row with deleted_at set.
    if (!stored.user || stored.user.status !== UserStatus.active) {
      throw new UnauthorizedException('This account is disabled');
    }

    const user = stored.user;

    const result = await this.dataSource.transaction(async (manager) => {
      await manager.update(
        RefreshToken,
        { id: stored.id },
        { revoked_at: new Date() },
      );

      return this.issueTokens(user, stored.family_id, manager);
    });

    await this.audit.record({
      actor_id: stored.user_id,
      entity: 'auth',
      entity_id: String(stored.user_id),
      action: 'refresh',
      ip,
    });

    return result;
  }

  /** FR-AUT-03 */
  async logout(rawToken: string | undefined, ip?: string): Promise<void> {
    if (!rawToken) return;

    const stored = await this.refreshTokens.findOne({
      where: { token_hash: this.hashToken(rawToken) },
    });

    if (!stored || stored.revoked_at) return;

    await this.refreshTokens.update(
      { id: stored.id },
      { revoked_at: new Date() },
    );

    await this.audit.record({
      actor_id: stored.user_id,
      entity: 'auth',
      entity_id: String(stored.user_id),
      action: 'logout',
      ip,
    });
  }

  /** FR-AUT-07 */
  async changePassword(
    user_id: number,
    dto: ChangePasswordDto,
    ip?: string,
  ): Promise<void> {
    const user = await this.users.findById(user_id);

    if (!user) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    const matches = await this.passwords.verify(
      user.password_hash,
      dto.current_password,
    );

    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.users.updatePasswordHash(
      user.id,
      await this.passwords.hash(dto.new_password),
    );

    // Every existing session is invalidated: a password change should log out
    // any device the old password reached.
    await this.revokeAllForUser(user.id);

    await this.audit.record({
      actor_id: user.id,
      entity: 'user',
      entity_id: String(user.id),
      action: 'password_changed',
      ip,
    });
  }

  /** Used by password changes now, and by user disable in Module 9 (FR-AUT-08). */
  async revokeAllForUser(user_id: number): Promise<void> {
    await this.refreshTokens.update(
      { user_id, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );
  }

  private async issueTokens(
    user: User,
    family_id: string,
    manager?: EntityManager,
  ): Promise<AuthResult> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const expires_in = Math.floor(parseDurationMs(this.accessTtl) / 1000);

    const access_token = await this.jwt.signAsync(payload, {
      secret: this.accessSecret,
      // `expiresIn` is @nestjs/jwt's own option name, not one of ours.
      expiresIn: expires_in,
    });

    const refresh_token = randomBytes(48).toString('base64url');
    const expires_at = new Date(Date.now() + this.refreshTtlMs);

    const repository = manager
      ? manager.getRepository(RefreshToken)
      : this.refreshTokens;

    await repository.insert({
      user_id: user.id,
      token_hash: this.hashToken(refresh_token),
      family_id,
      expires_at,
    });

    return {
      access_token,
      expires_in,
      refresh_token,
      refresh_token_expires_at: expires_at,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Refresh tokens are 48 random bytes, so a keyed digest is enough — there is
   * no low-entropy secret to brute-force, and unlike a salted Argon2 hash it can
   * be looked up by equality. The HMAC key means a leaked table alone is not
   * enough to match a captured token.
   */
  private hashToken(rawToken: string): string {
    return createHmac('sha256', this.refreshSecret)
      .update(rawToken)
      .digest('hex');
  }
}
