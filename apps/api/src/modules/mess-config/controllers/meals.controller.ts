import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type MealConfig } from '@ennel/shared';
import { StudentJwtAuthGuard } from '../../../common/guards/student-jwt-auth.guard';
import { ListMealsService } from '../services/list-meals.service';

@ApiTags('meals')
@ApiBearerAuth()
@Controller('meals')
@UseGuards(StudentJwtAuthGuard)
export class MealsController {
  constructor(private readonly listMeals: ListMealsService) {}

  @Get()
  async list(): Promise<{ items: MealConfig[] }> {
    return { items: await this.listMeals.execute() };
  }
}
