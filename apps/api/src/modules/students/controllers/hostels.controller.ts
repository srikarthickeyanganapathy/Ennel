import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type HostelOption } from '@ennel/shared';
import { StudentJwtAuthGuard } from '../../../common/guards/student-jwt-auth.guard';
import { ListHostelsService } from '../services/list-hostels.service';

@ApiTags('hostels')
@ApiBearerAuth()
@Controller('hostels')
@UseGuards(StudentJwtAuthGuard)
export class HostelsController {
  constructor(private readonly listHostels: ListHostelsService) {}

  @Get()
  async list(): Promise<{ items: HostelOption[] }> {
    return { items: await this.listHostels.execute() };
  }
}
