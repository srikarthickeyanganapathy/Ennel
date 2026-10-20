import { Injectable } from '@nestjs/common';
import { isPermissionKey, type PermissionKey, type Role, type StaffRole } from '@ennel/shared';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';

export abstract class RolesRepository {
  abstract list(): Promise<Role[]>;
  abstract findById(id: string, tx?: TransactionClient): Promise<Role | null>;
  abstract setPermissions(
    roleId: string,
    permissions: PermissionKey[],
    tx: TransactionClient,
  ): Promise<void>;
}

const ROLE_ORDER: StaffRole[] = ['SUPER_ADMIN', 'MESS_MANAGER', 'MESS_STAFF', 'WARDEN', 'AUDITOR'];

@Injectable()
export class PrismaRolesRepository extends RolesRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(): Promise<Role[]> {
    const ids = await this.prisma.role.findMany({ select: { id: true } });
    const roles = await Promise.all(ids.map(({ id }) => this.findById(id)));
    return roles
      .filter((role): role is Role => role !== null)
      .sort((a, b) => ROLE_ORDER.indexOf(a.key) - ROLE_ORDER.indexOf(b.key));
  }

  async findById(id: string, tx: TransactionClient = this.prisma): Promise<Role | null> {
    const row = await tx.role.findUnique({
      where: { id },
      include: {
        permissions: { select: { permissionKey: true } },
        _count: { select: { staff: { where: { staffUser: { deletedAt: null } } } } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      key: row.key as StaffRole,
      name: row.name,
      isSystem: row.isSystem,
      permissions: row.permissions
        .map((permission) => permission.permissionKey)
        .filter(isPermissionKey),
      staffCount: row._count.staff,
    };
  }

  async setPermissions(
    roleId: string,
    permissions: PermissionKey[],
    tx: TransactionClient,
  ): Promise<void> {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    await tx.rolePermission.createMany({
      data: permissions.map((permissionKey) => ({ roleId, permissionKey })),
    });
  }
}
