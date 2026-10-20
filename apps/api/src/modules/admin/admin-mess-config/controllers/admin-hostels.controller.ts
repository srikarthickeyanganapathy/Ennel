import { Body, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  type AdminHostel,
  hostelNameRequestSchema,
  hostelUpdateRequestSchema,
} from '@ennel/shared';
import { type z } from 'zod';
import {
  AdminController,
  AuthenticatedStaffOnly,
  RequirePermissions,
} from '../../../../common/decorators/admin.decorators';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { ManageHostelsService } from '../services/manage-hostels.service';

type Name = z.output<typeof hostelNameRequestSchema>;
type Update = z.output<typeof hostelUpdateRequestSchema>;
const namePipe = new ZodValidationPipe(hostelNameRequestSchema);
const updatePipe = new ZodValidationPipe(hostelUpdateRequestSchema);

@AdminController('hostels')
export class AdminHostelsController {
  constructor(private readonly hostels: ManageHostelsService) {}

  // Reference data used for filters on many pages (students, announcements), so any staff may read it.
  @Get()
  @AuthenticatedStaffOnly()
  async list(): Promise<{ items: AdminHostel[] }> {
    return { items: await this.hostels.list() };
  }

  @Post()
  @RequirePermissions('mess-config:update')
  async create(@Body(namePipe) body: Name): Promise<{ items: AdminHostel[] }> {
    return { items: await this.hostels.createHostel(body.name) };
  }

  @Patch('blocks/:blockId')
  @RequirePermissions('mess-config:update')
  async updateBlock(
    @Param('blockId', ParseUUIDPipe) blockId: string,
    @Body(updatePipe) body: Update,
  ): Promise<{ items: AdminHostel[] }> {
    return { items: await this.hostels.updateBlock(blockId, body) };
  }

  @Patch(':id')
  @RequirePermissions('mess-config:update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(updatePipe) body: Update,
  ): Promise<{ items: AdminHostel[] }> {
    return { items: await this.hostels.updateHostel(id, body) };
  }

  @Post(':id/blocks')
  @RequirePermissions('mess-config:update')
  async createBlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(namePipe) body: Name,
  ): Promise<{ items: AdminHostel[] }> {
    return { items: await this.hostels.createBlock(id, body.name) };
  }
}
