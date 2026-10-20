import { Module } from '@nestjs/common';
import { RolesController } from './controllers/roles.controller';
import { PrismaRolesRepository, RolesRepository } from './repositories/roles.repository';
import { RolePermissionsService } from './services/role-permissions.service';

/** Role editing. Permission resolution for guards lives in AdminCoreModule. */
@Module({
  controllers: [RolesController],
  providers: [
    { provide: RolesRepository, useClass: PrismaRolesRepository },
    RolePermissionsService,
  ],
})
export class RbacModule {}
