// Small shared building blocks. Every colour and size comes from theme.ts.
import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, Text, type TextStyle, View, type ViewStyle } from "react-native";
import type { Conn } from "./hooks";
import { color, mono, radius, space, touch } from "./theme";

export function Card({ children, style, accent }: { children: React.ReactNode; style?: ViewStyle; accent?: string }) {
  return <View style={[s.card, accent ? { borderLeftWidth: 4, borderLeftColor: accent } : null, style]}>{children}</View>;
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[s.title, style]}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

export function Body({ children, muted, monoFont, style, numberOfLines }: { children: React.ReactNode; muted?: boolean; monoFont?: boolean; style?: TextStyle; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[s.body, muted && { color: color.text2 }, monoFont && { fontFamily: mono, fontSize: 13 }, style]}>
      {children}
    </Text>
  );
}

export function Badge({ text, tone = color.brand, filled }: { text: string; tone?: string; filled?: boolean }) {
  return (
    <View style={[s.badge, { borderColor: tone, backgroundColor: filled ? tone : "transparent" }]}>
      <Text style={[s.badgeText, { color: filled ? color.onBrand : tone }]}>{text}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  tone = color.brand,
  variant = "solid",
  disabled,
  busy,
  large,
  style,
  ...rest
}: { title: string; tone?: string; variant?: "solid" | "outline"; busy?: boolean; large?: boolean; style?: ViewStyle } & Omit<PressableProps, "style" | "children">) {
  const solid = variant === "solid";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        { minHeight: large ? 56 : touch, borderColor: tone, backgroundColor: solid ? tone : color.surface, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
      {...rest}
    >
      {busy ? <ActivityIndicator color={solid ? color.onBrand : tone} /> : <Text style={[s.buttonText, { color: solid ? color.onBrand : tone }]}>{title}</Text>}
    </Pressable>
  );
}

export function ConnectionBanner({ conn, baseUrl, onRetry }: { conn: Conn; baseUrl: string; onRetry: () => void }) {
  if (conn === "online") return null;
  const offline = conn === "offline";
  return (
    <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry connection" style={[s.banner, { backgroundColor: offline ? color.failed : color.waiting }]}>
      <Text style={s.bannerText}>{offline ? `Offline: cannot reach ${baseUrl}. Tap to retry.` : "Reconnecting to the server…"}</Text>
    </Pressable>
  );
}

export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      {detail ? <Text style={s.emptyDetail}>{detail}</Text> : null}
    </View>
  );
}

export function ErrorCard({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Card style={{ borderColor: color.failed }}>
      <Body style={{ color: color.failed }}>{String(error)}</Body>
      {onRetry ? <Button title="Retry" variant="outline" tone={color.failed} onPress={onRetry} style={{ marginTop: space.sm }} /> : null}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: space.xs, borderWidth: 1, borderColor: color.line },
  title: { color: color.text, fontSize: 17, fontWeight: "700" },
  label: { color: color.text2, fontSize: 12, fontWeight: "600", letterSpacing: 0.6, marginTop: space.sm, textTransform: "uppercase" },
  body: { color: color.text, fontSize: 15, lineHeight: 21 },
  badge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  button: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: space.lg },
  buttonText: { fontSize: 16, fontWeight: "700" },
  banner: { paddingVertical: 10, paddingHorizontal: space.lg },
  bannerText: { color: "#fff", fontWeight: "600", textAlign: "center" },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: space.xl, gap: space.sm },
  emptyTitle: { color: color.text, fontSize: 16, fontWeight: "600", textAlign: "center" },
  emptyDetail: { color: color.text2, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
