import { describe, expect, it } from "vitest";
import { folderOf, layoutMosaic, tileAt } from "./mosaic";

const docs = [
  ...["apollo-budget", "cloud-bill-2026-08", "cloud-bill-2026-09", "q3-forecast"].map((n) => ({ path: `/org/finance/${n}` })),
  ...["vendor-email-2026-09-12", "email-cto-escalation"].map((n) => ({ path: `/org/inbox/${n}` })),
  ...["apollo-12", "apollo-14", "apollo-18"].map((n) => ({ path: `/org/jira/${n}` })),
  { path: "/org/slack/apollo-eng/2026-09-10" },
];

describe("wallpaper mosaic", () => {
  const m = layoutMosaic(docs, 1600, 900);

  it("gives every document exactly one tessera, and no two share a cell", () => {
    expect(m.tiles.map((t) => t.path).sort()).toEqual(docs.map((d) => d.path).sort());
    expect(new Set(m.tiles.map((t) => `${t.col},${t.row}`)).size).toBe(docs.length);
  });

  it("keeps the top bar row and the dock rows clear", () => {
    expect(m.tiles.every((t) => t.row >= 1 && t.row < m.rows - 3)).toBe(true);
  });

  it("clusters each folder around its own seed and labels it", () => {
    const finance = m.tiles.filter((t) => t.folder === "finance");
    const spread = Math.max(...finance.map((t) => t.col)) - Math.min(...finance.map((t) => t.col));
    expect(spread).toBeLessThanOrEqual(2);
    expect(m.labels.map((l) => l.folder).sort()).toEqual(["finance", "inbox", "jira", "slack"]);
    expect(folderOf("/org/slack/apollo-eng/2026-09-10")).toBe("slack");
  });

  it("is deterministic and finds a tile under a point", () => {
    expect(layoutMosaic(docs, 1600, 900)).toEqual(m);
    const t = m.tiles[0];
    expect(tileAt(m, t.col * m.cell + 3, t.row * m.cell + 3)?.path).toBe(t.path);
    expect(tileAt(m, 1, 1)).toBeUndefined();
  });
});
