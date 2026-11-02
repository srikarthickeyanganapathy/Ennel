import { type SlotStatusLabel } from '@ennel/shared';

/** The student-facing slot labels (BR-CAP-5), always as text with colour. */
export const STATUS_DISPLAY: Record<SlotStatusLabel, { label: string; text: string; bar: string }> =
  {
    AVAILABLE: { label: 'Available', text: 'text-foreground', bar: 'bg-primary' },
    FILLING_FAST: { label: 'Filling fast', text: 'text-warning', bar: 'bg-warning' },
    FULL: { label: 'Full', text: 'text-danger', bar: 'bg-danger' },
    OVER_CAPACITY: { label: 'Over capacity', text: 'text-danger', bar: 'bg-danger' },
  };
