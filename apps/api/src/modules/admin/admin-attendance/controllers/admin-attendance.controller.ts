import {
  Body,
  Get,
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
  type AttendanceCounter,
  type AttendanceImport,
  type AttendanceLookup,
  attendanceLookupQuerySchema,
  type AttendanceWindowQuery,
  attendanceWindowQuerySchema,
  endOutageRequestSchema,
  markAttendanceRequestSchema,
  type OutageStatus,
  startOutageRequestSchema,
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
import { AttendanceCounterService } from '../services/attendance-counter.service';
import { AttendanceImportService } from '../services/attendance-import.service';
import { MarkAttendanceService } from '../services/mark-attendance.service';
import { OutageService } from '../services/outage.service';

/** Attendance counter, outage mode and attendance import (Admin §I). */
@AdminController('attendance')
export class AdminAttendanceController {
  constructor(
    private readonly counter: AttendanceCounterService,
    private readonly marks: MarkAttendanceService,
    private readonly outage: OutageService,
    private readonly imports: AttendanceImportService,
  ) {}

  @Get('active')
  @RequirePermissions('attendance:read')
  active(): Promise<AttendanceWindowQuery> {
    return this.counter.active();
  }

  @Get('counter')
  @RequirePermissions('attendance:read')
  getCounter(
    @Query(new ZodValidationPipe(attendanceWindowQuerySchema))
    query: z.output<typeof attendanceWindowQuerySchema>,
  ): Promise<AttendanceCounter> {
    return this.counter.counter(query.date, query.mealType);
  }

  @Get('lookup')
  @RequirePermissions('attendance:read')
  lookup(
    @Query(new ZodValidationPipe(attendanceLookupQuerySchema))
    query: z.output<typeof attendanceLookupQuerySchema>,
  ): Promise<AttendanceLookup> {
    return this.counter.lookup(query);
  }

  @Post('marks')
  @RequirePermissions('attendance:mark')
  mark(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body(new ZodValidationPipe(markAttendanceRequestSchema))
    body: z.output<typeof markAttendanceRequestSchema>,
  ): Promise<AttendanceLookup> {
    return this.marks.execute(staff.id, body);
  }

  @Get('outage')
  @RequirePermissions('attendance:read')
  outageStatus(): Promise<OutageStatus> {
    return this.outage.status();
  }

  @Post('outage/start')
  @HttpCode(200)
  @RequirePermissions('attendance:outage-toggle')
  startOutage(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body(new ZodValidationPipe(startOutageRequestSchema))
    body: z.output<typeof startOutageRequestSchema>,
  ): Promise<OutageStatus> {
    return this.outage.start(staff.id, body.reason);
  }

  @Post('outage/end')
  @HttpCode(200)
  @RequirePermissions('attendance:outage-toggle')
  endOutage(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body(new ZodValidationPipe(endOutageRequestSchema))
    body: z.output<typeof endOutageRequestSchema>,
  ): Promise<OutageStatus> {
    return this.outage.end(staff.id, body.reason);
  }

  @Post('imports')
  @RequirePermissions('attendance:import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 + 1, files: 1 } }))
  upload(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Query(new ZodValidationPipe(attendanceWindowQuerySchema))
    query: z.output<typeof attendanceWindowQuerySchema>,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<AttendanceImport> {
    return this.imports.upload(
      { buffer: file?.buffer, originalName: file?.originalname ?? 'attendance' },
      query,
      staff.id,
    );
  }

  @Get('imports/:id')
  @RequirePermissions('attendance:import')
  getImport(@Param('id', ParseUUIDPipe) id: string): Promise<AttendanceImport> {
    return this.imports.get(id);
  }

  @Post('imports/:id/confirm')
  @HttpCode(200)
  @RequirePermissions('attendance:import')
  confirmImport(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AttendanceImport> {
    return this.imports.confirm(id, staff.id);
  }
}
