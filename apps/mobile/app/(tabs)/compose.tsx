import Ionicons from "@expo/vector-icons/Ionicons";
import type { Priority } from "@mosaic/contracts";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useClient, useSession } from "../../src/session";
import { color, font, radius, space, touch, type } from "../../src/theme";
import { Button, Card, Empty, ErrorCard, Eyebrow, ScreenHeader } from "../../src/ui";

const IDEAS = [
  "Investigate why Project Apollo is over budget and six weeks behind schedule. Identify root causes, update the tracker, and prepare a recovery plan.",
  "Summarize what changed in the Apollo budget this month and who approved it.",
  "Which open Jira issues are blocking the payments migration?",
];

const PRIORITIES: { id: Priority; label: string; hint: string }[] = [
  { id: "high", label: "Now", hint: "jumps the queue" },
  { id: "normal", label: "Normal", hint: "in order" },
  { id: "background", label: "Later", hint: "when idle" },
];

export default function Compose() {
  const client = useClient();
  const { can } = useSession();
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const t = await client.createTask(goal.trim(), priority);
      setGoal("");
      router.push(`/task/${encodeURIComponent(t.task_id)}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!can("task.create"))
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="New task" />
        <Empty title="You can watch, not start" detail="Your role can follow tasks and read knowledge. Ask an admin for the member role to start tasks." />
      </View>
    );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <ScreenHeader eyebrow="Runs on your server" title="New task" />
        <View style={styles.content}>
          <Card style={{ padding: space.md }}>
            <TextInput
              value={goal}
              onChangeText={setGoal}
              multiline
              style={styles.goal}
              accessibilityLabel="What should mOSaic do?"
              placeholder="What should mOSaic do?"
              placeholderTextColor={color.ink3}
            />
            <Text style={[type.small, { paddingHorizontal: space.xs }]}>Agents read your org's knowledge, then ask you before they change anything outside mOSaic.</Text>
          </Card>

          <Eyebrow>Try one of these</Eyebrow>
          <View style={{ gap: space.sm }}>
            {IDEAS.map((idea) => (
              <Pressable key={idea} onPress={() => setGoal(idea)} style={({ pressed }) => [styles.idea, pressed && { backgroundColor: color.brandSoft }]} accessibilityRole="button">
                <Ionicons name="sparkles-outline" size={16} color={color.brand} style={{ marginTop: 2 }} />
                <Text style={[type.small, { color: color.ink, flex: 1 }]} numberOfLines={2}>
                  {idea}
                </Text>
              </Pressable>
            ))}
          </View>

          <Eyebrow>When</Eyebrow>
          <View style={styles.segment} accessibilityRole="radiogroup">
            {PRIORITIES.map((p) => {
              const on = priority === p.id;
              return (
                <Pressable key={p.id} onPress={() => setPriority(p.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.seg, on && styles.segOn]}>
                  <Text style={[styles.segLabel, on && { color: color.onFill }]}>{p.label}</Text>
                  <Text style={[styles.segHint, on && { color: color.onFill }]}>{p.hint}</Text>
                </Pressable>
              );
            })}
          </View>

          {error ? <ErrorCard error={error} /> : null}
          <Button
            title="Start task"
            large
            busy={busy}
            disabled={!goal.trim()}
            onPress={submit}
            icon={<Ionicons name="arrow-up-circle" size={22} color={color.onFill} />}
            style={{ marginTop: space.lg }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, gap: space.sm },
  goal: { minHeight: 140, textAlignVertical: "top", padding: space.sm, fontFamily: font.body, fontSize: 17, lineHeight: 24, color: color.ink },
  idea: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.line, padding: space.md, minHeight: touch },
  segment: { flexDirection: "row", gap: 6, backgroundColor: color.surface, borderRadius: radius.lg, padding: 6, borderWidth: 1, borderColor: color.line },
  seg: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radius.md, paddingVertical: 10, minHeight: 56 },
  segOn: { backgroundColor: color.brand },
  segLabel: { fontFamily: font.bodyBold, fontSize: 15, color: color.ink },
  segHint: { fontFamily: font.body, fontSize: 11, color: color.ink2, marginTop: 1 },
});
