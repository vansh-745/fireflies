"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Tooltip } from "radix-ui";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Toaster, toast } from "sonner";

import { useTheme } from "@/lib/theme";

// Sonner reads these variables; point them at our tokens so toasts follow the theme.
const toasterTokens = {
  "--normal-bg": "var(--surface-overlay)",
  "--normal-border": "var(--border)",
  "--normal-text": "var(--ink)",
  "--success-bg": "var(--success-subtle)",
  "--success-border": "var(--border)",
  "--success-text": "var(--success)",
  "--error-bg": "var(--danger-subtle)",
  "--error-border": "var(--border)",
  "--error-text": "var(--danger)",
  "--border-radius": "var(--radius-lg)",
} as CSSProperties;

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme}
      position="bottom-right"
      richColors
      closeButton
      offset={{ bottom: 88, right: 24 }}
      style={toasterTokens}
    />
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
        },
        // One place to surface failed writes; components add their own success toasts.
        mutationCache: new MutationCache({
          onError: (error) => toast.error(error.message || "Something went wrong"),
        }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Tooltip.Provider delayDuration={400} skipDelayDuration={500}>
        {children}
      </Tooltip.Provider>
      <ThemedToaster />
    </QueryClientProvider>
  );
}
