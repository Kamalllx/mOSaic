import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useCallback } from "react";
import { type ColorValue, Platform, View } from "react-native";
import { useApprovalNotifications, useConnection, usePoll } from "../../src/hooks";
import { useSession } from "../../src/session";
import { color } from "../../src/theme";
import { ConnectionBanner } from "../../src/ui";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const icon = (name: IconName) =>
  function TabIcon({ color: c, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={c as string} size={size} />;
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
          tabBarActiveTintColor: color.brand,
          tabBarInactiveTintColor: color.text2,
          // native builds size the bar from the safe-area inset; the web build has no inset, so give the labels room there
          tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.line, ...(Platform.OS === "web" ? { height: 62, paddingBottom: 8 } : null) },
          tabBarLabelStyle: { fontWeight: "600" },
          headerStyle: { backgroundColor: color.surface },
          headerTitleStyle: { color: color.text, fontWeight: "700" },
          sceneStyle: { backgroundColor: color.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home", headerTitle: `mOSaic · ${session.org}`, tabBarIcon: icon("home-outline") }} />
        <Tabs.Screen
          name="approvals"
          options={{ title: "Approvals", tabBarIcon: icon("hand-left-outline"), tabBarBadge: approvals.length || undefined, tabBarBadgeStyle: { backgroundColor: color.approval } }}
        />
        <Tabs.Screen name="compose" options={{ title: "Compose", tabBarIcon: icon("create-outline") }} />
        <Tabs.Screen name="search" options={{ title: "Knowledge", tabBarIcon: icon("search-outline") }} />
        <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: icon("settings-outline") }} />
      </Tabs>
    </View>
  );
}
