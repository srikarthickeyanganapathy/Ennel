import { Injectable } from '@nestjs/common';
import { ErrorCode, type StaffRole, type StaffWithTemporaryPassword } from '@ennel/shared';
import { hash } from 'argon2';
import { AppError } from '../../../../common/errors/app-error';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { StaffUsersRepository } from '../repositories/staff-users.repository';
import { requireStaff, staffSnapshot } from './staff-lookup';
import { generateTemporaryPassword } from './temporary-password';

export interface CreateStaffCommand {
  email: string;
  fullName: string;
  roles: StaffRole[];
}

/**
 * Admin §B: staff are created by an administrator, never by self-sign-up. The temporary
 * password is returned once and must be changed at first sign-in.
 */
@Injectable()
export class CreateStaffService {
  constructor(
    private readonly staff: StaffUsersRepository,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  async execute(command: CreateStaffCommand): Promise<StaffWithTemporaryPassword> {
    if (await this.staff.emailExists(command.email)) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        'A staff account with this email already exists.',
        {
          issues: [{ path: 'email', message: 'Already in use' }],
        },
      );
    }
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hash(temporaryPassword);
    const created = await this.transactions.run(async (tx) => {
      const id = await this.staff.create({ ...command, passwordHash }, tx);
      const staff = await requireStaff(this.staff, id, tx);
      await this.audit.write(tx, {
        action: 'staff.create',
        entityType: 'staff_user',
        entityId: id,
        after: staffSnapshot(staff),
      });
      return staff;
    });
    return { staff: created, temporaryPassword };
  }
}
