import { Injectable } from '@nestjs/common';

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

type Attempt = {
  failures: number;
  windowStartedAt: number;
  lockedUntil: number | null;
};

/**
 * Per-account login throttling: 5 failures per 15 minutes, then a 15-minute
 * lockout (FR-AUT-04). In-memory, which is correct for the single-host
 * deployment in NFR-08; move to Redis or a table before running more than one
 * API instance.
 */
@Injectable()
export class LoginAttemptsService {
  private readonly attempts = new Map<string, Attempt>();

  /** Milliseconds remaining on the lockout, or 0 when not locked. */
  lockoutRemainingMs(email: string, now = Date.now()): number {
    const attempt = this.attempts.get(this.key(email));

    if (!attempt?.lockedUntil) return 0;

    if (attempt.lockedUntil <= now) {
      this.attempts.delete(this.key(email));
      return 0;
    }

    return attempt.lockedUntil - now;
  }

  recordFailure(email: string, now = Date.now()): void {
    const key = this.key(email);
    const attempt = this.attempts.get(key);

    if (!attempt || now - attempt.windowStartedAt > WINDOW_MS) {
      this.attempts.set(key, {
        failures: 1,
        windowStartedAt: now,
        lockedUntil: null,
      });
      return;
    }

    attempt.failures += 1;

    if (attempt.failures >= MAX_FAILURES) {
      attempt.lockedUntil = now + WINDOW_MS;
    }
  }

  reset(email: string): void {
    this.attempts.delete(this.key(email));
  }

  private key(email: string): string {
    return email.trim().toLowerCase();
  }
}
