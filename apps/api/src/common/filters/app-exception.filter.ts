import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ErrorCode, type ErrorResponse } from '@ennel/shared';
import type { Response } from 'express';
import { getRequestContext } from '../context/request-context';
import { AppError, ERROR_HTTP_STATUS } from '../errors/app-error';

const HTTP_STATUS_CODES: Readonly<Record<number, ErrorCode>> = {
  400: ErrorCode.VALIDATION_FAILED,
  401: ErrorCode.UNAUTHENTICATED,
  403: ErrorCode.PERMISSION_DENIED,
  404: ErrorCode.NOT_FOUND,
  413: ErrorCode.FILE_INVALID,
  429: ErrorCode.RATE_LIMITED,
};

interface MappedError {
  status: number;
  body: Omit<ErrorResponse, 'requestId'>;
}

/** Maps every thrown error to the standard error shape (docs/api-contract.md §1.2). */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.map(exception);
    if (status >= 500) this.logger.error('Unhandled error', exception);
    const requestId = getRequestContext()?.requestId ?? 'unknown';
    response.status(status).json({ ...body, requestId } satisfies ErrorResponse);
  }

  private map(exception: unknown): MappedError {
    if (exception instanceof AppError) {
      return {
        status: ERROR_HTTP_STATUS[exception.code],
        body: { code: exception.code, message: exception.message, details: exception.details },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = HTTP_STATUS_CODES[status] ?? ErrorCode.INTERNAL_ERROR;
      const message = status >= 500 ? 'Something went wrong.' : exception.message;
      return { status, body: { code, message } };
    }
    return {
      status: 500,
      body: { code: ErrorCode.INTERNAL_ERROR, message: 'Something went wrong.' },
    };
  }
}
