import { RequestMethod } from '@nestjs/common';
import { type GlobalPrefixOptions } from '@nestjs/common/interfaces';

/** Student routes live under /api/v1, staff routes under /api/v1/admin (ADR-0015). */
export const API_PREFIX = 'api/v1';

/** `GET /` stays outside the prefix so a browser opening the API sees where to go. */
export const API_PREFIX_OPTIONS: GlobalPrefixOptions = {
  exclude: [{ path: '', method: RequestMethod.GET }],
};
