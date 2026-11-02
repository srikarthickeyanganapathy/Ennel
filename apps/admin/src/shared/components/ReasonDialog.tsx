import { overrideReasonSchema } from '@ennel/shared';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { errorMessage } from '@/shared/api-client/api-error';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter } from './ui/dialog';
import { Field, Textarea } from './ui/form-controls';

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  /** Starts the field filled in, e.g. from a note already typed on the page. */
  initialReason?: string;
  isDestructive?: boolean;
  isPending?: boolean;
  error?: unknown;
  /** Extra inputs, e.g. a slot to reassign bookings to. */
  children?: ReactNode;
  onConfirm: (reason: string) => void;
}

/**
 * Confirmation with a mandatory reason, used for overrides and audited admin actions
 * (Admin UX standards, working rule 7). The reason is validated with the API's own schema.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  initialReason = '',
  isDestructive = false,
  isPending = false,
  error,
  children,
  onConfirm,
}: ReasonDialogProps) {
  const id = useId();
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason(initialReason);
      setProblem(null);
    }
  }, [open, initialReason]);

  const submit = () => {
    const result = overrideReasonSchema.safeParse(reason);
    if (!result.success) {
      setProblem(result.error.issues[0]?.message ?? 'A reason is required');
      return;
    }
    onConfirm(result.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        <div className="space-y-4">
          {children}
          <Field
            label="Reason (recorded in the audit log)"
            htmlFor={id}
            error={problem ?? undefined}
          >
            <Textarea
              id={id}
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(error)}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={isDestructive ? 'destructive' : 'default'}
            onClick={submit}
            disabled={isPending}
          >
            {isPending ? 'Saving…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
