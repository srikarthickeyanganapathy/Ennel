import { Text, View } from 'react-native';

interface MessageBannerProps {
  message: string;
  tone?: 'error' | 'info' | 'success' | 'warning';
}

const TONES = {
  error: { container: 'bg-danger-surface border-danger', text: 'text-danger', label: 'Error' },
  info: { container: 'bg-info-surface border-info', text: 'text-info', label: 'Note' },
  success: { container: 'bg-success-surface border-success', text: 'text-success', label: 'Done' },
  warning: {
    container: 'bg-warning-surface border-warning',
    text: 'text-warning',
    label: 'Warning',
  },
} as const;

/** Status text always carries a word label, not colour alone (Spec §14). */
export function MessageBanner({ message, tone = 'error' }: MessageBannerProps) {
  const style = TONES[tone];
  return (
    <View
      accessibilityRole="alert"
      className={`mb-4 rounded-md border px-3 py-2 ${style.container}`}
    >
      <Text className={`text-sm ${style.text}`}>
        <Text className="font-semibold">{style.label}: </Text>
        {message}
      </Text>
    </View>
  );
}
