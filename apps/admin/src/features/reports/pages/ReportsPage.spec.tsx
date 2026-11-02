import { type AdminReport } from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { addDays, todayBusinessDate } from '@/shared/lib/format';
import {
  downloadReport,
  getReport,
  listReportExports,
  requestReportExport,
} from '../api/reports-api';
import { ReportsPage } from './ReportsPage';

let auth = mockAuth(['reports:read', 'reports:export']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/reports-api', () => ({
  getReport: vi.fn(),
  downloadReport: vi.fn(),
  requestReportExport: vi.fn(),
  listReportExports: vi.fn(),
  downloadReportExport: vi.fn(),
}));

const HOSTEL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REPORT: AdminReport = {
  from: '2026-10-01',
  to: '2026-10-30',
  groupBy: 'day',
  generatedAt: '2026-10-30T06:00:00.000Z',
  hostels: [{ id: HOSTEL, name: 'Noyel Hostel' }],
  kpis: {
    total: 200,
    served: 150,
    cancelled: 20,
    noShows: 30,
    pending: 0,
    noShowRatePct: 17,
    previousNoShowRatePct: 20,
    wastePlates: 30,
    previousWastePlates: 40,
  },
  byMeal: [
    {
      mealType: 'LUNCH',
      mealName: 'Lunch',
      served: 150,
      cancelled: 20,
      noShows: 30,
      pending: 0,
      total: 200,
      noShowRatePct: 17,
    },
  ],
  series: [{ period: '2026-10-01', booked: 200, served: 150, noShows: 30, wastePlates: 30 }],
  byHostel: [
    { hostelId: HOSTEL, hostelName: 'Noyel Hostel', served: 150, noShows: 30, noShowRatePct: 17 },
  ],
  slots: [
    {
      slotId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      mealType: 'LUNCH',
      label: '11:00 AM - 11:30 AM',
      startMinute: 660,
      averageServedPerDay: 42,
      utilizationPct: 70,
      overCapacityDays: 2,
    },
  ],
  cancellations: {
    total: 20,
    averageLeadMinutes: 180,
    buckets: [{ bucket: 'HOURS_1_TO_6', count: 20 }],
  },
  leaves: [{ status: 'APPROVED', count: 4 }],
  complaints: {
    total: 5,
    byCategory: [{ category: 'FOOD_QUALITY', count: 5 }],
    byStatus: [{ status: 'NEW', count: 5 }],
    averageResolutionHours: 6,
  },
};

describe('ReportsPage (Admin §O, ADR-0029)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth = mockAuth(['reports:read', 'reports:export']);
    vi.mocked(getReport).mockResolvedValue(REPORT);
    vi.mocked(listReportExports).mockResolvedValue([]);
    vi.mocked(downloadReport).mockResolvedValue();
  });

  it('shows the summary with waste in plates and no invented early or late columns', async () => {
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText('30 plates')).toBeInTheDocument();
    expect(screen.getByText('of 200 booked')).toBeInTheDocument();
    expect(screen.getByText('17% · was 20% the period before')).toBeInTheDocument();
    expect(screen.getByText('10 fewer than the period before')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Attendance by meal' });
    const row = within(table).getByRole('row', { name: /^Lunch/ });
    expect(within(row).getByText('150')).toBeInTheDocument();
    expect(screen.queryByText(/Arrived/)).not.toBeInTheDocument();
    expect(screen.queryByText(/kg/)).not.toBeInTheDocument();
  });

  it('filters by meal, hostel and grouping', async () => {
    renderWithProviders(<ReportsPage />);
    await screen.findByText('30 plates');
    fireEvent.click(screen.getByRole('radio', { name: 'Dinner' }));
    await waitFor(() =>
      expect(getReport).toHaveBeenLastCalledWith(expect.objectContaining({ mealType: 'DINNER' })),
    );
    fireEvent.change(await screen.findByLabelText('Hostel'), { target: { value: HOSTEL } });
    await waitFor(() =>
      expect(getReport).toHaveBeenLastCalledWith(expect.objectContaining({ hostelId: HOSTEL })),
    );
    fireEvent.click(await screen.findByRole('radio', { name: 'Monthly' }));
    await waitFor(() =>
      expect(getReport).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: 'month' })),
    );
  });

  it('downloads a short range straight away', async () => {
    renderWithProviders(<ReportsPage />);
    await screen.findByText('30 plates');
    fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));
    await waitFor(() =>
      expect(downloadReport).toHaveBeenCalledWith(
        expect.objectContaining({ groupBy: 'day' }),
        'xlsx',
      ),
    );
    expect(requestReportExport).not.toHaveBeenCalled();
  });

  it('sends a long range to the background', async () => {
    renderWithProviders(<ReportsPage />);
    await screen.findByText('30 plates');
    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: addDays(todayBusinessDate(), -60) },
    });
    await screen.findByText('30 plates');
    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));
    await waitFor(() => expect(requestReportExport).toHaveBeenCalled());
    expect(downloadReport).not.toHaveBeenCalled();
  });

  it('hides exports from staff who cannot export', async () => {
    auth = mockAuth(['reports:read']);
    renderWithProviders(<ReportsPage />);
    await screen.findByText('30 plates');
    expect(screen.queryByRole('button', { name: /Export/ })).not.toBeInTheDocument();
  });
});
