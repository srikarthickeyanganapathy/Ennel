import { type StaffRole } from '@ennel/shared';
import { hash } from 'argon2';
import request from 'supertest';
import { seedRbac } from '../../../prisma/seed/rbac.seed';
import { type PrismaService } from '../../../src/infrastructure/database/prisma.service';
import { type TestApp } from './test-app';

export const STAFF_PASSWORD = 'staff-password-123';

export async function seedRoles(prisma: PrismaService): Promise<void> {
  const quiet = console.log;
  console.log = () => undefined;
  try {
    await seedRbac(prisma);
  } finally {
    console.log = quiet;
  }
}

export interface TestStaff {
  id: string;
  email: string;
}

export async function createStaff(
  prisma: PrismaService,
  roles: StaffRole[],
  options: { email?: string; mustChangePassword?: boolean } = {},
): Promise<TestStaff> {
  const email =
    options.email ??
    `${roles.join('-').toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@ennel.test`;
  const roleRows = await prisma.role.findMany({ where: { key: { in: roles } } });
  const staff = await prisma.staffUser.create({
    data: {
      email,
      fullName: `Test ${roles.join(' ')}`,
      passwordHash: await hash(STAFF_PASSWORD),
      mustChangePassword: options.mustChangePassword ?? false,
      roles: { create: roleRows.map((role) => ({ roleId: role.id })) },
    },
  });
  return { id: staff.id, email };
}

export interface StaffLogin {
  accessToken: string;
  cookie: string;
}

export async function loginStaff(
  ctx: TestApp,
  email: string,
  password = STAFF_PASSWORD,
): Promise<StaffLogin> {
  const response = await request(ctx.app.getHttpServer())
    .post('/api/v1/admin/auth/login')
    .send({ email, password })
    .expect(200);
  const setCookie = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie =
    setCookie?.find((value) => value.startsWith('ennel_staff_refresh='))?.split(';')[0] ?? '';
  return { accessToken: response.body.session.accessToken as string, cookie };
}

export async function staffToken(ctx: TestApp, roles: StaffRole[]): Promise<string> {
  const staff = await createStaff(ctx.prisma, roles);
  return (await loginStaff(ctx, staff.email)).accessToken;
}

export function auditCount(
  prisma: PrismaService,
  entityId: string,
  action?: string,
): Promise<number> {
  return prisma.auditLog.count({ where: { entityId, action } });
}
