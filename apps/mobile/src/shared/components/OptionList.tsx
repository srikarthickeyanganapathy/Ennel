import { Pressable, Text, View } from 'react-native';

export interface Option {
  value: string;
  label: string;
}

interface OptionListProps {
  label: string;
  options: Option[];
  selected: string | null;
  onSelect: (value: string) => void;
  error?: string;
}

/** Single-choice list used for hostel blocks and slots; the selection is marked in text too. */
export function OptionList({ label, options, selected, onSelect, error }: OptionListProps) {
  return (
    <View className="mb-4" accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text className="mb-2 text-sm font-medium text-foreground">{label}</Text>
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected, checked: isSelected }}
            onPress={() => onSelect(option.value)}
            className={`mb-2 min-h-12 flex-row items-center justify-between rounded-md border px-3 py-3 ${isSelected ? 'border-primary bg-mint' : 'border-border bg-background'}`}
          >
            <Text
              className={`text-base ${isSelected ? 'font-semibold text-primary' : 'text-foreground'}`}
            >
              {option.label}
            </Text>
            {isSelected ? (
              <Text className="text-sm font-semibold text-primary">Selected</Text>
            ) : null}
          </Pressable>
        );
      })}
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
