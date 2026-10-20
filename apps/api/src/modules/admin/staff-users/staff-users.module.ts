import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { StaffUsersController } from './controllers/staff-users.controller';
import {
  PrismaStaffUsersRepository,
  StaffUsersRepository,
} from './repositories/staff-users.repository';
import { ChangeStaffStatusService } from './services/change-staff-status.service';
import { CreateStaffService } from './services/create-staff.service';
import { ListStaffService } from './services/list-staff.service';
import { ResetStaffCredentialsService } from './services/reset-staff-credentials.service';
import { SetStaffRolesService } from './services/set-staff-roles.service';
import { UpdateStaffService } from './services/update-staff.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [StaffUsersController],
  providers: [
    { provide: StaffUsersRepository, useClass: PrismaStaffUsersRepository },
    ListStaffService,
    CreateStaffService,
    UpdateStaffService,
    SetStaffRolesService,
    ChangeStaffStatusService,
    ResetStaffCredentialsService,
  ],
})
export class StaffUsersModule {}
