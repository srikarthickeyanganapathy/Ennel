import { type ComponentType } from 'react';
import { cn } from '@/shared/lib/utils';

/**
 * Renders a Figma SVG file as a CSS mask filled with the current text colour, so the file is used
 * as exported while the icon still follows the active and hover colours like the Lucide icons.
 */
export function maskIcon(url: string): ComponentType<{ className?: string }> {
  function MaskedIcon({ className }: { className?: string }) {
    return (
      <span
        aria-hidden
        className={cn('inline-block shrink-0 bg-current', className)}
        style={{
          maskImage: `url("${url}")`,
          WebkitMaskImage: `url("${url}")`,
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
        }}
      />
    );
  }
  return MaskedIcon;
}
