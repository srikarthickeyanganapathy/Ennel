import { Injectable } from '@nestjs/common';
import {
  type BookMealRequest,
  type changeBookingRequestSchema,
  type BusinessDate,
  type CancelEligibleResponse,
  cancelEligibleResponseSchema,
  type DayResponse,
  type MealCard,
  mealCardSchema,
  type MealType,
} from '@ennel/shared';
import { type z } from 'zod';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { IdempotencyService } from '../../idempotency/services/idempotency.service';
import { type BookingRow, BookingsRepository } from '../repositories/bookings.repository';
import { BookingCommandsService, type ChangeCommand } from './booking-commands.service';
import { BookingDayService } from './booking-day.service';
import { bookingNotFound } from './booking-errors';

const STUDENT = { type: 'STUDENT' } as const;

/** Student booking use cases behind Home and Slot Selection (Spec §4, §5, Rule 13). */
@Injectable()
export class StudentBookingsService {
  constructor(
    private readonly days: BookingDayService,
    private readonly commands: BookingCommandsService,
    private readonly bookings: BookingsRepository,
    private readonly idempotency: IdempotencyService,
  ) {}

  getDay(studentId: string, date: BusinessDate): Promise<DayResponse> {
    return this.days.build(studentId, date);
  }

  book(studentId: string, request: BookMealRequest, key: string): Promise<MealCard> {
    return this.idempotency.run({
      context: { actorKey: `student:${studentId}`, key, route: 'POST /bookings', request },
      responseCode: 201,
      responseSchema: mealCardSchema,
      work: async (tx) => {
        await this.commands.book(STUDENT, { studentId, ...request }, tx);
        return this.days.card(studentId, request.date, request.mealType, tx);
      },
    });
  }

  change(
    studentId: string,
    bookingId: string,
    request: z.output<typeof changeBookingRequestSchema>,
    key: string,
  ): Promise<MealCard> {
    return this.mutate(
      studentId,
      bookingId,
      key,
      `PATCH /bookings/${bookingId}`,
      request,
      (booking, tx) => this.commands.change(STUDENT, booking, request satisfies ChangeCommand, tx),
    );
  }

  cancel(studentId: string, bookingId: string, key: string): Promise<MealCard> {
    return this.mutate(
      studentId,
      bookingId,
      key,
      `POST /bookings/${bookingId}/cancel`,
      {},
      (booking, tx) => this.commands.cancel(STUDENT, booking, tx),
    );
  }

  /** Spec §4.4, BR-DEAD-6: cancels only meals still before their deadline and lists the rest. */
  cancelEligible(
    studentId: string,
    date: BusinessDate,
    key: string,
  ): Promise<CancelEligibleResponse> {
    return this.idempotency.run({
      context: {
        actorKey: `student:${studentId}`,
        key,
        route: `POST /days/${date}/cancel-eligible`,
        request: {},
      },
      responseCode: 200,
      responseSchema: cancelEligibleResponseSchema,
      work: async (tx) => {
        const before = await this.days.build(studentId, date, tx);
        const cancelled: MealType[] = [];
        const notEligible: CancelEligibleResponse['notEligible'] = [];
        for (const meal of before.meals) {
          if (meal.booking?.status !== 'BOOKED') continue;
          if (!meal.actions.cancel.allowed) {
            notEligible.push({
              mealType: meal.mealType,
              reason: meal.actions.cancel.reason ?? 'Cancellation has closed.',
            });
            continue;
          }
          await this.commands.cancel(
            STUDENT,
            await this.requireOwn(studentId, meal.booking.id, tx),
            tx,
          );
          cancelled.push(meal.mealType);
        }
        return { cancelled, notEligible, day: await this.days.build(studentId, date, tx) };
      },
    });
  }

  private mutate(
    studentId: string,
    bookingId: string,
    key: string,
    route: string,
    request: unknown,
    action: (
      booking: BookingRow,
      tx: TransactionClient,
    ) => Promise<{ date: BusinessDate; mealType: MealType }>,
  ): Promise<MealCard> {
    return this.idempotency.run({
      context: { actorKey: `student:${studentId}`, key, route, request },
      responseCode: 200,
      responseSchema: mealCardSchema,
      work: async (tx) => {
        const outcome = await action(await this.requireOwn(studentId, bookingId, tx), tx);
        return this.days.card(studentId, outcome.date, outcome.mealType, tx);
      },
    });
  }

  /** Another student's booking is reported as missing, never as forbidden. */
  private async requireOwn(
    studentId: string,
    bookingId: string,
    tx: TransactionClient,
  ): Promise<BookingRow> {
    const booking = await this.bookings.findBooking(bookingId, tx);
    if (!booking || booking.studentId !== studentId) throw bookingNotFound();
    return booking;
  }
}
