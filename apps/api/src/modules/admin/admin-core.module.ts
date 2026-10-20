import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { StaffJwtAuthGuard } from '../../common/guards/staff-jwt-auth.guard';
import { StaffAccessTokenService } from './admin-auth/services/staff-access-token.service';
import {
  PrismaStaffAccessRepository,
  StaffAccessRepository,
} from './rbac/repositories/staff-access.repository';
import { StaffPermissionsService } from './rbac/services/staff-permissions.service';

/**
 * What every admin controller's guards need, provided once and globally so each admin
 * feature module stays independent.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    StaffAccessTokenService,
    { provide: StaffAccessRepository, useClass: PrismaStaffAccessRepository },
    StaffPermissionsService,
    StaffJwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [
    StaffAccessTokenService,
    StaffPermissionsService,
    StaffJwtAuthGuard,
    PermissionsGuard,
    JwtModule,
  ],
})
export class AdminCoreModule {}
