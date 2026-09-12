/**
 * import-photos.mjs — brings the credited photography into the mobile app.
 *
 * Run by hand, output committed:
 *
 *   node scripts/import-photos.mjs           # write assets/photos + the two data files
 *   node scripts/import-photos.mjs --check   # fail if either data file is stale
 *
 * ## Why this reads `sourced/` and not `stay-NN`
 *
 * Session 0's prompt asked for the 23 `apps/web/public/assets/stay-01…23.jpg`
 * tiles, and said to derive each tile's credit row from the encoded files —
 * "if you cannot establish it for a given tile, do not ship that tile."
 *
 * It cannot be established, for any of the 23, because it does not exist. The
 * tiles are not derived from the sourced originals at all:
 *
 *   - They carry no row in `public/assets/sourced/MANIFEST.json` (25 entries,
 *     none of them a `stay-NN`) and none in the generated
 *     `src/data/generated/photo-credits.ts` (25 rows, zero matches on `stay-`).
 *   - No script in the repo emits them. `scripts/` has no `stay-` reference
 *     outside one comment in `gen-avif-twins.mjs` noting that `/explore` ships
 *     them as plain JPEG.
 *   - A 16×16 luminance-grid comparison of each tile against every sourced
 *     original, centre-cropped to the tiles' own 860×530, produced no match:
 *     every best distance landed between 0.71 and 1.32 in normalised units,
 *     with no separation from the second- and third-best candidates. A real
 *     re-encode of the same photograph scores an order of magnitude lower.
 *   - Decoding two of them settles it. `stay-01` is a North American suburban
 *     house at dusk and `stay-12` a yellow Mediterranean doorway. Neither is
 *     Rwandan, and the sourced set is entirely Rwandan.
 *
 * So the 23 tiles are an unattributed international stock set inherited from
 * the donor site. ADR-015 call 5 requires a photograph that does not depict the
 * property it illustrates to carry a VISIBLE credit where it appears — and a
 * credit needs an author, a licence and a source. None of the 23 has one.
 * Shipping them would mean shipping 23 photographs whose licence the project
 * cannot state, which is the exact failure the prompt's own last line forbids.
 *
 * This script therefore imports the 25 photographs that DO carry a full licence
 * chain: the `sourced/` originals, each with a manifest row naming the file,
 * subject, author, licence, licence URL, source URL, attribution string and the
 * `depicts_actual_property` flag. 22 of the 25 are stand-ins and carry the
 * visible credit; 3 depict their property and do not.
 *
 * The `stay-NN` tiles are left where they are. Removing them from `apps/web` is
 * a decision for the web app's owner, not for a mobile session, but the finding
 * is in Session 0's report so it reaches one.
 *
 * ## What it does
 *
 * Re-encodes each original to a phone-sized JPEG (1080px on the long edge,
 * quality 78, metadata stripped) and samples its average colour, which
 * `expo-image` renders as the placeholder while the file decodes. The average
 * is DATA — it is derived from the photograph and cannot come from the palette
 * — so it is the one hex in `src/data/` and it lives nowhere near a component.
 *
 * ## sharp
 *
 * `sharp` is not a dependency of this app and must not become one — Session 0's
 * prompt names six packages and says "Nothing else". It is already installed in
 * `apps/web`, which is where the encoding pipeline for these same photographs
 * lives, so this script borrows that copy. It is a build-time importer run by
 * hand, exactly like `tools/sync-vendor.mjs` living in `injishi.managed`; the
 * app itself never loads it.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');
const WEB = resolve(APP, '../web');
const SOURCED = join(WEB, 'public/assets/sourced');
const OUT_DIR = join(APP, 'assets/photos');

const require = createRequire(join(WEB, 'package.json'));
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error(
    'import-photos: sharp not found in apps/web/node_modules.\n' +
      'Run `pnpm install` at the repo root first. This script is a hand-run\n' +
      'importer and deliberately does not add sharp to apps/mobile.',
  );
  process.exit(1);
}

/** Long edge in px. 393pt at 3x is 1179; 1080 covers a full-bleed hero. */
const LONG_EDGE = 1080;
const QUALITY = 78;

const check = process.argv.includes('--check');

const manifest = JSON.parse(readFileSync(join(SOURCED, 'MANIFEST.json'), 'utf8'));

