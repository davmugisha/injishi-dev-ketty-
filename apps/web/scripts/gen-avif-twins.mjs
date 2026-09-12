/**
 * Generate AVIF twins for the heavy raster images the pages actually reference.
 *
 * /explore ships ~1.5 MB of plain JPEG (stay-*.jpg) with no modern-format twin
 * at all, so avif-sources.mjs has nothing to point a <source> at. This creates
 * `<name>.avif` next to any referenced .jpg/.jpeg/.png/.webp above the size
 * floor, at the same pixel dimensions (no resizing — resolution selection is the
 * job of srcSet, not this script).
 *
 * Skips images whose AVIF comes out no smaller than the original: shipping a
 * bigger "optimised" file would be worse than doing nothing.
 *
 *   node scripts/gen-avif-twins.mjs --dry
 *   node scripts/gen-avif-twins.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const MIN_BYTES = 30 * 1024;
const QUALITY = 55;

const walk = (d, f, out = []) => {
  if (!fs.existsSync(d)) return out;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, f, out);
    else if (f(p)) out.push(p);
  }
  return out;
};

// Every raster URL referenced from the generated pages.
const REF = /["'{(]((?:\.\/|\/)?(?:assets|media|shared)\/[^"')\s]+?\.(?:jpe?g|png|webp))["')}\s]/gi;
const referenced = new Set();
for (const f of walk("src/app", (p) => p.endsWith(".tsx"))) {
  const txt = fs.readFileSync(f, "utf8");
  for (const m of txt.matchAll(REF)) {
    let u = m[1].replace(/^\.\//, "/");
    if (!u.startsWith("/")) u = "/" + u;
    referenced.add(u);
  }
}

const publicPath = (u) => path.join("public", u.replace(/^\//, ""));
const targets = [...referenced].filter((u) => {
  const p = publicPath(u);
  if (!fs.existsSync(p)) return false;
  if (fs.statSync(p).size < MIN_BYTES) return false;
  const avif = u.replace(/\.(jpe?g|png|webp)$/i, ".avif");
  return !fs.existsSync(publicPath(avif));
});

console.log((DRY ? "DRY RUN" : "GENERATING") + " — AVIF twins for " + targets.length + " referenced images\n");

let origTotal = 0, avifTotal = 0, made = 0, skipped = 0;
for (const u of targets.sort()) {
  const src = publicPath(u);
  const outUrl = u.replace(/\.(jpe?g|png|webp)$/i, ".avif");
  const out = publicPath(outUrl);
  const origSize = fs.statSync(src).size;

  const buf = await sharp(src).avif({ quality: QUALITY, effort: 4 }).toBuffer();

  if (buf.length >= origSize) {
    skipped++;
    console.log(
      "  skip  " + u.padEnd(42) + Math.round(origSize / 1024) + "KB -> " +
        Math.round(buf.length / 1024) + "KB (not smaller)"
    );
    continue;
  }

  origTotal += origSize;
  avifTotal += buf.length;
  made++;
  if (!DRY) fs.writeFileSync(out, buf);
  console.log(
    "  ok    " + u.padEnd(42) + Math.round(origSize / 1024) + "KB -> " +
      Math.round(buf.length / 1024) + "KB  (-" + Math.round((1 - buf.length / origSize) * 100) + "%)"
  );
}

console.log("\n  generated : " + made + (skipped ? "   skipped (no gain): " + skipped : ""));
if (origTotal) {
  console.log(
    "  original  : " + (origTotal / 1048576).toFixed(2) + " MB\n" +
    "  avif      : " + (avifTotal / 1048576).toFixed(2) + " MB\n" +
    "  saving    : " + ((origTotal - avifTotal) / 1048576).toFixed(2) + " MB (-" +
      Math.round((1 - avifTotal / origTotal) * 100) + "%) once the <source>s point at them"
  );
}
