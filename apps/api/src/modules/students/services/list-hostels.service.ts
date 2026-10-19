import { Injectable } from '@nestjs/common';
import { type HostelOption } from '@ennel/shared';
import { HostelRepository } from '../repositories/hostel.repository';

/** Spec §3 Screen 6 hostel dropdown options. */
@Injectable()
export class ListHostelsService {
  constructor(private readonly hostels: HostelRepository) {}

  execute(): Promise<HostelOption[]> {
    return this.hostels.listActive();
  }
}
