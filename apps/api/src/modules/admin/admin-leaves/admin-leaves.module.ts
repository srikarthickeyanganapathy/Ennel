import { Module } from '@nestjs/common';
import { LeavesModule } from '../../leaves/leaves.module';
import { MessConfigModule } from '../../mess-config/mess-config.module';
import { AdminLeavesController } from './controllers/admin-leaves.controller';
import { AdminLeavesRepository } from './repositories/admin-leaves.repository';
import { AdminLeavesService } from './services/admin-leaves.service';

/** Leave management for staff (Admin §K, Phase 8). */
@Module({
  imports: [LeavesModule, MessConfigModule],
  controllers: [AdminLeavesController],
  providers: [AdminLeavesRepository, AdminLeavesService],
})
export class AdminLeavesModule {}
