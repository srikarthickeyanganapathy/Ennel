import { Module } from '@nestjs/common';
import { MessConfigModule } from '../../mess-config/mess-config.module';
import { SlotsModule } from '../../slots/slots.module';
import { AdminHostelsController } from './controllers/admin-hostels.controller';
import { AdminMessConfigController } from './controllers/admin-mess-config.controller';
import { AdminPolicyController } from './controllers/admin-policy.controller';
import { AdminMessConfigRepository } from './repositories/admin-mess-config.repository';
import { AdminPolicyRepository } from './repositories/admin-policy.repository';
import { GetMessConfigService } from './services/get-mess-config.service';
import { ManageHostelsService } from './services/manage-hostels.service';
import { PolicySettingsService } from './services/policy-settings.service';
import { SaveSlotService } from './services/save-slot.service';
import { SlotCapacityService } from './services/slot-capacity.service';
import { SlotLifecycleService } from './services/slot-lifecycle.service';
import { UpdateMealService } from './services/update-meal.service';

/** Mess configuration, hostels and policy settings (Admin §D). */
@Module({
  imports: [MessConfigModule, SlotsModule],
  controllers: [AdminMessConfigController, AdminPolicyController, AdminHostelsController],
  providers: [
    AdminMessConfigRepository,
    AdminPolicyRepository,
    GetMessConfigService,
    UpdateMealService,
    SaveSlotService,
    SlotLifecycleService,
    SlotCapacityService,
    PolicySettingsService,
    ManageHostelsService,
  ],
})
export class AdminMessConfigModule {}
