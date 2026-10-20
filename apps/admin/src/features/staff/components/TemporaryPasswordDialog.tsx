import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/shared/components/ui/dialog';

interface TemporaryPasswordDialogProps {
  email: string | null;
  password: string | null;
  onClose: () => void;
}

/** Shows a one-time password once (Admin §B); it is never retrievable again. */
export function TemporaryPasswordDialog({
  email,
  password,
  onClose,
}: TemporaryPasswordDialogProps) {
  return (
    <Dialog open={password !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Temporary password"
        description={`Give this to ${email ?? 'the staff member'} privately. It is shown only once and must be changed at first sign-in.`}
      >
        <p
          className="break-all rounded-md bg-surface p-3 font-mono text-base"
          aria-label="Temporary password"
        >
          {password}
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => void navigator.clipboard?.writeText(password ?? '')}
          >
            Copy
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
