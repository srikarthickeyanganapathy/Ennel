import { Alert } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  isDestructive?: boolean;
}

/** Spec §14 confirmation dialog for destructive actions. Resolves true when confirmed. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      options.title,
      options.message,
      [
        { text: options.cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: options.confirmLabel,
          style: options.isDestructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      // Android: tapping outside the dialog dismisses it, which counts as cancel.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
