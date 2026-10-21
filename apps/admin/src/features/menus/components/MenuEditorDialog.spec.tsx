import { type AdminMenu } from '@ennel/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api-client/api-error';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { saveMenu } from '../api/menus-api';
import { MenuEditorDialog } from './MenuEditorDialog';

const auth = mockAuth(['menus:read', 'menus:update', 'menus:publish']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/menus-api', () => ({ saveMenu: vi.fn(), publishMenu: vi.fn() }));

const MENU: AdminMenu = {
  id: '22222222-2222-4222-8222-222222222222',
  mealDate: '2026-10-26',
  mealType: 'LUNCH',
  status: 'PUBLISHED',
  hasUnpublishedChanges: false,
  isSpecial: false,
  specialTitle: null,
  items: [{ name: 'Dal', dietType: 'VEG' }],
  publishedItems: [{ name: 'Dal', dietType: 'VEG' }],
  publishedAt: '2026-10-20T06:00:00.000Z',
  version: 2,
};

describe('MenuEditorDialog (Admin §E)', () => {
  it('saves a change to the special-meal flag on an existing menu and stays open', async () => {
    const onClose = vi.fn();
    vi.mocked(saveMenu).mockResolvedValue({
      ...MENU,
      isSpecial: true,
      specialTitle: 'Diwali lunch',
      hasUnpublishedChanges: true,
      version: 3,
    });
    renderWithProviders(<MenuEditorDialog menu={MENU} onClose={onClose} />);

    const saveButton = screen.getByRole('button', { name: 'Save draft' });
    expect(saveButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Special meal/));
    fireEvent.change(screen.getByLabelText('Special meal title'), {
      target: { value: 'Diwali lunch' },
    });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(saveMenu).toHaveBeenCalledWith('2026-10-26', 'LUNCH', {
        items: MENU.items,
        isSpecial: true,
        specialTitle: 'Diwali lunch',
        version: 2,
      }),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('reloads the menus when a colleague saved first', async () => {
    vi.mocked(saveMenu).mockRejectedValue(
      new ApiError(
        'VERSION_CONFLICT',
        'Someone else changed this menu. Reload and try again.',
        409,
      ),
    );
    const { queryClient } = renderWithProviders(
      <MenuEditorDialog menu={MENU} onClose={() => undefined} />,
    );
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.change(screen.getByLabelText('Dish 1'), { target: { value: 'Dal fry' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['menus'] }));
  });

  it('starts clean when reopened after unsaved edits', () => {
    const { rerender } = renderWithProviders(
      <MenuEditorDialog menu={MENU} onClose={() => undefined} />,
    );
    fireEvent.change(screen.getByLabelText('Dish 1'), { target: { value: 'Unsaved' } });
    rerender(<MenuEditorDialog menu={null} onClose={() => undefined} />);
    rerender(<MenuEditorDialog menu={MENU} onClose={() => undefined} />);
    expect(screen.getByLabelText('Dish 1')).toHaveValue('Dal');
  });
});
