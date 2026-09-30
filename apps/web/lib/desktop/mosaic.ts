/** The wallpaper's layout: one tessera per /org document, each folder a patch of tesserae around its own seed on an
 *  ellipse (the centre stays clear for the composer). Pure and deterministic, so it is unit-tested. */

export interface Doc {
  path: string;
  title?: string;
}

export interface Tile {
  path: string;
  title?: string;
  folder: string;
  col: number;
  row: number;
}

export interface MosaicLayout {
  cell: number;
  cols: number;
  rows: number;
  tiles: Tile[];
  /** Where each folder's name is drawn: just above its patch, in px. */
  labels: { folder: string; x: number; y: number }[];
}

/** `/org/slack/apollo-eng/x` belongs to `slack`. */
export function folderOf(path: string): string {
  return path.split("/")[2] ?? "org";
}

/** A stable 0..1 value per cell, for the tesserae's jitter and the filler's shading. */
export function hash2(a: number, b: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function layoutMosaic(docs: Doc[], width: number, height: number, cell = 26): MosaicLayout {
  const cols = Math.max(1, Math.floor(width / cell));
  const rows = Math.max(1, Math.floor(height / cell));
  const groups = new Map<string, Doc[]>();
  for (const d of [...docs].sort((a, b) => a.path.localeCompare(b.path))) {
    const f = folderOf(d.path);
    groups.set(f, [...(groups.get(f) ?? []), d]);
  }
  const folders = [...groups.keys()].sort();
  const taken = new Set<string>();
  const tiles: Tile[] = [];
  const labels: MosaicLayout["labels"] = [];
  const cx = cols / 2;
  const cy = rows * 0.47;
  const rx = cols * 0.37;
  const ry = rows * 0.33;
  // Rows kept clear: the top bar (first row) and the dock (last three rows).
  const free = (c: number, r: number) => c >= 0 && c < cols && r >= 1 && r < rows - 3 && !taken.has(`${c},${r}`);

  folders.forEach((folder, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / folders.length;
    const sc = Math.round(cx + rx * Math.cos(angle));
    const sr = Math.round(cy + ry * Math.sin(angle));
    let minRow = Infinity;
    let sumCol = 0;
    const placed: Tile[] = [];
    for (const d of groups.get(folder)!) {
      // Walk rings outward from the seed and take the first free cell: patches stay compact and never overlap.
      search: for (let ring = 0; ring < Math.max(cols, rows); ring++) {
        for (let dr = -ring; dr <= ring; dr++) {
          for (let dc = -ring; dc <= ring; dc++) {
            if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
            const c = sc + dc;
            const r = sr + dr;
            if (free(c, r)) {
              taken.add(`${c},${r}`);
              placed.push({ path: d.path, title: d.title, folder, col: c, row: r });
              break search;
            }
          }
        }
      }
    }
    for (const t of placed) {
      minRow = Math.min(minRow, t.row);
      sumCol += t.col;
    }
    tiles.push(...placed);
    if (placed.length) labels.push({ folder, x: ((sumCol / placed.length) + 0.5) * cell, y: minRow * cell - 6 });
  });
  return { cell, cols, rows, tiles, labels };
}

/** The document tile under a point, if any. */
export function tileAt(layout: MosaicLayout, x: number, y: number): Tile | undefined {
  const c = Math.floor(x / layout.cell);
  const r = Math.floor(y / layout.cell);
  return layout.tiles.find((t) => t.col === c && t.row === r);
}
