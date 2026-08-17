import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

// @node-rs/argon2 exposes `Algorithm` as an ambient const enum, which this
// project's `isolatedModules` setting forbids importing. 2 is Algorithm.Argon2id.
const ARGON2ID = 2;

/**
 * Argon2id password hashing (SRS §2.2, NFR-04). Defaults from @node-rs/argon2
 * (19 MiB, 2 passes, 1 lane) match the OWASP baseline.
 */
@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return hash(plain, { algorithm: ARGON2ID });
  }

  async verify(hashed: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashed, plain);
    } catch {
      // A malformed stored hash must read as "wrong password", never a 500.
      return false;
    }
  }
}
