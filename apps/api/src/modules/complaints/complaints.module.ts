import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessConfigModule } from '../mess-config/mess-config.module';
import { ComplaintsController } from './controllers/complaints.controller';
import { ComplaintsRepository } from './repositories/complaints.repository';
import { ComplaintPhotos } from './services/complaint-photos.service';
import { StudentComplaintsService } from './services/student-complaints.service';

/** Student complaints and feedback (Spec §12, Phase 10). The staff inbox is AdminComplaintsModule. */
@Module({
  imports: [AuthModule, MessConfigModule],
  controllers: [ComplaintsController],
  providers: [ComplaintsRepository, ComplaintPhotos, StudentComplaintsService],
  exports: [ComplaintsRepository],
})
export class ComplaintsModule {}
