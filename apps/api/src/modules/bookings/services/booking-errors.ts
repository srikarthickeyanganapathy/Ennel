import { ErrorCode, formatMinuteOfDay, toMinuteOfDay } from '@ennel/shared';
import { AppError } from '../../../common/errors/app-error';

export function notAllowed(message: string, details?: Record<string, unknown>): AppError {
  return new AppError(ErrorCode.BOOKING_NOT_ALLOWED, message, details);
}

export function slotUnavailable(message: string): AppError {
  return new AppError(ErrorCode.SLOT_UNAVAILABLE, message);
}

export function deadlinePassed(what: string, deadline: Date): AppError {
  const time = formatMinuteOfDay(toMinuteOfDay(deadline));
  return new AppError(ErrorCode.BOOKING_DEADLINE_PASSED, `${what} closed at ${time}.`, {
    deadlineAt: deadline.toISOString(),
  });
}

export function bookingNotFound(): AppError {
  return new AppError(ErrorCode.NOT_FOUND, 'Booking not found.');
}

export function bookingChanged(): AppError {
  return new AppError(
    ErrorCode.VERSION_CONFLICT,
    'This booking changed in the meantime. Refresh and try again.',
  );
}
