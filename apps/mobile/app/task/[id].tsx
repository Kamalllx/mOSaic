import Ionicons from "@expo/vector-icons/Ionicons";
import type { AgentProcess, Event } from "@mosaic/contracts";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { clock } from "../../src/format";
import { usePoll } from "../../src/hooks";
import { useClient, useSession } from "../../src/session";
import { color, font, radius, space, stateTone, statusTone, type Tone, type } from "../../src/theme";
import { Button, Card, ErrorCard, Eyebrow, Pill, Progress, Tile } from "../../src/ui";

const ACTIVE = new Set(["queued", "planning", "running", "waiting_approval", "paused"]);
const LIVE = new Set(["RUNNING", "INITIALIZING", "READY"]);
const MAX_EVENTS = 200;

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const T = {
  brand: { fill: color.brand, soft: color.brandSoft, ink: color.brandInk },
  know: { fill: color.knowledge, soft: color.knowledgeSoft, ink: color.knowledge },
  wait: { fill: color.waiting, soft: color.waitingSoft, ink: color.waiting },
  ok: { fill: color.approve, soft: color.approveSoft, ink: color.approve },
  bad: { fill: color.danger, soft: color.dangerSoft, ink: color.danger },
  quiet: { fill: color.ink3, soft: color.sunken, ink: color.ink2 },
};

/** Event family -> colour and icon, so the timeline reads at a glance. */
function look(e: Event): { tone: Tone; icon: IconName } {
  const t = e.type;
  if (t.startsWith("knowledge.")) return { tone: T.know, icon: "library" };
  if (t.startsWith("approval.") || t === "syscall.requested") return { tone: T.wait, icon: "hand-left" };
  if (t.startsWith("sandbox.")) return { tone: T.brand, icon: "cube" };
  if (t.startsWith("tool.")) return { tone: T.brand, icon: "construct" };
  if (t.startsWith("transaction.") || t === "task.completed") return { tone: T.ok, icon: "checkmark-circle" };
  if (t.endsWith(".failed") || t.includes("rollback")) return { tone: T.bad, icon: "close-circle" };
  if (t.startsWith("process.")) return { tone: T.brand, icon: "git-network" };
  if (t.startsWith("memory.")) return { tone: T.know, icon: "albums" };
  if (t.startsWith("agent.thought") || t.startsWith("task.understood") || t.startsWith("agent.planned")) return { tone: T.brand, icon: "bulb" };
  return { tone: T.quiet, icon: "ellipse" };
}

