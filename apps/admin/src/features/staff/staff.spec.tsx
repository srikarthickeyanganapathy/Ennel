import { type Role } from '@ennel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api-client/api-error';
import { renderWithProviders } from '@/test-utils/render';
import { createStaff, listRoles, updateRolePermissions } from './api/staff-api';
import { CreateStaffDialog } from './components/CreateStaffDialog';
import { RolesPage } from './pages/RolesPage';

vi.mock('./api/staff-api', () => ({
  createStaff: vi.fn(),
  listRoles: vi.fn(),
  updateRolePermissions: vi.fn(),
}));

const role = (id: string, key: Role['key'], name: string): Role => ({
  id,
  key,
  name,
  isSystem: true,
  permissions: ['menus:read'],
  staffCount: 1,
});
const WARDEN = role('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'WARDEN', 'Warden');
const AUDITOR = role('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'AUDITOR', 'Auditor');

describe('RolesPage (Admin §A)', () => {
  it('keeps unsaved edits to other roles after saving one role', async () => {
    vi.mocked(listRoles).mockResolvedValue([WARDEN, AUDITOR]);
    vi.mocked(updateRolePermissions).mockResolvedValue({
      ...WARDEN,
      permissions: ['menus:read', 'policy:read'],
    });
    renderWithProviders(<RolesPage />);

    const auditorReports = await screen.findByLabelText('Auditor: reports:read');
    fireEvent.click(auditorReports);
    fireEvent.click(screen.getByLabelText('Warden: policy:read'));
    vi.mocked(listRoles).mockResolvedValue([
      { ...WARDEN, permissions: ['menus:read', 'policy:read'] },
      AUDITOR,
    ]);

    const [wardenSave] = screen.getAllByRole('button', { name: /^Save / });
    fireEvent.click(wardenSave as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason (recorded in the audit log)'), {
      target: { value: 'Wardens read policy' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save permissions' }));

    await waitFor(() => expect(listRoles).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('Auditor: reports:read')).toBeChecked();
    expect(screen.getByLabelText('Warden: policy:read')).toBeChecked();
  });
});

describe('CreateStaffDialog (Admin §B)', () => {
  it('opens empty again after a failed attempt was cancelled', async () => {
    vi.mocked(createStaff).mockRejectedValue(
      new ApiError('VALIDATION_FAILED', 'That email is already used.', 400),
    );
    const props = { onOpenChange: () => undefined, onCreated: () => undefined };
    const { rerender } = renderWithProviders(<CreateStaffDialog open {...props} />);

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Meena Iyer' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'meena@ennel.test' } });
    fireEvent.click(screen.getByLabelText('Warden'));
    fireEvent.click(screen.getByRole('button', { name: 'Add staff member' }));
    expect(await screen.findByText('That email is already used.')).toBeInTheDocument();

    rerender(<CreateStaffDialog open={false} {...props} />);
    rerender(<CreateStaffDialog open {...props} />);
    expect(screen.getByLabelText('Full name')).toHaveValue('');
    expect(screen.queryByText('That email is already used.')).not.toBeInTheDocument();
  });
});
