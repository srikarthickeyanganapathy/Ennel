import { useState } from 'react';
import { Pressable, Text, TextInput, type TextInputProps, View } from 'react-native';
import { THEME_COLORS } from '@ennel/shared';

interface TextFieldProps extends Omit<TextInputProps, 'className' | 'secureTextEntry'> {
  label: string;
  error?: string;
  hint?: string;
  /** Hidden by default with a Show/Hide toggle (Spec §3 Screen 3). */
  isPassword?: boolean;
  isReadOnly?: boolean;
}

export function TextField({
  label,
  error,
  hint,
  isPassword = false,
  isReadOnly = false,
  ...input
}: TextFieldProps) {
  const [isHidden, setIsHidden] = useState(isPassword);
  const borderClass = error ? 'border-danger' : 'border-border';
  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-foreground">{label}</Text>
      <View
        className={`flex-row items-center rounded-md border bg-background ${borderClass} ${isReadOnly ? 'bg-surface' : ''}`}
      >
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hint}
          editable={!isReadOnly}
          secureTextEntry={isHidden}
          placeholderTextColor={THEME_COLORS.textMuted}
          className="min-h-12 flex-1 px-3 text-base text-foreground"
          {...input}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isHidden ? `Show ${label.toLowerCase()}` : `Hide ${label.toLowerCase()}`
            }
            onPress={() => setIsHidden((value) => !value)}
            className="px-3 py-3"
          >
            <Text className="text-sm font-semibold text-primary">{isHidden ? 'Show' : 'Hide'}</Text>
          </Pressable>
        ) : null}
      </View>
      {hint && !error ? <Text className="mt-1 text-xs text-muted-foreground">{hint}</Text> : null}
      {error ? (
        <Text accessibilityRole="alert" className="mt-1 text-sm text-danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