/** `kigali-skyline-01.jpg` -> `kigali-skyline-01`. */
const stemOf = (file) => file.replace(/\.[a-z0-9]+$/i, '');

/**
 * A quoted single-line TypeScript string literal.
 *
 * The whitespace collapse is not cosmetic. Wikimedia's derivative-work
 * attribution carries a real newline — `nyungwe-forest-02`'s author is
 * "Nyungwe_Foprest_panorama.jpg: Guswen⏎derivative work: Jjtkk" — and a raw
 * newline inside a single-quoted literal is a syntax error, which is how this
 * was found. Collapsing to one space keeps the attribution accurate (it is one
 * credit line either way) and keeps it renderable in a one-line chip. Quotes
 * and backslashes are escaped rather than collapsed, because those are content.
 */
function q(s) {
  const flat = String(s).replace(/\s+/g, ' ').trim();
  return `'${flat.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

async function encodeAll() {
  mkdirSync(OUT_DIR, { recursive: true });
  const rows = [];

  for (const entry of manifest) {
    const src = join(SOURCED, entry.file);
    if (!existsSync(src)) {
      console.error(`import-photos: ${entry.file} is in the manifest but not on disk. Skipped.`);
      continue;
    }
    const stem = stemOf(entry.file);
    const outFile = join(OUT_DIR, `${stem}.jpg`);

    const pipeline = sharp(src)
      .rotate()
      .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: 'inside', withoutEnlargement: true });

    if (!check) await pipeline.clone().jpeg({ quality: QUALITY, mozjpeg: true }).toFile(outFile);

    const meta = await sharp(src).metadata();
    // The average colour, sampled from the same pipeline the file goes through
    // so the placeholder matches what finally decodes.
    const { data } = await sharp(src).resize(1, 1, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const hex = `#${[...data].map((b) => b.toString(16).padStart(2, '0')).join('')}`.toUpperCase();

    const width = Math.min(LONG_EDGE, meta.width ?? LONG_EDGE);
    const scale = width / (meta.width ?? width);

    rows.push({
      stem,
      subject: entry.subject,
      author: entry.author,
      licence: entry.licence,
      licenceUrl: entry.licence_url,
      sourceUrl: entry.source_url,
      attribution: entry.attribution_string,
      attributionRequired: !!entry.attribution_required,
      depictsActualProperty: !!entry.depicts_actual_property,
      group: entry.group,
      placeholder: hex,
      width,
      height: Math.round((meta.height ?? width) * scale),
    });
  }
  return rows;
}

function creditsFile(rows) {
  const body = rows
    .map(
      (r) => `  {
    stem: ${q(r.stem)},
    subject: ${q(r.subject)},
    author: ${q(r.author)},
    licence: ${q(r.licence)},
    licenceUrl: ${q(r.licenceUrl)},
    sourceUrl: ${q(r.sourceUrl)},
    attribution: ${q(r.attribution)},
    attributionRequired: ${r.attributionRequired},
    depictsActualProperty: ${r.depictsActualProperty},
  },`,
    )
    .join('\n');

  const standIns = rows.filter((r) => !r.depictsActualProperty).length;

  return `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Written by \`scripts/import-photos.mjs\` from
 * \`apps/web/public/assets/sourced/MANIFEST.json\`, which is the licence chain's
 * source of truth. To change a credit, change the manifest and re-run.
 *
 * **Every photograph this app ships has a row here, and nothing ships without
 * one.** That is not a convention, it is the import rule: the script walks the
 * manifest, not the asset folder, so a file with no licence row is never copied
 * in and therefore cannot reach a screen.
 *
 * ${standIns} of the ${rows.length} do not show the property they illustrate. They are
 * Rwandan landscape and city photography standing in for stock the project does
 * not hold, and [ADR-015](../../../../injishi.context/dox/adrs) call 5 requires
 * each of them to carry a **visible** credit where it appears — on the screen,
 * not only on a credits page. \`PhotoCredit\` in \`src/components\` is what draws
 * it, and \`depictsActualProperty\` is the flag that decides whether it must.
 *
 * The 23 \`stay-NN\` tiles in \`apps/web/public/assets\` are deliberately NOT here.
 * They carry no manifest row, no generated credit row, and no script that emits
 * them; a perceptual comparison against every sourced original found no match,
 * and decoding them shows non-Rwandan stock photography. Their licence cannot
 * be stated, so they are not imported. The reasoning is in the script header.
 */

export interface PhotoCredit {
  /** The file stem, and the key into \`PHOTOS\`. */
  stem: string;
  subject: string;
  author: string;
  licence: string;
  licenceUrl: string;
  sourceUrl: string;
  /** The full sentence the licence asks to travel with the work. */
  attribution: string;
  attributionRequired: boolean;
  /**
   * Whether this photograph shows the property it illustrates.
   *
   * False means it is a stand-in, and a stand-in owes a visible credit
   * wherever it is drawn — a card that shows one without saying so implies the
   * guest is looking at the place they would book.
   */
  depictsActualProperty: boolean;
}

export const PHOTO_CREDITS: PhotoCredit[] = [
${body}
];

const BY_STEM = new Map(PHOTO_CREDITS.map((c) => [c.stem, c]));

export function creditFor(stem: string): PhotoCredit | undefined {
  return BY_STEM.get(stem);
}

/** Whether this photograph owes a visible credit where it is drawn. */
export function needsVisibleCredit(stem: string): boolean {
  const credit = BY_STEM.get(stem);
  return credit ? !credit.depictsActualProperty : false;
}
`;
}

