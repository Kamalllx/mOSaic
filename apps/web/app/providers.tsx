"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { KnowledgeEvents } from "@/components/knowledge-events";
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
    <ClientContext.Provider value={client}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          {children}
          <KnowledgeEvents />
          <Toaster theme="dark" position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </QueryClientProvider>
    </ClientContext.Provider>
  );
}
