import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { type StudentComplaint, type StudentProfile } from '@ennel/shared';
import {
  mockNavigation,
  mockPreventRemove,
  mockRouter,
  renderWithProviders,
} from '@/test-utils/render';
import { getMyProfile } from '@/features/onboarding/api/onboarding-api';
import { listMyComplaints, lookupComplaints, submitComplaint } from '../api/complaints-api';
import { addReceipt, readReceipts } from '../storage/receipt-storage';
import { ComplaintDetailScreen } from './ComplaintDetailScreen';
import { ComplaintsScreen } from './ComplaintsScreen';
import { NewComplaintScreen } from './NewComplaintScreen';

jest.mock('../api/complaints-api');
jest.mock('@/features/onboarding/api/onboarding-api');
jest.mock('@/shared/utils/confirm-action', () => ({
  confirmAction: jest.fn(async () => true),
}));

const STUDENT_ID = '99999999-9999-4999-8999-999999999999';
const report = (overrides: Partial<StudentComplaint>): StudentComplaint => ({
  id: '11111111-1111-4111-8111-111111111111',
  referenceCode: 'CMP-ABC234',
  type: 'COMPLAINT',
  category: 'FOOD_QUALITY',
  mealType: 'LUNCH',
  mealDate: '2026-10-30',
  description: 'The dal was cold and too salty.',
  status: 'RESOLVED',
  response: 'The food warmer is fixed.',
  photoCount: 1,
  privacyMode: 'PRIVATE_IDENTIFIED',
  createdAt: '2026-10-30T08:00:00.000Z',
  updatedAt: '2026-10-31T08:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  jest
    .mocked(getMyProfile)
    .mockResolvedValue({ id: STUDENT_ID, fullName: 'Test Student' } as StudentProfile);
});

describe('ComplaintsScreen (Spec §12 My Reports)', () => {
  it('shows identified reports and anonymous ones found with receipts on this phone', async () => {
    await addReceipt(STUDENT_ID, 'receipt-token-aaaaaaaaaaaaaaaaaaaa');
    jest
      .mocked(listMyComplaints)
      .mockResolvedValue({ items: [report({})], privacyMode: 'ANONYMOUS' });
    jest.mocked(lookupComplaints).mockResolvedValue([
      report({
        id: '33333333-3333-4333-8333-333333333333',
        referenceCode: 'CMP-ZZZ999',
        status: 'IN_REVIEW',
        response: null,
        privacyMode: 'ANONYMOUS',
        createdAt: '2026-10-31T08:00:00.000Z',
      }),
    ]);
    await renderWithProviders(<ComplaintsScreen />);

    expect(await screen.findByText('CMP-ZZZ999')).toBeTruthy();
    expect(screen.getByText('CMP-ABC234')).toBeTruthy();
    expect(screen.getByText('In review')).toBeTruthy();
    expect(screen.getByText('Resolved')).toBeTruthy();
    expect(screen.getByText(/Your name is not stored with this report/)).toBeTruthy();
    expect(lookupComplaints).toHaveBeenCalledWith(['receipt-token-aaaaaaaaaaaaaaaaaaaa']);

    await fireEvent.press(screen.getByText('New Report'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(student)/complaints/new');
  });

  it('shows the reply on the detail screen', async () => {
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ id: '11111111-1111-4111-8111-111111111111' });
    jest
      .mocked(listMyComplaints)
      .mockResolvedValue({ items: [report({})], privacyMode: 'PRIVATE_IDENTIFIED' });
    jest.mocked(lookupComplaints).mockResolvedValue([]);
    await renderWithProviders(<ComplaintDetailScreen />);
    expect(await screen.findByText('The food warmer is fixed.')).toBeTruthy();
    expect(screen.getByText('Status: Resolved')).toBeTruthy();
  });
});

describe('NewComplaintScreen (Spec §12)', () => {
  beforeEach(() => {
    jest.mocked(listMyComplaints).mockResolvedValue({ items: [], privacyMode: 'ANONYMOUS' });
    jest.mocked(lookupComplaints).mockResolvedValue([]);
  });

  it('asks for a category and a description before sending', async () => {
    await renderWithProviders(<NewComplaintScreen />);
    await fireEvent.press(await screen.findByLabelText('Submit'));
    expect(await screen.findByText('Choose a category')).toBeTruthy();
    expect(screen.getByText('Describe what happened in a few words')).toBeTruthy();
    expect(submitComplaint).not.toHaveBeenCalled();
  });

  it('sends the report, keeps the anonymous receipt and shows the reference number', async () => {
    jest.mocked(submitComplaint).mockResolvedValue({
      complaint: report({ status: 'NEW', response: null, privacyMode: 'ANONYMOUS' }),
      receiptToken: 'receipt-token-bbbbbbbbbbbbbbbbbbbb',
    });
    await renderWithProviders(<NewComplaintScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Lunch' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Foreign object in food' }));
    await fireEvent.changeText(
      screen.getByLabelText('Description'),
      'There was a small stone in the rice.',
    );
    expect(mockPreventRemove.isActive).toBe(true);
    await fireEvent.press(screen.getByLabelText('Submit'));

    expect(await screen.findByText(/Your reference number is CMP-ABC234/)).toBeTruthy();
    const [request, photos] = jest.mocked(submitComplaint).mock.calls[0] ?? [];
    expect(request).toMatchObject({
      type: 'COMPLAINT',
      category: 'FOREIGN_OBJECT',
      mealType: 'LUNCH',
      description: 'There was a small stone in the rice.',
    });
    expect(photos).toEqual([]);
    await waitFor(async () =>
      expect(await readReceipts(STUDENT_ID)).toEqual(['receipt-token-bbbbbbbbbbbbbbbbbbbb']),
    );
  });

  it('warns before leaving with unsaved text', async () => {
    await renderWithProviders(<NewComplaintScreen />);
    expect(mockPreventRemove.isActive).toBe(false);
    await fireEvent.changeText(await screen.findByLabelText('Description'), 'Half written');
    expect(mockPreventRemove.isActive).toBe(true);
    const action = { type: 'GO_BACK' };
    mockPreventRemove.onRemove?.({ data: { action } });
    await waitFor(() => expect(mockNavigation.dispatch).toHaveBeenCalledWith(action));
  });
});
