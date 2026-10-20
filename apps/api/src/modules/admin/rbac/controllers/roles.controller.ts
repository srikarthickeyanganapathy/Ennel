import { Body, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { type Role, updateRolePermissionsRequestSchema } from '@ennel/shared';
import { type z } from 'zod';
import {
  AdminController,
  RequirePermissions,
} from '../../../../common/decorators/admin.decorators';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { RolePermissionsService } from '../services/role-permissions.service';

@AdminController('roles')
export class RolesController {
  constructor(private readonly roles: RolePermissionsService) {}

  // Staff managers need the role list to assign roles, so staff:read is enough to view it.
  @Get()
  @RequirePermissions('staff:read')
  async list(): Promise<{ items: Role[] }> {
    return { items: await this.roles.list() };
  }

  @Put(':id/permissions')
  @RequirePermissions('roles:manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateRolePermissionsRequestSchema))
    body: z.output<typeof updateRolePermissionsRequestSchema>,
  ): Promise<Role> {
    return this.roles.update(id, body.permissions, body.reason);
  }
}
