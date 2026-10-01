import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useCallback } from "react";
import { type ColorValue, Platform, View } from "react-native";
import { useApprovalNotifications, useConnection, usePoll } from "../../src/hooks";
import { useSession } from "../../src/session";
import { color, font } from "../../src/theme";
import { ConnectionBanner } from "../../src/ui";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const icon = (on: IconName, off: IconName) =>
  function TabIcon({ color: c, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? on : off} color={c as string} size={size} />;
  };

export default function TabsLayout() {
  const { session, client } = useSession();
  const { conn, retry } = useConnection();
  // one app-wide poll feeds the badge and the notifications, so they work on every tab
  const pending = usePoll(useCallback(() => client!.pendingApprovals(), [client]), 3_000, [client]);
  const approvals = pending.data ?? [];
  const byId = new Map(approvals.map((a) => [a.approval_id, a]));
  useApprovalNotifications(
    pending.data?.map((a) => a.approval_id),
    useCallback(
      (id: string) => {
        const a = byId.get(id);
        return a ? `${a.agent} wants ${a.syscall.capability}: ${a.syscall.justification ?? a.syscall.operation}` : id;
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [pending.data],
    ),
  );
  if (!session) return null;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ConnectionBanner conn={conn} baseUrl={session.baseUrl} onRetry={retry} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: color.brand,
          tabBarInactiveTintColor: color.ink3,
          // native builds size the bar from the safe-area inset; the web build has none, so give the labels room there
          tabBarStyle: {
            backgroundColor: color.surface,
            borderTopColor: color.line,
            ...(Platform.OS === "web" ? { height: 64, paddingBottom: 8 } : null),
          },
          tabBarLabelStyle: { fontFamily: font.bodyMedium, fontSize: 11 },
          sceneStyle: { backgroundColor: color.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("grid", "grid-outline") }} />
        <Tabs.Screen
          name="approvals"
          options={{
            title: "Approvals",
            tabBarIcon: icon("hand-left", "hand-left-outline"),
            tabBarBadge: approvals.length || undefined,
            tabBarBadgeStyle: { backgroundColor: color.waiting, color: color.onFill, fontFamily: font.bodyBold },
          }}
        />
        <Tabs.Screen name="compose" options={{ title: "New task", tabBarIcon: icon("add-circle", "add-circle-outline") }} />
        <Tabs.Screen name="search" options={{ title: "Knowledge", tabBarIcon: icon("library", "library-outline") }} />
        <Tabs.Screen name="settings" options={{ title: "You", tabBarIcon: icon("person-circle", "person-circle-outline") }} />
      </Tabs>
    </View>
  );
}
