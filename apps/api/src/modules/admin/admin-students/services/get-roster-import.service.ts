import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type Paginated,
  ROSTER_IMPORT_COLUMNS,
  type RosterImportRow,
  type RosterImportSummary,
  type RosterRowOutcome,
} from '@ennel/shared';
import { stringify } from 'csv-stringify/sync';
import { AppError } from '../../../../common/errors/app-error';
import { RosterImportRepository } from '../repositories/roster-import.repository';

const TEMPLATE_EXAMPLE = [
  '24900417',
  'Ashwin Kumar',
  'Computer Science',
  '2',
  'Hostel A',
  'Block A',
  '323',
  'ashwin@example.com',
];

/** Import history, preview rows and the CSV template (Admin §G). */
@Injectable()
export class GetRosterImportService {
  constructor(private readonly imports: RosterImportRepository) {}

  async summary(id: string): Promise<RosterImportSummary> {
    const summary = await this.imports.findSummary(id);
    if (!summary) throw new AppError(ErrorCode.NOT_FOUND, 'Import not found.');
    return summary;
  }

  list(page: number, pageSize: number): Promise<Paginated<RosterImportSummary>> {
    return this.imports.listJobs(page, pageSize);
  }

  async rows(
    id: string,
    outcome: RosterRowOutcome | undefined,
    page: number,
    pageSize: number,
  ): Promise<Paginated<RosterImportRow>> {
    await this.summary(id);
    return this.imports.listRows(id, outcome, page, pageSize);
  }

  template(): string {
    return stringify([[...ROSTER_IMPORT_COLUMNS], TEMPLATE_EXAMPLE]);
  }
}
