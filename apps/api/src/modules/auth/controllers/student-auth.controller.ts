import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type AuthSession,
  loginRequestSchema,
  logoutRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  resetWithCodeRequestSchema,
  type RosterCheckResponse,
  rosterCheckRequestSchema,
} from '@ennel/shared';
import { type z } from 'zod';
import {
  ClientMeta,
  type RequestClientMeta,
} from '../../../common/decorators/client-meta.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { RateLimit, RateLimitGuard } from '../../../common/rate-limit/rate-limit.guard';
import { CheckRosterService } from '../services/check-roster.service';
import { LoginStudentService } from '../services/login-student.service';
import { LogoutStudentService } from '../services/logout-student.service';
import { RefreshStudentSessionService } from '../services/refresh-student-session.service';
import { RegisterStudentService } from '../services/register-student.service';
import { ResetWithCodeService } from '../services/reset-with-code.service';

/** Student account creation and sign-in (Spec §3 Screens 2-4, Rule 11). */
@ApiTags('student-auth')
@Controller('auth')
@UseGuards(RateLimitGuard)
export class StudentAuthController {
  constructor(
    private readonly checkRoster: CheckRosterService,
    private readonly register: RegisterStudentService,
    private readonly login: LoginStudentService,
    private readonly refresh: RefreshStudentSessionService,
    private readonly logout: LogoutStudentService,
    private readonly resetWithCode: ResetWithCodeService,
  ) {}

  @Post('roster-check')
  @HttpCode(200)
  @RateLimit({ name: 'student-roster-check', limit: 20, windowSeconds: 60 })
  rosterCheck(
    @Body(new ZodValidationPipe(rosterCheckRequestSchema))
    body: z.output<typeof rosterCheckRequestSchema>,
  ): Promise<RosterCheckResponse> {
    return this.checkRoster.execute(body.referenceNumber);
  }

  @Post('register')
  @RateLimit({ name: 'student-register', limit: 10, windowSeconds: 60 })
  registerStudent(
    @Body(new ZodValidationPipe(registerRequestSchema))
    body: z.output<typeof registerRequestSchema>,
    @ClientMeta() meta: RequestClientMeta,
  ): Promise<AuthSession> {
    return this.register.execute(body, meta);
  }

  @Post('login')
  @HttpCode(200)
  @RateLimit({ name: 'student-login', limit: 10, windowSeconds: 60 })
  loginStudent(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: z.output<typeof loginRequestSchema>,
    @ClientMeta() meta: RequestClientMeta,
  ): Promise<AuthSession> {
    return this.login.execute(body, meta);
  }

  @Post('refresh')
  @HttpCode(200)
  @RateLimit({ name: 'student-refresh', limit: 30, windowSeconds: 60 })
  refreshSession(
    @Body(new ZodValidationPipe(refreshRequestSchema)) body: z.output<typeof refreshRequestSchema>,
    @ClientMeta() meta: RequestClientMeta,
  ): Promise<AuthSession> {
    return this.refresh.execute(body.refreshToken, meta);
  }

  @Post('logout')
  @HttpCode(204)
  async logoutStudent(
    @Body(new ZodValidationPipe(logoutRequestSchema)) body: z.output<typeof refreshRequestSchema>,
  ): Promise<void> {
    await this.logout.execute(body.refreshToken);
  }

  /** ADR-0019: redeem a staff-issued one-time code. */
  @Post('reset-with-code')
  @HttpCode(200)
  @RateLimit({ name: 'student-reset-code', limit: 10, windowSeconds: 60 })
  resetPassword(
    @Body(new ZodValidationPipe(resetWithCodeRequestSchema))
    body: z.output<typeof resetWithCodeRequestSchema>,
    @ClientMeta() meta: RequestClientMeta,
  ): Promise<AuthSession> {
    return this.resetWithCode.execute(body, meta);
  }
}
