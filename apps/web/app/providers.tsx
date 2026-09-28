"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { createContext, useContext, useState } from "react";
import { GlobalEvents } from "@/components/global-events";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createMosaicClient, type MosaicClient } from "@/lib/mosaic-client";

const ClientContext = createContext<MosaicClient | null>(null);

export function useClient(): MosaicClient {
  const c = useContext(ClientContext);
  if (!c) throw new Error("useClient must be used inside <Providers>");
  return c;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 1_000 } } }),
  );
  const [client] = useState(() => createMosaicClient());
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem storageKey="theme" disableTransitionOnChange>
      <ClientContext.Provider value={client}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={200}>
            {children}
            <GlobalEvents />
            <Toaster position="bottom-right" closeButton expand visibleToasts={4} duration={4_000} />
          </TooltipProvider>
        </QueryClientProvider>
      </ClientContext.Provider>
    </ThemeProvider>
  );
}
