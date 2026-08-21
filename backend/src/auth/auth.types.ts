import type { Role } from '../common/enums';

/** Claims carried by the 15-minute access token (FR-AUT-01). */
export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: Role;
};

/** Shape attached to `request.user` by the JWT strategy. */
export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};
