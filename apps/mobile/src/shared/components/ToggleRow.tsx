import { Switch, Text, View } from 'react-native';
import { THEME_COLORS } from '@ennel/shared';

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/** A switch with a visible ON/OFF word so state is not shown by colour alone (Spec §14). */
export function ToggleRow({ label, description, value, onChange }: ToggleRowProps) {
  return (
    <View className="flex-row items-center justify-between py-3">
      <View className="mr-3 flex-1">
        <Text className="text-base font-semibold text-foreground">{label}</Text>
        {description ? <Text className="text-sm text-muted-foreground">{description}</Text> : null}
      </View>
      <Text className="mr-2 text-sm font-medium text-muted-foreground">{value ? 'ON' : 'OFF'}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: THEME_COLORS.primary, false: THEME_COLORS.border }}
      />
    </View>
  );
}
