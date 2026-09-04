#!/usr/bin/env node
/**
 * Pull brand assets from wilshirelawfirm.com into assets/img/ — run from any machine with
 * normal internet access (the Claude Code cloud sandbox blocks the firm's domain):
 *
 *   node fetch-assets.mjs            → downloads attorney headshots + logo, then run: node build.mjs
 *   node fetch-assets.mjs --dry-run  → shows what it would download
 *
 * What it does
 *  1. Fetches https://wilshirelawfirm.com/legal-team/ (and /attorneys/, /legal-team/<slug>/ profile
 *     pages) and looks for each attorney listed in content/site.json → attorneys.
 *     Match = the attorney's last name appears in the <img alt>, the image filename, or the
 *     text of the card/link wrapping the image. Saves assets/img/attorneys/<key>.<ext>.
 *  2. Fetches the homepage and saves the site logo (first <img>/<svg> whose src/alt/class
 *     contains "logo") to assets/img/logo.<ext>. build.mjs uses it automatically.
 * Zero dependencies (Node 18+). Nothing is overwritten unless --force is passed.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const site = JSON.parse(readFileSync(join(ROOT, "content/site.json"), "utf8"));
const BASE = (process.env.WLF_BASE || site.main_site_url).replace(/\/$/, "");  // WLF_BASE overrides for testing
const DRY = process.argv.includes("--dry-run"), FORCE = process.argv.includes("--force");
const UA = { "User-Agent": "Mozilla/5.0 (compatible; WilshirePPC-asset-fetch/1.0)", "Accept": "text/html,image/*,*/*" };

async function get(url, asBuffer = false) {
  const r = await fetch(url, { headers: UA, redirect: "follow" });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return asBuffer ? Buffer.from(await r.arrayBuffer()) : await r.text();
}
const abs = (src, page) => { try { return new URL(src, page).href; } catch { return null; } };
const decode = s => s.replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"');
function bestSrc(tag) {
  // prefer the largest candidate in srcset, else data-src/data-lazy-src, else src
  const ss = tag.match(/\bsrcset="([^"]+)"/i)?.[1];
  if (ss) { const c = ss.split(",").map(s => s.trim().split(/\s+/)).map(([u, w]) => [u, parseInt(w) || 0]).sort((a, b) => b[1] - a[1]); if (c[0]) return c[0][0]; }
  return tag.match(/\bdata-(?:lazy-)?src="([^"]+)"/i)?.[1] || tag.match(/\bsrc="([^"]+)"/i)?.[1] || null;
}
function imgs(html, page) {
  const out = [];
  const re = /<img\b[^>]*>/gi; let m;
  while ((m = re.exec(html))) {
    const tag = m[0]; const src = bestSrc(tag); if (!src || /^data:/.test(src)) continue;
    const alt = decode(tag.match(/\balt="([^"]*)"/i)?.[1] || "");
    out.push({ src: abs(decode(src), page), alt, cls: tag.match(/\bclass="([^"]*)"/i)?.[1] || "", index: m.index, end: m.index + tag.length });
  }
  return out;
}
const isJunk = i => /logo|icon|badge|award|sprite|placeholder|arrow|flag/i.test(i.src + " " + i.alt + " " + i.cls);
/** Find the headshot for one attorney on a page: alt/src match first, then the nearest <img> to the
 *  attorney's name (within 500 chars of HTML) as long as no other listed attorney's name sits between. */
function findHeadshot(html, page, a, others) {
  const list = imgs(html, page);
  const direct = list.find(i => (i.alt + " " + i.src).toLowerCase().includes(a.last) && !isJunk(i));
  if (direct) return direct.src;
  const lower = html.toLowerCase(); let pos = 0;
  while ((pos = lower.indexOf(a.last, pos)) !== -1) {
    const before = list.filter(i => i.end <= pos && pos - i.end < 500).sort((x, y) => y.index - x.index)[0];
    const after = list.filter(i => i.index >= pos && i.index - pos < 500).sort((x, y) => x.index - y.index)[0];
    for (const c of [before, after]) {
      if (!c || isJunk(c)) continue;
      const between = c.index < pos ? lower.slice(c.end, pos) : lower.slice(pos + a.last.length, c.index);
      if (others.some(n => between.includes(n))) continue;
      return c.src;
    }
    pos += a.last.length;
  }
  return null;
}
function extFor(url, contentType) {
  const e = extname(new URL(url).pathname).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".svg"].includes(e)) return e === ".jpeg" ? ".jpg" : e;
  if (/svg/.test(contentType)) return ".svg"; if (/png/.test(contentType)) return ".png"; if (/webp/.test(contentType)) return ".webp"; return ".jpg";
}
async function save(url, destBase) {
  const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(`${r.status} ${url}`);
  const ext = extFor(url, r.headers.get("content-type") || ""); const dest = destBase + ext;
  if (existsSync(dest) && !FORCE) { console.log("  exists, skipping (use --force):", dest); return dest; }
  if (DRY) { console.log("  would save", url, "→", dest); return dest; }
  writeFileSync(dest, Buffer.from(await r.arrayBuffer())); console.log("  saved", dest); return dest;
}

