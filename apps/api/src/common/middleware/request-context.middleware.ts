import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from '../context/request-context';

export const REQUEST_ID_HEADER = 'x-request-id';

// Accept a caller-supplied ID only if it is short and safe to echo into logs.
const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.header(REQUEST_ID_HEADER);
    const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    response.setHeader(REQUEST_ID_HEADER, requestId);
    runWithRequestContext(
      { requestId, ip: request.ip, userAgent: request.header('user-agent') },
      () => next(),
    );
  }
}
