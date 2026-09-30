import type { Priority } from "@mosaic/contracts";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useClient, useSession } from "../../src/session";
import { color, radius, space } from "../../src/theme";
import { Body, Button, Card, ErrorCard, Label } from "../../src/ui";

const DEMO_PROMPT =
  "Investigate why Project Apollo is over budget and six weeks behind schedule. Identify root causes, update the tracker, and prepare a recovery plan.";
const PRIORITIES: Priority[] = ["high", "normal", "background"];

export default function Compose() {
  const client = useClient();
  const { can } = useSession();
  const router = useRouter();
  const [goal, setGoal] = useState(DEMO_PROMPT);
  const [priority, setPriority] = useState<Priority>("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const t = await client.createTask(goal.trim(), priority);
      router.push(`/task/${encodeURIComponent(t.task_id)}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!can("task.create"))
    return (
      <View style={styles.content}>
        <Card>
          <Body>Your role can watch tasks but not start them. Ask an admin for the member role.</Body>
        </Card>
      </View>
    );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Label>What should mOSaic do?</Label>
          <TextInput value={goal} onChangeText={setGoal} multiline style={styles.goal} accessibilityLabel="Task goal" placeholder="Describe the goal" placeholderTextColor={color.text2} />
          <Label>Priority</Label>
          <View style={styles.row}>
            {PRIORITIES.map((p) => (
              <Pressable key={p} onPress={() => setPriority(p)} accessibilityRole="radio" accessibilityState={{ selected: priority === p }} style={[styles.chip, priority === p && styles.chipOn]}>
                <Text style={[styles.chipText, priority === p && { color: color.onBrand }]}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
        {error ? <ErrorCard error={error} /> : null}
        <Button title="Start task" large busy={busy} disabled={!goal.trim()} onPress={submit} />
        <Body muted style={{ textAlign: "center" }}>The task runs on the mOSaic server. Anything that changes the outside world waits for an approval.</Body>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  goal: { minHeight: 150, textAlignVertical: "top", backgroundColor: color.surface2, borderRadius: radius.md, padding: space.md, fontSize: 16, lineHeight: 22, color: color.text, borderWidth: 1, borderColor: color.line },
  row: { flexDirection: "row", gap: space.sm },
  chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  chipOn: { backgroundColor: color.brand, borderColor: color.brand },
  chipText: { color: color.text, fontWeight: "600", textTransform: "capitalize" },
});
