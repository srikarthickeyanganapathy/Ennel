import { Injectable } from '@nestjs/common';
import { type Paginated, type StaffUser } from '@ennel/shared';
import { type StaffListFilter, StaffUsersRepository } from '../repositories/staff-users.repository';
import { requireStaff } from './staff-lookup';

@Injectable()
export class ListStaffService {
  constructor(private readonly staff: StaffUsersRepository) {}

  list(filter: StaffListFilter, page: number, pageSize: number): Promise<Paginated<StaffUser>> {
    return this.staff.list(filter, page, pageSize);
  }

  get(id: string): Promise<StaffUser> {
    return requireStaff(this.staff, id);
  }
}
