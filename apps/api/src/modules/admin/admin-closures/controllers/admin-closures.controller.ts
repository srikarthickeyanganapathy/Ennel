import { Body, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  type AdminClosure,
  type ClosureImpact,
  closureImpactQuerySchema,
  closureListQuerySchema,
  type ClosureResult,
  createClosureRequestSchema,
  removeClosureRequestSchema,
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
import { ApplyClosureService } from '../services/apply-closure.service';
import { ClosureQueriesService } from '../services/closure-queries.service';
import { RemoveClosureService } from '../services/remove-closure.service';

/** Closures, holidays and special meals (Admin §F). */
@AdminController('closures')
export class AdminClosuresController {
  constructor(
    private readonly queries: ClosureQueriesService,
    private readonly applyClosure: ApplyClosureService,
    private readonly removeClosure: RemoveClosureService,
  ) {}

  @Get()
  @RequirePermissions('closures:read')
  async list(
    @Query(new ZodValidationPipe(closureListQuerySchema))
    query: z.output<typeof closureListQuerySchema>,
  ): Promise<{ items: AdminClosure[] }> {
    return { items: await this.queries.list(query) };
  }

  @Get('impact')
  @RequirePermissions('closures:read')
  impact(
    @Query(new ZodValidationPipe(closureImpactQuerySchema))
    query: z.output<typeof closureImpactQuerySchema>,
  ): Promise<ClosureImpact> {
    return this.queries.impact(query);
  }

  @Post()
  @RequirePermissions('closures:manage')
  create(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body(new ZodValidationPipe(createClosureRequestSchema))
    body: z.output<typeof createClosureRequestSchema>,
  ): Promise<ClosureResult> {
    return this.applyClosure.execute(staff.id, body);
  }

  @Post(':id/remove')
  @HttpCode(200)
  @RequirePermissions('closures:manage')
  remove(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(removeClosureRequestSchema))
    body: z.output<typeof removeClosureRequestSchema>,
  ): Promise<ClosureResult> {
    return this.removeClosure.execute(staff.id, id, body.reason);
  }
}
