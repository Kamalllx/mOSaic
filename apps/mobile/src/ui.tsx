// Shared building blocks. Every colour, font and size comes from theme.ts (checked by scripts/contrast.mjs).
import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Conn } from "./hooks";
import { color, font, initials, radius, shadow, space, type Tone, tileFor, touch, type } from "./theme";

export function Card({ children, style, onPress, label }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void; label?: string }) {
  if (!onPress) return <View style={[s.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.card, style, pressed && { transform: [{ scale: 0.985 }] }]}>
      {children}
    </Pressable>
  );
}

export function ScreenHeader({ title, eyebrow, right }: { title: string; eyebrow?: string; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + space.md }]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={type.eyebrow}>{eyebrow}</Text> : null}
        <Text style={type.hero} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

export function Eyebrow({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[type.eyebrow, { marginTop: space.md, marginBottom: space.xs }, style]}>{children}</Text>;
}

export function Body({ children, muted, style, numberOfLines }: { children: React.ReactNode; muted?: boolean; style?: TextStyle; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[type.body, muted && { color: color.ink2 }, style]}>
      {children}
    </Text>
  );
}

export function Mono({ children, style, numberOfLines }: { children: React.ReactNode; style?: TextStyle; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[type.mono, style]}>
      {children}
    </Text>
  );
}

/** A status pill: soft background, same-hue ink (both from theme, contrast-checked). */
export function Pill({ text, tone, solid, icon }: { text: string; tone: Tone; solid?: boolean; icon?: React.ReactNode }) {
  return (
    <View style={[s.pill, { backgroundColor: solid ? tone.fill : tone.soft }]}>
      {icon}
      <Text style={[s.pillText, { color: solid ? color.onFill : tone.ink }]}>{text}</Text>
    </View>
  );
}

/** An agent as a tessera: its role colour, its initials. Breathes (scale, never fades) while working; done agents
 *  become outlined tiles with coloured initials, which keeps the same contrast as white-on-colour. */
export function Tile({ name, size = 40, live, dim }: { name: string; size?: number; live?: boolean; dim?: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!live) return;
    let anim: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.86, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
      );
      anim.start();
    });
    return () => {
      anim?.stop();
      pulse.setValue(1);
    };
  }, [live, pulse]);
  return (
    <Animated.View
      accessibilityLabel={name}
      style={[
        s.tile,
        { width: size, height: size, borderRadius: size * 0.3, transform: [{ scale: pulse }] },
        dim ? { backgroundColor: color.surface, borderWidth: 2, borderColor: tileFor(name) } : { backgroundColor: tileFor(name) },
      ]}
    >
      <Text style={[s.tileText, { fontSize: size * 0.36 }, dim && { color: tileFor(name) }]}>{initials(name)}</Text>
    </Animated.View>
  );
}

export function TileRow({ names, size = 28, live }: { names: string[]; size?: number; live?: (n: string) => boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {names.map((n, i) => (
        <Tile key={`${n}-${i}`} name={n} size={size} live={live?.(n)} />
      ))}
    </View>
  );
}

export function Progress({ value, tone }: { value: number; tone: Tone }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <View style={[s.bar, { width: `${pct * 100}%`, backgroundColor: tone.fill }]} />
    </View>
  );
}

export function Button({
  title,
  onPress,
  tone = { fill: color.brand, soft: color.brandSoft, ink: color.brandInk },
  variant = "solid",
  disabled,
  busy,
  large,
  icon,
  style,
  ...rest
}: { title: string; tone?: Tone; variant?: "solid" | "soft" | "outline"; busy?: boolean; large?: boolean; icon?: React.ReactNode; style?: ViewStyle } & Omit<PressableProps, "style" | "children">) {
  // disabled is a readable grey-on-grey, never faded white-on-colour
  const bg = disabled ? color.sunken : variant === "solid" ? tone.fill : variant === "soft" ? tone.soft : color.surface;
  const fg = disabled ? color.ink3 : variant === "solid" ? color.onFill : tone.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        { minHeight: large ? 56 : touch, backgroundColor: bg, borderColor: disabled ? color.line : variant === "outline" ? tone.fill : bg },
        pressed && { transform: [{ scale: 0.97 }] },
        style,
      ]}
      {...rest}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={s.buttonRow}>
          {disabled ? null : icon}
          <Text style={[s.buttonText, { color: fg, fontSize: large ? 17 : 15 }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function ConnectionBanner({ conn, baseUrl, onRetry }: { conn: Conn; baseUrl: string; onRetry: () => void }) {
  const insets = useSafeAreaInsets();
  if (conn === "online") return null;
  const offline = conn === "offline";
  return (
    <Pressable
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel="Retry connection"
      style={[s.banner, { paddingTop: insets.top + 8, backgroundColor: offline ? color.danger : color.waiting }]}
    >
      <Text style={s.bannerText}>{offline ? `Can't reach ${baseUrl}. Tap to retry.` : "Reconnecting to your server…"}</Text>
    </Pressable>
  );
}

export function Empty({ title, detail, children }: { title: string; detail?: string; children?: React.ReactNode }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyMosaic} aria-hidden>
        {color.tiles.slice(0, 4).map((t, i) => (
          <View key={t} style={[s.emptyTile, { backgroundColor: t, opacity: 0.25 + i * 0.18 }]} />
        ))}
      </View>
      <Text style={[type.title, { textAlign: "center" }]}>{title}</Text>
      {detail ? <Text style={[type.small, { textAlign: "center" }]}>{detail}</Text> : null}
      {children}
    </View>
  );
}

export function ErrorCard({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <View style={[s.card, { backgroundColor: color.dangerSoft, borderColor: color.dangerSoft }]}>
      <Text style={[type.body, { color: color.danger, fontFamily: font.bodyMedium }]}>{msg}</Text>
      {onRetry ? <Button title="Try again" variant="outline" tone={{ fill: color.danger, soft: color.dangerSoft, ink: color.danger }} onPress={onRetry} style={{ marginTop: space.md }} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: color.line, ...shadow.card },
  header: { flexDirection: "row", alignItems: "flex-end", gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.md, backgroundColor: color.bg },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: font.bodyBold, fontSize: 12, letterSpacing: 0.2 },
  tile: { alignItems: "center", justifyContent: "center" },
  tileText: { color: color.onFill, fontFamily: font.display, letterSpacing: 0.5 },
  track: { height: 6, borderRadius: 3, backgroundColor: color.sunken, overflow: "hidden" },
  bar: { height: 6, borderRadius: 3 },
  button: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: space.lg },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  buttonText: { fontFamily: font.bodyBold },
  banner: { paddingBottom: 10, paddingHorizontal: space.lg },
  bannerText: { color: color.onFill, fontFamily: font.bodyBold, textAlign: "center" },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: space.xl, gap: space.sm },
  emptyMosaic: { width: 56, height: 56, flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: space.sm },
  emptyTile: { width: 26, height: 26, borderRadius: 7 },
});
