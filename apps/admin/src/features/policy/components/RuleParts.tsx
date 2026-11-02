import { Check } from 'lucide-react';
import { type ReactNode } from 'react';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/form-controls';
import { Switch } from '@/shared/components/ui/switch';

/** One card of the Settings & rules page; the id is what the section list scrolls to. */
export function RuleSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-2 divide-y divide-border border-t border-border">{children}</div>
    </Card>
  );
}

/** A setting: its name and control on one line, what the value does on the next. */
export function RuleRow({
  label,
  htmlFor,
  sentence,
  children,
}: {
  label: string;
  htmlFor?: string;
  sentence: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">{children}</div>
      </div>
      <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
        <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={3} />
        {sentence}
      </p>
    </div>
  );
}

export function RuleNumber({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label?: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <Input
      id={id}
      type="number"
      aria-label={label}
      className="h-10 w-20 text-foreground"
      disabled={disabled}
      value={Number.isNaN(value) ? '' : String(value)}
      onChange={(event) => onChange(event.target.valueAsNumber)}
    />
  );
}

export function RuleSwitch({
  label,
  description,
  isOn,
  disabled,
  onToggle,
}: {
  label: string;
  description: string;
  isOn: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch label={label} isOn={isOn} disabled={disabled} onToggle={onToggle} />
    </div>
  );
}
