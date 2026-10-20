import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from '../context/request-context';
import { formatRequestLine, requestLogLevel } from '../logging/request-log';

export const REQUEST_ID_HEADER = 'x-request-id';
/** Set by AppExceptionFilter so the request log line can show the error code. */
export const ERROR_CODE_LOCAL = 'errorCode';

// Accept a caller-supplied ID only if it is short and safe to echo into logs.
const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.header(REQUEST_ID_HEADER);
    const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    response.setHeader(REQUEST_ID_HEADER, requestId);
    this.logWhenFinished(request, response, requestId);
    runWithRequestContext(
      { requestId, ip: request.ip, userAgent: request.header('user-agent') },
      () => next(),
    );
  }

  private logWhenFinished(request: Request, response: Response, requestId: string): void {
    const startedAt = performance.now();
    response.once('finish', () => {
      const errorCode: unknown = response.locals[ERROR_CODE_LOCAL];
      const line = formatRequestLine({
        method: request.method,
        url: request.originalUrl,
        status: response.statusCode,
        durationMs: performance.now() - startedAt,
        requestId,
        errorCode: typeof errorCode === 'string' ? errorCode : undefined,
      });
      this.logger[requestLogLevel(response.statusCode)](line);
    });
  }
}
