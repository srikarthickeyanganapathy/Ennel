import { Injectable } from '@nestjs/common';
import { ErrorCode, type PermissionKey, type Role, StaffRole } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { TransactionRunner } from '../../../../infrastructure/database/transaction-runner';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { RolesRepository } from '../repositories/roles.repository';
import { StaffPermissionsService } from './staff-permissions.service';

/**
 * Role → permission editing (Admin §A: roles are editable only by a Super Admin, enforced by
 * roles:manage). The Super Admin role always keeps every permission so nobody can lock the
 * system out of staff and role management.
 */
@Injectable()
export class RolePermissionsService {
  constructor(
    private readonly roles: RolesRepository,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly permissions: StaffPermissionsService,
  ) {}

  list(): Promise<Role[]> {
    return this.roles.list();
  }

  async update(roleId: string, permissions: PermissionKey[], reason: string): Promise<Role> {
    const updated = await this.transactions.run(async (tx) => {
      const before = await this.roles.findById(roleId, tx);
      if (!before) throw new AppError(ErrorCode.NOT_FOUND, 'Role not found.');
      if (before.key === StaffRole.SUPER_ADMIN) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          'The Super Admin role always has every permission.',
        );
      }
      const unique = [...new Set(permissions)].sort();
      await this.roles.setPermissions(roleId, unique, tx);
      await this.audit.write(tx, {
        action: 'role.permissions.update',
        entityType: 'role',
        entityId: roleId,
        before: { key: before.key, permissions: before.permissions },
        after: { key: before.key, permissions: unique },
        reason,
      });
      const role = await this.roles.findById(roleId, tx);
      if (!role) throw new AppError(ErrorCode.NOT_FOUND, 'Role not found.');
      return role;
    });
    this.permissions.invalidate();
    return updated;
  }
}
