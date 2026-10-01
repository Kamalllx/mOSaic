import Ionicons from "@expo/vector-icons/Ionicons";
import type { AgentProcess, Task } from "@mosaic/contracts";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { ago } from "../../src/format";
import { usePoll } from "../../src/hooks";
import { useClient, useSession } from "../../src/session";
import { color, font, radius, space, statusTone, type } from "../../src/theme";
import { Card, Empty, ErrorCard, Pill, Progress, ScreenHeader, Tile, TileRow } from "../../src/ui";

const ACTIVE = new Set(["queued", "planning", "running", "waiting_approval", "paused"]);
const LIVE = new Set(["RUNNING", "INITIALIZING", "READY"]);

type Row = { task: Task; procs: AgentProcess[] };

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** The signature: every agent working right now, as tiles. Live tiles breathe, waiting ones wear an ochre ring. */
function LiveMosaic({ rows, pending, onApprovals }: { rows: Row[]; pending: number; onApprovals: () => void }) {
  const procs = rows.filter((r) => ACTIVE.has(r.task.status ?? "")).flatMap((r) => r.procs);
  const working = procs.filter((p) => LIVE.has(p.state ?? "")).length;
  const waiting = procs.filter((p) => p.state === "WAITING").length;
  return (
    <View style={styles.mosaic}>
      <View style={styles.mosaicHead}>
        <Text style={[type.eyebrow, { color: color.brandInk }]}>Live on your server</Text>
        <Text style={styles.mosaicStat}>
          {working} working · {waiting} waiting
        </Text>
      </View>
      {procs.length ? (
        <View style={styles.mosaicGrid}>
          {procs.map((p) => (
            <View key={`${p.task_id}-${p.pid}`} style={[styles.mosaicCell, p.state === "WAITING" && styles.waitingRing]}>
              <Tile name={p.agent} size={38} live={LIVE.has(p.state ?? "")} dim={p.state === "COMPLETED"} />
            </View>
          ))}
        </View>
      ) : (
        <Text style={[type.small, { color: color.brandInk }]}>No agents are running. Start a task and its agents appear here as tiles.</Text>
      )}
      {pending ? (
        <Card onPress={onApprovals} label={`${pending} approvals waiting`} style={styles.callout}>
          <View style={styles.calloutRow}>
            <View style={styles.calloutIcon}>
              <Ionicons name="hand-left" size={18} color={color.onFill} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { fontFamily: font.bodyBold }]}>
                {pending === 1 ? "1 action needs your approval" : `${pending} actions need your approval`}
              </Text>
              <Text style={type.small}>Agents are blocked until you decide.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={color.ink2} />
          </View>
        </Card>
      ) : null}
    </View>
  );
}

function TaskCard({ row }: { row: Row }) {
  const router = useRouter();
  const t = row.task;
  const tone = statusTone(t.status);
  const live = ACTIVE.has(t.status ?? "");
  const done = row.procs.filter((p) => p.state === "COMPLETED").length;
  return (
    <Card onPress={() => router.push(`/task/${encodeURIComponent(t.task_id)}`)} label={`Open task ${t.goal}`}>
      <View style={styles.cardTop}>
        <Pill text={(t.status ?? "queued").replace("_", " ")} tone={tone} solid={t.status === "waiting_approval"} />
        <Text style={styles.meta}>{ago(t.updated_at ?? t.created_at)}</Text>
      </View>
      <Text style={[type.body, { fontFamily: font.bodyMedium, marginTop: space.sm }]} numberOfLines={3}>
        {t.goal}
      </Text>
      {row.procs.length ? (
        <View style={styles.cardFoot}>
          <TileRow names={row.procs.map((p) => p.agent)} size={24} live={(n) => live && row.procs.some((p) => p.agent === n && LIVE.has(p.state ?? ""))} />
          <Text style={styles.meta}>
            {done}/{row.procs.length} agents done
          </Text>
        </View>
      ) : null}
      {live && row.procs.length ? (
        <View style={{ marginTop: space.sm }}>
          <Progress value={done / row.procs.length} tone={tone} />
        </View>
      ) : null}
      {!live && t.result?.summary ? (
        <Text style={[type.small, { marginTop: space.sm }]} numberOfLines={2}>
          {t.result.summary.replace(/[#*_`>]/g, "").trim()}
        </Text>
      ) : null}
    </Card>
  );
}

export default function Home() {
  const client = useClient();
  const { session } = useSession();
  const router = useRouter();
  const data = usePoll(
    useCallback(async (): Promise<{ rows: Row[]; pending: number }> => {
      const [tasks, approvals] = await Promise.all([client.listTasks(), client.pendingApprovals()]);
      const sorted = [...tasks].sort((a, b) => (b.updated_at ?? b.created_at ?? "").localeCompare(a.updated_at ?? a.created_at ?? ""));
      const rows = await Promise.all(
        sorted.slice(0, 20).map(async (task, i) => ({
          task,
          // agents only for the few newest tasks: one request each, refreshed every poll
          procs: i < 6 ? await client.processes(task.task_id).catch(() => []) : [],
        })),
      );
      return { rows, pending: approvals.length };
    }, [client]),
    3_000,
    [client],
  );
  const rows = data.data?.rows ?? [];

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.task.task_id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={false} onRefresh={data.refresh} tintColor={color.brand} colors={[color.brand]} />}
      ListHeaderComponent={
        <View>
          <ScreenHeader eyebrow={`${session?.org ?? ""} · ${session?.user ?? ""}`} title={greeting()} />
          <View style={{ paddingHorizontal: space.lg, gap: space.lg }}>
            {data.error && !data.data ? <ErrorCard error={data.error} onRetry={data.refresh} /> : null}
            <LiveMosaic rows={rows} pending={data.data?.pending ?? 0} onApprovals={() => router.push("/approvals")} />
            {rows.length ? <Text style={type.eyebrow}>Tasks</Text> : null}
          </View>
        </View>
      }
      ListEmptyComponent={
        data.loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={color.brand} />
        ) : (
          <Empty title="No tasks yet" detail="Ask mOSaic to investigate something. The work runs on your server, not on this phone." />
        )
      }
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: space.lg }}>
          <TaskCard row={item} />
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 32 },
  mosaic: { backgroundColor: color.brandSoft, borderRadius: radius.xl, padding: space.lg, gap: space.md },
  mosaicHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mosaicStat: { fontFamily: font.monoBold, fontSize: 12, color: color.brandInk },
  mosaicGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  mosaicCell: { padding: 2, borderRadius: 14, borderWidth: 2, borderColor: "transparent" },
  waitingRing: { borderColor: color.waiting },
  callout: { padding: space.md, borderColor: color.waitingSoft, backgroundColor: color.surface },
  calloutRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  calloutIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: color.waiting, alignItems: "center", justifyContent: "center" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.md },
  meta: { fontFamily: font.body, fontSize: 12, color: color.ink3 },
});
