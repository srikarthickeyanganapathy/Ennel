import { type Forecast, type ForecastMealDay } from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { addDays, startOfWeek, todayBusinessDate } from '@/shared/lib/format';
import { exportKitchenSheet, getForecast } from '../api/forecast-api';
import { ForecastPage } from './ForecastPage';

let auth = mockAuth(['forecasting:read', 'forecasting:export']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/forecast-api', () => ({ getForecast: vi.fn(), exportKitchenSheet: vi.fn() }));

const MONDAY = startOfWeek(todayBusinessDate());
const meal = (overrides: Partial<ForecastMealDay>): ForecastMealDay => ({
  date: MONDAY,
  mealType: 'LUNCH',
  mealName: 'Lunch',
  closureTitle: null,
  isLocked: false,
  showUpRatePct: 90,
  daysUsed: 10,
  isLowConfidence: false,
  veg: { booked: 110, expected: 99 },
  nonVeg: { booked: 40, expected: 36 },
  slots: [
    {
      slotId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      label: '11:00 AM - 11:30 AM',
      veg: { booked: 110, expected: 99 },
      nonVeg: { booked: 40, expected: 36 },
    },
  ],
  ...overrides,
});
const FORECAST: Forecast = {
  from: MONDAY,
  days: 7,
  today: MONDAY,
  lookbackDays: 14,
  generatedAt: '2026-11-02T06:00:00.000Z',
  meals: [
    meal({}),
    meal({ date: addDays(MONDAY, 1), isLocked: true, veg: { booked: 7, expected: 6 } }),
    meal({ date: addDays(MONDAY, 2), closureTitle: 'Festival' }),
  ],
  trend: [{ date: addDays(MONDAY, -1), booked: 50, served: 45 }],
  wasteWeeks: [
    { weekStart: addDays(MONDAY, -28), plates: 40 },
    { weekStart: addDays(MONDAY, -21), plates: 30 },
    { weekStart: addDays(MONDAY, -14), plates: 25 },
    { weekStart: addDays(MONDAY, -7), plates: 20 },
  ],
};

describe('ForecastPage (Admin §N, BR-FC-1, ADR-0029)', () => {
  beforeEach(() => {
    auth = mockAuth(['forecasting:read', 'forecasting:export']);
    vi.mocked(getForecast).mockResolvedValue(FORECAST);
    vi.mocked(exportKitchenSheet).mockResolvedValue();
  });

  it('shows booked with expected plates, locked or open in words, and closed meals', async () => {
    renderWithProviders(<ForecastPage />);
    const row = await screen.findByRole('row', { name: /Lunch · Veg/ });
    expect(within(row).getByText('110')).toBeInTheDocument();
    expect(within(row).getByText('exp. 99')).toBeInTheDocument();
    expect(within(row).getByText('Open')).toBeInTheDocument();
    expect(within(row).getByText('Locked')).toBeInTheDocument();
    expect(within(row).getByText('Closed')).toBeInTheDocument();
    expect(screen.queryByText(/Low confidence/)).not.toBeInTheDocument();
  });

  it('warns when history is short', async () => {
    vi.mocked(getForecast).mockResolvedValue({
      ...FORECAST,
      meals: [meal({ isLowConfidence: true, daysUsed: 2 })],
    });
    renderWithProviders(<ForecastPage />);
    expect(await screen.findByText(/Low confidence for Lunch/)).toBeInTheDocument();
  });

  it('breaks a day down by slot and reports waste in plates, not kilograms', async () => {
    renderWithProviders(<ForecastPage />);
    const row = await screen.findByRole('row', { name: /11:00 AM - 11:30 AM/ });
    expect(within(row).getByText('110 (99)')).toBeInTheDocument();
    expect(screen.getByText('50% less than 3 weeks earlier')).toBeInTheDocument();
    expect(screen.queryByText(/kg/)).not.toBeInTheDocument();
  });

  it('moves between weeks and exports the kitchen sheet', async () => {
    renderWithProviders(<ForecastPage />);
    await screen.findByRole('row', { name: /Lunch · Veg/ });
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await waitFor(() => expect(getForecast).toHaveBeenLastCalledWith(addDays(MONDAY, 7), 7));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Export week' }), {
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Kitchen sheet (PDF)' }));
    await waitFor(() =>
      expect(exportKitchenSheet).toHaveBeenCalledWith(addDays(MONDAY, 7), 7, 'pdf'),
    );
  });

  it('hides export from staff who cannot export', async () => {
    auth = mockAuth(['forecasting:read']);
    renderWithProviders(<ForecastPage />);
    await screen.findByRole('row', { name: /Lunch · Veg/ });
    expect(screen.queryByRole('button', { name: 'Export week' })).not.toBeInTheDocument();
  });
});
