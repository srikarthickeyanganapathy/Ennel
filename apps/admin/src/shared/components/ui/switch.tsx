import { cn } from '@/shared/lib/utils';

interface SwitchProps {
  label: string;
  isOn: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/** The Figma "Switch" (44 × 26). Pair it with text saying what on and off mean. */
export function Switch({ label, isOn, onToggle, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={isOn}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'relative h-[26px] w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50',
        isOn ? 'bg-primary' : 'bg-border',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-[3px] top-[3px] size-5 rounded-full bg-background shadow-xs transition-transform',
          isOn && 'translate-x-[18px]',
        )}
      />
    </button>
  );
}
