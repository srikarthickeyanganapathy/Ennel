import { Utensils } from 'lucide-react';
import { type ReactNode } from 'react';

/** The Figma "Admin — Login" card, for the pages shown outside the app layout. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-mint p-4">
      <section className="flex w-full max-w-[440px] flex-col gap-5 rounded-lg bg-background px-6 pt-8 pb-7 shadow-[0_8px_24px_rgba(0,0,0,0.08)] sm:px-10 sm:pt-10 sm:pb-9">
        <div className="flex items-center gap-2.5">
          <span className="rounded-sm bg-primary p-2 text-primary-foreground">
            <Utensils aria-hidden className="size-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-xl font-bold text-primary">ENNEL</span>
            <span className="block text-xs font-semibold text-muted-foreground">Mess Admin</span>
          </span>
        </div>
        <div>
          <h1 className="text-[22px] leading-tight font-semibold text-foreground">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {children}
      </section>
    </main>
  );
}
