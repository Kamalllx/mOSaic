"use client";

import type { GraphResult } from "@mosaic/contracts";
import { useQuery } from "@tanstack/react-query";
import { Background, type Edge, MarkerType, type Node, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { EyeOff, Link2, ShieldAlert } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useClient } from "@/app/providers";
import { MosaicError } from "@/lib/mosaic-client";
import { Chip, PrivacyChip, TrustChip } from "./chips";

function Markdown({ body, onLink }: { body: string; onLink: (href: string) => void }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:bg-secondary [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-ev-knowledge underline underline-offset-2"
              onClick={(e) => {
                if (href && !/^[a-z]+:/i.test(href)) {
                  e.preventDefault();
                  onLink(href);
                }
              }}
            >
              {children}
            </a>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}

/** Relative OKF link (../systems/payments-api.md) → /org path, mirroring util.okf_file_to_org_path. */
export function resolveOkfLink(fromPath: string, okfFile: string, href: string): string {
  const baseDir = okfFile.split("/").slice(0, -1);
  const parts = [...baseDir, ...href.split("#")[0].split("/")];
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p && p !== ".") out.push(p);
  }
  const rel = out.join("/").replace(/\.md$/, "").replace(/(^|\/)index$/, "");
  return rel ? `/org/${rel}` : fromPath.split("/").slice(0, 2).join("/");
}

function GraphView({ graph, onSelect }: { graph: GraphResult; onSelect: (p: string) => void }) {
  const others = graph.nodes.filter((n) => n.path !== graph.root);
  const r = 160;
  const nodes: Node[] = [
    {
      id: graph.root,
      position: { x: 0, y: 0 },
      data: { label: graph.nodes.find((n) => n.path === graph.root)?.title ?? graph.root },
      style: { background: "#0f2a2e", color: "#e6edf3", border: "2px solid #39c5cf", borderRadius: 8, fontSize: 13, width: 190 },
    },
    ...others.map((n, i) => {
      const a = (2 * Math.PI * i) / Math.max(others.length, 1) - Math.PI / 2;
      return {
        id: n.path,
        position: { x: Math.cos(a) * r * 1.4, y: Math.sin(a) * r },
        data: { label: n.title || n.path.split("/").pop() },
        style: { background: "#10161e", color: "#e6edf3", border: "1px solid #2b3a4b", borderRadius: 8, fontSize: 13, width: 180 },
      };
    }),
  ];
  const edges: Edge[] = graph.edges.map((e) => ({
    id: `${e.src}-${e.relation}-${e.dst}`,
    source: e.src,
    target: e.dst,
    label: e.relation,
    labelStyle: { fill: "#9aa7b4", fontSize: 10 },
    labelBgStyle: { fill: "#0a0e13" },
    style: { stroke: e.relation === "links_to" ? "#3a4a5c" : "#a371f7" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#3a4a5c" },
  }));
  return (
    <div className="h-[440px] rounded-lg border bg-background/60">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesConnectable={false}
        colorMode="dark"
        style={{ background: "transparent" }}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, n) => onSelect(n.id)}
      >
        <Background gap={24} size={1} color="#1c2733" />
      </ReactFlow>
    </div>
  );
}

export function ObjectView({ path, onSelect }: { path: string; onSelect: (p: string) => void }) {
  const client = useClient();
  const obj = useQuery({ queryKey: ["knowledge-object", path], queryFn: () => client.object(path), retry: false });
  const graph = useQuery({ queryKey: ["knowledge-graph", path], queryFn: () => client.graph(path, 1), retry: false, enabled: obj.isSuccess });

  if (obj.isLoading) return <p className="text-sm text-muted-foreground">Loading {path}…</p>;
  if (obj.isError) {
    const e = obj.error;
    if (e instanceof MosaicError && e.code === "KNOWLEDGE_FORBIDDEN")
      return (
        <div className="rounded-lg border border-st-failed/50 bg-st-failed/10 p-5">
          <p className="flex items-center gap-2 font-semibold text-st-failed"><EyeOff className="size-5" /> Hidden by policy</p>
          <p className="mt-1 text-sm text-muted-foreground">{path} is outside your scope or above your privacy clearance.</p>
        </div>
      );
    if (e instanceof MosaicError && e.code === "KNOWLEDGE_NOT_FOUND")
      return <p className="text-sm text-muted-foreground">{path} is a folder without an index document. Pick a file on the left.</p>;
    return <p className="text-sm text-st-failed">{String(e)}</p>;
  }
  const o = obj.data!;
  const fm = o.frontmatter;
  const pv = o.provenance;
  return (
    <article className="space-y-5">
      <header className="space-y-2">
        <p className="font-mono text-sm text-muted-foreground">{o.path} <span className="opacity-60">({o.okf_file} · v{o.version ?? 1} · {o.content_hash})</span></p>
        <h1 className="text-2xl font-semibold">{fm.title}</h1>
        {fm.description && <p className="text-muted-foreground">{fm.description}</p>}
        <div className="flex flex-wrap gap-1.5">
          <Chip label="type" value={fm.type} className="border-border" />
          <PrivacyChip value={fm.privacy ?? "internal"} />
          <TrustChip value={pv.trust ?? fm.trust} />
          <Chip label="source" value={`${pv.source}${pv.source_version ? ` @ ${pv.source_version}` : ""}`} className="border-border" />
          {pv.verification_status && <Chip label="verification" value={pv.verification_status} className="border-border" />}
          {fm.owner && <Chip label="owner" value={fm.owner} className="border-border" />}
          {pv.updated_at && <Chip label="updated" value={pv.updated_at.slice(0, 10)} className="border-border" />}
          {(fm.tags ?? []).map((t) => <Chip key={t} value={`#${t}`} className="border-border text-muted-foreground" />)}
        </div>
        {(pv.trust ?? fm.trust) === "untrusted" && (
          <p className="flex items-center gap-2 rounded-md border border-st-failed/50 bg-st-failed/10 px-3 py-2 text-sm text-st-failed">
            <ShieldAlert className="size-4" /> Untrusted external content: agents receive it as quoted data and the context firewall screens it.
          </p>
        )}
      </header>
      <div className="rounded-lg border bg-card p-5">
        <Markdown body={o.body} onLink={(href) => onSelect(resolveOkfLink(o.path, o.okf_file, href))} />
      </div>
      {!!o.links?.length && (
        <section>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Link2 className="size-3.5" /> Links</h3>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {o.links.map((l) => (
              <button key={l} type="button" onClick={() => onSelect(l)} className="font-mono text-sm text-ev-knowledge hover:underline">{l}</button>
            ))}
          </div>
        </section>
      )}
      {graph.data && graph.data.nodes.length > 1 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Graph (depth 1)</h3>
          <GraphView graph={graph.data} onSelect={onSelect} />
        </section>
      )}
    </article>
  );
}
