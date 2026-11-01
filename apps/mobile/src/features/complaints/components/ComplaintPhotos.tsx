import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { COMPLAINT_MAX_PHOTOS, COMPLAINT_PHOTO_MAX_BYTES } from '@ennel/shared';
import { AppButton } from '@/shared/components/AppButton';
import { MessageBanner } from '@/shared/components/MessageBanner';
import { type PickedComplaintPhoto } from '../api/complaints-api';

interface ComplaintPhotosProps {
  photos: PickedComplaintPhoto[];
  onChange: (photos: PickedComplaintPhoto[]) => void;
}

/** Spec §12 "Upload Photo" / "Remove Photo", with permission and size checks before upload. */
export function ComplaintPhotos({ photos, onChange }: ComplaintPhotosProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const isFull = photos.length >= COMPLAINT_MAX_PHOTOS;

  const addPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNotice('Allow photo access in Settings to attach a photo.');
      return;
    }
    // Quality below 1 makes the picker re-encode to JPEG, which also drops most metadata.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    const size = asset.fileSize ?? asset.file?.size;
    if (size !== undefined && size > COMPLAINT_PHOTO_MAX_BYTES) {
      setNotice('Each photo must be 5 MB or smaller.');
      return;
    }
    setNotice(null);
    onChange([
      ...photos,
      {
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
        fileName: asset.fileName ?? `photo-${photos.length + 1}.jpg`,
        file: asset.file,
      },
    ]);
  };

  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-foreground">Photos (optional)</Text>
      <Text className="mb-2 text-xs text-muted-foreground">
        Up to {COMPLAINT_MAX_PHOTOS} photos, 5 MB each. Location and camera details are removed.
      </Text>
      {notice ? <MessageBanner tone="warning" message={notice} /> : null}
      <View className="mb-2 flex-row flex-wrap gap-3">
        {photos.map((photo, index) => (
          <View key={photo.uri} className="items-center">
            <Image
              source={{ uri: photo.uri }}
              accessibilityLabel={`Photo ${index + 1}`}
              className="h-20 w-20 rounded-md bg-surface"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              onPress={() => onChange(photos.filter((item) => item.uri !== photo.uri))}
              className="min-h-11 justify-center"
            >
              <Text className="text-sm font-semibold text-danger">Remove</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <AppButton
        label={isFull ? `${COMPLAINT_MAX_PHOTOS} photos added` : 'Upload Photo'}
        variant="secondary"
        isDisabled={isFull}
        onPress={() => void addPhoto()}
      />
    </View>
  );
}
