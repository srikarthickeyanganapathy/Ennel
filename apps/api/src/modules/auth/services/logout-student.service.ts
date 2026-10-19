import { Injectable } from '@nestjs/common';
import { Clock } from '../../../infrastructure/clock/clock';
import { StudentSessionRepository } from '../repositories/student-session.repository';
import { hashRefreshToken } from './refresh-token';

/** Spec §9 Logout: ends this device's session family. Unknown tokens are ignored. */
@Injectable()
export class LogoutStudentService {
  constructor(
    private readonly sessions: StudentSessionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    const stored = await this.sessions.findByTokenHash(hashRefreshToken(refreshToken));
    if (stored) await this.sessions.revokeFamily(stored.familyId, this.clock.now());
  }
}
