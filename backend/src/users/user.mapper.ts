import type { Role, UserStatus } from '../common/enums';
import type { User } from '../database/entities';

/**
 * SRS §5.1. **`password_hash` is absent by construction**, not stripped by a
 * caller who might forget. Every route that returns a user goes through here,
 * so the hash cannot reach a response by omission.
 */
export type UserResponse = {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    last_login_at: user.last_login_at?.toISOString() ?? null,
    created_at: user.created_at.toISOString(),
    updated_at: user.updated_at.toISOString(),
    deleted_at: user.deleted_at?.toISOString() ?? null,
  };
}

/** The audit trail stores JSONB; the response shape is already free of Dates. */
export function toAuditSnapshot(user: UserResponse): Record<string, unknown> {
  return { ...user };
}
