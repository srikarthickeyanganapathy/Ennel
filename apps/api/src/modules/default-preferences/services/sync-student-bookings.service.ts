import { Injectable } from '@nestjs/common';
import { addBusinessDays, toBusinessDate } from '@ennel/shared';
import { Clock } from '../../../infrastructure/clock/clock';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { BookingReconciler } from '../../bookings/services/booking-reconciler.service';
import { GetMessPolicyService } from '../../mess-config/services/get-mess-policy.service';

/**
 * Applies a preference change to the student's upcoming bookings right away (BR-DEF-3), instead
 * of waiting for the nightly job: today … today + horizon, within the caller's transaction.
 * Deadlines still apply, so nothing already closed is changed.
 */
@Injectable()
export class SyncStudentBookingsService {
  constructor(
    private readonly reconciler: BookingReconciler,
    private readonly policies: GetMessPolicyService,
    private readonly clock: Clock,
  ) {}

  /** Returns how many bookings were created, reactivated, moved or cancelled. */
  async execute(studentId: string, tx: TransactionClient): Promise<number> {
    const policy = await this.policies.execute();
    const today = toBusinessDate(this.clock.now());
    const dates = Array.from({ length: policy.bookingHorizonDays + 1 }, (_, index) =>
      addBusinessDays(today, index),
    );
    const stats = await this.reconciler.reconcile(studentId, dates, policy, tx);
    return stats.created + stats.reactivated + stats.updated + stats.cancelled;
  }
}
