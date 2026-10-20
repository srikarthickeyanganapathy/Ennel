import { cn } from '@/shared/lib/utils';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONES: Record<StatusTone, string> = {
  success: 'bg-success-surface text-success border-success/30',
  warning: 'bg-warning-surface text-warning border-warning/30',
  danger: 'bg-danger-surface text-danger border-danger/30',
  info: 'bg-info-surface text-info border-info/30',
  neutral: 'bg-surface text-muted-foreground border-border',
};

/** Statuses always show a text label, never colour alone (Admin UX standards). */
export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        TONES[tone],
      )}
    >
      {label}
    </span>
  );
}
