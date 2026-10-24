import { Injectable } from '@nestjs/common';
import { type AdminBooking, type adminBookingListQuerySchema, type Paginated } from '@ennel/shared';
import { type z } from 'zod';
import { AdminBookingsRepository } from '../repositories/admin-bookings.repository';

/** Admin §H booking grid: one date, filtered, searched and paged on the server. */
@Injectable()
export class ListAdminBookingsService {
  constructor(private readonly grid: AdminBookingsRepository) {}

  execute(query: z.output<typeof adminBookingListQuerySchema>): Promise<Paginated<AdminBooking>> {
    return this.grid.list(query);
  }
}
