import { Module } from '@nestjs/common';
import { AdminAuthController } from './controllers/admin-auth.controller';
import {
  PrismaStaffAuthRepository,
  StaffAuthRepository,
} from './repositories/staff-auth.repository';
import {
  PrismaStaffSessionRepository,
  StaffSessionRepository,
} from './repositories/staff-session.repository';
import { ChangeStaffPasswordService } from './services/change-staff-password.service';
import { GetStaffMeService } from './services/get-staff-me.service';
import { LoginStaffService } from './services/login-staff.service';
import { LogoutStaffService } from './services/logout-staff.service';
import { RefreshStaffSessionService } from './services/refresh-staff-session.service';
import { StaffSessionIssuer } from './services/staff-session-issuer.service';
import { StaffSessionsService } from './services/staff-sessions.service';
import { StaffTotpService } from './services/staff-totp.service';
import { VerifyTotpLoginService } from './services/verify-totp-login.service';

/** Staff sign-in, password, sessions and 2FA (Admin §B). */
@Module({
  controllers: [AdminAuthController],
  providers: [
    { provide: StaffAuthRepository, useClass: PrismaStaffAuthRepository },
    { provide: StaffSessionRepository, useClass: PrismaStaffSessionRepository },
    StaffSessionIssuer,
    LoginStaffService,
    VerifyTotpLoginService,
    RefreshStaffSessionService,
    LogoutStaffService,
    ChangeStaffPasswordService,
    GetStaffMeService,
    StaffSessionsService,
    StaffTotpService,
  ],
  exports: [StaffSessionsService],
})
export class AdminAuthModule {}
