import { type SystemHealth } from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { getSystemHealth, runJob } from '../api/system-api';
import { SystemHealthPage } from './SystemHealthPage';

let auth = mockAuth(['system:read', 'system:manage']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/system-api', () => ({ getSystemHealth: vi.fn(), runJob: vi.fn() }));

const HEALTH: SystemHealth = {
  generatedAt: '2026-11-02T06:00:00.000Z',
  version: '0.0.0',
  environment: 'development',
  timeZone: 'Asia/Kolkata',
  pushProvider: 'none',
  database: 'up',
  queue: { isAvailable: true, waiting: 1, active: 0, delayed: 2, failed: 3 },
  jobs: [
    {
      name: 'close-attendance-window',
      label: 'Close attendance windows',
      schedule: 'Every 5 minutes',
      lastRun: {
        status: 'FAILED',
        startedAt: '2026-11-02T05:00:00.000Z',
        finishedAt: '2026-11-02T05:01:00.000Z',
        attempt: 2,
        error: 'Provider timed out',
      },
      nextRunAt: '2026-11-02T06:05:00.000Z',
      failuresLast7Days: 4,
    },
  ],
  attendanceProvider: { name: 'Face verification (not configured)', isConfigured: false },
  outage: null,
};

describe('SystemHealthPage (Admin §Q)', () => {
  beforeEach(() => {
    auth = mockAuth(['system:read', 'system:manage']);
    vi.mocked(getSystemHealth).mockResolvedValue(HEALTH);
    vi.mocked(runJob).mockResolvedValue({ queued: true });
  });

  it('shows job status with its error, queue depth, provider and config', async () => {
    renderWithProviders(<SystemHealthPage />);
    const row = await screen.findByRole('row', { name: /Close attendance windows/ });
    expect(within(row).getByText('Failed')).toBeInTheDocument();
    expect(within(row).getByText('Provider timed out')).toBeInTheDocument();
    expect(within(row).getByText('4')).toBeInTheDocument();
    expect(screen.getByText('1 waiting · 0 running · 2 scheduled · 3 failed')).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
    expect(screen.getByText('Asia/Kolkata')).toBeInTheDocument();
    expect(screen.getByText('Outage mode is off.')).toBeInTheDocument();
  });

  it('retries a job only with a reason', async () => {
    renderWithProviders(<SystemHealthPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Run Close attendance windows now' }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Run now' }));
    expect(runJob).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText('Reason (recorded in the audit log)'), {
      target: { value: 'Provider is back' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Run now' }));
    await waitFor(() =>
      expect(runJob).toHaveBeenCalledWith('close-attendance-window', 'Provider is back'),
    );
  });

  it('says so when the queue is down, and does not offer to run jobs', async () => {
    vi.mocked(getSystemHealth).mockResolvedValue({
      ...HEALTH,
      queue: { ...HEALTH.queue, isAvailable: false },
    });
    renderWithProviders(<SystemHealthPage />);
    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Close/ })).toBeDisabled();
  });

  it('flags a next run in the past, because it means the worker has stopped', async () => {
    vi.mocked(getSystemHealth).mockResolvedValue({
      ...HEALTH,
      jobs: HEALTH.jobs.map((job) => ({ ...job, nextRunAt: '2026-11-02T05:00:00.000Z' })),
    });
    renderWithProviders(<SystemHealthPage />);
    expect(await screen.findByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText(/Check that the worker is running/)).toBeInTheDocument();
  });

  it('hides running jobs from read-only staff', async () => {
    auth = mockAuth(['system:read']);
    renderWithProviders(<SystemHealthPage />);
    await screen.findByRole('row', { name: /Close attendance windows/ });
    expect(screen.queryByRole('button', { name: /Run Close/ })).not.toBeInTheDocument();
  });
});
