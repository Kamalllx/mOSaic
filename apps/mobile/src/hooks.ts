// Polling that pauses in the background, connection state, and approval notifications.
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { isNetworkError } from "./client";
import { useSession } from "./session";

export type Conn = "online" | "offline" | "reconnecting";

/** Poll `fn` every `ms` while the app is in the foreground; refresh immediately on return to the foreground. */
export function usePoll<T>(fn: () => Promise<T>, ms: number, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const refresh = useCallback(async () => {
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      refresh();
      timer = setInterval(refresh, ms);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === "active" || Platform.OS === "web") start();
    const sub = AppState.addEventListener("change", (s) => (s === "active" ? start() : stop()));
    return () => {
      stop();
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, refresh, ...deps]);

  return { data, error, loading, refresh };
}

/** online / offline / reconnecting, from /health. After the first failure we keep retrying and say so. */
export function useConnection(): { conn: Conn; retry: () => void } {
  const { client } = useSession();
  const [conn, setConn] = useState<Conn>("online");
  const fails = useRef(0);
  const probe = useCallback(async () => {
    if (!client) return;
    try {
      await client.health();
      fails.current = 0;
      setConn("online");
    } catch (e) {
      if (!isNetworkError(e)) return setConn("online"); // the server answered, just not with 2xx
      fails.current += 1;
      setConn(fails.current >= 3 ? "offline" : "reconnecting");
    }
  }, [client]);
  usePoll(probe, 5_000, [client]);
  return { conn, retry: probe };
}

let handlerSet = false;

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (!handlerSet) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    handlerSet = true;
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("approvals", { name: "Approvals", importance: Notifications.AndroidImportance.HIGH });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/** Fire a local notification for every approval id we have not seen before (the first load only primes the set). */
export function useApprovalNotifications(ids: string[] | undefined, describe: (id: string) => string) {
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!ids) return;
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !seen.current!.has(id));
    fresh.forEach((id) => seen.current!.add(id));
    if (Platform.OS === "web") return;
    for (const id of fresh) {
      Notifications.scheduleNotificationAsync({
        content: { title: "Approval needed", body: describe(id), data: { approvalId: id } },
        trigger: Platform.OS === "android" ? { channelId: "approvals" } : null,
      }).catch(() => undefined);
    }
  }, [ids, describe]);
}
