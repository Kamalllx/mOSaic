// Design tokens for the phone. Direction: a light, Mac-like "tessera" look. Every agent and every task is a coloured
// tile, the way the console's wallpaper turns the org's knowledge into a mosaic. Colours, type and radii live only
// here, and scripts/contrast.mjs checks that every text colour stays readable on the surface it sits on (WCAG AA).
export const color = {
  bg: "#eef1f7", // cool paper, slightly blue so white cards lift off it
  surface: "#ffffff",
  sunken: "#f4f6fa", // inset blocks inside cards (arguments, evidence)
  line: "#dce1ea",
  ink: "#121826", // primary text
  ink2: "#475266", // secondary text, 7:1 on white
  ink3: "#5f6b80", // captions and meta, still >= 4.5:1 on paper and white
  brand: "#0b6f64", // teal; white text on it passes AA
  brandSoft: "#dff3ef",
  brandInk: "#075249", // brand-coloured text on brandSoft
  approve: "#13703a",
  approveSoft: "#e2f4e8",
  danger: "#b3342d",
  dangerSoft: "#fbe8e6",
  waiting: "#8a5300", // ochre text / fills that carry white text
  waitingSoft: "#fdf0d9",
  knowledge: "#3446a0",
  knowledgeSoft: "#e6e9fb",
  onFill: "#ffffff",
  // one tile colour per agent role; all carry white initials at AA
  tiles: ["#0b6f64", "#8a5300", "#3446a0", "#6f3f93", "#3f6a2c", "#a2382f", "#1f5f86"],
} as const;

export const risk: Record<string, { fill: string; soft: string; ink: string }> = {
  critical: { fill: "#a3241f", soft: "#fbe4e2", ink: "#8c1d19" },
  high: { fill: "#9a4100", soft: "#fdebdc", ink: "#7f3600" },
  medium: { fill: "#8a5300", soft: "#fdf0d9", ink: "#6e4300" },
  low: { fill: "#4b5568", soft: "#eceff4", ink: "#3c4555" },
};

export const font = {
  display: "SpaceGrotesk_700Bold",
  displayMedium: "SpaceGrotesk_600SemiBold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodyBold: "Inter_700Bold",
  mono: "JetBrainsMono_400Regular",
  monoBold: "JetBrainsMono_700Bold",
} as const;

export const type = {
  hero: { fontFamily: font.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: color.ink },
  title: { fontFamily: font.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.2, color: color.ink },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 22, color: color.ink },
  small: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: color.ink2 },
  eyebrow: { fontFamily: font.bodyBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, color: color.ink3, textTransform: "uppercase" as const },
  mono: { fontFamily: font.mono, fontSize: 13, lineHeight: 19, color: color.ink },
} as const;

export const radius = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const touch = 48; // minimum touch target; primary actions are 56

export const shadow = {
  card: { shadowColor: "#1a2340", shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  lift: { shadowColor: "#1a2340", shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
} as const;

export type Tone = { fill: string; soft: string; ink: string };

export function statusTone(status?: string): Tone {
  switch (status) {
    case "completed":
      return { fill: color.approve, soft: color.approveSoft, ink: color.approve };
    case "failed":
    case "cancelled":
      return { fill: color.danger, soft: color.dangerSoft, ink: color.danger };
    case "waiting_approval":
    case "paused":
      return { fill: color.waiting, soft: color.waitingSoft, ink: color.waiting };
    default:
      return { fill: color.brand, soft: color.brandSoft, ink: color.brandInk };
  }
}

export function stateTone(state?: string): Tone {
  switch (state) {
    case "RUNNING":
    case "INITIALIZING":
    case "READY":
      return { fill: color.brand, soft: color.brandSoft, ink: color.brandInk };
    case "WAITING":
    case "PAUSED":
      return { fill: color.waiting, soft: color.waitingSoft, ink: color.waiting };
    case "FAILED":
    case "TERMINATED":
      return { fill: color.danger, soft: color.dangerSoft, ink: color.danger };
    case "COMPLETED":
      return { fill: color.approve, soft: color.approveSoft, ink: color.approve };
    default:
      return { fill: color.ink3, soft: color.sunken, ink: color.ink2 };
  }
}

/** A stable tile colour per agent name (planner is always teal, finance ochre, ...). */
const ROLE_TILE: Record<string, string> = {
  "planner-agent": color.tiles[0],
  "finance-agent": color.tiles[1],
  "research-agent": color.tiles[2],
  "engineering-agent": color.tiles[4],
  "action-agent": color.tiles[3],
};

export function tileFor(name: string): string {
  if (ROLE_TILE[name]) return ROLE_TILE[name];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return color.tiles[h % color.tiles.length];
}

export function initials(name: string): string {
  const base = name.replace(/-agent$/, "");
  const parts = base.split(/[-_ ]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : base.slice(0, 2)).toUpperCase();
}
