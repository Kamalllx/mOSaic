import type { Approval } from "@mosaic/contracts";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { ago } from "../../src/format";
import { usePoll } from "../../src/hooks";
import { useClient, useSession } from "../../src/session";
import { color, mono, radius, risk, space } from "../../src/theme";
import { Badge, Body, Button, Card, Empty, ErrorCard, Label } from "../../src/ui";

function ApprovalCard({ a, allowed, onResolve, busy }: { a: Approval; allowed: boolean; onResolve: (approve: boolean) => void; busy: boolean }) {
  const router = useRouter();
  const sc = a.syscall;
  return (
    <Card accent={risk[sc.risk ?? "low"]}>
      <View style={styles.head}>
        <Badge text={(sc.risk ?? "low").toUpperCase()} tone={risk[sc.risk ?? "low"]} filled />
        <Text style={styles.meta}>{ago(a.requested_at)}</Text>
      </View>
      <Text style={styles.cap}>{sc.capability}</Text>
      <Body muted>
        {a.agent} (PID {a.pid}) wants {sc.tool}.{sc.operation}
      </Body>
      {sc.justification ? <Body>{sc.justification}</Body> : null}

      <Label>Arguments</Label>
      <ScrollView horizontal style={styles.args} contentContainerStyle={{ padding: space.sm }}>
        <Text style={styles.mono}>{JSON.stringify(sc.arguments ?? {}, null, 2)}</Text>
      </ScrollView>

      <Label>Evidence</Label>
      {(sc.evidence ?? []).length ? (
        (sc.evidence ?? []).map((p) => (
          <Text key={p} style={[styles.mono, { color: color.knowledge }]}>
            {p}
          </Text>
        ))
      ) : (
        <Body muted>No evidence attached.</Body>
      )}

      <Label>Policy</Label>
      <Body>
        {a.decision.policy}: {a.decision.reason}
      </Body>

      <Button title={`Open task ${a.task_id}`} variant="outline" onPress={() => router.push(`/task/${encodeURIComponent(a.task_id)}`)} style={{ marginTop: space.md, flex: 0 }} />
      {allowed ? (
        <View style={styles.actions}>
          <Button title="Reject" variant="outline" tone={color.failed} large busy={busy} onPress={() => onResolve(false)} accessibilityLabel={`Reject ${sc.capability}`} />
          <Button title="Approve" tone={color.running} large busy={busy} onPress={() => onResolve(true)} accessibilityLabel={`Approve ${sc.capability}`} />
        </View>
      ) : (
        <Body muted style={{ marginTop: space.md }}>Your role cannot resolve approvals. An approver, admin or owner has to decide.</Body>
      )}
    </Card>
  );
}

export default function Approvals() {
  const client = useClient();
  const { can, session } = useSession();
  const pending = usePoll(useCallback(() => client.pendingApprovals(), [client]), 2_000, [client]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const resolve = async (a: Approval, approve: boolean) => {
    setBusy(a.approval_id);
    setError(null);
    try {
      const note = `${approve ? "approved" : "rejected"} from mobile by ${session?.user}`;
      await (approve ? client.approve(a.approval_id, note) : client.reject(a.approval_id, note));
      await pending.refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <FlatList
      data={pending.data ?? []}
      keyExtractor={(a) => a.approval_id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={false} onRefresh={pending.refresh} tintColor={color.brand} />}
      ListHeaderComponent={error || (pending.error && !pending.data) ? <ErrorCard error={error ?? pending.error} onRetry={pending.refresh} /> : null}
      ListEmptyComponent={
        pending.loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={color.brand} />
        ) : (
          <Empty title="Nothing waiting for you" detail="When an agent asks to change something outside mOSaic, such as a Jira ticket, the request appears here and on your lock screen." />
        )
      }
      renderItem={({ item }) => <ApprovalCard a={item} allowed={can("approval.resolve")} busy={busy === item.approval_id} onResolve={(ok) => resolve(item, ok)} />}
      ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 96, gap: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  meta: { color: color.text2, fontSize: 12, marginLeft: "auto" },
  cap: { color: color.text, fontSize: 20, fontWeight: "800", fontFamily: mono, marginTop: space.xs },
  args: { backgroundColor: color.surface2, borderRadius: radius.sm, maxHeight: 180 },
  mono: { fontFamily: mono, fontSize: 13, color: color.text },
  actions: { flexDirection: "row", gap: space.md, marginTop: space.lg },
});
