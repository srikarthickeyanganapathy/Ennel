import { type Dashboard } from '@ennel/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { getDashboard } from '../api/dashboard-api';
import { DashboardPage } from './DashboardPage';

let auth = mockAuth(['dashboard:read', 'dashboard:read-today']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/dashboard-api', () => ({ getDashboard: vi.fn() }));
// Recharts measures the DOM, which jsdom cannot do; the charts are covered by their labels.
vi.mock('../components/TrendCharts', () => ({ TrendCharts: () => <p>7-day charts</p> }));

const DASHBOARD: Dashboard = {
  date: '2026-10-24',
  today: '2026-10-24',
  canChooseDate: true,
  generatedAt: '2026-10-24T05:00:00.000Z',
  meals: [
    {
      mealType: 'LUNCH',
      mealName: 'Lunch',
      closureTitle: null,
      booked: 320,
      expected: 288,
      showUpRatePct: 90,
      isExpectedLowConfidence: false,
      attended: 120,
      veg: 200,
      nonVeg: 120,
      overCapacitySlotCount: 1,
      slots: [
        {
          slotId: '55555555-5555-4555-8555-555555555555',
          label: '11:00 AM - 11:30 AM',
          officialCapacity: 300,
          bookedCount: 320,
          occupancyPct: 100,
          status: 'OVER_CAPACITY',
          isRecommended: false,
        },
      ],
    },
  ],
  pending: { leaveApprovals: 2, openComplaints: 0, noShowAppeals: 1, attendanceIssues: 0 },
  trend: [],
};

describe('DashboardPage (Admin §C)', () => {
  it('shows plates, the diet split, slot labels, over-capacity and pending work', async () => {
    vi.mocked(getDashboard).mockResolvedValue(DASHBOARD);
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('320')).toBeInTheDocument();
    expect(screen.getByText('288')).toBeInTheDocument();
    expect(screen.getByText(/booked × 90% show-up rate/)).toBeInTheDocument();
    expect(screen.getByText('1 over capacity')).toBeInTheDocument();
    expect(screen.getByText('Over capacity')).toBeInTheDocument();
    expect(screen.getByText('Leave approvals').nextSibling).toHaveTextContent('2');
    expect(screen.getByLabelText('Dashboard date')).toBeInTheDocument();
  });

  it('offers no date choice to today-only roles and asks nothing for roles without access', async () => {
    auth = mockAuth(['dashboard:read-today']);
    vi.mocked(getDashboard).mockResolvedValue({ ...DASHBOARD, canChooseDate: false });
    const { unmount } = renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('320')).toBeInTheDocument();
    expect(screen.queryByLabelText('Dashboard date')).not.toBeInTheDocument();
    unmount();

    vi.mocked(getDashboard).mockClear();
    auth = mockAuth(['audit-log:read']);
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Quick actions')).toBeInTheDocument();
    expect(getDashboard).not.toHaveBeenCalled();
    auth = mockAuth(['dashboard:read', 'dashboard:read-today']);
  });
});
