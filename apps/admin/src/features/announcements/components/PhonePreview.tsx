import { BUSINESS_TIME_ZONE } from '@ennel/shared';
import { formatInTimeZone } from 'date-fns-tz';
import { Info, Utensils } from 'lucide-react';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Card } from '@/shared/components/ui/card';

interface PhonePreviewProps {
  title: string;
  body: string;
  isUrgent: boolean;
  hasPush: boolean;
}

/**
 * Figma "Phone preview", adjusted to BR-NOT-3 / ADR-0028: the lock screen only ever says there is a
 * new notice, so the preview shows that push and, separately, the full notice inside the app.
 */
export function PhonePreview({ title, body, isUrgent, hasPush }: PhonePreviewProps) {
  const now = new Date();
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Phone preview</h2>
      <div className="flex flex-col gap-2.5 rounded-lg bg-primary px-3.5 pb-6 pt-4 text-primary-foreground">
        <p className="text-[28px] font-bold leading-tight">
          {formatInTimeZone(now, BUSINESS_TIME_ZONE, 'h:mm')}
        </p>
        <p className="text-xs opacity-85">
          {formatInTimeZone(now, BUSINESS_TIME_ZONE, 'EEEE, d MMMM')}
        </p>
        {hasPush ? (
          <Notification label="Lock screen">
            <p className="text-sm font-semibold">ENNEL</p>
            <p className="text-xs">You have a new notice. Open the app to read it.</p>
          </Notification>
        ) : (
          <p className="rounded-md bg-primary-foreground/15 px-3 py-2 text-xs">
            No push: students see it next time they open the app.
          </p>
        )}
      </div>
      <p className="text-[13px] font-medium text-muted-foreground">In the app (Notifications)</p>
      <Notification label="In the app" isUrgent={isUrgent} isBordered>
        <p className="text-sm font-semibold">{title.trim() || 'Your title'}</p>
        <p className="whitespace-pre-wrap text-xs">{body.trim() || 'Your message appears here.'}</p>
      </Notification>
      <div className="flex gap-2.5 rounded-md bg-mint p-3 text-[13px]">
        <Info aria-hidden className="size-[18px] shrink-0 text-primary" />
        <p>
          The lock screen never shows the message itself, so nothing private is visible on a locked
          phone.
        </p>
      </div>
    </Card>
  );
}

function Notification({
  label,
  isUrgent = false,
  isBordered = false,
  children,
}: {
  label: string;
  isUrgent?: boolean;
  isBordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-label={`${label} preview`}
      className={`flex flex-col gap-1 rounded-md bg-background px-3 py-2.5 text-foreground ${isBordered ? 'border border-border' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        <span aria-hidden className="flex size-4 items-center justify-center rounded-sm bg-primary">
          <Utensils className="size-2.5 text-primary-foreground" />
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">ENNEL · now</span>
        {isUrgent ? (
          <span className="ml-auto">
            <StatusBadge label="Urgent" tone="danger" />
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
