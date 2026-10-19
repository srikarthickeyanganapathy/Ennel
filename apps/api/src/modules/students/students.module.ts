import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DefaultPreferencesModule } from '../default-preferences/default-preferences.module';
import { MessConfigModule } from '../mess-config/mess-config.module';
import { HostelsController } from './controllers/hostels.controller';
import { MeController } from './controllers/me.controller';
import { HostelRepository, PrismaHostelRepository } from './repositories/hostel.repository';
import {
  PrismaStudentProfileRepository,
  StudentProfileRepository,
} from './repositories/student-profile.repository';
import { CompleteOnboardingService } from './services/complete-onboarding.service';
import { GetMyProfileService } from './services/get-my-profile.service';
import { ListHostelsService } from './services/list-hostels.service';
import { UpdateMyPhotoService } from './services/update-my-photo.service';
import { UpdateMyProfileService } from './services/update-my-profile.service';

@Module({
  imports: [AuthModule, MessConfigModule, DefaultPreferencesModule],
  controllers: [MeController, HostelsController],
  providers: [
    { provide: StudentProfileRepository, useClass: PrismaStudentProfileRepository },
    { provide: HostelRepository, useClass: PrismaHostelRepository },
    GetMyProfileService,
    UpdateMyProfileService,
    UpdateMyPhotoService,
    CompleteOnboardingService,
    ListHostelsService,
  ],
})
export class StudentsModule {}
