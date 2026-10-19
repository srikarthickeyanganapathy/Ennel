import { type LoggerService } from '@nestjs/common';
import { getRequestContext } from '../context/request-context';
import { redact } from './redact';

type Level = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

/** One JSON object per line with the request ID attached (CLAUDE.md: structured logging). */
export class StructuredLogger implements LoggerService {
  constructor(private readonly isVerbose = false) {}

  log(message: unknown, ...optional: unknown[]): void {
    this.write('info', message, optional);
  }

  error(message: unknown, ...optional: unknown[]): void {
    this.write('error', message, optional);
  }

  warn(message: unknown, ...optional: unknown[]): void {
    this.write('warn', message, optional);
  }

  debug(message: unknown, ...optional: unknown[]): void {
    if (this.isVerbose) this.write('debug', message, optional);
  }

  verbose(message: unknown, ...optional: unknown[]): void {
    if (this.isVerbose) this.write('verbose', message, optional);
  }

  private write(level: Level, message: unknown, optional: unknown[]): void {
    // Nest passes the logger context (class name) as the last string argument.
    const last = optional.at(-1);
    const context = typeof last === 'string' ? last : undefined;
    const extra = context ? optional.slice(0, -1) : optional;
    const entry = {
      time: new Date().toISOString(),
      level,
      context,
      requestId: getRequestContext()?.requestId,
      message: typeof message === 'string' ? message : redact(message),
      ...(extra.length > 0 ? { details: redact(extra) } : {}),
    };
    const stream = level === 'error' ? process.stderr : process.stdout;
    stream.write(`${JSON.stringify(entry)}\n`);
  }
}
