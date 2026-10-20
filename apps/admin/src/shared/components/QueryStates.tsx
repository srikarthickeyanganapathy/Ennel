import { type ReactNode } from 'react';
import { errorMessage } from '@/shared/api-client/api-error';
import { Button } from './ui/button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
      <span
        className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-hidden
      />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-danger/30 bg-danger-surface p-4 text-sm text-danger"
    >
      <p>
        <span className="font-semibold">Error: </span>
        {errorMessage(error)}
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border p-8 text-center">
      <p className="font-medium text-foreground">{title}</p>
      {children ? <div className="mt-1 text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}

interface QueryBoundaryProps {
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  children: ReactNode;
}

export function QueryBoundary({ isLoading, error, onRetry, children }: QueryBoundaryProps) {
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  return <>{children}</>;
}
