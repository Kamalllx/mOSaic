"use client";

import type { AgentManifest, SystemConfig } from "@mosaic/contracts";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Bot,
  CircleCheck,
  CircleX,
  Cpu,
  Flag,
  Hand,
  Layers,
  type LucideIcon,
  Network,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useClient } from "@/app/providers";
import { useResources } from "@/components/desktop/hooks";
import { Loading } from "@/components/desktop/orb";
import { useWindowNav, useWindowParams } from "@/components/desktop/window-context";
import { architecture, isHealthy, needsHuman, overview, routingFlow, SECTIONS, type SectionId, searchConfig } from "@/lib/settings";
import { cn } from "@/lib/utils";

const ICON: Record<SectionId, LucideIcon> = {
  overview: Settings2,
  models: Sparkles,
  agents: Bot,
  tools: Wrench,
  policies: Hand,
  security: ShieldCheck,
  stack: Layers,
};

function Panel({ title, icon: Icon, children, className }: { title: string; icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-line bg-surface-1 p-4 shadow-panel", className)}>
      <h2 className="mb-3 flex items-center gap-2 text-[17px] font-semibold">
        <Icon className="size-4.5 text-text-2" aria-hidden /> {title}
      </h2>
      {children}
    </section>
  );
}

function Chips({ items, tone = "border-line text-text-2" }: { items?: string[]; tone?: string }) {
  if (!items?.length) return <span className="text-sm text-muted-foreground">none</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((c) => (
        <span key={c} className={cn("rounded-md border px-1.5 py-0.5 font-mono text-xs", tone)}>
          {c}
        </span>
      ))}
    </div>
  );
}

function Pill({ on, yes = "on", no = "off" }: { on: boolean; yes?: string; no?: string }) {
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 font-mono text-xs font-bold", on ? "bg-st-running/12 text-st-running" : "bg-surface-3 text-text-2")}>
      {on ? yes : no}
    </span>
  );
}

function Stat({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-4 shadow-panel">
      <p className="text-sm text-text-2">{label}</p>
      <p className="mt-1 font-mono text-3xl font-bold">{value}</p>
      {detail && <p className="mt-1 truncate text-xs text-text-2">{detail}</p>}
    </div>
  );
}

