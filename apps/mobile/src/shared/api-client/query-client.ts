import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
      // Never retry submits automatically; duplicate protection is server-side too (ADR-0016).
      mutations: { retry: false },
    },
  });
}
