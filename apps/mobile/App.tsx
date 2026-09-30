import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Approval } from "@mosaic/contracts";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createClient, type Settings } from "./src/client";

const STORAGE_KEY = "mosaic.settings";
const DEFAULT_SETTINGS: Settings = { baseUrl: "http://localhost:8080", user: "alice", org: "acme" };
const DEMO_PROMPT =
  "Investigate why Project Apollo is over budget and six weeks behind schedule. Identify root causes, update the tracker, and prepare a recovery plan.";
const POLL_INTERVAL_MS = 2_000;
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

  if (!settings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2bb8a3" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.brand}>mOSaic</Text>
        <Text style={styles.headerSub}>{settings.org}</Text>
      </View>
      <View style={styles.tabs}>
        {(["approvals", "compose", "settings"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            accessibilityLabel={t.charAt(0).toUpperCase() + t.slice(1)}
          >
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

/** Polls for pending approvals; pauses when the app goes into background (saves network + battery). */
function Approvals({ settings }: { settings: Settings }) {
  const client = useMemo(() => createClient(settings), [settings]);
  const [items, setItems] = useState<Approval[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const refresh = useCallback(async () => {
    try {
      const data = await client.pendingApprovals();
      setItems(data);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      // Only poll when the app is in the foreground.
      if (appState.current === "active") refresh();
    }, POLL_INTERVAL_MS);

    const sub = AppState.addEventListener("change", (next) => {
      appState.current = next;
      // Refresh immediately when the app comes back to the foreground.
      if (next === "active") refresh();
    });

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  const resolve = async (a: Approval, approve: boolean) => {
    setBusy(a.approval_id);
    try {
      await (approve
        ? client.approve(a.approval_id, "approved from mobile")
        : client.reject(a.approval_id, "rejected from mobile"));
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2bb8a3" />
        <Text style={[styles.muted, { marginTop: 8 }]}>Connecting to {settings.baseUrl}…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(a) => a.approval_id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={refresh}
              style={styles.retryButton}
              accessibilityRole="button"
              accessibilityLabel="Retry"
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No pending approvals</Text>
          <Text style={styles.muted}>Polling every 2 s — approvals appear here when an agent requests a privileged action.</Text>
        </View>
      }
      renderItem={({ item: a }) => (
        <ApprovalCard a={a} busy={busy} onResolve={resolve} />
      )}
    />
  );
}

function ApprovalCard({
  a,
  busy,
  onResolve,
}: {
  a: Approval;
  busy: string | null;
  onResolve: (a: Approval, approve: boolean) => void;
}) {
  return (
    <View style={styles.card}>
      {/* Risk badge */}
      <View style={styles.riskRow}>
        <View style={[styles.riskBadge, riskStyle(a.syscall.risk)]}>
          <Text style={styles.riskText}>risk {a.syscall.risk}</Text>
        </View>
        <Text style={styles.muted}>{a.syscall.capability}</Text>
      </View>

      <Text style={styles.cardTitle}>
        {a.syscall.tool}.{a.syscall.operation}
      </Text>
      <Text style={styles.muted}>
        {a.agent} · PID {a.pid} · task {a.task_id}
      </Text>

      <Text style={styles.body}>{a.syscall.justification}</Text>

      <Text style={styles.label}>Arguments</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.codeScroll}
      >
        <Text style={styles.mono}>{JSON.stringify(a.syscall.arguments, null, 2)}</Text>
      </ScrollView>

      {(a.syscall.evidence ?? []).length > 0 && (
        <>
          <Text style={styles.label}>Evidence</Text>
          {(a.syscall.evidence ?? []).map((p) => (
            <Text key={p} style={styles.evidence}>
              {p}
            </Text>
          ))}
        </>
      )}

      <Text style={styles.label}>Policy</Text>
      <Text style={styles.body}>
        {a.decision.policy}: {a.decision.reason}
      </Text>

      <View style={styles.row}>
        <Pressable
          disabled={busy !== null}
          onPress={() => onResolve(a, false)}
          style={({ pressed }) => [
            styles.button,
            styles.rejectButton,
            busy !== null && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Reject this approval"
          accessibilityState={{ disabled: busy !== null }}
        >
          <Text style={styles.buttonText}>Reject</Text>
        </Pressable>
        <Pressable
          disabled={busy !== null}
          onPress={() => onResolve(a, true)}
          style={({ pressed }) => [
            styles.button,
            styles.approveButton,
            busy !== null && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Approve this action"
          accessibilityState={{ disabled: busy !== null }}
        >
          <Text style={styles.buttonText}>
            {busy === a.approval_id ? "…" : "Approve"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Compose({ settings }: { settings: Settings }) {
  const client = useMemo(() => createClient(settings), [settings]);
  const [goal, setGoal] = useState(DEMO_PROMPT);
  const [status, setStatus] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!goal.trim() || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const task = await client.createTask({ goal: goal.trim() });
      setStatus(`Submitted ${task.task_id} (${task.status})`);
      setStatusIsError(false);
    } catch (e) {
      setStatus(String(e));
      setStatusIsError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>Goal</Text>
        <TextInput
          value={goal}
          onChangeText={setGoal}
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.goalInput]}
          placeholderTextColor="#6b7280"
          placeholder="Describe the goal…"
          accessibilityLabel="Task goal"
        />
        <Pressable
          disabled={busy || !goal.trim()}
          onPress={submit}
          style={({ pressed }) => [
            styles.button,
            styles.approveButton,
            (busy || !goal.trim()) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
            { flex: undefined, marginTop: 4 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Submit task"
          accessibilityState={{ disabled: busy || !goal.trim() }}
        >
          <Text style={styles.buttonText}>{busy ? "Submitting…" : "Submit task"}</Text>
        </Pressable>
        {status && (
          <View style={[styles.statusBox, statusIsError && styles.errorCard]}>
            <Text style={statusIsError ? styles.errorText : styles.body}>{status}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SettingsForm({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (s: Settings) => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);

  const field = (key: keyof Settings, label: string, hint?: string) => (
    <View key={key} style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={draft[key]}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={key === "baseUrl" ? "url" : "default"}
        onChangeText={(v) => {
          setDraft({ ...draft, [key]: v });
          setSaved(false);
        }}
        style={styles.input}
        accessibilityLabel={label}
      />
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {field("baseUrl", "Gateway URL", "e.g. http://192.168.1.10:8080 or https://<node>.ts.net:8443")}
        {field("user", "User")}
        {field("org", "Organisation")}
        <Pressable
          onPress={async () => {
            await onSave({ ...draft, baseUrl: draft.baseUrl.trim() });
            setSaved(true);
          }}
          style={({ pressed }) => [
            styles.button,
            styles.approveButton,
            { flex: undefined },
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Save settings"
        >
          <Text style={styles.buttonText}>{saved ? "Saved" : "Save"}</Text>
        </Pressable>
        <Text style={styles.hint}>
          On the demo laptop hotspot, run phone-access.ps1 (admin) to open the firewall and get the URL.
          Expo Go allows plain HTTP during development; production builds require HTTPS.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function riskStyle(risk?: string | null) {
  if (risk === "critical") return { backgroundColor: "#7f1d1d", borderColor: "#ef4444" };
  if (risk === "high") return { backgroundColor: "#7c2d12", borderColor: "#f97316" };
  if (risk === "medium") return { backgroundColor: "#713f12", borderColor: "#eab308" };
  return { backgroundColor: "#1c1f26", borderColor: "#4b5563" };
}

// On Android, StatusBar with translucent=false sits outside the View layout tree, so we
// manually pad the top by StatusBar.currentHeight to avoid content sliding under it.
// On iOS this is not needed when translucent=false.
const STATUS_BAR_HEIGHT = Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 0) : 0;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0d1117",
    paddingTop: STATUS_BAR_HEIGHT,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0d1117",
    paddingTop: STATUS_BAR_HEIGHT,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  brand: {
    color: "#f1f5f9",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerSub: {
    color: "#6b7280",
    fontSize: 13,
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#1c1f26",
    minHeight: 44,
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: "#2bb8a3",
  },
  tabText: {
    color: "#9ca3af",
    textTransform: "capitalize",
    fontSize: 14,
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#04211d",
    fontWeight: "700",
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#151a21",
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#2d3743",
  },
  riskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  riskBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  riskText: {
    color: "#f1f5f9",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardTitle: {
    color: "#f1f5f9",
    fontSize: 16,
    fontWeight: "600",
  },
  label: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "600",
  },
  sectionLabel: {
    color: "#9ca3af",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "600",
    marginBottom: 4,
  },
  body: {
    color: "#d1d5db",
    fontSize: 14,
    lineHeight: 20,
  },
  mono: {
    color: "#a5f3e8",
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
  },
  muted: {
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 18,
  },
  evidence: {
    color: "#60a5fa",
    fontFamily: "monospace",
    fontSize: 12,
    marginTop: 2,
  },
  codeScroll: {
    backgroundColor: "#0d1117",
    borderRadius: 8,
    padding: 8,
    marginTop: 2,
    maxHeight: 160,
  },
  errorCard: {
    backgroundColor: "#1c0a0a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: "#f87171",
    fontSize: 13,
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4b5563",
  },
  retryText: {
    color: "#d1d5db",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 6,
  },
  emptyTitle: {
    color: "#9ca3af",
    fontSize: 15,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 50,
  },
  approveButton: {
    backgroundColor: "#15803d",
  },
  rejectButton: {
    backgroundColor: "#991b1b",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonText: {
    color: "#f1f5f9",
    fontWeight: "700",
    fontSize: 15,
  },
  input: {
    backgroundColor: "#151a21",
    color: "#f1f5f9",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#2d3743",
    minHeight: 44,
  },
  goalInput: {
    minHeight: 140,
    textAlignVertical: "top",
  },
  fieldGroup: {
    gap: 4,
  },
  statusBox: {
    backgroundColor: "#151a21",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#2d3743",
  },
  hint: {
    color: "#4b5563",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
});