const attorneys = Object.entries(site.attorneys).map(([key, a]) => ({ key, last: a.name.replace(/,.*$/, "").trim().split(/\s+/).pop().toLowerCase(), name: a.name }));
mkdirSync(join(ROOT, "assets/img/attorneys"), { recursive: true });

/* 1. attorney headshots */
const pages = [`${BASE}/legal-team/`, `${BASE}/attorneys/`];
const found = {};
for (const url of pages) {
  let html; try { html = await get(url); console.log("fetched", url); } catch (e) { console.log("skip", url, e.message); continue; }
  // collect profile links so we can fall back to each attorney's own page
  const links = [...html.matchAll(/href="([^"]*(?:legal-team|attorneys)\/[a-z0-9-]+\/?)"/gi)].map(m => abs(m[1], url));
  for (const a of attorneys) {
    if (found[a.key]) continue;
    const others = attorneys.filter(o => o.key !== a.key).map(o => o.last);
    const hit = findHeadshot(html, url, a, others);
    if (hit) { found[a.key] = hit; continue; }
    const prof = links.find(l => l && l.toLowerCase().includes(a.last));
    if (prof) { try { const ph = await get(prof); const pi = findHeadshot(ph, prof, a, others) || imgs(ph, prof).find(i => /attorney|headshot|profile|team|portrait/i.test(i.cls + " " + i.src) && !isJunk(i))?.src; if (pi) found[a.key] = pi; } catch {} }
  }
}
for (const a of attorneys) {
  if (!found[a.key]) { console.log(`  NOT FOUND: ${a.name} — download manually to assets/img/attorneys/${a.key}.jpg`); continue; }
  console.log(`${a.name} → ${found[a.key]}`);
  try { await save(found[a.key], join(ROOT, "assets/img/attorneys", a.key)); } catch (e) { console.log("  failed:", e.message); }
}

/* 2. logo */
try {
  const home = await get(BASE + "/");
  const cand = imgs(home, BASE + "/").find(i => /logo/i.test(i.src + " " + i.alt + " " + i.cls) && !/favicon|icon-|badge|award|partner|chargers/i.test(i.src + " " + i.alt));
  const inlineSvg = !cand && home.match(/<svg\b[^>]*(?:logo)[^>]*>[\s\S]*?<\/svg>/i)?.[0];
  if (cand) { console.log("logo →", cand.src); await save(cand.src, join(ROOT, "assets/img/logo")); }
  else if (inlineSvg) { const dest = join(ROOT, "assets/img/logo.svg"); if (!DRY) writeFileSync(dest, inlineSvg); console.log("  saved inline SVG logo →", dest); }
  else console.log("  logo not detected — save it manually as assets/img/logo.svg or logo.png");
} catch (e) { console.log("homepage fetch failed:", e.message); }

console.log(DRY ? "\nDry run complete." : "\nDone. Now run: node build.mjs  (then commit assets/ and public/)");
