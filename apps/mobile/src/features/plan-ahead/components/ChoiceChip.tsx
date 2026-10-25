import { Pressable, Text } from 'react-native';

interface ChoiceChipProps {
  label: string;
  accessibilityLabel: string;
  isChecked: boolean;
  onToggle: () => void;
}

/** A checkbox shaped as a chip; "✓" marks the choice in text, not colour alone (Spec §14). */
export function ChoiceChip({ label, accessibilityLabel, isChecked, onToggle }: ChoiceChipProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: isChecked }}
      onPress={onToggle}
      className={`mb-2 mr-2 min-h-11 justify-center rounded-full border px-4 ${isChecked ? 'border-primary bg-mint' : 'border-border bg-background'}`}
    >
      <Text className={`text-sm ${isChecked ? 'font-semibold text-primary' : 'text-foreground'}`}>
        {isChecked ? `✓ ${label}` : label}
      </Text>
    </Pressable>
  );
}
