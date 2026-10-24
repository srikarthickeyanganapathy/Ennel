import { Injectable } from '@nestjs/common';
import { type Paginated, type StaffRole, type StaffUser } from '@ennel/shared';
import { type Prisma, type StaffStatus } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../../infrastructure/database/transaction-runner';
import { withUniqueField } from '../../../../infrastructure/database/unique-violation';

export interface StaffListFilter {
  q?: string;
  status?: StaffStatus;
  role?: StaffRole;
}

export interface NewStaffUser {
  email: string;
  fullName: string;
  passwordHash: string;
  roles: StaffRole[];
}

export abstract class StaffUsersRepository {
  abstract list(
    filter: StaffListFilter,
    page: number,
    pageSize: number,
  ): Promise<Paginated<StaffUser>>;
  abstract findById(id: string, tx?: TransactionClient): Promise<StaffUser | null>;
  abstract emailExists(email: string): Promise<boolean>;
  abstract create(staff: NewStaffUser, tx: TransactionClient): Promise<string>;
  abstract updateName(
    id: string,
    version: number,
    fullName: string,
    tx: TransactionClient,
  ): Promise<boolean>;
  abstract setRoles(
    id: string,
    version: number,
    roles: StaffRole[],
    tx: TransactionClient,
  ): Promise<boolean>;
  abstract setStatus(id: string, status: StaffStatus, tx: TransactionClient): Promise<void>;
  abstract setTemporaryPassword(
    id: string,
    passwordHash: string,
    tx: TransactionClient,
  ): Promise<void>;
  abstract resetTotp(id: string, tx: TransactionClient): Promise<void>;
  abstract countActiveSuperAdmins(tx: TransactionClient, excludingId?: string): Promise<number>;
}

const STAFF_INCLUDE = {
  roles: { select: { role: { select: { key: true } } } },
} satisfies Prisma.StaffUserInclude;
type StaffRow = Prisma.StaffUserGetPayload<{ include: typeof STAFF_INCLUDE }>;

function toStaffUser(row: StaffRow): StaffUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    status: row.status,
    roles: row.roles.map((assignment) => assignment.role.key as StaffRole),
    mustChangePassword: row.mustChangePassword,
    totpEnabled: row.totpEnabled,
    lockedUntil: row.lockedUntil?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    version: row.version,
  };
}

function toWhere(filter: StaffListFilter): Prisma.StaffUserWhereInput {
  return {
    deletedAt: null,
    status: filter.status,
    roles: filter.role ? { some: { role: { key: filter.role } } } : undefined,
    OR: filter.q
      ? [
          { fullName: { contains: filter.q, mode: 'insensitive' } },
          { email: { contains: filter.q, mode: 'insensitive' } },
        ]
      : undefined,
  };
}

async function roleIds(tx: TransactionClient, roles: StaffRole[]): Promise<{ roleId: string }[]> {
  const rows = await tx.role.findMany({ where: { key: { in: roles } }, select: { id: true } });
  return rows.map((row) => ({ roleId: row.id }));
}

@Injectable()
export class PrismaStaffUsersRepository extends StaffUsersRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(
    filter: StaffListFilter,
    page: number,
    pageSize: number,
  ): Promise<Paginated<StaffUser>> {
    const where = toWhere(filter);
    const [rows, total] = await Promise.all([
      this.prisma.staffUser.findMany({
        where,
        include: STAFF_INCLUDE,
        orderBy: { fullName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.staffUser.count({ where }),
    ]);
    return { items: rows.map(toStaffUser), total, page, pageSize };
  }

  async findById(id: string, tx: TransactionClient = this.prisma): Promise<StaffUser | null> {
    const row = await tx.staffUser.findFirst({
      where: { id, deletedAt: null },
      include: STAFF_INCLUDE,
    });
    return row ? toStaffUser(row) : null;
  }

  async emailExists(email: string): Promise<boolean> {
    return (await this.prisma.staffUser.count({ where: { email } })) > 0;
  }

  async create(staff: NewStaffUser, tx: TransactionClient): Promise<string> {
    const roles = await roleIds(tx, staff.roles);
    const created = await withUniqueField(
      'email',
      'A staff account with this email already exists.',
      () =>
        tx.staffUser.create({
          data: {
            email: staff.email,
            fullName: staff.fullName,
            passwordHash: staff.passwordHash,
            mustChangePassword: true,
            roles: { create: roles },
          },
          select: { id: true },
        }),
    );
    return created.id;
  }

  async updateName(
    id: string,
    version: number,
    fullName: string,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.staffUser.updateMany({
      where: { id, version, deletedAt: null },
      data: { fullName, version: { increment: 1 } },
    });
    return result.count === 1;
  }

  async setRoles(
    id: string,
    version: number,
    roles: StaffRole[],
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.staffUser.updateMany({
      where: { id, version, deletedAt: null },
      data: { version: { increment: 1 } },
    });
    if (result.count !== 1) return false;
    await tx.staffUserRole.deleteMany({ where: { staffUserId: id } });
    const ids = await roleIds(tx, roles);
    await tx.staffUserRole.createMany({
      data: ids.map(({ roleId }) => ({ staffUserId: id, roleId })),
    });
    return true;
  }

  async setStatus(id: string, status: StaffStatus, tx: TransactionClient): Promise<void> {
    await tx.staffUser.update({
      where: { id },
      data: { status, failedLoginCount: 0, lockedUntil: null, version: { increment: 1 } },
    });
  }

  async setTemporaryPassword(
    id: string,
    passwordHash: string,
    tx: TransactionClient,
  ): Promise<void> {
    await tx.staffUser.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
        version: { increment: 1 },
      },
    });
  }

  async resetTotp(id: string, tx: TransactionClient): Promise<void> {
    await tx.staffUser.update({
      where: { id },
      data: { totpEnabled: false, totpSecretEnc: null, version: { increment: 1 } },
    });
  }

  async countActiveSuperAdmins(tx: TransactionClient, excludingId?: string): Promise<number> {
    // Serializes concurrent changes so two admins cannot each remove the other's Super Admin access.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('staff:super-admin-set'))`;
    return tx.staffUser.count({
      where: {
        id: excludingId ? { not: excludingId } : undefined,
        status: 'ACTIVE',
        deletedAt: null,
        roles: { some: { role: { key: 'SUPER_ADMIN' } } },
      },
    });
  }
}