/** One readable line per event; unknown event types (e.g. the new thought-process events) still show their type. */
function describe(e: Event): string {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : undefined);
  switch (e.type) {
    case "process.spawned":
      return `Started ${s("agent") ?? "an agent"}${s("goal") ? `: ${s("goal")}` : ""}`;
    case "process.state_changed":
      return `${s("agent") ?? "Agent"} is now ${(s("to") ?? s("state") ?? "").toLowerCase()}`;
    case "agent.log":
      return s("message") ?? s("text") ?? "";
    case "agent.thought":
      return s("text") ?? "";
    case "task.understood":
      return `Understood: ${s("intent") ?? s("plan_summary") ?? ""}`;
    case "agent.planned":
      return `Planned ${s("role") ?? "an agent"}${s("why") ? `, because ${s("why")}` : ""}`;
    case "knowledge.retrieved": {
      const n = Array.isArray(p.paths) ? (p.paths as string[]).length : 0;
      const f = Array.isArray(p.flagged) ? (p.flagged as unknown[]).length : 0;
      return `Read ${n} document${n === 1 ? "" : "s"}${f ? `, ${f} flagged by the firewall` : ""}`;
    }
    case "syscall.requested":
      return `Asked to use ${s("capability") ?? "a tool"}`;
    case "approval.requested":
      return `Waiting for your approval of ${s("capability") ?? "an action"}`;
    case "approval.resolved":
      return `Approval ${s("status") ?? "resolved"}${s("resolved_by") ? ` by ${s("resolved_by")}` : ""}`;
    case "tool.query":
      return `${s("tool") ?? "Tool"} query${typeof p.rows === "number" ? `: ${p.rows} rows` : ""}`;
    default:
      return s("summary") ?? s("message") ?? s("status") ?? "";
  }
}

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useClient();
  const { can } = useSession();
  const task = usePoll(useCallback(() => client.getTask(id), [client, id]), 2_000, [id]);
  const procs = usePoll(useCallback(() => client.processes(id), [client, id]), 2_500, [id]);
  const [events, setEvents] = useState<Event[]>([]);
  const [live, setLive] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    setEvents([]);
    return client.events(
      id,
      (e) =>
        setEvents((prev) => {
          if (e.event_id && prev.some((x) => x.event_id === e.event_id)) return prev;
          return [...prev, e].slice(-MAX_EVENTS);
        }),
      setLive,
    );
  }, [client, id]);

  const t = task.data;
  const tone = statusTone(t?.status);
  const active = ACTIVE.has(t?.status ?? "");
  const tree = [...(procs.data ?? [])].sort((a, b) => a.pid - b.pid);
  const done = tree.filter((p) => p.state === "COMPLETED").length;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: id }} />
      {task.error && !t ? <ErrorCard error={task.error} onRetry={task.refresh} /> : null}
      {!t ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={color.brand} />
      ) : (
        <View style={[styles.hero, { backgroundColor: tone.soft }]}>
          <View style={styles.row}>
            <Pill text={(t.status ?? "").replace("_", " ")} tone={tone} solid />
            <Text style={[styles.meta, { color: tone.ink }]}>{t.priority ?? "normal"} priority</Text>
          </View>
          <Text style={[type.title, { marginTop: space.md }]}>{t.goal}</Text>
          {tree.length ? (
            <View style={{ marginTop: space.lg, gap: 6 }}>
              <Progress value={done / tree.length} tone={tone} />
              <Text style={[styles.meta, { color: tone.ink }]}>
                {done} of {tree.length} agents finished
              </Text>
            </View>
          ) : null}
          {active && can("task.cancel") ? (
            <Button
              title="Cancel task"
              variant="outline"
              tone={T.bad}
              busy={cancelling}
              style={{ marginTop: space.lg, flex: 0, backgroundColor: color.surface }}
              onPress={async () => {
                setCancelling(true);
                await client.cancelTask(id).catch(() => undefined);
                await task.refresh();
                setCancelling(false);
              }}
            />
          ) : null}
        </View>
      )}

      {t?.result?.summary ? (
        <Card style={{ borderColor: color.approveSoft }}>
          <View style={styles.row}>
            <Ionicons name="sparkles" size={18} color={color.approve} />
            <Text style={[type.eyebrow, { color: color.approve }]}>Result</Text>
          </View>
          <Text style={[type.body, { marginTop: space.sm }]}>{t.result.summary.replace(/[#*_`>]/g, "").trim()}</Text>
          {(t.result.artifacts ?? []).map((a) => (
            <View key={a} style={styles.artifact}>
              <Ionicons name="document-attach-outline" size={15} color={color.knowledge} />
              <Text style={styles.artifactText}>{a.replace(/^artifact:\/\/[^/]+\//, "")}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {t?.error ? <ErrorCard error={`${t.error.code}: ${t.error.message}`} /> : null}

      <Eyebrow>Agents</Eyebrow>
      <Card style={{ paddingVertical: space.sm }}>
        {tree.length === 0 ? <Text style={[type.small, { paddingVertical: space.sm }]}>No agents yet. The planner starts them as it breaks the task down.</Text> : null}
        {tree.map((p: AgentProcess, i) => {
          const st = stateTone(p.state);
          return (
            <View key={p.pid} style={[styles.proc, i > 0 && styles.procLine, { paddingLeft: p.ppid ? space.xl : 0 }]}>
              {p.ppid ? <View style={styles.branch} /> : null}
              <Tile name={p.agent} size={38} live={LIVE.has(p.state ?? "")} />
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { fontFamily: font.bodyBold }]}>{p.agent.replace(/-agent$/, "")}</Text>
                <Text style={styles.meta}>PID {p.pid}</Text>
              </View>
              <Pill text={(p.state ?? "").toLowerCase()} tone={st} />
            </View>
          );
        })}
      </Card>

      <View style={[styles.row, { marginTop: space.md }]}>
        <Text style={type.eyebrow}>Timeline</Text>
        <View style={{ marginLeft: "auto" }}>
          <Pill text={live ? "live" : "reconnecting"} tone={live ? T.ok : T.wait} icon={<View style={[styles.liveDot, { backgroundColor: live ? color.approve : color.waiting }]} />} />
        </View>
      </View>
      <Card>
        {events.length === 0 ? <Text style={type.small}>Events appear here as the agents work.</Text> : null}
        {[...events].reverse().map((e, i, arr) => {
          const { tone: et, icon } = look(e);
          const text = describe(e);
          return (
            <View key={e.event_id ?? `${e.type}-${i}`} style={styles.event}>
              <View style={styles.rail}>
                <View style={[styles.dot, { backgroundColor: et.soft }]}>
                  <Ionicons name={icon} size={14} color={et.fill} />
                </View>
                {i < arr.length - 1 ? <View style={styles.railLine} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: space.md }}>
                <Text style={styles.evHead}>
                  <Text style={{ color: et.ink, fontFamily: font.monoBold }}>{e.type}</Text>
                  <Text style={{ color: color.ink3 }}>
                    {"  "}
                    {clock(e.ts)}
                    {e.pid ? ` · PID ${e.pid}` : ""}
                  </Text>
                </Text>
                {text ? (
                  <Text style={[type.small, { color: color.ink, marginTop: 2 }]} numberOfLines={4}>
                    {text}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  hero: { borderRadius: radius.xl, padding: space.lg },
  meta: { fontFamily: font.body, fontSize: 12, color: color.ink3 },
  artifact: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: color.knowledgeSoft, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6, marginTop: space.sm, alignSelf: "flex-start" },
  artifactText: { fontFamily: font.mono, fontSize: 12, color: color.knowledge },
  proc: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  procLine: { borderTopWidth: 1, borderTopColor: color.line },
  branch: { position: "absolute", left: 10, top: 0, bottom: "50%", width: 12, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: color.line, borderBottomLeftRadius: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  event: { flexDirection: "row", gap: space.md },
  rail: { alignItems: "center", width: 28 },
  dot: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  railLine: { flex: 1, width: 2, backgroundColor: color.line, marginVertical: 2 },
  evHead: { fontSize: 12, fontFamily: font.mono },
});
