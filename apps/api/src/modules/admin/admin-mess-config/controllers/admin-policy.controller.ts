import { Body, Get, Patch, Query } from '@nestjs/common';
import {
  type MessPolicyView,
  type Paginated,
  paginationQuerySchema,
  type PolicyHistoryItem,
  updatePolicyRequestSchema,
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
import { PolicySettingsService } from '../services/policy-settings.service';

/** `mess_policy` settings (Rule 8) with history; editing needs policy:update (Super Admin by default). */
@AdminController('policy')
export class AdminPolicyController {
  constructor(private readonly policy: PolicySettingsService) {}

  @Get()
  @RequirePermissions('policy:read')
  get(): Promise<MessPolicyView> {
    return this.policy.get();
  }

  @Patch()
  @RequirePermissions('policy:update')
  update(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body(new ZodValidationPipe(updatePolicyRequestSchema))
    body: z.output<typeof updatePolicyRequestSchema>,
  ): Promise<MessPolicyView> {
    const { version, reason, ...changes } = body;
    return this.policy.update({
      changes,
      version,
      reason,
      staffId: staff.id,
      action: 'policy.update',
    });
  }

  @Get('history')
  @RequirePermissions('policy:read')
  history(
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: z.output<typeof paginationQuerySchema>,
  ): Promise<Paginated<PolicyHistoryItem>> {
    return this.policy.history(query.page, query.pageSize);
  }
}
