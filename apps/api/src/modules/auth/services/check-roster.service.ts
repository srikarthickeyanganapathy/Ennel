import { Injectable } from '@nestjs/common';
import { type RosterCheckResponse } from '@ennel/shared';
import { resolveRosterStatus } from '../domain/registration';
import { StudentAuthRepository } from '../repositories/student-auth.repository';

/** Spec §3 Screen 2 "Continue". */
@Injectable()
export class CheckRosterService {
  constructor(private readonly students: StudentAuthRepository) {}

  async execute(referenceNumber: string): Promise<RosterCheckResponse> {
    const roster = await this.students.findRosterForRegistration(referenceNumber);
    return { status: resolveRosterStatus(roster) };
  }
}
