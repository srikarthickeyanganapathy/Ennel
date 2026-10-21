import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { MemoryRouter } from 'react-router';

/** Renders a page or component with a fresh query client (no retries) and a router. */
export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrap = (element: ReactElement) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>
  );
  const result = render(wrap(ui));
  return { ...result, queryClient, rerender: (next: ReactElement) => result.rerender(wrap(next)) };
}
