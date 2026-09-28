import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Approval } from "@mosaic/contracts";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { createClient, type Settings } from "./src/client";

const STORAGE_KEY = "mosaic.settings";
const DEFAULT_SETTINGS: Settings = { baseUrl: "https://mosaic-node.tailnet.ts.net:8443", user: "alice", org: "acme" };
const DEMO_PROMPT =
  "Investigate why Project Apollo is over budget and six weeks behind schedule. Identify root causes, update the tracker, and prepare a recovery plan.";
type Tab = "approvals" | "compose" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("approvals");
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setSettings(raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS))
      .catch(() => setSettings(DEFAULT_SETTINGS));
  }, []);

  const save = useCallback(async (next: Settings) => {
    setSettings(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  if (!settings) return <ActivityIndicator style={styles.center} />;
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Text style={styles.brand}>mOSaic</Text>
      <View style={styles.tabs}>
        {(["approvals", "compose", "settings"] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      {tab === "approvals" && <Approvals settings={settings} />}
      {tab === "compose" && <Compose settings={settings} />}
      {tab === "settings" && <SettingsForm settings={settings} onSave={save} />}
    </View>
  );
}

function Approvals({ settings }: { settings: Settings }) {
  const client = useMemo(() => createClient(settings), [settings]);
  const [items, setItems] = useState<Approval[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await client.pendingApprovals());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [client]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [refresh]);

  const resolve = async (a: Approval, approve: boolean) => {
    setBusy(a.approval_id);
    try {
      await (approve ? client.approve(a.approval_id, "approved from mobile") : client.reject(a.approval_id, "rejected from mobile"));
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(a) => a.approval_id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={<Text style={styles.muted}>No pending approvals.</Text>}
      renderItem={({ item: a }) => (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {a.syscall.capability} · {a.syscall.tool}.{a.syscall.operation}
          </Text>
          <Text style={styles.muted}>
            {a.agent} (PID {a.pid}) · task {a.task_id} · risk {a.syscall.risk}
          </Text>
          <Text style={styles.body}>{a.syscall.justification}</Text>
          <Text style={styles.label}>Arguments</Text>
          <Text style={styles.mono}>{JSON.stringify(a.syscall.arguments, null, 2)}</Text>
          <Text style={styles.label}>Evidence</Text>
          {(a.syscall.evidence ?? []).map((p) => (
            <Text key={p} style={styles.mono}>
              {p}
            </Text>
          ))}
          <Text style={styles.label}>Policy</Text>
          <Text style={styles.body}>
            {a.decision.policy}: {a.decision.reason}
          </Text>
          <View style={styles.row}>
            <Pressable disabled={busy !== null} onPress={() => resolve(a, false)} style={[styles.button, styles.reject]}>
              <Text style={styles.buttonText}>Reject</Text>
            </Pressable>
            <Pressable disabled={busy !== null} onPress={() => resolve(a, true)} style={[styles.button, styles.approve]}>
              <Text style={styles.buttonText}>{busy === a.approval_id ? "…" : "Approve"}</Text>
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

function Compose({ settings }: { settings: Settings }) {
  const client = useMemo(() => createClient(settings), [settings]);
  const [goal, setGoal] = useState(DEMO_PROMPT);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const task = await client.createTask({ goal: goal.trim() });
      setStatus(`Submitted ${task.task_id} (${task.status})`);
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <TextInput value={goal} onChangeText={setGoal} multiline style={[styles.input, styles.goal]} placeholderTextColor="#888" />
      <Pressable disabled={busy || !goal.trim()} onPress={submit} style={[styles.button, styles.approve]}>
        <Text style={styles.buttonText}>{busy ? "Submitting…" : "Submit task"}</Text>
      </Pressable>
      {status && <Text style={styles.body}>{status}</Text>}
    </ScrollView>
  );
}

function SettingsForm({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => Promise<void> }) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  const field = (key: keyof Settings, label: string) => (
    <View key={key}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={draft[key]}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={(v) => {
          setDraft({ ...draft, [key]: v });
          setSaved(false);
        }}
        style={styles.input}
      />
    </View>
  );
  return (
    <ScrollView contentContainerStyle={styles.list}>
      {field("baseUrl", "Gateway URL (Tailscale HTTPS)")}
      {field("user", "User")}
      {field("org", "Org")}
      <Pressable
        onPress={async () => {
          await onSave({ ...draft, baseUrl: draft.baseUrl.trim() });
          setSaved(true);
        }}
        style={[styles.button, styles.approve]}
      >
        <Text style={styles.buttonText}>{saved ? "Saved" : "Save"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1115", paddingTop: 56 },
  center: { flex: 1 },
  brand: { color: "#fff", fontSize: 22, fontWeight: "700", paddingHorizontal: 16 },
  tabs: { flexDirection: "row", gap: 8, padding: 16 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: "#1c1f26" },
  tabActive: { backgroundColor: "#3b82f6" },
  tabText: { color: "#aab", textTransform: "capitalize" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: "#1c1f26", borderRadius: 12, padding: 14, gap: 4 },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  label: { color: "#8b93a7", fontSize: 12, marginTop: 8, textTransform: "uppercase" },
  body: { color: "#dde", fontSize: 14 },
  mono: { color: "#cfe", fontFamily: "monospace", fontSize: 12 },
  muted: { color: "#8b93a7", fontSize: 13 },
  error: { color: "#f87171", marginBottom: 8 },
  row: { flexDirection: "row", gap: 12, marginTop: 12 },
  button: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10 },
  approve: { backgroundColor: "#16a34a" },
  reject: { backgroundColor: "#b91c1c" },
  buttonText: { color: "#fff", fontWeight: "600" },
  input: { backgroundColor: "#1c1f26", color: "#fff", borderRadius: 10, padding: 12, fontSize: 15 },
  goal: { minHeight: 140, textAlignVertical: "top" },
});
