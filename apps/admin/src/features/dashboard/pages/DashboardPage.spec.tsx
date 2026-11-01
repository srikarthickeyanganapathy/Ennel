import { type Announcement, type Dashboard, type DashboardMeal } from '@ennel/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { listAnnouncements } from '@/features/announcements/api/announcements-api';
import { getDashboard } from '../api/dashboard-api';
import { DashboardPage } from './DashboardPage';

let auth = mockAuth([
  'dashboard:read',
  'dashboard:read-today',
  'leaves:read',
  'complaints:read',
  'announcements:read',
  'announcements:manage',
]);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/dashboard-api', () => ({ getDashboard: vi.fn() }));
vi.mock('@/features/announcements/api/announcements-api', () => ({ listAnnouncements: vi.fn() }));
// Recharts measures the DOM, which jsdom cannot do; the chart is covered by its label.
vi.mock('../components/TrendCard', () => ({ TrendCard: () => <p>7-day charts</p> }));

const LUNCH: DashboardMeal = {
  mealType: 'LUNCH',
  mealName: 'Lunch',
  closureTitle: null,
  booked: 1950,
  expected: 1755,
  showUpRatePct: 90,
  isExpectedLowConfidence: false,
  attended: 1284,
  veg: 1120,
  nonVeg: 830,
  overCapacitySlotCount: 1,
  slots: [
    {
      slotId: '55555555-5555-4555-8555-555555555555',
      label: '11:00 AM - 11:30 AM',
      officialCapacity: 500,
      bookedCount: 200,
      occupancyPct: 40,
      status: 'AVAILABLE',
      isRecommended: true,
    },
    {
      slotId: '66666666-6666-4666-8666-666666666666',
      label: '12:30 PM - 1:00 PM',
      officialCapacity: 500,
      bookedCount: 520,
      occupancyPct: 104,
      status: 'OVER_CAPACITY',
      isRecommended: false,
    },
  ],
};
const DINNER: DashboardMeal = {
  ...LUNCH,
  mealType: 'DINNER',
  mealName: 'Dinner',
  booked: 800,
  attended: 0,
  overCapacitySlotCount: 0,
  slots: [],
};
const DASHBOARD: Dashboard = {
  date: '2026-10-24',
  today: '2026-10-24',
  canChooseDate: true,
  generatedAt: '2026-10-24T07:11:00.000Z',
  meals: [LUNCH, DINNER],
  pending: { leaveApprovals: 6, openComplaints: 3, noShowAppeals: 0, attendanceIssues: 1 },
  trend: [],
};
const SENT = (title: string, sentAt: string): Announcement => ({
  id: crypto.randomUUID(),
  title,
  body: 'Body text',
  category: 'GENERAL',
  audience: { type: 'ALL', hostelIds: [], blockIds: [], academicYears: [], referenceNumbers: [] },
  channels: ['IN_APP'],
  status: 'SENT',
  scheduledFor: null,
  sentAt,
  createdByName: 'Manager',
  version: 2,
  createdAt: sentAt,
  deliveries: { inApp: 120, pushSent: 0, pushFailed: 0 },
});

function setUp(dashboard: Dashboard = DASHBOARD) {
  vi.mocked(getDashboard).mockResolvedValue(dashboard);
  vi.mocked(listAnnouncements).mockResolvedValue({
    items: [
      SENT('Menu change', '2026-10-24T04:00:00.000Z'),
      SENT('Yesterday news', '2026-10-23T04:00:00.000Z'),
    ],
    total: 2,
    page: 1,
    pageSize: 10,
  });
}

describe('DashboardPage (Admin §C, Figma "Admin — Live dashboard")', () => {
  it('shows the live status, the selected meal, slot occupancy and the count card', async () => {
    setUp();
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Lunch booked')).toBeInTheDocument();
    expect(screen.getByText(/Live · updated 12:41 PM/)).toBeInTheDocument();
    expect(screen.getByText('1,120 / 830')).toBeInTheDocument();
    expect(screen.getByText('1 over capacity')).toBeInTheDocument();
    expect(screen.getByText(/Booked × 90% show-up rate/)).toBeInTheDocument();
    expect(screen.getByText('66%')).toBeInTheDocument();

    const count = screen.getByRole('region', { name: 'Lunch count' });
    expect(within(count).getByText('1,950')).toBeInTheDocument();
    expect(within(count).getByText('Veg 1,120')).toBeInTheDocument();

    expect(
      screen.getByRole('listitem', {
        name: '12:30 PM - 1:00 PM: 520 of 500 booked, Over capacity',
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard date')).toHaveValue('2026-10-24');
  });

  it('switches meals with the meal switcher', async () => {
    setUp();
    renderWithProviders(<DashboardPage />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Dinner' }));
    expect(await screen.findByText('Dinner booked')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dinner' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('No active slots for this meal.')).toBeInTheDocument();
  });

  it('lists work that needs action, linking only where the role may go', async () => {
    setUp();
    renderWithProviders(<DashboardPage />);
    expect(
      await screen.findByRole('link', { name: 'Leave requests to review: 6' }),
    ).toHaveAttribute('href', '/leaves');
    expect(screen.getByRole('link', { name: 'Open complaints: 3' })).toHaveAttribute(
      'href',
      '/complaints',
    );
    // Without no-shows:read the rows show the count but are not links.
    expect(screen.queryByRole('link', { name: /No-show appeals/ })).not.toBeInTheDocument();
    expect(screen.getByText('No-shows held for review')).toBeInTheDocument();
  });

  it("shows only the chosen date's announcements", async () => {
    setUp();
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Menu change')).toBeInTheDocument();
    expect(screen.queryByText('Yesterday news')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compose announcement' })).toHaveAttribute(
      'href',
      '/announcements',
    );
  });

  it('offers no date choice to today-only roles and asks nothing for roles without access', async () => {
    auth = mockAuth(['dashboard:read-today']);
    setUp({ ...DASHBOARD, canChooseDate: false });
    const { unmount } = renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Lunch booked')).toBeInTheDocument();
    expect(screen.queryByLabelText('Dashboard date')).not.toBeInTheDocument();
    expect(screen.queryByText('Announcements today')).not.toBeInTheDocument();
    unmount();

    vi.mocked(getDashboard).mockClear();
    auth = mockAuth(['audit-log:read']);
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Quick actions')).toBeInTheDocument();
    expect(getDashboard).not.toHaveBeenCalled();
    auth = mockAuth([
      'dashboard:read',
      'dashboard:read-today',
      'leaves:read',
      'complaints:read',
      'announcements:read',
      'announcements:manage',
    ]);
  });
});
