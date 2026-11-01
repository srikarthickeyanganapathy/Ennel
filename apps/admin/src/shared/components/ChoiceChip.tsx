import { Check, Plus } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface ChoiceChipProps {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  /** `radio` inside a single-choice group, `checkbox` inside a multi-choice group. */
  role?: 'radio' | 'checkbox';
  disabled?: boolean;
}

/** The Figma "Choice chip": a check when chosen, a plus when not; 44px tall for touch. */
export function ChoiceChip({
  label,
  isSelected,
  onClick,
  role = 'radio',
  disabled = false,
}: ChoiceChipProps) {
  const Icon = isSelected ? Check : Plus;
  return (
    <button
      type="button"
      role={role}
      aria-checked={isSelected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] pl-3 pr-3.5 text-sm transition-colors disabled:opacity-50',
        isSelected
          ? 'border-primary bg-mint font-semibold text-primary'
          : 'border-border bg-background text-foreground hover:border-primary',
      )}
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </button>
  );
}