function ArchitectureMap({ cfg, live }: { cfg: SystemConfig; live?: import("@mosaic/contracts").ComponentHealth[] }) {
  const layers = architecture(cfg.stack ?? [], live);
  const endpoints = cfg.endpoints ?? [];
  return (
    <div className="space-y-2" aria-label="Architecture map">
      <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-xs">
        {["console", "phone", "ai-* CLI"].map((c) => (
          <span key={c} className="rounded-md border border-line bg-surface-2 px-2 py-1">{c}</span>
        ))}
        <ArrowRight className="size-3.5 text-text-2" aria-hidden />
        <span className="rounded-md border border-brand/50 bg-brand-subtle px-2 py-1 text-brand">gateway {endpoints.find((e) => e.name === "gateway")?.url.replace(/^https?:\/\//, "")}</span>
      </div>
      {layers.map((l) => (
        <div key={l.title} className="grid gap-2 rounded-lg border border-line bg-surface-2 p-2 @3xl:grid-cols-[10rem_1fr] @3xl:items-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-2">{l.title}</p>
          <ul className="flex flex-wrap gap-1.5">
            {l.nodes.map((n) => (
              <li
                key={n.component}
                title={`${n.implementation}${n.detail ? ` · ${n.detail}` : ""}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border bg-surface-1 px-2 py-1 text-sm",
                  isHealthy(n) ? "border-st-running/40" : "border-st-failed/60",
                )}
              >
                <span className={cn("size-2 rounded-full", isHealthy(n) ? "bg-st-running" : "bg-st-failed")} aria-label={isHealthy(n) ? "healthy" : "down"} />
                {n.component}
                <span className={cn("rounded px-1 font-mono text-[10px] font-bold", n.mode === "real" ? "text-st-running" : "text-st-waiting")}>{n.mode}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-xs">
        {endpoints
          .filter((e) => e.name !== "gateway")
          .map((e) => (
            <span key={e.name} title={e.url} className="rounded-md border border-line bg-surface-2 px-2 py-1">
              {e.name}
            </span>
          ))}
      </div>
    </div>
  );
}

function ModelsSection({ cfg }: { cfg: SystemConfig }) {
  const res = useResources();
  const gpu = res.data?.gpu;
  const flow = routingFlow(cfg.models.routes ?? []);
  const info = new Map((cfg.models.models ?? []).map((m) => [m.name, m]));
  return (
    <div className="space-y-4">
      <Panel title="Routing" icon={Sparkles}>
        <p className="mb-3 text-sm text-text-2">
          From <span className="font-mono">{cfg.models.config_file}</span>. {cfg.models.remote_enabled ? "Remote models are enabled for non-restricted data." : "Remote models are off: every call stays on this machine."}
        </p>
        <ul className="space-y-2">
          {flow.map((g) => {
            const m = info.get(g.model);
            return (
              <li key={g.model} className="grid gap-2 rounded-lg border border-line bg-surface-2 p-3 @3xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] @3xl:items-center">
                <Chips items={g.classes} tone="border-brand/40 text-brand" />
                <ArrowRight className="hidden size-4 text-text-2 @3xl:block" aria-hidden />
                <div className={cn("flex flex-wrap items-center gap-2", !g.available && "opacity-60")}>
                  <span className="font-mono text-sm font-semibold">{g.model}</span>
                  <Pill on={g.local} yes="local" no="remote" />
                  {!g.available && <span className="rounded-md bg-st-failed/12 px-1.5 py-0.5 font-mono text-xs font-bold text-st-failed">not pulled</span>}
                  {m?.embedding_dim ? (
                    <span className="font-mono text-xs text-text-2">{m.embedding_dim}-d</span>
                  ) : m?.context_window ? (
                    <span className="font-mono text-xs text-text-2">{m.context_window.toLocaleString()} ctx</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
      <Panel title="GPU" icon={Cpu}>
        {gpu ? (
          <div className="space-y-2">
            <p className="font-mono text-sm">{gpu.name}</p>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="meter" aria-label="VRAM" aria-valuenow={gpu.memory_used_mb} aria-valuemin={0} aria-valuemax={gpu.memory_total_mb}>
              <div className="h-full rounded-full bg-brand" style={{ width: `${(100 * gpu.memory_used_mb) / Math.max(gpu.memory_total_mb, 1)}%` }} />
            </div>
            <p className="font-mono text-xs text-text-2">
              VRAM {(gpu.memory_used_mb / 1024).toFixed(1)} of {(gpu.memory_total_mb / 1024).toFixed(1)} GB in use by the resident models · load {gpu.utilization.toFixed(0)}%
            </p>
          </div>
        ) : (
          <p className="text-sm text-text-2">No GPU reported by the resource probe.</p>
        )}
      </Panel>
    </div>
  );
}

function AgentCard({ a }: { a: AgentManifest }) {
  return (
    <article className="space-y-2 rounded-xl border border-line bg-surface-1 p-4 shadow-panel">
      <header className="flex items-center justify-between gap-2">
        <h3 className="font-mono text-base font-semibold">{a.name}</h3>
        <span className="font-mono text-xs text-text-2">v{a.version ?? "0.1.0"}</span>
      </header>
      <p className="text-sm text-text-2">{a.description}</p>
      <div className="space-y-1.5 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-2">Tools</p>
        <Chips items={a.capabilities?.tools} tone="border-ev-tool/40 text-ev-tool" />
        <p className="text-xs font-semibold uppercase tracking-wider text-text-2">Knowledge</p>
        <Chips items={a.capabilities?.knowledge} tone="border-ev-knowledge/40 text-ev-knowledge" />
        {!!a.capabilities?.agents?.length && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-2">May spawn</p>
            <Chips items={a.capabilities.agents} />
          </>
        )}
        <p className="text-xs font-semibold uppercase tracking-wider text-text-2">Mounts</p>
        <Chips items={a.memory?.mounts} />
      </div>
      <p className="font-mono text-xs text-text-2">
        {a.resources?.max_tokens_per_task ? `${a.resources.max_tokens_per_task.toLocaleString()} tokens/task` : "no token cap"} · {a.resources?.max_tool_calls ?? "∞"} tool calls
      </p>
    </article>
  );
}

function PoliciesSection({ cfg }: { cfg: SystemConfig }) {
  const human = needsHuman(cfg.policies ?? []);
  return (
    <div className="space-y-4">
      <Panel title="What needs a human" icon={Hand}>
        {human.length === 0 ? (
          <p className="text-sm text-text-2">No capability requires approval.</p>
        ) : (
          <ul className="grid gap-2 @3xl:grid-cols-2">
            {human.map((h) => (
              <li key={h.capability} className="rounded-lg border border-ev-approval/40 bg-surface-2 p-3">
                <p className="font-mono text-sm font-semibold text-ev-approval">{h.capability}</p>
                <p className="text-xs text-text-2">required by {h.policies.join(", ")}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Policies (lower priority number wins)" icon={ShieldCheck}>
        <ul className="divide-y divide-line">
          {(cfg.policies ?? []).map((p) => (
            <li key={p.policy} className="grid gap-1 py-2 @3xl:grid-cols-[14rem_1fr]">
              <div>
                <p className="font-mono text-sm font-semibold">{p.policy}</p>
                <p className="text-xs text-text-2">priority {p.priority} · agents {(p.agents ?? []).join(", ")}</p>
              </div>
              <div className="space-y-1">
                <Chips items={p.requires_approval} tone="border-ev-approval/40 text-ev-approval" />
                {!!p.auto_approved?.length && <Chips items={p.auto_approved} tone="border-st-running/40 text-st-running" />}
                {!!p.denied?.length && <Chips items={p.denied} tone="border-st-failed/40 text-st-failed" />}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function SecuritySection({ cfg }: { cfg: SystemConfig }) {
  return (
    <div className="grid gap-4 @3xl:grid-cols-2">
      <Panel title="Context firewall" icon={ShieldCheck}>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between"><dt>Regex screening</dt><dd><Pill on={cfg.firewall?.regex ?? true} /></dd></div>
          <div className="flex items-center justify-between"><dt>LLM classifier (MOSAIC_FIREWALL_LLM)</dt><dd><Pill on={!!cfg.firewall?.llm_classifier} /></dd></div>
        </dl>
        <p className="mt-3 text-xs text-text-2">Retrieved text is data, never instructions. Flagged hits reach agents as evidence only.</p>
      </Panel>
      <Panel title="Feature flags" icon={Flag}>
        <dl className="space-y-2 text-sm">
          {Object.entries(cfg.feature_flags ?? {}).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between"><dt className="font-mono">{k}</dt><dd><Pill on={v} /></dd></div>
          ))}
        </dl>
      </Panel>
      <Panel title="Data boundaries" icon={Network} className="@3xl:col-span-2">
        <ul className="space-y-1 text-sm text-text-2">
          <li>Restricted data stays on local models{cfg.models.remote_enabled ? "; remote models are enabled for everything else" : "; remote models are disabled entirely"}.</li>
          <li>Sandboxes default to no network, run as non-root with a read-only filesystem.</li>
          <li>Every world-changing action is a governed syscall: policy, approval, sandboxed execution, verify, commit or rollback.</li>
          <li>Secrets are never shown here: connection strings are redacted by the gateway.</li>
        </ul>
      </Panel>
    </div>
  );
}

function StackSection({ cfg }: { cfg: SystemConfig }) {
  return (
    <div className="space-y-4">
      <Panel title="Components" icon={Layers}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="pb-2 font-semibold">Component</th><th className="pb-2 font-semibold">Mode</th><th className="pb-2 font-semibold">Implementation</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(cfg.stack ?? []).map((c) => (
                <tr key={c.component}>
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      {c.ok ? <CircleCheck className="size-4 text-st-running" aria-label="ok" /> : <CircleX className="size-4 text-st-failed" aria-label="down" />}
                      {c.component}
                    </span>
                  </td>
                  <td className="py-1.5"><Pill on={c.mode === "real"} yes="real" no={c.mode} /></td>
                  <td className="py-1.5 font-mono text-xs text-text-2 break-all">{c.implementation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="grid gap-4 @3xl:grid-cols-2">
        <Panel title="Endpoints" icon={Network}>
          <dl className="space-y-1.5 text-sm">
            {(cfg.endpoints ?? []).map((e) => (
              <div key={e.name} className="grid grid-cols-[6rem_1fr] gap-2"><dt className="text-text-2">{e.name}</dt><dd className="font-mono text-xs break-all">{e.url}</dd></div>
            ))}
          </dl>
        </Panel>
        <Panel title="Versions and paths" icon={Cpu}>
          <dl className="space-y-1.5 text-sm">
            {[
              ["mOSaic", cfg.versions.mosaic],
              ["contract", cfg.versions.contract],
              ["Python", cfg.versions.python],
              ["Node", cfg.versions.node ?? "not installed"],
              ["env", cfg.env ?? "dev"],
              ...Object.entries(cfg.paths ?? {}),
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[7rem_1fr] gap-2"><dt className="text-text-2">{k}</dt><dd className="font-mono text-xs break-all">{v}</dd></div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}

export function SettingsApp() {
  const client = useClient();
  const nav = useWindowNav();
  const params = useWindowParams();
  const section = (SECTIONS.find((s) => s.id === params.get("section"))?.id ?? "overview") as SectionId;
  const [query, setQuery] = useState("");
  const cfg = useQuery({ queryKey: ["system-config"], queryFn: () => client.systemConfig(), refetchInterval: 30_000 });
  const status = useQuery({ queryKey: ["system-status"], queryFn: () => client.status(), refetchInterval: 10_000 });
  const hits = useMemo(() => (cfg.data ? searchConfig(cfg.data, query) : []), [cfg.data, query]);
  const go = (id: SectionId) => {
    setQuery("");
    nav.navigate(`/settings?section=${id}`);
  };

  if (cfg.isPending) return <Loading label="Reading the system configuration" />;
  if (cfg.isError || !cfg.data)
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-sm text-st-failed">
        Could not load /system/config.
        <button type="button" onClick={() => cfg.refetch()} className="rounded-md border border-line px-3 py-1.5 text-foreground hover:bg-surface-3">
          Retry
        </button>
      </div>
    );
  const c = cfg.data;
  const o = overview(c);

  return (
    <div className="mx-auto grid max-w-[1600px] gap-5 @3xl:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="space-y-3">
        <label className="flex items-center gap-2 rounded-lg border border-line bg-surface-1 px-2.5 py-1.5 focus-within:border-brand">
          <Search className="size-4 text-text-2" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings"
            aria-label="Search settings"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <ul className="flex gap-1 overflow-x-auto @3xl:flex-col">
          {SECTIONS.map((s) => {
            const Icon = ICON[s.id];
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => go(s.id)}
                  aria-current={section === s.id && !query ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-sm",
                    section === s.id && !query ? "bg-brand-subtle font-semibold text-brand" : "text-text-2 hover:bg-surface-3",
                  )}
                >
                  <Icon className="size-4" aria-hidden /> {s.title}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 space-y-4">
        {query ? (
          <Panel title={`${hits.length} result${hits.length === 1 ? "" : "s"} for “${query}”`} icon={Search}>
            {hits.length === 0 ? (
              <p className="text-sm text-text-2">Nothing matches.</p>
            ) : (
              <ul className="divide-y divide-line">
                {hits.map((h, i) => (
                  <li key={`${h.section}-${h.label}-${i}`}>
                    <button type="button" onClick={() => go(h.section)} className="grid w-full gap-0.5 py-2 text-left hover:bg-surface-2 @3xl:grid-cols-[11rem_14rem_1fr] @3xl:gap-2">
                      <span className="text-xs uppercase tracking-wider text-text-2">{SECTIONS.find((s) => s.id === h.section)?.title}</span>
                      <span className="font-mono text-sm">{h.label}</span>
                      <span className="truncate text-sm text-text-2">{h.detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : section === "overview" ? (
          <>
            <div className="grid gap-4 @xl:grid-cols-2 @7xl:grid-cols-4">
              <Stat label="Components real" value={`${o.real}/${o.components}`} detail={`${o.healthy} healthy`} />
              <Stat label="Models" value={o.models} detail={o.localOnly ? "all local" : "some remote"} />
              <Stat label="Agents · tools" value={`${o.agents} · ${o.tools}`} />
              <Stat label="Needs a human" value={o.gated} detail="capabilities gated by policy" />
            </div>
            <Panel title="Architecture" icon={Layers}>
              <ArchitectureMap cfg={c} live={status.data?.components} />
            </Panel>
          </>
        ) : section === "models" ? (
          <ModelsSection cfg={c} />
        ) : section === "agents" ? (
          <div className="grid gap-4 @3xl:grid-cols-2 @7xl:grid-cols-3">
            {(c.agents ?? []).map((a) => (
              <AgentCard key={a.name} a={a} />
            ))}
          </div>
        ) : section === "tools" ? (
          <div className="grid gap-4 @3xl:grid-cols-2">
            {(c.tools ?? []).map((t) => (
              <Panel key={t.name} title={t.name} icon={Wrench}>
                <p className="mb-2 text-sm text-text-2">{t.description} · {t.transport}</p>
                <ul className="space-y-1">
                  {t.operations.map((op) => (
                    <li key={op.name} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono">{op.name}</span>
                      <span className="rounded-md border border-ev-tool/40 px-1.5 font-mono text-xs text-ev-tool">{op.capability}</span>
                      {needsHuman(c.policies ?? []).some((h) => h.capability === op.capability) && (
                        <span className="rounded-md bg-ev-approval/12 px-1.5 font-mono text-xs font-bold text-ev-approval">needs approval</span>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
          </div>
        ) : section === "policies" ? (
          <PoliciesSection cfg={c} />
        ) : section === "security" ? (
          <SecuritySection cfg={c} />
        ) : (
          <StackSection cfg={c} />
        )}
      </div>
    </div>
  );
}
