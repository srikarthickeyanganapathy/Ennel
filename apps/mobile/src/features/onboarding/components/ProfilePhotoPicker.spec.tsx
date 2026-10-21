import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { renderWithProviders } from '@/test-utils/render';
import { uploadProfilePhoto } from '../api/onboarding-api';
import { PROFILE } from '../screens/onboarding.fixtures';
import { ProfilePhotoPicker } from './ProfilePhotoPicker';

jest.mock('../api/onboarding-api');

type PickerResult = Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>;

function pickAsset(asset: Partial<ImagePicker.ImagePickerAsset>): void {
  const result = {
    canceled: false,
    assets: [{ uri: 'file:///photo.jpg', width: 400, height: 400, ...asset }],
  } as PickerResult;
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce(result);
}

describe('ProfilePhotoPicker (Spec §3 Screen 5, BR-ONB-7)', () => {
  beforeEach(() => {
    jest.mocked(uploadProfilePhoto).mockResolvedValue(PROFILE);
  });

  it('explains how to allow access when photo permission is denied', async () => {
    jest
      .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
      .mockResolvedValueOnce({ granted: false } as ImagePicker.MediaLibraryPermissionResponse);
    await renderWithProviders(<ProfilePhotoPicker photoUrl={null} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add Photo (optional)' }));
    expect(await screen.findByText(/Allow photo access in Settings/)).toBeTruthy();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('refuses a photo over 5 MB before uploading it', async () => {
    pickAsset({ fileSize: 6 * 1024 * 1024 });
    await renderWithProviders(<ProfilePhotoPicker photoUrl={null} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add Photo (optional)' }));
    expect(await screen.findByText(/The photo must be 5 MB or smaller./)).toBeTruthy();
    expect(uploadProfilePhoto).not.toHaveBeenCalled();
  });

  it('uploads the browser File in the web preview', async () => {
    const file = new Blob(['jpeg'], { type: 'image/jpeg' }) as File;
    pickAsset({ file, fileName: 'me.jpg', mimeType: 'image/jpeg', fileSize: 4 });
    await renderWithProviders(<ProfilePhotoPicker photoUrl={null} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add Photo (optional)' }));
    await waitFor(() => expect(uploadProfilePhoto).toHaveBeenCalledTimes(1));
    expect(jest.mocked(uploadProfilePhoto).mock.calls[0]?.[0]).toMatchObject({
      fileName: 'me.jpg',
      file,
    });
  });
});
