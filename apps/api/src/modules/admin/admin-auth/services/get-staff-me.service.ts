import { Injectable } from '@nestjs/common';
import { type StaffMe } from '@ennel/shared';
import { StaffPermissionsService } from '../../rbac/services/staff-permissions.service';
import { StaffAuthRepository } from '../repositories/staff-auth.repository';
import { requireMember } from './require-staff-member';

/** The signed-in staff member with resolved permissions; the admin UI gates controls on these. */
@Injectable()
export class GetStaffMeService {
  constructor(
    private readonly staff: StaffAuthRepository,
    private readonly permissions: StaffPermissionsService,
  ) {}

  async execute(staffId: string): Promise<StaffMe> {
    const member = await requireMember(this.staff, staffId);
    const access = await this.permissions.getAccess(staffId);
    return {
      id: member.id,
      email: member.email,
      fullName: member.fullName,
      roles: access?.roles ?? [],
      permissions: access?.permissions ?? [],
      mustChangePassword: member.mustChangePassword,
      totpEnabled: member.totpEnabled,
    };
  }
}
