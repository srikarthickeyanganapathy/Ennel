import { Body, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import {
  createStaffRequestSchema,
  type Paginated,
  reasonRequestSchema,
  setStaffRolesRequestSchema,
  staffListQuerySchema,
  type StaffUser,
  type StaffWithTemporaryPassword,
  updateStaffRequestSchema,
} from '@ennel/shared';
import { type z } from 'zod';
import {
  AdminController,
  RequirePermissions,
} from '../../../../common/decorators/admin.decorators';
import {
  type AuthenticatedStaff,
  CurrentStaff,
} from '../../../../common/decorators/current-staff.decorator';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { ChangeStaffStatusService } from '../services/change-staff-status.service';
import { CreateStaffService } from '../services/create-staff.service';
import { ListStaffService } from '../services/list-staff.service';
import { ResetStaffCredentialsService } from '../services/reset-staff-credentials.service';
import { SetStaffRolesService } from '../services/set-staff-roles.service';
import { UpdateStaffService } from '../services/update-staff.service';

type Reason = z.output<typeof reasonRequestSchema>;
const reasonPipe = new ZodValidationPipe(reasonRequestSchema);

/** Staff directory (Admin §A/§B). */
@AdminController('staff-users')
export class StaffUsersController {
  constructor(
    private readonly listStaff: ListStaffService,
    private readonly createStaff: CreateStaffService,
    private readonly updateStaff: UpdateStaffService,
    private readonly setRoles: SetStaffRolesService,
    private readonly changeStatus: ChangeStaffStatusService,
    private readonly resetCredentials: ResetStaffCredentialsService,
  ) {}

  @Get()
  @RequirePermissions('staff:read')
  list(
    @Query(new ZodValidationPipe(staffListQuerySchema))
    query: z.output<typeof staffListQuerySchema>,
  ): Promise<Paginated<StaffUser>> {
    const { page, pageSize, q, status, role } = query;
    return this.listStaff.list({ q, status, role }, page, pageSize);
  }

  @Get(':id')
  @RequirePermissions('staff:read')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<StaffUser> {
    return this.listStaff.get(id);
  }

  @Post()
  @RequirePermissions('staff:manage', 'roles:manage')
  create(
    @Body(new ZodValidationPipe(createStaffRequestSchema))
    body: z.output<typeof createStaffRequestSchema>,
  ): Promise<StaffWithTemporaryPassword> {
    return this.createStaff.execute(body);
  }

  @Patch(':id')
  @RequirePermissions('staff:manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateStaffRequestSchema))
    body: z.output<typeof updateStaffRequestSchema>,
  ): Promise<StaffUser> {
    return this.updateStaff.execute(id, body.fullName, body.version);
  }

  @Put(':id/roles')
  @RequirePermissions('roles:manage')
  putRoles(
    @CurrentStaff() actor: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setStaffRolesRequestSchema))
    body: z.output<typeof setStaffRolesRequestSchema>,
  ): Promise<StaffUser> {
    return this.setRoles.execute({ actorId: actor.id, staffId: id, ...body });
  }

  @Post(':id/disable')
  @HttpCode(200)
  @RequirePermissions('staff:manage')
  disable(
    @CurrentStaff() actor: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(reasonPipe) body: Reason,
  ): Promise<StaffUser> {
    return this.changeStatus.execute({
      actorId: actor.id,
      staffId: id,
      isEnabled: false,
      reason: body.reason,
    });
  }

  @Post(':id/enable')
  @HttpCode(200)
  @RequirePermissions('staff:manage')
  enable(
    @CurrentStaff() actor: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(reasonPipe) body: Reason,
  ): Promise<StaffUser> {
    return this.changeStatus.execute({
      actorId: actor.id,
      staffId: id,
      isEnabled: true,
      reason: body.reason,
    });
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @RequirePermissions('staff:manage')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(reasonPipe) body: Reason,
  ): Promise<StaffWithTemporaryPassword> {
    return this.resetCredentials.resetPassword(id, body.reason);
  }

  @Post(':id/reset-totp')
  @HttpCode(204)
  @RequirePermissions('staff:manage')
  async resetTotp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(reasonPipe) body: Reason,
  ): Promise<void> {
    await this.resetCredentials.resetTotp(id, body.reason);
  }
}
