import { Injectable } from '@nestjs/common';
import { type completeOnboardingRequestSchema, type StudentProfile } from '@ennel/shared';
import { type z } from 'zod';
import { Clock } from '../../../infrastructure/clock/clock';
import { TransactionRunner } from '../../../infrastructure/database/transaction-runner';
import { SaveMealPreferencesService } from '../../default-preferences/services/save-meal-preferences.service';
import { SyncStudentBookingsService } from '../../default-preferences/services/sync-student-bookings.service';
import { GetMessPolicyService } from '../../mess-config/services/get-mess-policy.service';
import { pickEditableChanges } from '../domain/editable-fields';
import { StudentProfileRepository } from '../repositories/student-profile.repository';
import { GetMyProfileService } from './get-my-profile.service';
import { assertActiveHostelBlock } from './hostel-block.guard';

export type CompleteOnboardingCommand = z.output<typeof completeOnboardingRequestSchema>;

/**
 * Spec §3 Screen 8 "Save & Continue": saves profile, hostel details and Default Booking
 * preferences in one transaction, marks onboarding complete and creates the resulting
 * upcoming Default Bookings.
 */
@Injectable()
export class CompleteOnboardingService {
  constructor(
    private readonly profiles: StudentProfileRepository,
    private readonly preferences: SaveMealPreferencesService,
    private readonly syncBookings: SyncStudentBookingsService,
    private readonly policy: GetMessPolicyService,
    private readonly transactions: TransactionRunner,
    private readonly getProfile: GetMyProfileService,
    private readonly clock: Clock,
  ) {}

  async execute(studentId: string, command: CompleteOnboardingCommand): Promise<StudentProfile> {
    const policy = await this.policy.execute();
    const changes = pickEditableChanges(command.profile, policy.collegeControlledFields);
    await assertActiveHostelBlock(this.profiles, command.profile.hostelBlockId);

    await this.transactions.run(
      async (tx) => {
        await this.preferences.execute(studentId, command.mealPreferences, tx);
        await this.profiles.completeOnboarding(
          studentId,
          changes,
          command.defaultBookingEnabled,
          this.clock.now(),
          tx,
        );
        // Default Booking starts at once rather than after the nightly job (BR-DEF-1).
        await this.syncBookings.execute(studentId, tx);
      },
      { timeoutMs: 30_000 },
    );
    return this.getProfile.execute(studentId);
  }
}
