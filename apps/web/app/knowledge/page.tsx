"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ObjectView } from "@/components/knowledge/object-view";
import { SearchResults } from "@/components/knowledge/search-results";
import { KnowledgeTree } from "@/components/knowledge/tree";
import { Input } from "@/components/ui/input";

function Explorer() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const path = params.get("path");
  const query = params.get("q");
  const [draft, setDraft] = useState(query ?? "");

  const go = (next: { path?: string | null; q?: string | null }) => {
    const s = new URLSearchParams();
    if (next.path) s.set("path", next.path);
    if (next.q) s.set("q", next.q);
    router.push(`${pathname}${s.size ? `?${s}` : ""}`);
  };

  return (
    <div className="grid h-[calc(100vh-6.5rem)] grid-cols-[320px_minmax(0,1fr)] gap-5">
      <aside className="flex min-h-0 flex-col gap-3">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: draft.trim() || null, path: null });
          }}
        >
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Hybrid search over /org" className="pl-8" />
        </form>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-card/50 p-2">
          <KnowledgeTree selected={path} onSelect={(p) => go({ path: p, q: null })} />
        </div>
      </aside>
      <section className="min-h-0 overflow-y-auto pr-2">
        {query ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">Search: “{query}”</h1>
              <button type="button" onClick={() => go({ q: null })} className="text-muted-foreground hover:text-foreground" aria-label="Clear search">
                <X className="size-4" />
              </button>
            </div>
            <SearchResults text={query} onSelect={(p) => go({ path: p, q: null })} />
          </div>
        ) : path ? (
          <ObjectView key={path} path={path} onSelect={(p) => go({ path: p })} />
        ) : (
          <div className="mt-20 text-center text-muted-foreground">
            <p className="text-lg">The organization&apos;s knowledge, as a filesystem.</p>
            <p className="mt-1 text-sm">Pick a document on the left or search. Everything shown is filtered by your scope and clearance.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense>
      <Explorer />
    </Suspense>
  );
}
