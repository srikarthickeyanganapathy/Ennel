import { type AdminMenu, type MenuWeek } from '@ennel/shared';
import { createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAuth } from '@/test-utils/mock-auth';
import { renderWithProviders } from '@/test-utils/render';
import { addDays, startOfWeek, todayBusinessDate } from '@/shared/lib/format';
import { getDishes, getMenuWeek, publishMenu, saveMenu } from '../api/menus-api';
import { MenusPage } from './MenusPage';

let auth = mockAuth(['menus:read', 'menus:update', 'menus:publish']);
vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => auth,
  usePermissions:
    () =>
    (...keys: string[]) =>
      keys.every((key) => auth.permissions.has(key as never)),
}));
vi.mock('../api/menus-api', () => ({
  getMenuWeek: vi.fn(),
  getDishes: vi.fn(),
  saveMenu: vi.fn(),
  publishMenu: vi.fn(),
  copyMenuWeek: vi.fn(),
}));

const MONDAY = startOfWeek(todayBusinessDate());
const menu = (overrides: Partial<AdminMenu>): AdminMenu => ({
  id: null,
  mealDate: MONDAY,
  mealType: 'BREAKFAST',
  status: 'NONE',
  hasUnpublishedChanges: false,
  isSpecial: false,
  specialTitle: null,
  items: [],
  publishedItems: null,
  publishedAt: null,
  version: null,
  ...overrides,
});
const DRAFT = menu({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  status: 'DRAFT',
  items: [{ name: 'Idli, sambar', dietType: 'VEG' }],
  version: 3,
});
const EDITED = menu({
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  mealDate: addDays(MONDAY, 1),
  status: 'PUBLISHED',
  hasUnpublishedChanges: true,
  items: [{ name: 'Fish curry', dietType: 'NON_VEG' }],
  version: 5,
});
const EMPTY = menu({ mealDate: addDays(MONDAY, 2) });
const WEEK: MenuWeek = { from: MONDAY, days: 7, menus: [DRAFT, EDITED, EMPTY] };
const PUBLISH_RESULT = { menu: DRAFT, isChanged: true, notifiedStudents: 4 };

describe('MenusPage (Admin §E, Figma "Admin — Menu")', () => {
  beforeEach(() => {
    auth = mockAuth(['menus:read', 'menus:update', 'menus:publish']);
    vi.mocked(getMenuWeek).mockResolvedValue(WEEK);
    vi.mocked(getDishes).mockResolvedValue({
      items: [
        { name: 'Egg masala', dietType: 'NON_VEG' },
        { name: 'Masala dosa', dietType: 'VEG' },
      ],
    });
  });

  it('counts unpublished work and labels it with text in the cells', async () => {
    renderWithProviders(<MenusPage />);
    expect(await screen.findByText('Draft · 2 unpublished changes')).toBeInTheDocument();
    expect(screen.getByText('Idli, sambar')).toBeInTheDocument();
    expect(screen.getByText('Changed')).toBeInTheDocument();
    expect(screen.getByText('Add dishes')).toBeInTheDocument();
  });

  it('filters the dish library by search and diet', async () => {
    renderWithProviders(<MenusPage />);
    expect(await screen.findByText('Masala dosa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Non-veg' }));
    expect(screen.queryByText('Masala dosa')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search dishes'), { target: { value: 'dosa' } });
    expect(screen.getByText('No dishes match.')).toBeInTheDocument();
  });

  it('adds a dropped dish to the draft with the version it was loaded at', async () => {
    vi.mocked(saveMenu).mockResolvedValue(DRAFT);
    renderWithProviders(<MenusPage />);
    const dish = (await screen.findByText('Masala dosa')).closest('li') as HTMLElement;
    const store = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: '',
      setData: (type: string, value: string) => store.set(type, value),
      getData: (type: string) => store.get(type) ?? '',
    };
    const start = createEvent.dragStart(dish, { dataTransfer });
    fireEvent(dish, start);
    const cell = screen
      .getAllByRole('button', { name: /Breakfast/ })[0]
      ?.closest('td') as HTMLElement;
    fireEvent.drop(cell, { dataTransfer });
    await waitFor(() =>
      expect(saveMenu).toHaveBeenCalledWith(MONDAY, 'BREAKFAST', {
        items: [...DRAFT.items, { name: 'Masala dosa', dietType: 'VEG' }],
        isSpecial: false,
        specialTitle: null,
        version: 3,
      }),
    );
  });

  it('refreshes the dish library when the editor saves a new dish', async () => {
    vi.mocked(saveMenu).mockResolvedValue(DRAFT);
    renderWithProviders(<MenusPage />);
    await screen.findByText('Masala dosa');
    const calls = vi.mocked(getDishes).mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: /Breakfast/ })[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Dish 1'), { target: { value: 'Upma' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(vi.mocked(getDishes).mock.calls.length).toBeGreaterThan(calls));
  });

  it('publishes every unpublished menu after confirming', async () => {
    vi.mocked(publishMenu).mockResolvedValue(PUBLISH_RESULT);
    renderWithProviders(<MenusPage />);
    await screen.findByText('Idli, sambar');
    fireEvent.click(screen.getByRole('button', { name: 'Publish & notify students' }));
    const dialog = await screen.findByRole('dialog');
    expect(publishMenu).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish & notify students' }));
    await waitFor(() => expect(publishMenu).toHaveBeenCalledTimes(2));
    expect(publishMenu).toHaveBeenCalledWith(DRAFT.id, 3);
    expect(publishMenu).toHaveBeenCalledWith(EDITED.id, 5);
  });

  it('stops publishing at the first failure and says how far it got', async () => {
    vi.mocked(publishMenu)
      .mockReset()
      .mockResolvedValueOnce(PUBLISH_RESULT)
      .mockRejectedValueOnce(new Error('Someone else changed this menu.'));
    renderWithProviders(<MenusPage />);
    await screen.findByText('Idli, sambar');
    fireEvent.click(screen.getByRole('button', { name: 'Publish & notify students' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish & notify students' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '1 published, then this stopped',
    );
  });

  it('is read-only without edit permissions', async () => {
    auth = mockAuth(['menus:read']);
    renderWithProviders(<MenusPage />);
    expect(await screen.findAllByRole('button', { name: /^View Breakfast/ })).toHaveLength(3);
    expect(screen.queryByText('Dish library')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy last week' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Publish & notify students' }),
    ).not.toBeInTheDocument();
  });
});
