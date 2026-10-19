import { Button } from '@/shared/components/ui/button';

// Staff sign-in is implemented in Phase 2 (Admin §B); this page only fixes the layout.
export function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-mint p-4">
      <section className="w-full max-w-sm rounded-lg bg-background p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-primary">ENNEL staff sign-in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign-in is not available yet.</p>
        <Button className="mt-6 w-full" disabled>
          Sign in
        </Button>
      </section>
    </main>
  );
}
