import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core';
import { DEFAULT_ROLE_PERMISSIONS, type PermissionKey, StaffRole } from '@ennel/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AUTHENTICATED_STAFF_ONLY_KEY,
  PUBLIC_ADMIN_ROUTE_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from '../../src/common/decorators/admin-metadata.keys';
import { resetDatabase, seedFixtures } from './helpers/database';
import { createStaff, loginStaff, seedRoles } from './helpers/staff';
import { createTestApp, type TestApp } from './helpers/test-app';

interface AdminRoute {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  name: string;
  required: PermissionKey[] | undefined;
  isAuthOnly: boolean;
  isPublic: boolean;
}

const METHODS: Partial<Record<RequestMethod, AdminRoute['method']>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.DELETE]: 'delete',
};

// Placeholder values; guards run before pipes, so they only need to match the route shape.
const PARAM_VALUES: Record<string, string> = {
  date: '2026-10-20',
  mealType: 'LUNCH',
};
const fillParams = (path: string) =>
  path.replace(
    /:(\w+)/g,
    (_match, name: string) => PARAM_VALUES[name] ?? '00000000-0000-4000-8000-000000000000',
  );

function collectAdminRoutes(ctx: TestApp): AdminRoute[] {
  const modules = ctx.app.get(ModulesContainer);
  const scanner = new MetadataScanner();
  const reflector = ctx.app.get(Reflector);
  const wrappers = [...modules.values()].flatMap((module) => [...module.controllers.values()]);
  return wrappers.flatMap((wrapper) => {
    const controller = wrapper.metatype as (new (...args: unknown[]) => object) | null;
    const base = controller
      ? (Reflect.getMetadata(PATH_METADATA, controller) as string | undefined)
      : undefined;
    if (!controller || !base?.startsWith('admin/')) return [];
    return scanner.getAllMethodNames(controller.prototype).flatMap((name) => {
      const handler = (controller.prototype as Record<string, unknown>)[name] as () => unknown;
      const subPath = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      const method = METHODS[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
      if (subPath === undefined || !method) return [];
      const read = <T>(key: string) =>
        reflector.getAllAndOverride<T | undefined>(key, [handler, controller]);
      return [
        {
          method,
          path: `/api/v1/${base}${subPath === '/' ? '' : `/${subPath}`}`,
          name: `${controller.name}.${name}`,
          required: read<PermissionKey[]>(REQUIRED_PERMISSIONS_KEY),
          isAuthOnly: read<boolean>(AUTHENTICATED_STAFF_ONLY_KEY) === true,
          isPublic: read<boolean>(PUBLIC_ADMIN_ROUTE_KEY) === true,
        },
      ];
    });
  });
}

describe('admin authorization (Admin §A, ADR-0015)', () => {
  let ctx: TestApp;
  let routes: AdminRoute[];
  let noRoleToken: string;
  let studentToken: string;
  const tokensByRole = new Map<StaffRole, string>();
  const http = () => request(ctx.app.getHttpServer());
  const call = (method: AdminRoute['method'], path: string, token?: string) => {
    const pending = http()[method](path);
    return (token ? pending.set('Authorization', `Bearer ${token}`) : pending).send({});
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    await seedFixtures(ctx.prisma);
    await seedRoles(ctx.prisma);
    routes = collectAdminRoutes(ctx);
    noRoleToken = (await loginStaff(ctx, (await createStaff(ctx.prisma, [])).email)).accessToken;
    for (const role of Object.values(StaffRole)) {
      tokensByRole.set(
        role,
        (await loginStaff(ctx, (await createStaff(ctx.prisma, [role])).email)).accessToken,
      );
    }
    const password = 'correct-horse-1';
    const session = await http()
      .post('/api/v1/auth/register')
      .send({ referenceNumber: '24900001', password, confirmPassword: password });
    studentToken = session.body.accessToken as string;
  }, 120_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('finds the admin routes', () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  it('declares a permission (or auth-only/public) on every admin route', () => {
    const undeclared = routes.filter(
      (route) => !route.required && !route.isAuthOnly && !route.isPublic,
    );
    expect(undeclared.map((route) => route.name)).toEqual([]);
  });

  it('rejects requests without a token and with a student token on every protected route', async () => {
    for (const route of routes.filter((candidate) => !candidate.isPublic)) {
      const path = fillParams(route.path);
      const anonymous = await call(route.method, path);
      expect(anonymous.status, `${route.name} without token`).toBe(401);
      const asStudent = await call(route.method, path, studentToken);
      expect(asStudent.status, `${route.name} with student token`).toBe(401);
    }
  }, 120_000);

  it('returns PERMISSION_DENIED to staff without the permission, including each default role that lacks it', async () => {
    for (const route of routes.filter((candidate) => candidate.required)) {
      const path = fillParams(route.path);
      const denied = await call(route.method, path, noRoleToken);
      expect(denied.body.code, `${route.name} for staff without roles`).toBe('PERMISSION_DENIED');
      for (const role of Object.values(StaffRole)) {
        const granted = new Set<PermissionKey>(DEFAULT_ROLE_PERMISSIONS[role]);
        if (route.required?.every((key) => granted.has(key))) continue;
        const response = await call(route.method, path, tokensByRole.get(role));
        expect(response.status, `${route.name} for ${role}`).toBe(403);
      }
    }
  }, 180_000);

  it('rejects staff tokens on student routes', async () => {
    const response = await http()
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${tokensByRole.get(StaffRole.SUPER_ADMIN)}`);
    expect(response.status).toBe(401);
  });
});
