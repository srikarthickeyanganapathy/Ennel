import { Eye, EyeOff, Lock } from 'lucide-react';
import { type ComponentProps, useState } from 'react';
import { Input } from '@/shared/components/ui/form-controls';

export const AUTH_INPUT =
  'h-12 rounded-md border-[1.5px] border-border pl-10 text-[15px] shadow-none';
export const AUTH_ICON =
  'pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground';

interface PasswordInputProps extends Omit<ComponentProps<'input'>, 'type'> {
  /** Names the field on its button, e.g. "the new password". */
  subject?: string;
}

/** A password field with a show and hide button (Figma "Admin — Login"). */
export function PasswordInput({ subject = 'the password', ...props }: PasswordInputProps) {
  const [isShown, setIsShown] = useState(false);
  const Icon = isShown ? EyeOff : Eye;
  return (
    <span className="relative block">
      <Lock aria-hidden className={AUTH_ICON} />
      <Input {...props} type={isShown ? 'text' : 'password'} className={`${AUTH_INPUT} pr-11`} />
      <button
        type="button"
        aria-label={`${isShown ? 'Hide' : 'Show'} ${subject}`}
        aria-pressed={isShown}
        className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        onClick={() => setIsShown(!isShown)}
      >
        <Icon aria-hidden className="size-[18px]" />
      </button>
    </span>
  );
}
