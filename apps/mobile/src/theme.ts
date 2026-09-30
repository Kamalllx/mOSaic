// Design tokens for the phone. Values mirror the console's light theme (apps/web/app/globals.css); when Kamal's
// Mac-like re-skin lands, update them here only: every screen reads colours, radii and spacing from this file.
export const color = {
  bg: "#f5f6fa",
  surface: "#ffffff",
  surface2: "#f1f3f6",
  surface3: "#e8ecf1",
  line: "#d5dbe3",
  text: "#0f172a",
  text2: "#475569",
  brand: "#0b6b60",
  brandSubtle: "#ddf3ef",
  running: "#17702b",
  waiting: "#8f5f00",
  failed: "#b42f2f",
  approval: "#a8741c",
  knowledge: "#3d5f8a",
  onBrand: "#ffffff",
  // role accents, one colourful tile per agent role (the desktop's bot faces use the same idea)
  accents: ["#2b8f80", "#a8741c", "#3d5f8a", "#6b5a8e", "#7c4a44", "#4f6a3d"],
} as const;

export const risk: Record<string, string> = {
  critical: "#b42f2f",
  high: "#9e4a00",
  medium: "#8f5f00",
  low: "#5b6675",
};

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const touch = 48; // minimum touch target (Android guidance); primary actions use 56

export const mono = "monospace";

export function statusColor(status?: string): string {
  switch (status) {
    case "completed":
      return color.running;
    case "failed":
    case "cancelled":
      return color.failed;
    case "waiting_approval":
    case "paused":
      return color.waiting;
    default:
      return color.brand;
  }
}

export function accentFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return color.accents[h % color.accents.length];
}
