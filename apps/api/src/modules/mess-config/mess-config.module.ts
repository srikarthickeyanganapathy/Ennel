import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MealsController } from './controllers/meals.controller';
import {
  MealConfigRepository,
  PrismaMealConfigRepository,
} from './repositories/meal-config.repository';
import {
  MessPolicyRepository,
  PrismaMessPolicyRepository,
} from './repositories/mess-policy.repository';
import { GetMessPolicyService } from './services/get-mess-policy.service';
import { ListMealsService } from './services/list-meals.service';

/** Read side of mess configuration; staff edits live in admin-mess-config (Phase 2). */
@Module({
  imports: [AuthModule],
  controllers: [MealsController],
  providers: [
    { provide: MealConfigRepository, useClass: PrismaMealConfigRepository },
    { provide: MessPolicyRepository, useClass: PrismaMessPolicyRepository },
    ListMealsService,
    GetMessPolicyService,
  ],
  exports: [ListMealsService, GetMessPolicyService],
})
export class MessConfigModule {}
