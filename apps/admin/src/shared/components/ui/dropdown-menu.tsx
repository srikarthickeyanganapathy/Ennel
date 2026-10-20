import * as React from 'react';
import { DropdownMenu as MenuPrimitive } from 'radix-ui';
import { cn } from '@/shared/lib/utils';

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        align="end"
        sideOffset={4}
        className={cn(
          'z-50 min-w-44 rounded-md border border-border bg-background p-1 shadow-md',
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center rounded px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-mint data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.CheckboxItem>) {
  return (
    <MenuPrimitive.CheckboxItem
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-mint',
        className,
      )}
      {...props}
    >
      <span aria-hidden className="w-4 text-primary">
        {props.checked ? '✓' : ''}
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

export const DropdownMenuSeparator = () => (
  <MenuPrimitive.Separator className="my-1 h-px bg-border" />
);
