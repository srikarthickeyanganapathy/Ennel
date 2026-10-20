import { Injectable } from '@nestjs/common';
import { isPermissionKey, type PermissionKey } from '@ennel/shared';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

export interface StaffAccessRecord {
  isActive: boolean;
  roles: string[];
  permissions: PermissionKey[];
}

export abstract class StaffAccessRepository {
  abstract findAccess(staffId: string): Promise<StaffAccessRecord | null>;
}

@Injectable()
export class PrismaStaffAccessRepository extends StaffAccessRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAccess(staffId: string): Promise<StaffAccessRecord | null> {
    const staff = await this.prisma.staffUser.findUnique({
      where: { id: staffId },
      select: {
        status: true,
        deletedAt: true,
        roles: {
          select: {
            role: { select: { key: true, permissions: { select: { permissionKey: true } } } },
          },
        },
      },
    });
    if (!staff) return null;
    const roles = staff.roles.map((assignment) => assignment.role.key);
    const keys = staff.roles.flatMap((assignment) =>
      assignment.role.permissions.map((permission) => permission.permissionKey),
    );
    return {
      isActive: staff.status === 'ACTIVE' && staff.deletedAt === null,
      roles,
      // Keys removed from the code but still in the database are ignored.
      permissions: [...new Set(keys)].filter(isPermissionKey),
    };
  }
}
