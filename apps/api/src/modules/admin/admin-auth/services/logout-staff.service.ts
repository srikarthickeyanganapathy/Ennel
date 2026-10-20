import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../infrastructure/clock/clock';
import { hashRefreshToken } from '../../../auth/services/refresh-token';
import { StaffSessionRepository } from '../repositories/staff-session.repository';

/** Logout ends this device's session family; unknown cookies are ignored. */
@Injectable()
export class LogoutStaffService {
  constructor(
    private readonly sessions: StaffSessionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(refreshToken: string | null): Promise<void> {
    if (!refreshToken) return;
    const stored = await this.sessions.findByTokenHash(hashRefreshToken(refreshToken));
    if (stored) await this.sessions.revokeFamily(stored.familyId, this.clock.now());
  }
}
