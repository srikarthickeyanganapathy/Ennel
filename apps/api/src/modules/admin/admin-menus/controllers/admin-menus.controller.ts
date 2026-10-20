import { Body, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import {
  type AdminMenu,
  bulkSaveMenusRequestSchema,
  businessDateSchema,
  copyMenuWeekRequestSchema,
  mealTypeSchema,
  type MenuWeek,
  menuWeekQuerySchema,
  type PublishMenuResponse,
  saveMenuRequestSchema,
} from '@ennel/shared';
import { z } from 'zod';
import {
  AdminController,
  RequirePermissions,
} from '../../../../common/decorators/admin.decorators';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { MenuEditorService } from '../services/menu-editor.service';
import { PublishMenuService } from '../services/publish-menu.service';

const publishRequestSchema = z.object({ version: z.number().int().min(1) });

/** Menu management (Admin §E). */
@AdminController('menus')
export class AdminMenusController {
  constructor(
    private readonly editor: MenuEditorService,
    private readonly publisher: PublishMenuService,
  ) {}

  @Get()
  @RequirePermissions('menus:read')
  week(
    @Query(new ZodValidationPipe(menuWeekQuerySchema)) query: z.output<typeof menuWeekQuerySchema>,
  ): Promise<MenuWeek> {
    return this.editor.week(query.from, query.days);
  }

  @Post('bulk')
  @HttpCode(200)
  @RequirePermissions('menus:update')
  async bulk(
    @Body(new ZodValidationPipe(bulkSaveMenusRequestSchema))
    body: z.output<typeof bulkSaveMenusRequestSchema>,
  ): Promise<{ items: AdminMenu[] }> {
    return { items: await this.editor.saveMany(body.entries) };
  }

  @Post('copy-week')
  @HttpCode(200)
  @RequirePermissions('menus:update')
  copyWeek(
    @Body(new ZodValidationPipe(copyMenuWeekRequestSchema))
    body: z.output<typeof copyMenuWeekRequestSchema>,
  ): Promise<{ copied: number }> {
    return this.editor.copyWeek(body.fromWeekStart, body.toWeekStart, body.overwrite);
  }

  @Put(':date/:mealType')
  @RequirePermissions('menus:update')
  save(
    @Param('date', new ZodValidationPipe(businessDateSchema)) mealDate: string,
    @Param('mealType', new ZodValidationPipe(mealTypeSchema))
    mealType: z.output<typeof mealTypeSchema>,
    @Body(new ZodValidationPipe(saveMenuRequestSchema))
    body: z.output<typeof saveMenuRequestSchema>,
  ): Promise<AdminMenu> {
    return this.editor.save({ mealDate, mealType, ...body });
  }

  @Post(':id/publish')
  @HttpCode(200)
  @RequirePermissions('menus:publish')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(publishRequestSchema)) body: z.output<typeof publishRequestSchema>,
  ): Promise<PublishMenuResponse> {
    return this.publisher.execute(id, body.version);
  }
}
