import { Pressable, Text, View } from 'react-native';
import { type Option } from './OptionList';

interface SegmentedControlProps {
  label: string;
  options: Option[];
  selected: string;
  onSelect: (value: string) => void;
}

export function SegmentedControl({ label, options, selected, onSelect }: SegmentedControlProps) {
  return (
    <View className="mb-2" accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text className="mb-1 text-sm font-medium text-foreground">{label}</Text>
      <View className="flex-row rounded-md border border-border">
        {options.map((option) => {
          const isSelected = option.value === selected;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: isSelected, checked: isSelected }}
              onPress={() => onSelect(option.value)}
              className={`min-h-11 flex-1 items-center justify-center ${isSelected ? 'bg-primary' : 'bg-background'}`}
            >
              <Text
                className={isSelected ? 'font-semibold text-primary-foreground' : 'text-foreground'}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
