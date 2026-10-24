import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessConfigModule } from '../mess-config/mess-config.module';
import { SlotsController } from './controllers/slots.controller';
import {
  PrismaSlotAvailabilityRepository,
  SlotAvailabilityRepository,
} from './repositories/slot-availability.repository';
import { GetSlotAvailabilityService } from './services/get-slot-availability.service';

/** Live slot availability (Phase 3, Spec §5). The booking engine reuses it in Phase 4. */
@Module({
  imports: [AuthModule, MessConfigModule],
  controllers: [SlotsController],
  providers: [
    { provide: SlotAvailabilityRepository, useClass: PrismaSlotAvailabilityRepository },
    GetSlotAvailabilityService,
  ],
  exports: [GetSlotAvailabilityService, SlotAvailabilityRepository],
})
export class SlotsModule {}
