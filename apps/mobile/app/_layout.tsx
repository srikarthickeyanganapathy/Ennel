import '../src/global.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useRestoreSession } from '@/features/auth/hooks/use-restore-session';
import { createQueryClient } from '@/shared/api-client/query-client';

// Routes stay thin. The session is restored here, not on the splash, so a launch that opens
// a deeper route (a web reload or a link) also leaves the "restoring" state.
export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  useRestoreSession();
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
