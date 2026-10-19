import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { API_URL } from '@/config/env';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { useUploadPhoto } from '../hooks/use-onboarding-queries';

interface ProfilePhotoPickerProps {
  photoUrl: string | null;
}

/** Spec §3 Screen 5 "Add / Change Photo": optional; uploads as soon as a photo is chosen. */
export function ProfilePhotoPicker({ photoUrl }: ProfilePhotoPickerProps) {
  const upload = useUploadPhoto();
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPermissionMessage('Allow photo access in Settings to add a profile photo.');
      return;
    }
    setPermissionMessage(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    upload.mutate({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      fileName: asset.fileName ?? 'photo.jpg',
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
      {permissionMessage ? <MessageBanner tone="warning" message={permissionMessage} /> : null}
      {upload.error ? <MessageBanner message={upload.error.message} /> : null}
      <AppButton
        label={photoUrl ? 'Change Photo' : 'Add Photo (optional)'}
        variant="secondary"
        onPress={pickPhoto}
        isLoading={upload.isPending}
      />
    </View>
  );
}
