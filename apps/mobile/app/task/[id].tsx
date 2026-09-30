import type { AgentProcess, Event } from "@mosaic/contracts";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { clock } from "../../src/format";
import { usePoll } from "../../src/hooks";
import { useClient, useSession } from "../../src/session";
import { accentFor, color, mono, space, statusColor } from "../../src/theme";
import { Badge, Body, Button, Card, ErrorCard, Label } from "../../src/ui";

const ACTIVE = new Set(["queued", "planning", "running", "waiting_approval", "paused"]);
const MAX_EVENTS = 200;

/** One readable line per event; unknown event types (e.g. the new thought-process events) still show their type. */
export function describeEvent(e: Event): string {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : undefined);
  switch (e.type) {
    case "process.spawned":
      return `spawned ${s("agent") ?? "agent"}${s("goal") ? `: ${s("goal")}` : ""}`;
    case "agent.log":
      return s("message") ?? s("text") ?? "log";
    case "agent.thought":
      return s("text") ?? "thinking";
    case "task.understood":
      return `understood: ${s("intent") ?? s("plan_summary") ?? ""}`;
    case "agent.planned":
      return `planned ${s("role") ?? "agent"}${s("why") ? ` because ${s("why")}` : ""}`;
    case "knowledge.retrieved":
      return `read ${Array.isArray(p.paths) ? (p.paths as string[]).length : 0} documents${p.flagged && (p.flagged as unknown[]).length ? `, ${(p.flagged as unknown[]).length} flagged` : ""}`;
    case "syscall.requested":
      return `asked for ${s("capability") ?? "a syscall"}`;
    case "approval.requested":
      return `waiting for approval of ${s("capability") ?? "an action"}`;
    case "approval.resolved":
      return `approval ${s("status") ?? "resolved"}${s("resolved_by") ? ` by ${s("resolved_by")}` : ""}`;
    case "tool.query":
      return `${s("tool") ?? "tool"}: ${typeof p.rows === "number" ? `${p.rows} rows` : "query"}`;
    default:
      return s("summary") ?? s("message") ?? s("status") ?? "";
  }
}

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useClient();
  const { can } = useSession();
  const task = usePoll(useCallback(() => client.getTask(id), [client, id]), 2_000, [id]);
  const procs = usePoll(useCallback(() => client.processes(id), [client, id]), 3_000, [id]);
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
  const active = ACTIVE.has(t?.status ?? "");
  const tree = [...(procs.data ?? [])].sort((a, b) => a.pid - b.pid);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: id }} />
      {task.error && !t ? <ErrorCard error={task.error} onRetry={task.refresh} /> : null}
      {!t ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={color.brand} />
      ) : (
        <Card accent={statusColor(t.status)}>
          <View style={styles.row}>
            {active ? <ActivityIndicator size="small" color={statusColor(t.status)} /> : null}
            <Badge text={(t.status ?? "").replace("_", " ")} tone={statusColor(t.status)} filled />
            <Text style={styles.meta}>{t.priority ?? "normal"} priority</Text>
          </View>
          <Body>{t.goal}</Body>
          {active && can("task.cancel") ? (
            <Button
              title="Cancel task"
              variant="outline"
              tone={color.failed}
              busy={cancelling}
              style={{ marginTop: space.sm, flex: 0 }}
              onPress={async () => {
                setCancelling(true);
                await client.cancelTask(id).catch(() => undefined);
                await task.refresh();
                setCancelling(false);
              }}
            />
          ) : null}
        </Card>
      )}

      {t?.result?.summary ? (
        <Card>
          <Label>Result</Label>
          <Body>{t.result.summary}</Body>
          {(t.result.artifacts ?? []).map((a) => (
            <Text key={a} style={styles.mono}>{a}</Text>
          ))}
        </Card>
      ) : null}
      {t?.error ? (
        <Card style={{ borderColor: color.failed }}>
          <Label>Error</Label>
          <Body style={{ color: color.failed }}>{t.error.code}: {t.error.message}</Body>
        </Card>
      ) : null}

      <Card>
        <Label>Processes</Label>
        {tree.length === 0 ? <Body muted>No agent processes yet.</Body> : null}
        {tree.map((p: AgentProcess) => (
          <View key={p.pid} style={[styles.proc, { marginLeft: p.ppid ? space.lg : 0 }]}>
            <View style={[styles.avatar, { backgroundColor: accentFor(p.agent) }]}>
              <Text style={styles.avatarText}>{p.agent.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.procName}>
                {p.agent} <Text style={styles.meta}>PID {p.pid}</Text>
              </Text>
              {p.goal ? <Body muted numberOfLines={2} style={{ fontSize: 13 }}>{p.goal}</Body> : null}
            </View>
            <Badge text={(p.state ?? "").toLowerCase()} tone={p.state === "RUNNING" ? color.brand : p.state === "WAITING" ? color.waiting : p.state === "FAILED" ? color.failed : color.text2} />
          </View>
        ))}
      </Card>

      <Card>
        <View style={styles.row}>
          <Label>Timeline</Label>
          <Pressable accessibilityRole="text" style={{ marginLeft: "auto" }}>
            <Badge text={live ? "live" : "reconnecting"} tone={live ? color.running : color.waiting} />
          </Pressable>
        </View>
        {events.length === 0 ? <Body muted>Events appear here as the agents work.</Body> : null}
        {[...events].reverse().map((e, i) => (
          <View key={e.event_id ?? `${e.type}-${i}`} style={styles.event}>
            <Text style={styles.time}>{clock(e.ts)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.evType}>
                {e.type}
                {e.pid ? <Text style={styles.meta}> · PID {e.pid}</Text> : null}
              </Text>
              {describeEvent(e) ? <Body style={{ fontSize: 14 }} numberOfLines={3}>{describeEvent(e)}</Body> : null}
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  meta: { color: color.text2, fontSize: 12, fontWeight: "400" },
  mono: { fontFamily: mono, fontSize: 12, color: color.knowledge },
  proc: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs },
  avatar: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  procName: { color: color.text, fontWeight: "700", fontSize: 15 },
  event: { flexDirection: "row", gap: space.sm, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  time: { fontFamily: mono, fontSize: 12, color: color.text2, width: 64, paddingTop: 2 },
  evType: { fontFamily: mono, fontSize: 13, fontWeight: "700", color: color.brand },
});
