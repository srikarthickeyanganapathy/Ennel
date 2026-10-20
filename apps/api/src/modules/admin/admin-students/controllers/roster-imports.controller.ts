import {
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';
import {
  type Paginated,
  paginationQuerySchema,
  ROSTER_IMPORT_MAX_BYTES,
  type RosterImportRow,
  rosterImportRowsQuerySchema,
  type RosterImportSummary,
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
import { ConfirmRosterImportService } from '../services/confirm-roster-import.service';
import { GetRosterImportService } from '../services/get-roster-import.service';
import { UploadRosterImportService } from '../services/upload-roster-import.service';

/** Validate-first roster import (Admin §G): upload → preview → confirm. */
@AdminController('roster-imports')
export class RosterImportsController {
  constructor(
    private readonly upload: UploadRosterImportService,
    private readonly getImport: GetRosterImportService,
    private readonly confirm: ConfirmRosterImportService,
  ) {}

  @Get()
  @RequirePermissions('roster:import')
  list(
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: z.output<typeof paginationQuerySchema>,
  ): Promise<Paginated<RosterImportSummary>> {
    return this.getImport.list(query.page, query.pageSize);
  }

  @Get('template')
  @RequirePermissions('roster:import')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="roster-template.csv"')
  template(): string {
    return this.getImport.template();
  }

  @Post()
  @RequirePermissions('roster:import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: ROSTER_IMPORT_MAX_BYTES + 1, files: 1 } }),
  )
  create(
    @CurrentStaff() staff: AuthenticatedStaff,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<RosterImportSummary> {
    return this.upload.execute(
      { buffer: file?.buffer, originalName: file?.originalname ?? 'roster' },
      staff.id,
    );
  }

  @Get(':id')
  @RequirePermissions('roster:import')
  summary(@Param('id', ParseUUIDPipe) id: string): Promise<RosterImportSummary> {
    return this.getImport.summary(id);
  }

  @Get(':id/rows')
  @RequirePermissions('roster:import')
  rows(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(rosterImportRowsQuerySchema))
    query: z.output<typeof rosterImportRowsQuerySchema>,
  ): Promise<Paginated<RosterImportRow>> {
    return this.getImport.rows(id, query.outcome, query.page, query.pageSize);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @RequirePermissions('roster:import')
  confirmImport(@Param('id', ParseUUIDPipe) id: string): Promise<RosterImportSummary> {
    return this.confirm.execute(id);
  }
}
