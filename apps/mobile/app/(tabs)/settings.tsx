import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { normalizeUrl } from "../../src/client";
import { googleSignOut } from "../../src/google";
import { setupNotifications } from "../../src/hooks";
import { permissionsFor } from "../../src/rbac";
import { useSession } from "../../src/session";
import { color, radius, space, touch } from "../../src/theme";
import { Badge, Body, Button, Card, Label } from "../../src/ui";

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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Label>Account</Label>
          <Text style={styles.name}>{session.name ?? session.user}</Text>
          {session.email ? <Body muted>{session.email}</Body> : null}
          <View style={styles.row}>
            <Badge text={dev ? "dev sign-in" : "Google"} tone={dev ? color.waiting : color.brand} />
            {session.roles.map((r) => (
              <Badge key={r} text={r} tone={color.brand} filled />
            ))}
          </View>
          <Label>Permissions</Label>
          <Body muted monoFont>{perms.join("  ")}</Body>
        </Card>

        <Card>
          <Label>Organization</Label>
          <View style={styles.row}>
            {session.orgs.map((o) => (
              <Pressable key={o} onPress={() => update({ org: o })} accessibilityRole="radio" accessibilityState={{ selected: session.org === o }} style={[styles.chip, session.org === o && styles.chipOn]}>
                <Text style={[styles.chipText, session.org === o && { color: color.onBrand }]}>{o}</Text>
              </Pressable>
            ))}
          </View>
          {dev ? (
            <View style={[styles.row, { marginTop: space.sm }]}>
              <TextInput value={newOrg} onChangeText={setNewOrg} autoCapitalize="none" placeholder="add org id" style={[styles.input, { flex: 1, minWidth: 0 }]} accessibilityLabel="Add organization" />
              <Button
                title="Add"
                variant="outline"
                disabled={!newOrg.trim()}
                style={{ flex: 0 }}
                onPress={async () => {
                  await update({ org: newOrg.trim(), orgs: [...session.orgs, newOrg.trim()] });
                  setNewOrg("");
                }}
              />
            </View>
          ) : null}
        </Card>

        <Card>
          <Label>Server</Label>
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
          <Body muted style={{ fontSize: 13 }}>Emulator http://10.0.2.2:8080 · hotspot or LAN http://&lt;laptop-ip&gt;:8089 · Tailscale https://&lt;node&gt;.ts.net:8443</Body>
          <Button
            title={saved ? "Saved" : "Save"}
            disabled={!url.trim()}
            onPress={async () => {
              await update({ baseUrl: normalizeUrl(url) });
              setSaved(true);
            }}
            style={{ marginTop: space.sm }}
          />
        </Card>

        <Card>
          <Label>Notifications</Label>
          <Body muted>A notification appears when an agent asks for approval while the app is open or recently used.</Body>
          <Button
            title="Allow notifications"
            variant="outline"
            onPress={async () => setNotif((await setupNotifications()) ? "Notifications allowed." : "Notifications are off for mOSaic in system settings.")}
            style={{ marginTop: space.sm }}
          />
          {notif ? <Body muted>{notif}</Body> : null}
        </Card>

        <Button
          title="Sign out"
          variant="outline"
          tone={color.failed}
          onPress={async () => {
            if (!dev) await googleSignOut();
            await logout();
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: 96 },
  name: { color: color.text, fontSize: 20, fontWeight: "800" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, alignItems: "center" },
  input: { minHeight: touch, backgroundColor: color.surface2, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16, color: color.text, borderWidth: 1, borderColor: color.line },
  chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface },
  chipOn: { backgroundColor: color.brand, borderColor: color.brand },
  chipText: { color: color.text, fontWeight: "600" },
});
