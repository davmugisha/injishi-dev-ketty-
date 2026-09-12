// apps/web/scripts/gen-pwa-icons.mjs
// Generates the PWA icon set from the brand mark (src/app/icon.svg) using sharp.
// "any" icons: brand mark on a white canvas. "maskable": same mark inside a
// ~10% safe-zone so Android's adaptive mask never clips it. Run: pnpm icons
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const svg = path.join(appRoot, "src", "app", "icon.svg");
const iconsDir = path.join(appRoot, "public", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// A square "any" icon: mark centered on white, ~12% padding.
async function anyIcon(size, outFile) {
  const inner = Math.round(size * 0.76);
  const mark = await sharp(svg, { density: 512 })
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(outFile);
}

// A maskable icon: mark inside a ~10% safe zone on white (full-bleed canvas).
async function maskableIcon(size, outFile) {
  const inner = Math.round(size * 0.6); // extra safe zone for the mask
  const mark = await sharp(svg, { density: 512 })
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(outFile);
}

// A favicon.ico for the legacy request browsers make to /favicon.ico before
// they have read any <link>. Transparent, not white, because a white square is
// what a mark on a dark tab bar looks like. PNG-compressed entries, which every
// browser since IE11 reads.
async function faviconIco(outFile) {
  const SIZES = [16, 32, 48];
  const pngs = [];
  for (const size of SIZES) {
    pngs.push(
      await sharp(svg, { density: 512 })
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer(),
    );
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(SIZES.length, 4);

  const dir = Buffer.alloc(16 * SIZES.length);
  let offset = header.length + dir.length;
  SIZES.forEach((size, i) => {
    const at = i * 16;
    dir.writeUInt8(size === 256 ? 0 : size, at + 0); // width
    dir.writeUInt8(size === 256 ? 0 : size, at + 1); // height
    dir.writeUInt8(0, at + 2); // palette size, 0 for truecolour
    dir.writeUInt8(0, at + 3); // reserved
    dir.writeUInt16LE(1, at + 4); // colour planes
    dir.writeUInt16LE(32, at + 6); // bits per pixel
    dir.writeUInt32LE(pngs[i].length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += pngs[i].length;
  });
  fs.writeFileSync(outFile, Buffer.concat([header, dir, ...pngs]));
}

// No src/app/icon.png. `icon.svg` and `icon.png` collide on the same App
// Router `icon` slot and Next serves only one of them — it picked the png, so
// the scalable mark never reached a single <head>. The head set is now
// favicon.ico (legacy raster, 16/32/48), icon.svg (everything modern) and
// apple-icon.png (iOS home screen).
await anyIcon(180, path.join(appRoot, "src", "app", "apple-icon.png"));
await anyIcon(192, path.join(iconsDir, "icon-192.png"));
await anyIcon(512, path.join(iconsDir, "icon-512.png"));
await maskableIcon(512, path.join(iconsDir, "maskable-512.png"));
await faviconIco(path.join(appRoot, "src", "app", "favicon.ico"));

console.log("PWA icons and favicon.ico generated.");