function photosFile(rows) {
  const entries = rows
    .map(
      (r) => `  ${q(r.stem)}: {
    source: require('../../assets/photos/${r.stem}.jpg'),
    placeholder: ${q(r.placeholder)},
    width: ${r.width},
    height: ${r.height},
  },`,
    )
    .join('\n');

  return `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Written by \`scripts/import-photos.mjs\`. Every entry has a licence row in
 * \`./photo-credits\`, because the script walks the manifest rather than the
 * folder — see that file's header.
 *
 * \`placeholder\` is the photograph's own average colour, sampled at import.
 * \`expo-image\` paints it while the file decodes, so a card fills with the
 * picture's own tone instead of flashing grey. **It is the one hex in \`src/\`
 * that is not a palette key, and it is not a design decision** — it is derived
 * from the photograph and could not come from the palette if it tried. No
 * screen or component may write one; they read it from here.
 */
import type { ImageSourcePropType } from 'react-native';

export interface PhotoAsset {
  source: ImageSourcePropType;
  /** The photograph's average colour. Data, not a token. */
  placeholder: string;
  width: number;
  height: number;
}

export const PHOTOS: Record<string, PhotoAsset> = {
${entries}
};

export type PhotoStem = keyof typeof PHOTOS;

export const PHOTO_STEMS = Object.keys(PHOTOS);

export function photo(stem: string): PhotoAsset | undefined {
  return PHOTOS[stem];
}
`;
}

const rows = await encodeAll();
rows.sort((a, b) => a.stem.localeCompare(b.stem));

const targets = [
  [join(APP, 'src/data/photo-credits.ts'), creditsFile(rows)],
  [join(APP, 'src/data/photos.ts'), photosFile(rows)],
];

if (check) {
  const stale = targets.filter(([path, text]) => !existsSync(path) || readFileSync(path, 'utf8') !== text);
  if (stale.length) {
    console.error('import-photos --check: stale, re-run `node scripts/import-photos.mjs`:');
    for (const [path] of stale) console.error(`  ${path}`);
    process.exit(1);
  }
  console.log(`import-photos --check: ${rows.length} photographs, both files current.`);
} else {
  // Anything in the folder without a manifest row is a photograph whose licence
  // this app cannot state. Remove it rather than leave it to be picked up.
  const keep = new Set(rows.map((r) => `${r.stem}.jpg`));
  for (const file of existsSync(OUT_DIR) ? readdirSync(OUT_DIR) : []) {
    if (!keep.has(file)) {
      rmSync(join(OUT_DIR, file));
      console.log(`  removed ${file} — no licence row`);
    }
  }
  for (const [path, text] of targets) writeFileSync(path, text);
  const standIns = rows.filter((r) => !r.depictsActualProperty).length;
  console.log(
    `import-photos: ${rows.length} photographs, ${standIns} stand-ins owing a visible credit.`,
  );
}
