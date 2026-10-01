import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { normalizeUrl } from "../../src/client";
import { googleSignOut } from "../../src/google";
import { setupNotifications } from "../../src/hooks";
import { permissionsFor } from "../../src/rbac";
import { useSession } from "../../src/session";
import { color, font, radius, space, touch, type } from "../../src/theme";
import { Button, Eyebrow, Pill, ScreenHeader, Tile } from "../../src/ui";

const DANGER = { fill: color.danger, soft: color.dangerSoft, ink: color.danger };

function Group({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export default function Settings() {
  const { session, update, logout } = useSession();
  const [url, setUrl] = useState(session?.baseUrl ?? "");
  const [newOrg, setNewOrg] = useState("");
  const [saved, setSaved] = useState(false);
  const [notif, setNotif] = useState<string | null>(null);
  if (!session) return null;
  const perms = [...permissionsFor(session.roles, session.permissions)].sort();
  const dev = !session.token;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="You" />
        <View style={styles.content}>
          <Group>
            <View style={styles.account}>
              <Tile name={session.name ?? session.user} size={56} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={type.title}>{session.name ?? session.user}</Text>
                {session.email ? <Text style={type.small}>{session.email}</Text> : null}
                <View style={styles.row}>
                  <Pill text={dev ? "dev sign-in" : "Google"} tone={dev ? { fill: color.waiting, soft: color.waitingSoft, ink: color.waiting } : { fill: color.brand, soft: color.brandSoft, ink: color.brandInk }} />
                  {session.roles.map((r) => (
                    <Pill key={r} text={r} tone={{ fill: color.brand, soft: color.brandSoft, ink: color.brandInk }} solid />
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={type.eyebrow}>What you can do</Text>
            <View style={[styles.row, { marginTop: space.sm }]}>
              {perms.map((p) => (
                <View key={p} style={styles.perm}>
                  <Text style={styles.permText}>{p}</Text>
                </View>
              ))}
            </View>
          </Group>

          <Eyebrow>Organization</Eyebrow>
          <Group>
            {session.orgs.map((o, i) => {
              const on = session.org === o;
              return (
                <Pressable key={o} onPress={() => update({ org: o })} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.orgRow, i > 0 && styles.rowLine]}>
                  <Tile name={o} size={32} />
                  <Text style={[type.body, { flex: 1, fontFamily: on ? font.bodyBold : font.body }]}>{o}</Text>
                  {on ? <Ionicons name="checkmark-circle" size={22} color={color.brand} /> : <Ionicons name="ellipse-outline" size={22} color={color.ink3} />}
                </Pressable>
              );
            })}
            {dev ? (
              <View style={[styles.row, styles.rowLine, { paddingTop: space.md }]}>
                <TextInput value={newOrg} onChangeText={setNewOrg} autoCapitalize="none" placeholder="Add an org id" placeholderTextColor={color.ink3} style={[styles.input, { flex: 1, minWidth: 0 }]} accessibilityLabel="Add organization" />
                <Button
                  title="Add"
                  variant="soft"
                  disabled={!newOrg.trim()}
                  style={{ flex: 0, minWidth: 84 }}
                  onPress={async () => {
                    await update({ org: newOrg.trim(), orgs: [...session.orgs, newOrg.trim()] });
                    setNewOrg("");
                  }}
                />
              </View>
            ) : null}
          </Group>

          <Eyebrow>Server</Eyebrow>
          <Group>
            <TextInput
              value={url}
              onChangeText={(v) => {
                setUrl(v);
                setSaved(false);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.input}
              accessibilityLabel="Server URL"
            />
            <Text style={[type.small, { marginTop: space.sm }]}>USB: http://localhost:8081 with adb reverse · Wi-Fi or hotspot: http://&lt;laptop-ip&gt;:8089 · Tailscale: https://&lt;node&gt;.ts.net:8443</Text>
            <Button
              title={saved ? "Saved" : "Save server"}
              disabled={!url.trim() || saved}
              onPress={async () => {
                await update({ baseUrl: normalizeUrl(url) });
                setSaved(true);
              }}
              style={{ marginTop: space.md }}
            />
          </Group>

          <Eyebrow>Notifications</Eyebrow>
          <Group>
            <View style={styles.orgRow}>
              <Ionicons name="notifications-outline" size={22} color={color.brand} />
              <Text style={[type.small, { flex: 1, color: color.ink }]}>Get a notification when an agent asks for approval while mOSaic is open or recently used.</Text>
            </View>
            <Button
              title="Allow notifications"
              variant="soft"
              onPress={async () => setNotif((await setupNotifications()) ? "Notifications are on." : "Notifications are off for mOSaic in Android settings.")}
              style={{ marginTop: space.sm }}
            />
            {notif ? <Text style={[type.small, { marginTop: space.sm }]}>{notif}</Text> : null}
          </Group>

          <Button
            title="Sign out"
            variant="soft"
            tone={DANGER}
            icon={<Ionicons name="log-out-outline" size={20} color={color.danger} />}
            onPress={async () => {
              if (!dev) await googleSignOut();
              await logout();
            }}
            style={{ marginTop: space.xl }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg },
  group: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.line, padding: space.lg },
  account: { flexDirection: "row", gap: space.md, alignItems: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  divider: { height: 1, backgroundColor: color.line, marginVertical: space.lg },
  perm: { backgroundColor: color.sunken, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  permText: { fontFamily: font.mono, fontSize: 12, color: color.ink2 },
  orgRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: touch },
  rowLine: { borderTopWidth: 1, borderTopColor: color.line, marginTop: space.sm },
  input: { minHeight: touch, backgroundColor: color.sunken, borderRadius: radius.md, paddingHorizontal: space.md, fontFamily: font.body, fontSize: 16, color: color.ink, borderWidth: 1, borderColor: color.line },
});
