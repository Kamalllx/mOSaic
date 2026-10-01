import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { normalizeUrl, signInWithGoogle } from "../src/client";
import { googleAvailable, googleIdToken } from "../src/google";
import { ROLES } from "../src/rbac";
import { DEFAULT_URL, useSession } from "../src/session";
import { color, font, radius, space, touch, type } from "../src/theme";
import { Button, Eyebrow } from "../src/ui";

/** The mark: nine tesserae that settle into place one after another. */
function Mark() {
  const tiles = useRef(Array.from({ length: 9 }, () => new Animated.Value(0))).current;
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return tiles.forEach((t) => t.setValue(1));
      Animated.stagger(70, tiles.map((t) => Animated.spring(t, { toValue: 1, useNativeDriver: true, friction: 6 }))).start();
    });
  }, [tiles]);
  return (
    <View style={styles.mark} accessibilityLabel="mOSaic">
      {tiles.map((t, i) => (
        <Animated.View
          key={i}
          style={[
            styles.markTile,
            { backgroundColor: color.tiles[i % color.tiles.length], opacity: t, transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
          ]}
        />
      ))}
    </View>
  );
}

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
      setStatus(res.ok ? { ok: true, text: "Connected to your mOSaic server." } : { ok: false, text: `The server answered ${res.status}. Check the URL.` });
    } catch {
      setStatus({ ok: false, text: "Can't reach that address. Check the URL and that this phone is on the same network, Tailscale or USB." });
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
            <Mark />
            <Text style={styles.brand}>mOSaic</Text>
            <Text style={[type.body, { color: color.ink2, textAlign: "center" }]}>Your organization's AI runs on your own server. This phone watches it and approves what it does.</Text>
          </View>

          <View style={styles.group}>
            <Text style={type.eyebrow}>Server address</Text>
            <View style={styles.urlRow}>
              <Ionicons name="server-outline" size={20} color={color.ink2} />
              <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.urlInput} accessibilityLabel="Server URL" />
            </View>
            <Text style={type.small}>Emulator: http://10.0.2.2:8080 · USB: http://localhost:8081 · Wi-Fi: http://&lt;laptop-ip&gt;:8089</Text>
            <Button title="Check connection" variant="soft" onPress={test} busy={busy === "test"} style={{ marginTop: space.md }} />
            {status ? (
              <View style={[styles.status, { backgroundColor: status.ok ? color.approveSoft : color.dangerSoft }]}>
                <Ionicons name={status.ok ? "checkmark-circle" : "alert-circle"} size={18} color={status.ok ? color.approve : color.danger} />
                <Text style={[type.small, { flex: 1, color: status.ok ? color.approve : color.danger, fontFamily: font.bodyMedium }]}>{status.text}</Text>
              </View>
            ) : null}
          </View>

          {googleAvailable() ? (
            <Button title="Sign in with Google" large onPress={google} busy={busy === "google"} icon={<Ionicons name="logo-google" size={18} color={color.onFill} />} />
          ) : null}

          <View style={styles.group}>
            <Text style={type.eyebrow}>Developer sign-in</Text>
            <View style={styles.row}>
              <TextInput value={user} onChangeText={setUser} autoCapitalize="none" placeholder="user" placeholderTextColor={color.ink3} style={[styles.input, { flex: 1, minWidth: 0 }]} accessibilityLabel="User" />
              <TextInput value={org} onChangeText={setOrg} autoCapitalize="none" placeholder="org" placeholderTextColor={color.ink3} style={[styles.input, { flex: 1, minWidth: 0 }]} accessibilityLabel="Organization" />
            </View>
            <Eyebrow>Sign in as</Eyebrow>
            <View style={styles.roles}>
              {ROLES.map((r) => {
                const on = role === r;
                return (
                  <Pressable key={r} onPress={() => setRole(r)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.role, on && styles.roleOn]}>
                    <Text style={[styles.roleText, on && { color: color.onFill }]}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Button title="Continue" large onPress={devLogin} disabled={!user.trim() || !org.trim() || !url.trim()} busy={busy === "dev"} style={{ marginTop: space.lg }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.lg, gap: space.lg, paddingBottom: 40 },
  hero: { alignItems: "center", gap: space.md, paddingTop: space.xl, paddingBottom: space.sm },
  mark: { width: 84, height: 84, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  markTile: { width: 25, height: 25, borderRadius: 7 },
  brand: { fontFamily: font.display, fontSize: 40, letterSpacing: -1.2, color: color.ink },
  group: { backgroundColor: color.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: color.line, padding: space.lg, gap: space.sm },
  urlRow: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: color.sunken, borderRadius: radius.md, borderWidth: 1, borderColor: color.line, paddingHorizontal: space.md, minHeight: touch + 4 },
  urlInput: { flex: 1, fontFamily: font.mono, fontSize: 15, color: color.ink },
  status: { flexDirection: "row", gap: space.sm, alignItems: "center", borderRadius: radius.md, padding: space.md, marginTop: space.sm },
  input: { minHeight: touch, backgroundColor: color.sunken, borderRadius: radius.md, paddingHorizontal: space.md, fontFamily: font.body, fontSize: 16, color: color.ink, borderWidth: 1, borderColor: color.line },
  row: { flexDirection: "row", gap: space.sm },
  roles: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  role: { minHeight: 42, justifyContent: "center", paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  roleOn: { backgroundColor: color.brand, borderColor: color.brand },
  roleText: { fontFamily: font.bodyMedium, fontSize: 15, color: color.ink },
});
