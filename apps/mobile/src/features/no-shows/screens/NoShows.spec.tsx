import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { type MealNoShowSummary, type NoShowSummary, type StudentNoShowEvent } from '@ennel/shared';
import { mockRouter, renderWithProviders } from '@/test-utils/render';
import { getNoShowSummary, reportNoShow } from '../api/no-shows-api';
import { NoShowWarnings } from '../components/NoShowWarnings';
import { NoShowsScreen } from './NoShowsScreen';
import { ReportNoShowScreen } from './ReportNoShowScreen';

jest.mock('../api/no-shows-api');

const EVENT: StudentNoShowEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  bookingId: '22222222-2222-4222-8222-222222222222',
  date: '2026-10-28',
  mealType: 'LUNCH',
  status: 'COUNTED',
  exclusionCause: null,
  appeal: null,
  canAppeal: true,
};
const meal = (overrides: Partial<MealNoShowSummary>): MealNoShowSummary => ({
  mealType: 'LUNCH',
  mealName: 'Lunch',
  count: 3,
  level: 'WARNING',
  remainingBeforeDisable: 2,
  isAutoDisabled: false,
  canReEnable: false,
  ...overrides,
});
const summary = (meals: MealNoShowSummary[]): NoShowSummary => ({
  windowDays: 30,
  warningThreshold: 3,
  disableThreshold: 5,
  meals,
  events: [EVENT],
});

describe('NoShowWarnings (Spec §10, BR-NS-4)', () => {
  it('warns at three and lets the first warning be dismissed', async () => {
    jest.mocked(getNoShowSummary).mockResolvedValue(summary([meal({})]));
    await renderWithProviders(<NoShowWarnings />);

    expect(
      await screen.findByText(
        /3 No-shows for Lunch in 30 days. 2 more will turn off Default Booking/,
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Dismiss the Lunch warning'));
    expect(screen.queryByText(/3 No-shows for Lunch/)).toBeNull();
  });

  it('keeps the warning at four and explains the disable at five', async () => {
    jest.mocked(getNoShowSummary).mockResolvedValue(
      summary([
        meal({ count: 4, remainingBeforeDisable: 1 }),
        meal({
          mealType: 'DINNER',
          mealName: 'Dinner',
          count: 5,
          level: 'DISABLED',
          remainingBeforeDisable: 0,
          isAutoDisabled: true,
        }),
      ]),
    );
    await renderWithProviders(<NoShowWarnings />);

    expect(await screen.findByText(/4 No-shows for Lunch/)).toBeTruthy();
    expect(screen.queryByLabelText('Dismiss the Lunch warning')).toBeNull();
    expect(screen.getByText(/Default Booking for Dinner is off/)).toBeTruthy();
  });
});

describe('NoShowsScreen and the report (Spec §7, ADR-0027)', () => {
  it('lists No-shows and sends a report for one', async () => {
    jest.mocked(getNoShowSummary).mockResolvedValue(summary([meal({})]));
    jest.mocked(reportNoShow).mockResolvedValue({
      ...EVENT,
      canAppeal: false,
      appeal: {
        id: '33333333-3333-4333-8333-333333333333',
        status: 'PENDING',
        message: 'I ate at 1 PM.',
        decisionReason: null,
        createdAt: '2026-10-29T05:00:00.000Z',
        decidedAt: null,
      },
    });
    await renderWithProviders(<NoShowsScreen />);
    expect(await screen.findByText('Counts towards your No-shows')).toBeTruthy();
    await fireEvent.press(screen.getByText('Report incorrect record'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(student)/no-shows/report/[id]',
      params: { id: EVENT.id },
    });

    jest.mocked(useLocalSearchParams).mockReturnValue({ id: EVENT.id });
    await renderWithProviders(<ReportNoShowScreen />);
    await fireEvent.press(await screen.findByText('Send Report'));
    expect(screen.getByText('Tell the mess office what happened')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('What happened?'), 'I ate at 1 PM.');
    await fireEvent.press(screen.getByText('Send Report'));
    await waitFor(() => expect(reportNoShow).toHaveBeenCalledWith(EVENT.id, 'I ate at 1 PM.'));
    expect(await screen.findByText(/Report sent/)).toBeTruthy();
  });
});
