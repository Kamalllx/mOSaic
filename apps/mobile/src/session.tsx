// The signed-in session (server URL, user, org, roles, token), persisted on the device, and the client built from it.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type Client, createClient, type Session, signOut } from "./client";
import { can, type Permission, permissionsFor } from "./rbac";

const KEY = "mosaic.session.v2";
const LEGACY_KEY = "mosaic.settings"; // phase-1 app: {baseUrl, user, org}

export const DEFAULT_URL = "http://10.0.2.2:8080"; // the host machine as seen from the Android emulator

type Ctx = {
  ready: boolean;
  session: Session | null;
  client: Client | null;
  signIn: (s: Session) => Promise<void>;
  update: (patch: Partial<Session>) => Promise<void>;
  logout: () => Promise<void>;
  can: (p: Permission) => boolean;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setSession(JSON.parse(raw) as Session);
        else {
          const legacy = await AsyncStorage.getItem(LEGACY_KEY);
          if (legacy) {
            const l = JSON.parse(legacy) as { baseUrl?: string; user?: string; org?: string };
            if (l.baseUrl && l.user && l.org) setSession({ baseUrl: l.baseUrl, user: l.user, org: l.org, orgs: [l.org], roles: [] });
          }
        }
      } catch {
        /* corrupt storage: start signed out */
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (s: Session | null) => {
    setSession(s);
    if (s) await AsyncStorage.setItem(KEY, JSON.stringify(s));
    else await AsyncStorage.removeItem(KEY);
  }, []);

  const value = useMemo<Ctx>(() => {
    const perms = permissionsFor(session?.roles ?? [], session?.permissions);
    return {
      ready,
      session,
      client: session ? createClient(session) : null,
      signIn: (s) => persist({ ...s, orgs: Array.from(new Set([s.org, ...s.orgs])).filter(Boolean) }),
      update: async (patch) => {
        if (!session) return;
        const next = { ...session, ...patch };
        next.orgs = Array.from(new Set([next.org, ...(next.orgs ?? [])])).filter(Boolean);
        await persist(next);
      },
      logout: async () => {
        if (session) await signOut(session);
        await persist(null);
      },
      can: (p) => can(perms, p),
    };
  }, [ready, session, persist]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession outside SessionProvider");
  return ctx;
}

/** The client, for screens that only render when signed in. */
export function useClient(): Client {
  const { client } = useSession();
  if (!client) throw new Error("no session");
  return client;
}
