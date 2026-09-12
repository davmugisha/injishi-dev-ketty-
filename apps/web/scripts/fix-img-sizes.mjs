/**
 * Give fixed-size <img> slots a `sizes` attribute.
 *
 * An <img> with a srcSet but no `sizes` defaults to `sizes="100vw"`, so the
 * browser assumes the image fills the viewport and picks the LARGEST candidate.
 * The captures lost `sizes` on several tags, and the result is absurd: the 54x54
 * reviewer avatars on /property and /property-2 each declare
 *
 *     srcSet="...-480.webp 480w, ...-960.webp 960w, ....webp 1920w"   (no sizes)
 *
 * so the browser downloads the 1920w rwanda-kigali-hero (315 KB webp / 227 KB
 * avif) to paint a 54-pixel circle — and on those pages that photo is used
 * *only* as the avatar, so the full-size file is pure waste.
 *
 * For tags that declare an explicit pixel width and render at a fixed size
 * (<= MAX_FIXED px), we set `sizes` to that width so the browser picks the
 * smallest sufficient candidate. Fluid images (w-full heroes, cards) are left
 * alone: their rendered width is not knowable from the markup, and a wrong
 * `sizes` there could under-fetch and look blurry.
 *
 *   node scripts/fix-img-sizes.mjs --dry
 *   node scripts/fix-img-sizes.mjs
 */
import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const MAX_FIXED = 200;

const walk = (d, f, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, f, out);
    else if (f(p)) out.push(p);
  }
  return out;
};

const IMG = /<img\b[^>]*?\/>/gs;

/** Fixed-size only: a Tailwind size-[Npx] / w-[Npx] / size-N class, no w-full. */
function isFixedSize(tag, width) {
  const cls = (tag.match(/className=\{"([^"]*)"\}/) || [])[1] || "";
  if (/\bw-full\b|\bh-full\b|\bw-screen\b/.test(cls)) return false;
  if (new RegExp(`size-\\[${width}px\\]|w-\\[${width}px\\]`).test(cls)) return true;
  // rounded avatars / small square thumbs with an explicit width attr
  return /\brounded-full\b/.test(cls) && width <= MAX_FIXED;
}

let changed = 0, pages = 0;
const log = [];

for (const file of walk("src/app", (p) => p.endsWith(".tsx"))) {
  const original = fs.readFileSync(file, "utf8");
  const page = file.replace(/\\/g, "/").replace("src/app/", "").replace("/page.tsx", "");

  const out = original.replace(IMG, (tag) => {
    if (!/\ssrcSet=\{/.test(tag)) return tag;   // nothing to select between
    if (/\ssizes=\{/.test(tag)) return tag;     // already declared
    const wM = tag.match(/\swidth=\{"(\d+)"\}/);
    if (!wM) return tag;
    const width = parseInt(wM[1], 10);
    if (width > MAX_FIXED) return tag;
    if (!isFixedSize(tag, width)) return tag;

    changed++;
    log.push("    " + page.padEnd(20) + width + "px  " +
      ((tag.match(/\ssrc=\{"([^"]+)"\}/) || [])[1] || "").split("/").pop());
    // Insert sizes right before srcSet so the attribute order reads naturally.
    return tag.replace(/(\ssrcSet=)/, ` sizes={${JSON.stringify(width + "px")}}$1`);
  });

  if (out !== original) {
    pages++;
    if (!DRY) fs.writeFileSync(file, out, "utf8");
  }
}

console.log((DRY ? "DRY RUN" : "APPLIED") + " — sizes on fixed-size slots");
console.log("  tags given `sizes` : " + changed + "   (pages: " + pages + ")");
if (log.length) {
  console.log("\n  fixed slots that were downloading the full-size image:");
  console.log(log.join("\n"));
  console.log("\n  Re-run `node scripts/avif-sources.mjs` so the AVIF <source>s mirror the new sizes.");
}
