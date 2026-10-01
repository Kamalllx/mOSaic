import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setupNotifications } from "../src/hooks";
import { SessionProvider, useSession } from "../src/session";
import { color, font } from "../src/theme";

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

  if (!ready) return <Splash />;
  return (
    <Stack
      screenOptions={{
        headerTintColor: color.brand,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: color.bg },
        headerTitleStyle: { fontFamily: font.displayMedium, color: color.ink },
        contentStyle: { backgroundColor: color.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="task/[id]" options={{ title: "Task" }} />
    </Stack>
  );
}

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg }}>
      <ActivityIndicator size="large" color={color.brand} />
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/* a font that fails to load falls back to the system face rather than blocking the app */}
      {loaded || error ? (
        <SessionProvider>
          <Gate />
        </SessionProvider>
      ) : (
        <Splash />
      )}
    </SafeAreaProvider>
  );
}
