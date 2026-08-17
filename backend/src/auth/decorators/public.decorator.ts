import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'sps:isPublic';

/**
 * Opts a route out of the global JWT guard. Per FR-AUT-05 only /auth/login,
 * /auth/refresh and /auth/logout may carry this.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
