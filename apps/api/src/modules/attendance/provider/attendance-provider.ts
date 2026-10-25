import { Injectable } from '@nestjs/common';
import { type BusinessDate, type MealType } from '@ennel/shared';

export interface FaceVerification {
  referenceNumber: string;
  /** When the college's system verified the student; the only source of `verified_at` (BR-ATT-1). */
  verifiedAt: Date;
}

export interface ProviderStatus {
  name: string;
  isConfigured: boolean;
}

/**
 * Port to the college's existing face-verification system (Spec §7, ADR-0025). The real adapter
 * needs the college's API details; until then the app runs with the unconfigured adapter and
 * attendance comes from manual marking and imports.
 */
export abstract class AttendanceProvider {
  abstract status(): ProviderStatus;
  abstract fetchVerifications(date: BusinessDate, mealType: MealType): Promise<FaceVerification[]>;
}

/** Default adapter: reports "not configured" and never invents verifications. */
@Injectable()
export class UnconfiguredAttendanceProvider extends AttendanceProvider {
  status(): ProviderStatus {
    return { name: 'Face verification (not configured)', isConfigured: false };
  }

  fetchVerifications(): Promise<FaceVerification[]> {
    return Promise.resolve([]);
  }
}
