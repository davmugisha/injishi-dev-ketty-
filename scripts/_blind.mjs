import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
const SP = process.argv[2];
const BLIND = `${SP}/blind`;
mkdirSync(BLIND, { recursive: true });

// Crop the top band off every image: that is where the logo and account chrome
// live, and the comparison is meant to be about the listing, not the brand.
const CROP_TOP = 96;
async function place(src, dest, maxH) {
  const img = sharp(src);
  const { width, height } = await img.metadata();
  const h = Math.min(height - CROP_TOP, maxH);
  await sharp(src)
    .extract({ left: 0, top: CROP_TOP, width, height: h })
    .png()
    .toFile(`${BLIND}/${dest}`);
  return `${dest}  (${width}x${h})`;
}

const ours = `${SP}/ours`, ref = `${SP}/ref/booking`;
// Assignment is mixed so the order carries no signal.
const key = {
  "grid-A.png": "OURS /explore",
  "grid-B.png": "BOOKING.COM Kigali results",
  "listing-A.png": "BOOKING.COM Marriott",
  "listing-B.png": "OURS Kigali Serena",
};
console.log(await place(`${ours}/explore-fold.png`, "grid-A.png", 1400));
console.log(await place(`${ref}/kigali-results-1440-fold.png`, "grid-B.png", 1400));
console.log(await place(`${ref}/property-marriott-1440-fold.png`, "listing-A.png", 1400));
console.log(await place(`${ours}/property-serena-fold.png`, "listing-B.png", 1400));
writeFileSync(`${SP}/blind-key-r2.json`, JSON.stringify(key, null, 2));
console.log("\nkey written (not in blind/)");
