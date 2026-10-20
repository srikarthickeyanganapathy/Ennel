import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppExceptionFilter } from './common/filters/app-exception.filter';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { ConfigModule } from './config/config.module';
import { ClockModule } from './infrastructure/clock/clock.module';
import { CryptoModule } from './infrastructure/crypto/crypto.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AdminAuthModule } from './modules/admin/admin-auth/admin-auth.module';
import { AdminCoreModule } from './modules/admin/admin-core.module';
import { AdminStudentsModule } from './modules/admin/admin-students/admin-students.module';
import { AuditLogModule } from './modules/admin/audit-log/audit-log.module';
import { RbacModule } from './modules/admin/rbac/rbac.module';
import { StaffUsersModule } from './modules/admin/staff-users/staff-users.module';
import { AuthModule } from './modules/auth/auth.module';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './modules/health/health.module';
import { MessConfigModule } from './modules/mess-config/mess-config.module';
import { StudentsModule } from './modules/students/students.module';

@Module({
  imports: [
    ConfigModule,
    ClockModule,
    DatabaseModule,
    RedisModule,
    StorageModule,
    CryptoModule,
    RateLimitModule,
    HealthModule,
    FilesModule,
    AuthModule,
    MessConfigModule,
    StudentsModule,
    // Staff surface (/api/v1/admin)
    AdminCoreModule,
    AuditLogModule,
    AdminAuthModule,
    RbacModule,
    StaffUsersModule,
    AdminStudentsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AppExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*path');
  }
}
