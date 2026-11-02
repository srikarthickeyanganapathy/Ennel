import { Calendar, ChevronDown } from 'lucide-react';
import { useRef } from 'react';

interface DatePickerButtonProps {
  value: string;
  /** What the button says, e.g. "Thu, 21 May 2026" or "Week of 18 – 24 May". */
  text: string;
  label: string;
  onChange: (date: string | undefined) => void;
}

/** Looks like the design's date button; a real date input underneath keeps it keyboard-accessible. */
export function DatePickerButton({ value, text, label, onChange }: DatePickerButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <label className="relative flex h-11 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
      <Calendar aria-hidden className="size-4 text-muted-foreground" />
      <span>{text}</span>
      <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
      <input
        ref={input}
        type="date"
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
        value={value}
        onClick={() => input.current?.showPicker?.()}
        onChange={(event) => onChange(event.target.value || undefined)}
      />
    </label>
  );
}
