import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { API_URL } from '@/config/env';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { useSubmitLock } from '@/shared/hooks/use-submit-lock';
import { useUploadPhoto } from '../hooks/use-onboarding-queries';

// BR-ONB-7. Mirrors the API limit so a large photo is refused before it is uploaded; above this
// size the API's upload limit answers with a bare "File too large" instead of a helpful message.
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

interface ProfilePhotoPickerProps {
  photoUrl: string | null;
}

/** Spec §3 Screen 5 "Add / Change Photo": optional; uploads as soon as a photo is chosen. */
export function ProfilePhotoPicker({ photoUrl }: ProfilePhotoPickerProps) {
  const upload = useUploadPhoto();
  const lock = useSubmitLock();
  const [notice, setNotice] = useState<string | null>(null);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNotice('Allow photo access in Settings to add a profile photo.');
      return;
    }
    setNotice(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    const size = asset.fileSize ?? asset.file?.size;
    if (size !== undefined && size > MAX_PHOTO_BYTES) {
      setNotice('The photo must be 5 MB or smaller.');
      return;
    }
    upload.reset();
    await upload.mutateAsync({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      fileName: asset.fileName ?? 'photo.jpg',
      file: asset.file,
    });
  };

  return (
    <View className="mb-6 items-center">
      {photoUrl ? (
        <Image
          source={{ uri: `${API_URL}${photoUrl}` }}
          accessibilityLabel="Your profile photo"
          className="mb-3 h-24 w-24 rounded-full"
        />
      ) : (
        <View className="mb-3 h-24 w-24 items-center justify-center rounded-full bg-mint">
          <Text className="text-sm text-primary">No photo</Text>
        </View>
      )}
      {notice ? <MessageBanner tone="warning" message={notice} /> : null}
      {upload.error ? <MessageBanner message={upload.error.message} /> : null}
      <AppButton
        label={photoUrl ? 'Change Photo' : 'Add Photo (optional)'}
        variant="secondary"
        // The lock also stops a second tap from opening another picker while one is open.
        onPress={() => lock(pickPhoto)}
        isLoading={upload.isPending}
      />
    </View>
  );
}
