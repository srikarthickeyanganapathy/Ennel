import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StudentJwtAuthGuard } from '../../common/guards/student-jwt-auth.guard';
import { StudentAuthController } from './controllers/student-auth.controller';
import {
  PrismaStudentAuthRepository,
  StudentAuthRepository,
} from './repositories/student-auth.repository';
import {
  PrismaStudentSessionRepository,
  StudentSessionRepository,
} from './repositories/student-session.repository';
import { CheckRosterService } from './services/check-roster.service';
import { LoginStudentService } from './services/login-student.service';
import { LogoutStudentService } from './services/logout-student.service';
import { RefreshStudentSessionService } from './services/refresh-student-session.service';
import { RegisterStudentService } from './services/register-student.service';
import { StudentAccessTokenService } from './services/student-access-token.service';
import { StudentSessionIssuer } from './services/student-session-issuer.service';

/** Student authentication. Exports the guard dependencies used by every student module. */
@Module({
  imports: [JwtModule.register({})],
  controllers: [StudentAuthController],
  providers: [
    { provide: StudentAuthRepository, useClass: PrismaStudentAuthRepository },
    { provide: StudentSessionRepository, useClass: PrismaStudentSessionRepository },
    StudentAccessTokenService,
    StudentSessionIssuer,
    StudentJwtAuthGuard,
    CheckRosterService,
    RegisterStudentService,
    LoginStudentService,
    RefreshStudentSessionService,
    LogoutStudentService,
  ],
  exports: [StudentAccessTokenService, StudentJwtAuthGuard],
})
export class AuthModule {}
