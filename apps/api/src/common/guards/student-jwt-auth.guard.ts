import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { ErrorCode } from '@ennel/shared';
import { StudentSessionRepository } from '../../modules/auth/repositories/student-session.repository';
import { StudentAccessTokenService } from '../../modules/auth/services/student-access-token.service';
import { getRequestContext } from '../context/request-context';
import { type StudentRequest } from '../decorators/current-student.decorator';
import { AppError } from '../errors/app-error';

/** Guards student routes under /api/v1. Staff tokens fail: different secret and audience (ADR-0015). */
@Injectable()
export class StudentJwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: StudentAccessTokenService,
    private readonly sessions: StudentSessionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StudentRequest>();
    const token = extractBearerToken(request.header('authorization'));
    const claims = token ? await this.tokens.verify(token) : null;
    // A revoked session ends at once, not when its access token expires (ADR-0015).
    if (!claims || !(await this.sessions.isActive(claims.studentId, claims.sessionId))) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Please log in to continue.');
    }
    const studentId = claims.studentId;
    request.student = { id: studentId };
    const requestContext = getRequestContext();
    if (requestContext) requestContext.actor = { type: 'STUDENT', id: studentId, roles: [] };
    return true;
  }
}

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
