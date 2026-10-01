// Fails (exit 1) if any text colour used by the app is below WCAG AA (4.5:1) on the surface it sits on.
// Pairs mirror how src/theme.ts and src/ui.tsx combine colours. Run: node scripts/contrast.mjs
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/theme.ts", import.meta.url), "utf8");
const hex = (key) => {
  const m = new RegExp(`\\b${key}: "(#[0-9a-f]{6})"`, "i").exec(src);
  if (!m) throw new Error(`token ${key} not found`);
  return m[1];
};
const tiles = [...src.match(/tiles: \[([^\]]+)\]/)[1].matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]);
const riskRows = [...src.matchAll(/(\w+): \{ fill: "(#\w+)", soft: "(#\w+)", ink: "(#\w+)" \}/g)];

function lum(h) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const c = Object.fromEntries(
  ["bg", "surface", "sunken", "ink", "ink2", "ink3", "brand", "brandSoft", "brandInk", "approve", "approveSoft", "danger", "dangerSoft", "waiting", "waitingSoft", "knowledge", "knowledgeSoft", "onFill"].map((k) => [k, hex(k)]),
);

const pairs = [];
tiles.forEach((t, i) => pairs.push([`tile ${i} as text on surface`, t, c.surface], [`tile ${i} as text on brandSoft`, t, c.brandSoft]));
for (const fg of ["ink", "ink2", "ink3", "brand", "approve", "danger", "waiting", "knowledge", "brandInk"])
  for (const bg of ["surface", "bg", "sunken"]) pairs.push([`${fg} on ${bg}`, c[fg], c[bg]]);
for (const fill of ["brand", "approve", "danger", "waiting", "knowledge"]) pairs.push([`onFill on ${fill}`, c.onFill, c[fill]]);
pairs.push(["brandInk on brandSoft", c.brandInk, c.brandSoft], ["brand on brandSoft", c.brand, c.brandSoft]);
pairs.push(["approve on approveSoft", c.approve, c.approveSoft], ["danger on dangerSoft", c.danger, c.dangerSoft]);
pairs.push(["waiting on waitingSoft", c.waiting, c.waitingSoft], ["knowledge on knowledgeSoft", c.knowledge, c.knowledgeSoft]);
pairs.push(["ink2 on brandSoft", c.ink2, c.brandSoft], ["ink on waitingSoft", c.ink, c.waitingSoft]);
tiles.forEach((t, i) => pairs.push([`onFill on tile ${i}`, c.onFill, t]));
for (const [, name, fill, soft, ink] of riskRows) {
  pairs.push([`onFill on risk.${name}.fill`, c.onFill, fill], [`risk.${name}.ink on soft`, ink, soft]);
}

let bad = 0;
for (const [label, fg, bg] of pairs) {
  const r = ratio(fg, bg);
  const ok = r >= 4.5;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${r.toFixed(2).padStart(5)}  ${label}  (${fg} on ${bg})`);
}
console.log(bad ? `\n${bad} pair(s) below 4.5:1` : `\nall ${pairs.length} pairs pass WCAG AA`);
process.exit(bad ? 1 : 0);
