import { Platform } from "react-native";

/** The console's "Signal" look on the phone: cool paper, white cards, one vivid colour per thing. */
export const C = {
  ground: "#eef1f6",
  card: "#ffffff",
  sunk: "#f1f3f6",
  line: "rgba(15,23,42,0.10)",
  text: "#0f172a",
  text2: "#475569",
  text3: "#94a3b8",
  brand: "#0b6b60",
  brandSoft: "#ddf3ef",
  running: "#0d9488",
  waiting: "#d97706",
  waitingSoft: "#fef3c7",
  failed: "#dc2626",
  failedSoft: "#fee2e2",
  done: "#16a34a",
  doneSoft: "#dcfce7",
  blue: "#2563eb",
  violet: "#7c3aed",
};

export const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

/** Folder colours, as on the desktop's mosaic. */
export const FOLDER_HUES: Record<string, string> = {
  decisions: "#00b3c7",
  engineering: "#2f7cf6",
  finance: "#16b67a",
  inbox: "#ff5a5f",
  jira: "#7b61ff",
  meetings: "#c56cf0",
  people: "#f0628f",
  playbooks: "#14a89a",
  policies: "#7cc242",
  projects: "#ff8a3d",
  slack: "#f5a623",
  systems: "#5c6bc0",
  github: "#57606a",
  calendar: "#1a73e8",
  uploads: "#e8590c",
  mnt: "#d9480f",
};

export const folderHue = (path: string) => FOLDER_HUES[path.split("/")[2] ?? ""] ?? "#8a94a6";

export const STATUS: Record<string, { label: string; color: string; soft: string }> = {
  queued: { label: "queued", color: C.text2, soft: C.sunk },
  planning: { label: "planning", color: C.blue, soft: "#dbeafe" },
  running: { label: "running", color: C.running, soft: C.brandSoft },
  waiting_approval: { label: "needs approval", color: C.waiting, soft: C.waitingSoft },
  paused: { label: "paused", color: C.text2, soft: C.sunk },
  completed: { label: "done", color: C.done, soft: C.doneSoft },
  failed: { label: "failed", color: C.failed, soft: C.failedSoft },
  cancelled: { label: "cancelled", color: C.text2, soft: C.sunk },
};

export const isActive = (status?: string) => ["queued", "planning", "running", "waiting_approval", "paused"].includes(status ?? "");
