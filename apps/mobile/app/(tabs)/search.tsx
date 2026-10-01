import Ionicons from "@expo/vector-icons/Ionicons";
import type { EvidenceSet, SearchHit } from "@mosaic/contracts";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useClient, useSession } from "../../src/session";
import { color, font, radius, space, touch, type } from "../../src/theme";
import { Card, Empty, ErrorCard, Pill, ScreenHeader } from "../../src/ui";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const TYPE_ICON: Record<string, IconName> = {
  project: "rocket-outline",
  finance: "cash-outline",
  decision: "git-branch-outline",
  policy: "shield-checkmark-outline",
  person: "person-outline",
  team: "people-outline",
  system: "server-outline",
  index: "folder-open-outline",
  note: "document-text-outline",
};
const SUGGEST = ["Apollo budget", "migration backfill", "vendor SDK", "security policy"];
const TRUST = {
  verified: { fill: color.approve, soft: color.approveSoft, ink: color.approve },
  trusted: { fill: color.brand, soft: color.brandSoft, ink: color.brandInk },
  unverified: { fill: color.waiting, soft: color.waitingSoft, ink: color.waiting },
  untrusted: { fill: color.danger, soft: color.dangerSoft, ink: color.danger },
} as const;

function Hit({ h }: { h: SearchHit }) {
  const flagged = (h.firewall_flags ?? []).length > 0;
  const trust = h.provenance?.trust as keyof typeof TRUST | undefined;
  return (
    <Card style={flagged ? { borderColor: color.danger } : undefined}>
      <View style={styles.hitHead}>
        <View style={[styles.typeTile, flagged && { backgroundColor: color.dangerSoft }]}>
          <Ionicons name={TYPE_ICON[h.type] ?? "document-outline"} size={18} color={flagged ? color.danger : color.knowledge} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { fontFamily: font.bodyBold }]} numberOfLines={2}>
            {h.title}
          </Text>
          <Text style={styles.path} numberOfLines={1}>
            {h.path}
          </Text>
        </View>
        <View style={styles.score}>
          <Text style={styles.scoreText}>{Math.round(h.score * 100)}</Text>
        </View>
      </View>
      {flagged ? (
        <View style={styles.flag}>
          <Ionicons name="warning" size={15} color={color.danger} />
          <Text style={[type.small, { color: color.danger, fontFamily: font.bodyMedium, flex: 1 }]}>Contains instruction-like text. Agents treat it as data only.</Text>
        </View>
      ) : null}
      <Text style={[type.small, { marginTop: space.sm }]} numberOfLines={3}>
        {h.snippet.replace(/[#*_`>]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim()}
      </Text>
      <View style={styles.badges}>
        <Pill text={h.type} tone={{ fill: color.ink2, soft: color.sunken, ink: color.ink2 }} />
        {trust && TRUST[trust] ? <Pill text={trust} tone={TRUST[trust]} /> : null}
      </View>
    </Card>
  );
}

export default function Search() {
  const client = useClient();
  const { can } = useSession();
  const [text, setText] = useState("");
  const [res, setRes] = useState<EvidenceSet | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const run = async (q = text) => {
    if (!q.trim()) return;
    setText(q);
    setBusy(true);
    setError(null);
    try {
      setRes(await client.search(q.trim()));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!can("knowledge.read"))
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Knowledge" />
        <Empty title="No access to knowledge" detail="Your role can't read the organization's documents." />
      </View>
    );

  return (
    <FlatList
      data={res?.hits ?? []}
      keyExtractor={(h, i) => `${h.path}-${h.chunk_id ?? i}`}
      contentContainerStyle={{ paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          <ScreenHeader eyebrow="/org" title="Knowledge" />
          <View style={{ paddingHorizontal: space.lg, gap: space.md, marginBottom: space.md }}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color={color.ink2} />
              <TextInput
                value={text}
                onChangeText={setText}
                onSubmitEditing={() => run()}
                returnKeyType="search"
                placeholder="Search your organization"
                placeholderTextColor={color.ink3}
                style={styles.input}
                accessibilityLabel="Search knowledge"
              />
              {busy ? <ActivityIndicator color={color.brand} /> : null}
            </View>
            {!res ? (
              <View style={styles.suggest}>
                {SUGGEST.map((s) => (
                  <Pressable key={s} onPress={() => run(s)} style={styles.suggestChip} accessibilityRole="button">
                    <Text style={styles.suggestText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={type.small}>
                {res.hits.length} results{res.filtered_by_policy ? ` · ${res.filtered_by_policy} hidden by your access` : ""}
                {res.took_ms ? ` · ${Math.round(res.took_ms)} ms` : ""}
              </Text>
            )}
            {error ? <ErrorCard error={error} onRetry={() => run()} /> : null}
          </View>
        </View>
      }
      ListEmptyComponent={
        res && !busy ? <Empty title="No matches" detail="Search is hybrid: try a topic, a project, or a person's name." /> : null
      }
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: space.lg }}>
          <Hit h={item} />
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  searchBox: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.line, paddingHorizontal: space.md, minHeight: touch + 6 },
  input: { flex: 1, fontFamily: font.body, fontSize: 16, color: color.ink, paddingVertical: space.sm },
  suggest: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  suggestChip: { backgroundColor: color.knowledgeSoft, borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 40, justifyContent: "center" },
  suggestText: { fontFamily: font.bodyMedium, fontSize: 14, color: color.knowledge },
  hitHead: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  typeTile: { width: 38, height: 38, borderRadius: 11, backgroundColor: color.knowledgeSoft, alignItems: "center", justifyContent: "center" },
  path: { fontFamily: font.mono, fontSize: 12, color: color.knowledge, marginTop: 2 },
  score: { minWidth: 38, height: 26, borderRadius: radius.pill, backgroundColor: color.sunken, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  scoreText: { fontFamily: font.monoBold, fontSize: 12, color: color.ink2 },
  flag: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: color.dangerSoft, borderRadius: radius.sm, padding: space.sm, marginTop: space.md },
  badges: { flexDirection: "row", gap: 6, marginTop: space.md },
});
