import type { Task } from "@mosaic/contracts";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { ago } from "../../src/format";
import { usePoll } from "../../src/hooks";
import { useClient } from "../../src/session";
import { color, space, statusColor } from "../../src/theme";
import { Badge, Body, Card, Empty, ErrorCard } from "../../src/ui";

const ACTIVE = new Set(["queued", "planning", "running", "waiting_approval", "paused"]);

function TaskRow({ t }: { t: Task }) {
  const router = useRouter();
  const live = ACTIVE.has(t.status ?? "");
  return (
    <Pressable onPress={() => router.push(`/task/${encodeURIComponent(t.task_id)}`)} accessibilityRole="button" accessibilityLabel={`Task ${t.goal}`}>
      <Card accent={statusColor(t.status)}>
        <View style={styles.rowTop}>
          {live ? <ActivityIndicator size="small" color={statusColor(t.status)} /> : null}
          <Badge text={(t.status ?? "queued").replace("_", " ")} tone={statusColor(t.status)} filled={t.status === "waiting_approval"} />
          <Text style={styles.meta}>{t.task_id} · {ago(t.updated_at ?? t.created_at)}</Text>
        </View>
        <Body numberOfLines={3}>{t.goal}</Body>
        {t.result?.summary && !live ? <Body muted numberOfLines={2}>{t.result.summary.replace(/[#*_`>]/g, "").trim()}</Body> : null}
      </Card>
    </Pressable>
  );
}

export default function Home() {
  const client = useClient();
  const tasks = usePoll(useCallback(() => client.listTasks(), [client]), 3_000, [client]);
  const list = [...(tasks.data ?? [])].sort((a, b) => (b.updated_at ?? b.created_at ?? "").localeCompare(a.updated_at ?? a.created_at ?? ""));
  const running = list.filter((t) => ACTIVE.has(t.status ?? ""));
  const done = list.filter((t) => !ACTIVE.has(t.status ?? ""));

  return (
    <FlatList
      data={[...running, ...done]}
      keyExtractor={(t) => t.task_id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={false} onRefresh={tasks.refresh} tintColor={color.brand} />}
      ListHeaderComponent={
        <View style={{ gap: space.sm }}>
          {tasks.error && !tasks.data ? <ErrorCard error={tasks.error} onRetry={tasks.refresh} /> : null}
          <Text style={styles.section}>{running.length ? `${running.length} running` : "Nothing running"}</Text>
        </View>
      }
      ListEmptyComponent={tasks.loading ? <ActivityIndicator style={{ marginTop: 48 }} color={color.brand} /> : <Empty title="No tasks yet" detail="Start one from Compose. It runs on the mOSaic server, not on this phone." />}
      renderItem={({ item }) => <TaskRow t={item} />}
      ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 96 },
  section: { color: color.text2, fontSize: 13, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: space.xs },
  rowTop: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.xs },
  meta: { color: color.text2, fontSize: 12, marginLeft: "auto" },
});
