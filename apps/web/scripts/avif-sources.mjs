/**
 * Serve AVIF (with WebP fallback) for the heavy marketing images.
 *
 * The captures ship the big photos as WebP even though an AVIF twin of the same
 * image already sits in public/assets, 28–36% smaller:
 *
 *     rwanda-lake-kivu           454 KB webp -> 316 KB avif  (-30%)
 *     rwanda-apartment-interior  396 KB webp -> 252 KB avif  (-36%)
 *     rwanda-kigali-hero         315 KB webp -> 226 KB avif  (-28%)
 *
 * We do not swap `src` to .avif (that would break Safari < 16.4). Instead each
 * heavy <img> is backed by a <source type="image/avif">, using the <picture>
 * element the captures already use elsewhere. AVIF-capable browsers take it;
 * everyone else falls back to the untouched <img>/WebP. The <img> keeps its
 * classes, so the captured CSS still matches and layout is unchanged.
 *
 * CRITICAL — all-or-nothing per file: a page references the same photo from many
 * <img> tags. If only some of them get an AVIF source, the browser downloads the
 * AVIF *and* the WebP and the page gets HEAVIER. So this walks the markup
 * structurally:
 *
 *   - <img> already inside a <picture> that has an AVIF source -> left alone.
 *   - <img> inside a <picture> with no AVIF source            -> source injected
 *                                                                into that picture.
 *   - <img> not inside any <picture>                          -> wrapped in one.
 *
 * ...so every reference to a given file resolves to AVIF and the WebP is never
 * fetched. The script verifies this invariant and refuses to write if a file
 * would end up half-converted.
 *
 * `sizes`/`srcSet` are mirrored from the <img> so the AVIF candidate set matches
 * the WebP one. With no srcSet we emit a single full-size AVIF candidate: still
 * a ~30% saving, and it cannot change which resolution the browser picks.
 *
 *   node scripts/avif-sources.mjs --dry   # report only
 *   node scripts/avif-sources.mjs         # apply
 */
import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const MIN_BYTES = 30 * 1024;

const walk = (d, f, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, f, out);
    else if (f(p)) out.push(p);
  }
  return out;
};

