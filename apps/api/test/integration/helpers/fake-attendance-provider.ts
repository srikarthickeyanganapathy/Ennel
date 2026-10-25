import { type BusinessDate, type MealType } from '@ennel/shared';
import {
  AttendanceProvider,
  type FaceVerification,
  type ProviderStatus,
} from '../../../src/modules/attendance/provider/attendance-provider';

/** Stands in for the college's face-verification system; tests choose what it reports. */
export class FakeAttendanceProvider extends AttendanceProvider {
  private readonly verifications = new Map<string, FaceVerification[]>();

  set(date: BusinessDate, mealType: MealType, verifications: FaceVerification[]): void {
    this.verifications.set(`${date}:${mealType}`, verifications);
  }

  reset(): void {
    this.verifications.clear();
  }

  status(): ProviderStatus {
    return { name: 'Fake face verification', isConfigured: true };
  }

  fetchVerifications(date: BusinessDate, mealType: MealType): Promise<FaceVerification[]> {
    return Promise.resolve(this.verifications.get(`${date}:${mealType}`) ?? []);
  }
}
