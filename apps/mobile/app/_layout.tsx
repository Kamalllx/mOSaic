import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setupNotifications } from "../src/hooks";
import { SessionProvider, useSession } from "../src/session";
import { color } from "../src/theme";

function Gate() {
  const { ready, session } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const onLogin = segments[0] === "login";
    if (!session && !onLogin) router.replace("/login");
    else if (session && onLogin) router.replace("/");
  }, [ready, session, segments, router]);

  useEffect(() => {
    if (session) setupNotifications().catch(() => undefined);
  }, [session]);

  if (!ready)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg }}>
        <ActivityIndicator size="large" color={color.brand} />
      </View>
    );
  return (
    <Stack screenOptions={{ headerTintColor: color.brand, headerStyle: { backgroundColor: color.surface }, contentStyle: { backgroundColor: color.bg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="task/[id]" options={{ title: "Task" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Gate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
