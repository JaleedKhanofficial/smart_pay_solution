import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus, type User } from '@prisma/client';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { AccessTokenPayload, AuthenticatedUser } from './auth.types';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';
import { LoginAttemptsService } from './login-attempts.service';
import { PasswordService } from './password.service';

export type AuthResult = {
  accessToken: string;
  /** Access-token lifetime in seconds, for the client's refresh timer. */
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
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
    private readonly prisma: PrismaService,
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
      ? await this.passwords.verify(user.passwordHash, dto.password)
      : false;

    if (!user || !passwordMatches) {
      this.attempts.recordFailure(dto.email);

      await this.audit.record({
        actorId: user?.id ?? null,
        entity: 'auth',
        entityId: user?.id ?? null,
        action: 'login_failed',
        after: { email: dto.email },
        ip,
      });

      // Deliberately generic: never reveal whether the address exists.
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== UserStatus.active) {
      await this.audit.record({
        actorId: user.id,
        entity: 'auth',
        entityId: user.id,
        action: 'login_disabled_account',
        ip,
      });

      throw new UnauthorizedException('This account is disabled');
    }

    this.attempts.reset(dto.email);
    await this.users.markLoggedIn(user.id);

    const result = await this.issueTokens(user, randomUUID());

    await this.audit.record({
      actorId: user.id,
      entity: 'auth',
      entityId: user.id,
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

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token is not valid');
    }

    if (stored.revokedAt) {
      // The token was already rotated: treat this as theft and kill the family.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.audit.record({
        actorId: stored.userId,
        entity: 'auth',
        entityId: stored.userId,
        action: 'refresh_reuse_detected',
        after: { familyId: stored.familyId },
        ip,
      });

      throw new UnauthorizedException(
        'Refresh token has already been used. Please sign in again.',
      );
    }

    if (stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    if (stored.user.deletedAt || stored.user.status !== UserStatus.active) {
      throw new UnauthorizedException('This account is disabled');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      return this.issueTokens(stored.user, stored.familyId, tx);
    });

    await this.audit.record({
      actorId: stored.userId,
      entity: 'auth',
      entityId: stored.userId,
      action: 'refresh',
      ip,
    });

    return result;
  }

  /** FR-AUT-03 */
  async logout(rawToken: string | undefined, ip?: string): Promise<void> {
    if (!rawToken) return;

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
    });

    if (!stored || stored.revokedAt) return;

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      actorId: stored.userId,
      entity: 'auth',
      entityId: stored.userId,
      action: 'logout',
      ip,
    });
  }

  /** FR-AUT-07 */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ip?: string,
  ): Promise<void> {
    const user = await this.users.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    const matches = await this.passwords.verify(
      user.passwordHash,
      dto.currentPassword,
    );

    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.users.updatePasswordHash(
      user.id,
      await this.passwords.hash(dto.newPassword),
    );

    // Every existing session is invalidated: a password change should log out
    // any device the old password reached.
    await this.revokeAllForUser(user.id);

    await this.audit.record({
      actorId: user.id,
      entity: 'user',
      entityId: user.id,
      action: 'password_changed',
      ip,
    });
  }

  /** Used by password changes now, and by user disable in Module 9 (FR-AUT-08). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    user: User,
    familyId: string,
    tx?: Pick<PrismaService, 'refreshToken'>,
  ): Promise<AuthResult> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const expiresIn = Math.floor(parseDurationMs(this.accessTtl) / 1000);

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn,
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);

    await (tx ?? this.prisma).refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        familyId,
        expiresAt,
      },
    });

    return {
      accessToken,
      expiresIn,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
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
