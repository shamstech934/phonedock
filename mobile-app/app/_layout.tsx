import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { colors } from '@/theme';
import { SavedPhonesProvider } from '@/state/SavedPhonesProvider';
import { MobileConfigProvider } from '@/state/MobileConfigProvider';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        staleTime: 2 * 60 * 1000,
        gcTime: 20 * 60 * 1000,
        refetchOnReconnect: true,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <MobileConfigProvider><SavedPhonesProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background }, headerShadowVisible: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="phones/[slug]" options={{ title: 'Phone details', headerBackTitle: 'Back' }} />
          <Stack.Screen name="compare" options={{ title: 'Compare phones', headerBackTitle: 'Back' }} />
        </Stack>
      </SavedPhonesProvider></MobileConfigProvider>
    </QueryClientProvider>
  );
}
