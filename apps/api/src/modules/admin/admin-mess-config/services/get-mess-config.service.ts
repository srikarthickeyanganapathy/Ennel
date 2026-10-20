import { Injectable } from '@nestjs/common';
import { type AdminMeal } from '@ennel/shared';
import { AdminMessConfigRepository } from '../repositories/admin-mess-config.repository';

/** All meals with every non-deleted slot, including disabled ones (Admin §D). */
@Injectable()
export class GetMessConfigService {
  constructor(private readonly config: AdminMessConfigRepository) {}

  meals(): Promise<AdminMeal[]> {
    return this.config.listMeals();
  }
}
