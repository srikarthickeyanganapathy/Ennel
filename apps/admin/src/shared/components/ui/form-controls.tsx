import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

const FIELD =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input data-slot="input" className={cn(FIELD, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea data-slot="textarea" className={cn(FIELD, 'min-h-20 py-2', className)} {...props} />
  );
}

interface SelectProps extends React.ComponentProps<'select'> {
  /** `field` for forms and toolbars; `chip` for the Figma filter chips ("Hostel: All"). */
  variant?: 'field' | 'chip';
  /** Chip only: shows the chosen state (mint fill, green border). */
  isActive?: boolean;
}

const SELECT_VARIANTS = {
  field: 'rounded-md border border-input bg-background shadow-xs',
  chip: 'min-h-11 rounded-full border-[1.5px] border-border bg-background',
} as const;

/**
 * The one dropdown for every page. A native select keeps keyboard and screen-reader support with
 * no extra dependency; the browser arrow is hidden and replaced by our chevron, so the text never
 * runs under it. `className` sizes the control (width, height); the select fills it.
 */
export function Select({ className, variant = 'field', isActive = false, ...props }: SelectProps) {
  return (
    <span
      className={cn(
        'relative inline-flex h-9 w-full shrink-0',
        variant === 'chip' && 'h-11 w-auto',
        className,
      )}
    >
      <select
        data-slot="select"
        className={cn(
          'h-full w-full min-w-0 cursor-pointer appearance-none truncate pl-3 pr-9 text-sm text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive',
          SELECT_VARIANTS[variant],
          variant === 'chip' && 'pl-3.5',
          isActive && 'border-primary bg-mint font-semibold text-primary',
        )}
        {...props}
      />
      <ChevronDown
        aria-hidden
        className={cn(
          'pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2',
          isActive ? 'text-primary' : 'text-muted-foreground',
        )}
      />
    </span>
  );
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('text-sm font-medium text-foreground', className)} {...props} />;
}

export function Checkbox({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="checkbox"
      className={cn('size-4 rounded border-input accent-primary', className)}
      {...props}
    />
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
