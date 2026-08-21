import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../common/enums';

export const ROLES_KEY = 'sps:roles';

/** Restricts a route to the listed roles (SRS §2.3). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
