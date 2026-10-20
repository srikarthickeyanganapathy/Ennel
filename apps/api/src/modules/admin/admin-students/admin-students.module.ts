import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { MessConfigModule } from '../../mess-config/mess-config.module';
import { AdminStudentsController } from './controllers/admin-students.controller';
import { RosterImportsController } from './controllers/roster-imports.controller';
import {
  AdminStudentsRepository,
  PrismaAdminStudentsRepository,
} from './repositories/admin-students.repository';
import {
  PrismaRosterImportRepository,
  RosterImportRepository,
} from './repositories/roster-import.repository';
import { BulkUpdateHostelService } from './services/bulk-update-hostel.service';
import { ChangeStudentAccessService } from './services/change-student-access.service';
import { ConfirmRosterImportService } from './services/confirm-roster-import.service';
import { GetRosterImportService } from './services/get-roster-import.service';
import { IssueStudentResetService } from './services/issue-student-reset.service';
import { ListAdminStudentsService } from './services/list-admin-students.service';
import { RosterFileParser } from './services/roster-file-parser';
import { UpdateAdminStudentService } from './services/update-admin-student.service';
import { UploadRosterImportService } from './services/upload-roster-import.service';

/** Roster import and student management (Admin §G). */
@Module({
  imports: [AuthModule, MessConfigModule],
  controllers: [AdminStudentsController, RosterImportsController],
  providers: [
    { provide: AdminStudentsRepository, useClass: PrismaAdminStudentsRepository },
    { provide: RosterImportRepository, useClass: PrismaRosterImportRepository },
    RosterFileParser,
    UploadRosterImportService,
    GetRosterImportService,
    ConfirmRosterImportService,
    ListAdminStudentsService,
    UpdateAdminStudentService,
    ChangeStudentAccessService,
    BulkUpdateHostelService,
    IssueStudentResetService,
  ],
})
export class AdminStudentsModule {}
