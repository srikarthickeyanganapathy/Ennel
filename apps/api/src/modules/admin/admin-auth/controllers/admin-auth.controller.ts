import { Body, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  changePasswordRequestSchema,
  type StaffLoginResponse,
  staffLoginRequestSchema,
  type StaffMe,
  type StaffSession,
  type StaffSessionItem,
  totpConfirmRequestSchema,
  type TotpEnrollment,
  totpLoginRequestSchema,
} from '@ennel/shared';
import type { Request, Response } from 'express';
import { type z } from 'zod';
import {
  AdminController,
  AllowPendingPasswordChange,
  AuthenticatedStaffOnly,
  PublicAdminRoute,
} from '../../../../common/decorators/admin.decorators';
import {
  ClientMeta,
  type RequestClientMeta,
} from '../../../../common/decorators/client-meta.decorator';
import {
  type AuthenticatedStaff,
  CurrentStaff,
} from '../../../../common/decorators/current-staff.decorator';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { RateLimit, RateLimitGuard } from '../../../../common/rate-limit/rate-limit.guard';
import { readCookie } from '../../../../common/utils/cookies';
import { APP_CONFIG, type AppConfig } from '../../../../config/app-config';
import { ChangeStaffPasswordService } from '../services/change-staff-password.service';
import { GetStaffMeService } from '../services/get-staff-me.service';
import { LoginStaffService } from '../services/login-staff.service';
import { LogoutStaffService } from '../services/logout-staff.service';
import { RefreshStaffSessionService } from '../services/refresh-staff-session.service';
import { type IssuedStaffSession } from '../services/staff-session-issuer.service';
import { StaffSessionsService } from '../services/staff-sessions.service';
import { StaffTotpService } from '../services/staff-totp.service';
import { VerifyTotpLoginService } from '../services/verify-totp-login.service';

/** The refresh token lives only in this httpOnly cookie, scoped to the auth routes (ADR-0015). */
export const STAFF_REFRESH_COOKIE = 'ennel_staff_refresh';
const COOKIE_PATH = '/api/v1/admin/auth';

/** Staff authentication (Admin §B). */
@AdminController('auth')
@UseGuards(RateLimitGuard)
export class AdminAuthController {
  constructor(
    private readonly login: LoginStaffService,
    private readonly verifyTotp: VerifyTotpLoginService,
    private readonly refresh: RefreshStaffSessionService,
    private readonly logout: LogoutStaffService,
    private readonly changePassword: ChangeStaffPasswordService,
    private readonly getMe: GetStaffMeService,
    private readonly sessions: StaffSessionsService,
    private readonly totp: StaffTotpService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('login')
  @HttpCode(200)
  @PublicAdminRoute()
  @RateLimit({ name: 'staff-login', limit: 10, windowSeconds: 60 })
  async loginStaff(
    @Body(new ZodValidationPipe(staffLoginRequestSchema))
    body: z.output<typeof staffLoginRequestSchema>,
    @ClientMeta() meta: RequestClientMeta,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StaffLoginResponse> {
    const result = await this.login.execute(body.email, body.password, meta);
    if (result.status === 'TOTP_REQUIRED') return result;
    return { status: 'AUTHENTICATED', session: this.startSession(response, result.issued) };
  }

  @Post('totp/verify')
  @HttpCode(200)
  @PublicAdminRoute()
  @RateLimit({ name: 'staff-totp', limit: 10, windowSeconds: 60 })
  async verifyTotpLogin(
    @Body(new ZodValidationPipe(totpLoginRequestSchema))
    body: z.output<typeof totpLoginRequestSchema>,
    @ClientMeta() meta: RequestClientMeta,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StaffSession> {
    return this.startSession(
      response,
      await this.verifyTotp.execute(body.challengeToken, body.code, meta),
    );
  }

  @Post('refresh')
  @HttpCode(200)
  @PublicAdminRoute()
  @RateLimit({ name: 'staff-refresh', limit: 30, windowSeconds: 60 })
  async refreshSession(
    @Req() request: Request,
    @ClientMeta() meta: RequestClientMeta,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StaffSession> {
    try {
      const issued = await this.refresh.execute(readCookie(request, STAFF_REFRESH_COOKIE), meta);
      return this.startSession(response, issued);
    } catch (error) {
      this.clearCookie(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  @PublicAdminRoute()
  async logoutStaff(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.logout.execute(readCookie(request, STAFF_REFRESH_COOKIE));
    this.clearCookie(response);
  }

  @Get('me')
  @AuthenticatedStaffOnly()
  @AllowPendingPasswordChange()
  me(@CurrentStaff() staff: AuthenticatedStaff): Promise<StaffMe> {
    return this.getMe.execute(staff.id);
  }

  @Post('change-password')
  @HttpCode(200)
  @AuthenticatedStaffOnly()
  @AllowPendingPasswordChange()
  async changeOwnPassword(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body(new ZodValidationPipe(changePasswordRequestSchema))
    body: z.output<typeof changePasswordRequestSchema>,
    @ClientMeta() meta: RequestClientMeta,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StaffSession> {
    const issued = await this.changePassword.execute(staff.id, body, meta);
    return this.startSession(response, issued);
  }

  @Get('sessions')
  @AuthenticatedStaffOnly()
  async listSessions(
    @CurrentStaff() staff: AuthenticatedStaff,
  ): Promise<{ items: StaffSessionItem[] }> {
    return { items: await this.sessions.list(staff.id, staff.sessionId) };
  }

  @Post('sessions/revoke-all')
  @HttpCode(204)
  @AuthenticatedStaffOnly()
  async revokeAllSessions(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessions.revokeAll(staff.id);
    this.clearCookie(response);
  }

  @Post('totp/enroll')
  @HttpCode(200)
  @AuthenticatedStaffOnly()
  enrollTotp(@CurrentStaff() staff: AuthenticatedStaff): Promise<TotpEnrollment> {
    return this.totp.startEnrollment(staff.id);
  }

  @Post('totp/confirm')
  @HttpCode(204)
  @AuthenticatedStaffOnly()
  async confirmTotp(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body(new ZodValidationPipe(totpConfirmRequestSchema))
    body: z.output<typeof totpConfirmRequestSchema>,
  ): Promise<void> {
    await this.totp.confirmEnrollment(staff.id, body.code);
  }

  private startSession(response: Response, issued: IssuedStaffSession): StaffSession {
    response.cookie(STAFF_REFRESH_COOKIE, issued.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.nodeEnv === 'production',
      path: COOKIE_PATH,
      expires: issued.refreshTokenExpiresAt,
    });
    return issued.session;
  }

  private clearCookie(response: Response): void {
    response.clearCookie(STAFF_REFRESH_COOKIE, { path: COOKIE_PATH });
  }
}
