import { CLOSE_ATTENDANCE_WINDOWS } from './services/close-attendance-windows.service';
import { GENERATE_DEFAULT_BOOKINGS } from './services/generate-default-bookings.service';
import { GENERATE_REPORT_EXPORTS } from './services/generate-report-exports.service';
import { SEND_SCHEDULED_ANNOUNCEMENTS } from './services/send-scheduled-announcements.service';

export interface JobRunSummaryInput {
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  startedAt: Date | null;
  finishedAt: Date | null;
  attempt: number;
  error: string | null;
}

export interface JobInfo {
  name: string;
  label: string;
  schedule: string;
  /** Written to job_runs per date. The per-minute jobs are read from the queue instead. */
  recordsRuns: boolean;
}

/** Every background job, for the system health page (Admin §Q). */
export const JOB_CATALOG: readonly JobInfo[] = [
  {
    name: GENERATE_DEFAULT_BOOKINGS,
    label: 'Default Booking generation',
    schedule: 'Daily at 12:30 AM',
    recordsRuns: true,
  },
  {
    name: CLOSE_ATTENDANCE_WINDOWS,
    label: 'Close attendance windows',
    schedule: 'Every 5 minutes',
    recordsRuns: true,
  },
  {
    name: SEND_SCHEDULED_ANNOUNCEMENTS,
    label: 'Send scheduled announcements',
    schedule: 'Every minute',
    recordsRuns: false,
  },
  {
    name: GENERATE_REPORT_EXPORTS,
    label: 'Build report exports',
    schedule: 'Every minute',
    recordsRuns: false,
  },
];
