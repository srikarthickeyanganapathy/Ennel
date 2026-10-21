import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  type AdminMeal,
  type AdminSlot,
  businessDateSchema,
  type CapacityImpact,
  capacityImpactQuerySchema,
  type CapacityOverride,
  capacityOverrideRequestSchema,
  createSlotRequestSchema,
  disableSlotRequestSchema,
  ErrorCode,
  type MessPolicyView,
  reasonRequestSchema,
  type SlotUsage,
  thresholdsRequestSchema,
  updateMealRequestSchema,
  updateSlotRequestSchema,
  weekdayCapacitiesRequestSchema,
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
import { AppError } from '../../../../common/errors/app-error';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { GetMessConfigService } from '../services/get-mess-config.service';
import { PolicySettingsService } from '../services/policy-settings.service';
import { SaveSlotService } from '../services/save-slot.service';
import { type CapacityScope, SlotCapacityService } from '../services/slot-capacity.service';
import { SlotLifecycleService } from '../services/slot-lifecycle.service';
import { UpdateMealService } from '../services/update-meal.service';

const datePipe = new ZodValidationPipe(businessDateSchema);
const reasonPipe = new ZodValidationPipe(reasonRequestSchema);
type Reason = z.output<typeof reasonRequestSchema>;

/** Meals, serving windows, slots, capacities and thresholds (Admin §D). */
@AdminController('mess-config')
export class AdminMessConfigController {
  constructor(
    private readonly config: GetMessConfigService,
    private readonly updateMeal: UpdateMealService,
    private readonly saveSlot: SaveSlotService,
    private readonly lifecycle: SlotLifecycleService,
    private readonly capacity: SlotCapacityService,
    private readonly policy: PolicySettingsService,
  ) {}

  @Get('meals')
  @RequirePermissions('mess-config:read')
  async meals(): Promise<{ items: AdminMeal[] }> {
    return { items: await this.config.meals() };
  }

  @Patch('meals/:id')
  @RequirePermissions('mess-config:update')
  patchMeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateMealRequestSchema))
    body: z.output<typeof updateMealRequestSchema>,
  ): Promise<AdminMeal> {
    return this.updateMeal.execute({ id, ...body });
  }

  @Post('slots')
  @RequirePermissions('mess-config:update')
  createSlot(
    @Body(new ZodValidationPipe(createSlotRequestSchema))
    body: z.output<typeof createSlotRequestSchema>,
  ): Promise<AdminSlot> {
    const { mealId, ...input } = body;
    return this.saveSlot.create(mealId, input);
  }

  @Patch('slots/:id')
  @RequirePermissions('mess-config:update')
  patchSlot(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateSlotRequestSchema))
    body: z.output<typeof updateSlotRequestSchema>,
  ): Promise<AdminSlot> {
    const { version, reason, ...input } = body;
    return this.saveSlot.update(id, version, input, reason);
  }

  @Get('slots/:id/usage')
  @RequirePermissions('mess-config:read')
  usage(@Param('id', ParseUUIDPipe) id: string): Promise<SlotUsage> {
    return this.lifecycle.usage(id);
  }

  @Post('slots/:id/disable')
  @HttpCode(200)
  @RequirePermissions('mess-config:update')
  disable(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(disableSlotRequestSchema))
    body: z.output<typeof disableSlotRequestSchema>,
  ): Promise<AdminSlot> {
    return this.lifecycle.disable({ slotId: id, ...body, staffId: staff.id });
  }

  @Post('slots/:id/enable')
  @HttpCode(200)
  @RequirePermissions('mess-config:update')
  enable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(reasonPipe) body: Reason,
  ): Promise<AdminSlot> {
    return this.lifecycle.enable(id, body.reason);
  }

  @Delete('slots/:id')
  @HttpCode(204)
  @RequirePermissions('mess-config:update')
  async deleteSlot(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(reasonPipe) body: Reason,
  ): Promise<void> {
    await this.lifecycle.delete(id, body.reason);
  }

  @Put('slots/:id/weekday-capacities')
  @RequirePermissions('mess-config:update')
  weekdayCapacities(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(weekdayCapacitiesRequestSchema))
    body: z.output<typeof weekdayCapacitiesRequestSchema>,
  ): Promise<AdminSlot> {
    return this.capacity.setWeekdayCapacities(id, body.capacities, body.reason);
  }

  @Get('slots/:id/capacity-overrides')
  @RequirePermissions('mess-config:read')
  async overrides(@Param('id', ParseUUIDPipe) id: string): Promise<{ items: CapacityOverride[] }> {
    return { items: await this.capacity.listOverrides(id) };
  }

  @Put('slots/:id/capacity-overrides/:date')
  @HttpCode(204)
  @RequirePermissions('mess-config:update')
  async putOverride(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('date', datePipe) date: string,
    @Body(new ZodValidationPipe(capacityOverrideRequestSchema))
    body: z.output<typeof capacityOverrideRequestSchema>,
  ): Promise<void> {
    await this.capacity.setOverride(id, date, body.capacity, body.reason, staff.id);
  }

  @Delete('slots/:id/capacity-overrides/:date')
  @HttpCode(204)
  @RequirePermissions('mess-config:update')
  async deleteOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('date', datePipe) date: string,
    @Body(reasonPipe) body: Reason,
  ): Promise<void> {
    await this.capacity.removeOverride(id, date, body.reason);
  }

  @Get('slots/:id/capacity-impact')
  @RequirePermissions('mess-config:read')
  impact(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(capacityImpactQuerySchema))
    query: z.output<typeof capacityImpactQuerySchema>,
  ): Promise<CapacityImpact> {
    return this.capacity.impact(id, query.capacity, toScope(query));
  }

  /** Thresholds live in mess_policy but are configuration, not policy (ADR-0013). */
  @Patch('thresholds')
  @RequirePermissions('mess-config:update')
  thresholds(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body(new ZodValidationPipe(thresholdsRequestSchema))
    body: z.output<typeof thresholdsRequestSchema>,
  ): Promise<MessPolicyView> {
    const { version, reason, ...changes } = body;
    return this.policy.update({
      changes,
      version,
      reason,
      staffId: staff.id,
      action: 'policy.thresholds.update',
    });
  }
}

/** A WEEKDAY or DATE check without its weekday or date would silently report another scope. */
function toScope(query: z.output<typeof capacityImpactQuerySchema>): CapacityScope {
  if (query.scope === 'WEEKDAY') {
    if (query.weekday === undefined) throw missingQuery('weekday');
    return { scope: 'WEEKDAY', weekday: query.weekday };
  }
  if (query.scope === 'DATE') {
    if (!query.date) throw missingQuery('date');
    return { scope: 'DATE', date: query.date };
  }
  return { scope: 'DEFAULT' };
}

function missingQuery(path: 'weekday' | 'date'): AppError {
  return new AppError(ErrorCode.VALIDATION_FAILED, 'The request is invalid.', {
    issues: [{ path, message: `Required for this scope` }],
  });
}
