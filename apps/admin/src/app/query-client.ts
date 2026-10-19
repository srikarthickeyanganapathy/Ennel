import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
      // Mutations are never retried automatically, so a failed submit cannot double-apply.
      mutations: { retry: false },
    },
  });
}