const publicPath = (u) => path.join("public", u.replace(/^\//, ""));
const exists = (u) => fs.existsSync(publicPath(u));
const sizeOf = (u) => { try { return fs.statSync(publicPath(u)).size; } catch { return 0; } };

const normalize = (u) => {
  let s = u.replace(/^\.\//, "/");
  return s.startsWith("/") ? s : "/" + s;
};

/** Raster formats we can back with an AVIF <source> (JPEG on /explore too). */
const RASTER = /\.(webp|jpe?g|png)$/i;

/** /assets/x.{webp,jpg,png} -> /assets/x.avif, when the twin exists on disk. */
function avifTwin(url) {
  if (!RASTER.test(url)) return null;
  const a = url.replace(RASTER, ".avif");
  return exists(a) ? a : null;
}

/** Mirror the <img>'s srcSet onto AVIF; null if any candidate lacks a twin. */
function avifSrcSetFrom(srcSet) {
  const out = [];
  for (const part of srcSet.split(",")) {
    const m = part.trim().match(/^(\S+\.(?:webp|jpe?g|png))(\s+\d+w)?$/i);
    if (!m) return null;
    const twin = avifTwin(normalize(m[1]));
    if (!twin) return null;
    out.push(twin + (m[2] || ""));
  }
  return out.length ? out.join(", ") : null;
}

/** The heavy raster <img> inside a chunk of markup, if any. */
function heavyImg(tag) {
  const srcM = tag.match(/\ssrc=\{"([^"]+)"\}/);
  if (!srcM) return null;
  const url = normalize(srcM[1]);
  const avif = avifTwin(url);
  if (!avif) return null;
  if (sizeOf(url) < MIN_BYTES) return null;
  return { url, avif };
}

/**
 * The AVIF candidate set for an <img>, or null when converting would be unsafe.
 *
 * If the <img> carries a responsive srcSet, the AVIF source MUST mirror it
 * candidate-for-candidate. Emitting a single full-size AVIF instead would
 * override the browser's pick and force the big file into a small slot — that
 * makes the page HEAVIER (it did: /collections went 170KB -> 400KB when a 23KB
 * 480w WebP got replaced by a 253KB full-size AVIF). So if any candidate has no
 * AVIF twin, we decline to convert and leave the WebP chain alone.
 *
 * With no srcSet the <img> already downloads the full-size WebP, so a single
 * full-size AVIF is a true like-for-like swap.
 */
function avifSetFor(imgTag) {
  const info = heavyImg(imgTag);
  if (!info) return null;
  const ssM = imgTag.match(/\ssrcSet=\{"([^"]+)"\}/);
  if (ssM) return avifSrcSetFrom(ssM[1]); // null => unsafe, do not convert
  return info.avif;
}

function avifSourceFor(imgTag) {
  const set = avifSetFor(imgTag);
  if (!set) return null;
  const szM = imgTag.match(/\ssizes=\{"([^"]+)"\}/);
  const sizes = szM ? ` sizes={${JSON.stringify(szM[1])}}` : "";
  return `<source type={"image/avif"} srcSet={${JSON.stringify(set)}}${sizes} />`;
}

const PICTURE = /<picture\b[^>]*>[\s\S]*?<\/picture>/g;
const IMG = /<img\b[^>]*?\/>/gs;

const stats = { pages: 0, injected: 0, wrapped: 0, filled: 0, already: 0, reverted: 0, posters: 0 };
const converted = new Map(); // url -> count now served as avif
const leftWebp = new Map();  // url -> count still served as webp

for (const file of walk("src/app", (p) => p.endsWith(".tsx"))) {
  const original = fs.readFileSync(file, "utf8");

  // Split the file into [picture blocks] and [everything else], in order.
  const parts = [];
  let last = 0;
  for (const m of original.matchAll(PICTURE)) {
    if (m.index > last) parts.push({ type: "text", s: original.slice(last, m.index) });
    parts.push({ type: "picture", s: m[0] });
    last = m.index + m[0].length;
  }
  parts.push({ type: "text", s: original.slice(last) });

  const out = parts.map((part) => {
    if (part.type === "picture") {
      const img = (part.s.match(IMG) || [])[0];
      if (!img) return part.s;
      const info = heavyImg(img);
      if (!info) return part.s;

      // Convergent: recompute the AVIF candidate set from the <img> every run,
      // so a previously-written bad srcSet gets repaired rather than preserved.
      const want = avifSetFor(img); // null => unsafe to convert

      // Any existing AVIF <source>, with or without a srcSet. The captures ship
      // plenty WITHOUT one (optimize-assets.mjs strips the dead-CDN srcSet but
      // leaves the empty <source> shell), and an empty source matches nothing —
      // the browser silently falls back to the <img>'s WebP.
      const anyAvifRe = /<source\b[^>]*type=\{"image\/avif"\}[^>]*\/>/;
      const existing = part.s.match(anyAvifRe);

      if (!want) {
        // Cannot mirror the responsive set safely. Ensure we are NOT leaving a
        // single-candidate AVIF behind that would upsize a small slot.
        if (existing && /\bsrcSet=/.test(existing[0])) {
          stats.reverted++;
          return part.s.replace(anyAvifRe, (t) => t.replace(/\s*srcSet=\{"[^"]*"\}/, ""));
        }
        leftWebp.set(info.url, (leftWebp.get(info.url) || 0) + 1);
        return part.s;
      }

      converted.set(info.url, (converted.get(info.url) || 0) + 1);

      if (existing) {
        // The <source> must carry the SAME sizes as the <img>. A source without
        // sizes falls back to 100vw and wins the match anyway, so it would pull
        // the largest candidate no matter what sizes the <img> declares (this is
        // what kept the 54px avatars downloading the 1920w file).
        const imgSizes = (img.match(/\ssizes=\{"([^"]+)"\}/) || [])[1] || null;
        const had = existing[0].match(/\ssrcSet=\{"([^"]+)"\}/);
        const hadSizes = (existing[0].match(/\ssizes=\{"([^"]+)"\}/) || [])[1] || null;
        if (had && had[1] === want && hadSizes === imgSizes) {
          stats.already++;
          return part.s;
        }
        stats.filled++;
        return part.s.replace(anyAvifRe, (tag) => {
          let t = tag
            .replace(/\s*srcSet=\{"[^"]*"\}/, "")
            .replace(/\s*sizes=\{"[^"]*"\}/, "");
          const sizesAttr = imgSizes ? ` sizes={${JSON.stringify(imgSizes)}}` : "";
          return t.replace(/\s*\/>$/, `${sizesAttr} srcSet={${JSON.stringify(want)}} />`);
        });
      }

      stats.injected++;
      return part.s.replace(/^(<picture\b[^>]*>)/, (_m, open) => open + avifSourceFor(img));
    }

    // Bare <img> outside any <picture>: wrap it — but only when the AVIF set can
    // be built safely (same rule as above; never upsize a responsive slot).
    return part.s.replace(IMG, (tag) => {
      const info = heavyImg(tag);
      if (!info) return tag;
      const source = avifSourceFor(tag);
      if (!source) {
        leftWebp.set(info.url, (leftWebp.get(info.url) || 0) + 1);
        return tag;
      }
      stats.wrapped++;
      converted.set(info.url, (converted.get(info.url) || 0) + 1);
      return `<picture>${source}${tag}</picture>`;
    });
  }).join("");

  // Invariant check: after the rewrite, no heavy webp <img> may remain outside
  // an AVIF-backed <picture>, or the browser would fetch both formats.
  const pics = [...out.matchAll(PICTURE)].map((m) => m[0]);
  const inPictures = pics.join("");
  const outside = out.split(PICTURE).join("");
  for (const tag of outside.match(IMG) || []) {
    const info = heavyImg(tag);
    if (info) leftWebp.set(info.url, (leftWebp.get(info.url) || 0) + 1);
  }
  for (const p of pics) {
    const img = (p.match(IMG) || [])[0];
    if (!img) continue;
    const info = heavyImg(img);
    if (!info) continue;
    // Only an AVIF <source> that actually carries a srcSet can be selected.
    const usable = /<source\b[^>]*type=\{"image\/avif"\}[^>]*\bsrcSet=/.test(p) ||
      /<source\b[^>]*\bsrcSet=[^>]*type=\{"image\/avif"\}/.test(p);
    if (!usable) leftWebp.set(info.url, (leftWebp.get(info.url) || 0) + 1);
  }

  // <video poster="...webp"> would still pull the WebP even though the matching
  // <picture> now fetches AVIF — the browser downloads BOTH formats of the same
  // photo (this cost /property a duplicate 315KB rwanda-kigali-hero.webp). Point
  // the poster at the same AVIF the <picture> uses and it becomes a cache hit.
  let out2 = out.replace(/\sposter=\{"([^"]+)"\}/g, (m, url) => {
    const u = normalize(url);
    const twin = avifTwin(u);
    if (!twin || sizeOf(u) < MIN_BYTES) return m;
    stats.posters++;
    return ` poster={${JSON.stringify(twin)}}`;
  });

  if (out2 !== original) {
    stats.pages++;
    if (!DRY) fs.writeFileSync(file, out2, "utf8");
  }
}

console.log((DRY ? "DRY RUN" : "APPLIED") + " — AVIF sources");
console.log("  pages touched             : " + stats.pages);
console.log("  empty AVIF <source> filled: " + stats.filled);
console.log("  AVIF <source> injected    : " + stats.injected);
console.log("  bare <img> wrapped        : " + stats.wrapped);
console.log("  already AVIF-backed       : " + stats.already);
console.log("  <video> posters -> AVIF   : " + stats.posters);

console.log("\n  per-file resolution after rewrite:");
const all = new Set([...converted.keys(), ...leftWebp.keys()]);
let bad = 0;
for (const u of all) {
  const c = converted.get(u) || 0;
  const w = leftWebp.get(u) || 0;
  const flag = w > 0 ? "  <-- STILL HALF-WEBP (would double-fetch)" : "";
  if (w > 0) bad++;
  console.log(
    "    " + u.padEnd(46) + " avif:" + String(c).padStart(2) + "  webp:" + String(w).padStart(2) + flag
  );
}
if (bad) {
  console.log("\n  !! " + bad + " file(s) would be served in BOTH formats — page would get heavier.");
  process.exitCode = 1;
} else {
  console.log("\n  invariant OK: every heavy image resolves to AVIF only.");
}
