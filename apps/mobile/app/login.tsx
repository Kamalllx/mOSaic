import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { normalizeUrl, signInWithGoogle } from "../src/client";
import { googleAvailable, googleIdToken } from "../src/google";
import { ROLES } from "../src/rbac";
import { DEFAULT_URL, useSession } from "../src/session";
import { color, radius, space, touch } from "../src/theme";
import { Body, Button, Card, Label } from "../src/ui";

export default function Login() {
  const { signIn } = useSession();
  const [url, setUrl] = useState(DEFAULT_URL);
  const [user, setUser] = useState("alice");
  const [org, setOrg] = useState("acme");
  const [role, setRole] = useState<string>("approver");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<"test" | "dev" | "google" | null>(null);

  const test = async () => {
    setBusy("test");
    try {
      const res = await fetch(`${normalizeUrl(url)}/health`);
      setStatus(res.ok ? { ok: true, text: "Server reachable." } : { ok: false, text: `Server answered ${res.status}.` });
    } catch {
      setStatus({ ok: false, text: "Cannot reach the server. Check the URL and that the phone is on the same network or Tailscale." });
    } finally {
      setBusy(null);
    }
  };

  const devLogin = async () => {
    setBusy("dev");
    await signIn({ baseUrl: normalizeUrl(url), user: user.trim(), org: org.trim(), orgs: [org.trim()], roles: [role] });
    setBusy(null);
  };

  const google = async () => {
    setBusy("google");
    try {
      const idToken = await googleIdToken();
      if (idToken) await signIn(await signInWithGoogle(normalizeUrl(url), idToken));
    } catch (e) {
      setStatus({ ok: false, text: String(e instanceof Error ? e.message : e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.logo}>
              {color.accents.slice(0, 4).map((c) => (
                <View key={c} style={[styles.tile, { backgroundColor: c }]} />
              ))}
            </View>
            <Text style={styles.brand}>mOSaic</Text>
            <Text style={styles.tagline}>Your organization's AI, from your pocket.</Text>
          </View>

          <Card>
            <Label>Server</Label>
            <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} accessibilityLabel="Server URL" />
            <Body muted style={{ fontSize: 13 }}>Emulator: http://10.0.2.2:8080 · hotspot or LAN: http://&lt;laptop-ip&gt;:8089 · Tailscale: https://&lt;node&gt;.ts.net:8443</Body>
            <Button title="Test connection" variant="outline" onPress={test} busy={busy === "test"} style={{ marginTop: space.sm }} />
            {status ? <Body style={{ color: status.ok ? color.running : color.failed, marginTop: space.xs }}>{status.text}</Body> : null}
          </Card>

          {googleAvailable() ? (
            <Button title="Sign in with Google" large onPress={google} busy={busy === "google"} />
          ) : null}

          <Card>
            <Label>Developer sign-in (MOSAIC_AUTH=dev)</Label>
            <View style={styles.row}>
              <TextInput value={user} onChangeText={setUser} autoCapitalize="none" placeholder="user" style={[styles.input, { flex: 1, minWidth: 0 }]} accessibilityLabel="User" />
              <TextInput value={org} onChangeText={setOrg} autoCapitalize="none" placeholder="org" style={[styles.input, { flex: 1, minWidth: 0 }]} accessibilityLabel="Organization" />
            </View>
            <Label>Role</Label>
            <View style={styles.roles}>
              {ROLES.map((r) => (
                <Pressable key={r} onPress={() => setRole(r)} accessibilityRole="radio" accessibilityState={{ selected: role === r }} style={[styles.role, role === r && styles.roleOn]}>
                  <Text style={[styles.roleText, role === r && { color: color.onBrand }]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <Button title="Continue" large onPress={devLogin} disabled={!user.trim() || !org.trim() || !url.trim()} busy={busy === "dev"} style={{ marginTop: space.md }} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.lg, gap: space.lg },
  hero: { alignItems: "center", gap: space.sm, paddingTop: space.xl },
  logo: { width: 64, height: 64, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  tile: { width: 30, height: 30, borderRadius: 8 },
  brand: { fontSize: 32, fontWeight: "800", color: color.text },
  tagline: { color: color.text2, fontSize: 15 },
  input: { minHeight: touch, backgroundColor: color.surface2, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16, color: color.text, borderWidth: 1, borderColor: color.line },
  row: { flexDirection: "row", gap: space.sm },
  roles: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  role: { minHeight: 40, justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  roleOn: { backgroundColor: color.brand, borderColor: color.brand },
  roleText: { color: color.text, fontWeight: "600" },
});
