import Ionicons from "@expo/vector-icons/Ionicons";
import type { Approval } from "@mosaic/contracts";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { ago } from "../../src/format";
import { usePoll } from "../../src/hooks";
import { useClient, useSession } from "../../src/session";
import { color, font, radius, risk, space, type } from "../../src/theme";
import { Button, Card, Empty, ErrorCard, Eyebrow, Mono, ScreenHeader, Tile } from "../../src/ui";

const APPROVE = { fill: color.approve, soft: color.approveSoft, ink: color.approve };
const REJECT = { fill: color.danger, soft: color.dangerSoft, ink: color.danger };

function ApprovalCard({ a, allowed, onResolve, busy }: { a: Approval; allowed: boolean; onResolve: (approve: boolean) => void; busy: boolean }) {
  const router = useRouter();
  const sc = a.syscall;
  const r = risk[sc.risk ?? "low"] ?? risk.low;
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <View style={[styles.band, { backgroundColor: r.soft }]}>
        <View style={[styles.riskDot, { backgroundColor: r.fill }]} />
        <Text style={[styles.bandText, { color: r.ink }]}>{(sc.risk ?? "low").toUpperCase()} RISK</Text>
        <Text style={[styles.bandMeta, { color: r.ink }]}>{ago(a.requested_at)}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.who}>
          <Tile name={a.agent} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.capability}>{sc.capability}</Text>
            <Text style={type.small}>
              {a.agent} · PID {a.pid} · {sc.tool}.{sc.operation}
            </Text>
          </View>
        </View>
        {sc.justification ? <Text style={[type.body, { marginTop: space.md }]}>“{sc.justification}”</Text> : null}

        <Eyebrow>What it will change</Eyebrow>
        <ScrollView horizontal style={styles.inset} contentContainerStyle={{ padding: space.md }}>
          <Mono>{JSON.stringify(sc.arguments ?? {}, null, 2)}</Mono>
        </ScrollView>

        <Eyebrow>Evidence it cites</Eyebrow>
        <View style={styles.chips}>
          {(sc.evidence ?? []).length ? (
            (sc.evidence ?? []).map((p) => (
              <View key={p} style={styles.chip}>
                <Ionicons name="document-text-outline" size={13} color={color.knowledge} />
                <Text style={styles.chipText} numberOfLines={1}>
                  {p.replace(/^\/org\//, "")}
                </Text>
              </View>
            ))
          ) : (
            <Text style={type.small}>No evidence attached.</Text>
          )}
        </View>

        <Eyebrow>Why it needs you</Eyebrow>
        <Text style={type.body}>
          <Text style={{ fontFamily: font.bodyBold }}>{a.decision.policy}</Text>: {a.decision.reason}
        </Text>

        <Pressable onPress={() => router.push(`/task/${encodeURIComponent(a.task_id)}`)} style={styles.taskLink} accessibilityRole="link">
          <Text style={styles.taskLinkText}>See task {a.task_id}</Text>
          <Ionicons name="arrow-forward" size={16} color={color.brand} />
        </Pressable>
      </View>

      {allowed ? (
        <View style={styles.actions}>
          <Button title="Reject" variant="soft" tone={REJECT} large busy={busy} onPress={() => onResolve(false)} accessibilityLabel={`Reject ${sc.capability}`} />
          <Button
            title="Approve"
            tone={APPROVE}
            large
            busy={busy}
            icon={<Ionicons name="checkmark" size={20} color={color.onFill} />}
            onPress={() => onResolve(true)}
            accessibilityLabel={`Approve ${sc.capability}`}
          />
        </View>
      ) : (
        <View style={[styles.actions, { backgroundColor: color.sunken }]}>
          <Ionicons name="lock-closed" size={16} color={color.ink2} />
          <Text style={[type.small, { flex: 1 }]}>Your role can't decide this. An approver, admin or owner has to.</Text>
        </View>
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
  const [last, setLast] = useState<string | null>(null);

  const resolve = async (a: Approval, approve: boolean) => {
    setBusy(a.approval_id);
    setError(null);
    try {
      const note = `${approve ? "approved" : "rejected"} from mobile by ${session?.user}`;
      await (approve ? client.approve(a.approval_id, note) : client.reject(a.approval_id, note));
      setLast(`${approve ? "Approved" : "Rejected"} ${a.syscall.capability} for ${a.agent}.`);
      await pending.refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };
  const count = pending.data?.length ?? 0;

  return (
    <FlatList
      data={pending.data ?? []}
      keyExtractor={(a) => a.approval_id}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={pending.refresh} tintColor={color.brand} colors={[color.brand]} />}
      ListHeaderComponent={
        <View>
          <ScreenHeader eyebrow={count ? `${count} waiting` : "All clear"} title="Approvals" />
          <View style={{ paddingHorizontal: space.lg, gap: space.md, marginBottom: space.md }}>
            {last ? (
              <View style={styles.toast}>
                <Ionicons name="checkmark-circle" size={18} color={color.approve} />
                <Text style={[type.small, { color: color.approve, fontFamily: font.bodyMedium, flex: 1 }]}>{last}</Text>
              </View>
            ) : null}
            {error || (pending.error && !pending.data) ? <ErrorCard error={error ?? pending.error} onRetry={pending.refresh} /> : null}
          </View>
        </View>
      }
      ListEmptyComponent={
        pending.loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={color.brand} />
        ) : (
          <Empty
            title="Nothing needs you"
            detail="When an agent wants to change something outside mOSaic, like a Jira ticket, it stops and asks here. You'll get a notification too."
          />
        )
      }
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: space.lg }}>
          <ApprovalCard a={item} allowed={can("approval.resolve")} busy={busy === item.approval_id} onResolve={(ok) => resolve(item, ok)} />
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: space.lg }} />}
    />
  );
}

const styles = StyleSheet.create({
  band: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 10 },
  riskDot: { width: 8, height: 8, borderRadius: 4 },
  bandText: { fontFamily: font.bodyBold, fontSize: 12, letterSpacing: 1 },
  bandMeta: { marginLeft: "auto", fontFamily: font.body, fontSize: 12 },
  body: { padding: space.lg, paddingTop: space.md },
  who: { flexDirection: "row", alignItems: "center", gap: space.md },
  capability: { fontFamily: font.monoBold, fontSize: 20, color: color.ink, letterSpacing: -0.3 },
  inset: { backgroundColor: color.sunken, borderRadius: radius.md, maxHeight: 200 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: color.knowledgeSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, maxWidth: "100%" },
  chipText: { fontFamily: font.mono, fontSize: 12, color: color.knowledge, flexShrink: 1 },
  taskLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.lg, minHeight: 32 },
  taskLinkText: { fontFamily: font.bodyBold, fontSize: 14, color: color.brand },
  actions: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderTopWidth: 1, borderTopColor: color.line },
  toast: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: color.approveSoft, borderRadius: radius.md, padding: space.md },
});
