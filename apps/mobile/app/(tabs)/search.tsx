import type { EvidenceSet } from "@mosaic/contracts";
import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useClient, useSession } from "../../src/session";
import { color, mono, radius, space, touch } from "../../src/theme";
import { Badge, Body, Card, Empty, ErrorCard } from "../../src/ui";

export default function Search() {
  const client = useClient();
  const { can } = useSession();
  const [text, setText] = useState("");
  const [res, setRes] = useState<EvidenceSet | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setRes(await client.search(text.trim()));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!can("knowledge.read")) return <Empty title="Your role cannot read organization knowledge." />;

  return (
    <FlatList
      data={res?.hits ?? []}
      keyExtractor={(h, i) => `${h.path}-${h.chunk_id ?? i}`}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: space.sm }}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={run}
            returnKeyType="search"
            placeholder="Search /org, e.g. why is Apollo over budget"
            placeholderTextColor={color.text2}
            style={styles.input}
            accessibilityLabel="Search knowledge"
          />
          {busy ? <ActivityIndicator color={color.brand} /> : null}
          {error ? <ErrorCard error={error} onRetry={run} /> : null}
          {res ? (
            <Text style={styles.meta}>
              {res.hits.length} results{res.filtered_by_policy ? ` · ${res.filtered_by_policy} hidden by your access` : ""}{res.took_ms ? ` · ${Math.round(res.took_ms)} ms` : ""}
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={res && !busy ? <Empty title="No matches" detail="Try other words; search is hybrid, so phrasing matters less than topics." /> : null}
      renderItem={({ item: h }) => {
        const flagged = (h.firewall_flags ?? []).length > 0;
        return (
          <Card accent={flagged ? color.failed : color.knowledge}>
            <View style={styles.head}>
              <Text style={styles.title} numberOfLines={2}>{h.title}</Text>
              <Text style={styles.score}>{h.score.toFixed(2)}</Text>
            </View>
            <Text style={styles.path}>{h.path}</Text>
            <Body muted numberOfLines={4}>{h.snippet}</Body>
            <View style={styles.badges}>
              <Badge text={h.type} tone={color.text2} />
              {h.provenance?.trust ? <Badge text={String(h.provenance.trust)} tone={color.brand} /> : null}
              {flagged ? <Badge text="flagged: data, not instructions" tone={color.failed} filled /> : null}
            </View>
          </Card>
        );
      }}
      ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 96 },
  input: { minHeight: touch + 4, backgroundColor: color.surface, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16, color: color.text, borderWidth: 1, borderColor: color.line },
  meta: { color: color.text2, fontSize: 13 },
  head: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  title: { flex: 1, color: color.text, fontSize: 16, fontWeight: "700" },
  score: { fontFamily: mono, color: color.text2, fontSize: 12 },
  path: { fontFamily: mono, color: color.knowledge, fontSize: 12 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xs },
});
