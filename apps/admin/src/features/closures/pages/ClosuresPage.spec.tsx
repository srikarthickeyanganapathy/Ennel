import { type AdminClosure } from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { createClosure, getClosureImpact, listClosures, removeClosure } from '../api/closures-api';
import { ClosuresPage } from './ClosuresPage';

let auth = mockAuth(['closures:read', 'closures:manage']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/closures-api', () => ({
  listClosures: vi.fn(),
  getClosureImpact: vi.fn(),
  createClosure: vi.fn(),
  removeClosure: vi.fn(),
}));

const CLOSURE: AdminClosure = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  date: '2099-11-01',
  mealTypes: ['LUNCH', 'DINNER'],
  kind: 'FESTIVAL',
  title: 'Diwali holiday',
  reason: 'College holiday',
  status: 'ACTIVE',
  createdByName: 'Mess Manager',
  createdAt: '2026-10-24T05:00:00.000Z',
  removedByName: null,
  removedAt: null,
  removalReason: null,
};

describe('ClosuresPage (Admin §F)', () => {
  beforeEach(() => {
    auth = mockAuth(['closures:read', 'closures:manage']);
    vi.mocked(listClosures).mockResolvedValue([CLOSURE]);
  });

  it('removes a closure only after a reason is given', async () => {
    vi.mocked(removeClosure).mockResolvedValue({
      closure: { ...CLOSURE, status: 'REMOVED' },
      cancelled: 0,
      restored: 3,
      notRestored: 1,
    });
    renderWithProviders(<ClosuresPage />);

    expect(await screen.findByText('Diwali holiday')).toBeInTheDocument();
    expect(screen.getByText('Lunch, Dinner')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Remove closure on/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove closure' }));
    expect(removeClosure).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('Reason (recorded in the audit log)'), {
      target: { value: 'Holiday moved' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove closure' }));
    await waitFor(() => expect(removeClosure).toHaveBeenCalledWith(CLOSURE.id, 'Holiday moved'));
  });

  it('shows how many bookings a new closure cancels before applying it', async () => {
    vi.mocked(getClosureImpact).mockResolvedValue({
      meals: [{ mealType: 'LUNCH', bookedCount: 42 }],
      totalBooked: 42,
    });
    vi.mocked(createClosure).mockResolvedValue({
      closure: CLOSURE,
      cancelled: 42,
      restored: 0,
      notRestored: 0,
    });
    renderWithProviders(<ClosuresPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'New closure' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2099-11-02' } });
    fireEvent.click(within(dialog).getByLabelText('Lunch'));
    expect(
      await within(dialog).findByText('42 booked meals will be cancelled'),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Title (shown to students)'), {
      target: { value: 'Water outage' },
    });
    fireEvent.change(within(dialog).getByLabelText('Reason (recorded in the audit log)'), {
      target: { value: 'Municipal supply cut' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply closure' }));
    await waitFor(() =>
      expect(createClosure).toHaveBeenCalledWith({
        date: '2099-11-02',
        mealTypes: ['LUNCH'],
        kind: 'MESS_CLOSED',
        title: 'Water outage',
        reason: 'Municipal supply cut',
      }),
    );
  });

  it('hides create and remove from staff who can only view closures', async () => {
    auth = mockAuth(['closures:read']);
    renderWithProviders(<ClosuresPage />);

    expect(await screen.findByText('Diwali holiday')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New closure' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove closure on/ })).not.toBeInTheDocument();
  });
});
