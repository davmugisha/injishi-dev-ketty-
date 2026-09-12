/**
 * Source freely-licensed Rwandan photography from Wikimedia Commons.
 *
 * Commons is used rather than an OTA because hotel photography on Booking.com
 * or SafariBookings belongs to the properties and to those platforms. Every
 * file here carries the licence and author Commons publishes for it, taken
 * from the API's extmetadata rather than inferred, and written into the
 * manifest beside the download.
 *
 * Results are appended, and anything already in the manifest is skipped, so
 * this can be re-run to fill gaps without refetching what is already on disk.
 * Pass --force to refetch what the manifest already records: the repo ships the
 * manifest without the originals, so restoring them needs it.
 *
 *   node scripts/source-commons-images.mjs [group] [--force]
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Carried from the donor tree by ADR-015 build step 3. Its paths are rewritten
 * for this home: `scripts/` sits inside `apps/web`, so ROOT is the app rather
 * than a monorepo root, the manifest is `scripts/photo-manifest.json`, and the
 * originals land in `scripts/sourced/` — OUTSIDE `public/`, so a refresh cannot
 * push the committed tree over the `pnpm assets:check` ceiling.
 */
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "scripts/sourced");
const MANIFEST = path.join(ROOT, "scripts/photo-manifest.json");

/**
 * `--force` re-downloads the originals this manifest already records.
 *
 * Without it the skip rule below means a full manifest plus an empty
 * `sourced/` downloads NOTHING — which is exactly the state the repo is in,
 * because ADR-015 call 3 dropped the 89.2 MB of originals and kept the 16 KB
 * manifest. So restoring the originals from the manifest needs this flag; the
 * skip rule alone would report success and fetch nothing.
 */
const FORCE = process.argv.includes("--force");
const API = "https://commons.wikimedia.org/w/api.php";
const UA = "injishi-dev/0.1 (accommodation platform; contact via repo)";

/** Licences we will ship. Anything else is recorded as a gap and skipped. */
const OK_LICENCE = /^(cc0|cc[ -]?by([ -]?sa)?([ -]?\d(\.\d)?)?|public domain|pd|no restrictions)/i;
const MIN_WIDTH = 1200;

/** search term -> [stem prefix, group, subject, how many to keep] */
const QUERIES = [
  ["Volcanoes National Park Rwanda", "volcanoes-np", "destination", "Volcanoes National Park", 3],
  ["Virunga Mountains Rwanda", "virunga-range", "destination", "The Virunga volcanoes", 2],
  ["Mountain gorilla Volcanoes National Park", "mountain-gorilla", "destination", "Mountain gorillas, Volcanoes National Park", 2],
  ["Musanze Rwanda", "musanze", "destination", "Musanze", 2],
  ["Akagera National Park", "akagera-np", "destination", "Akagera National Park", 3],
  ["Nyungwe Forest National Park", "nyungwe-forest", "destination", "Nyungwe Forest National Park", 3],
  ["Lake Kivu Rwanda", "lake-kivu", "destination", "Lake Kivu", 3],
  ["Gisenyi Rubavu Rwanda", "gisenyi", "destination", "Gisenyi, Rubavu", 2],
  ["Karongi Kibuye Rwanda", "karongi", "destination", "Karongi (Kibuye)", 2],
  ["Kigali Convention Centre", "kigali-convention-centre", "property", "Kigali Convention Centre — the Radisson Blu site", 2],
  ["Hotel des Mille Collines", "mille-collines", "property", "Hôtel des Mille Collines", 2],
  ["Tea plantation Rwanda", "rwanda-tea", "interior", "Tea plantations, southern Rwanda", 2],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch with backoff.
 *
 * Commons rate-limits hard and answers 429 rather than queueing, so a tight
 * loop gets nothing at all. Honour Retry-After when it is sent and back off
 * exponentially when it is not.
 */
async function polite(url, attempt = 0) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 429 || res.status === 503) {
    if (attempt >= 5) throw new Error(`${res.status} after ${attempt} retries`);
    const after = Number(res.headers.get("retry-after"));
    const wait = Number.isFinite(after) && after > 0 ? after * 1000 : 2000 * 2 ** attempt;
    console.log(`    rate limited, waiting ${Math.round(wait / 1000)}s`);
    await sleep(wait);
    return polite(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", ...params })}`;
  const res = await polite(url);
  return res.json();
}

async function search(term, limit) {
  const data = await api({
    action: "query", list: "search", srsearch: term,
    srnamespace: "6", srlimit: String(limit),
  });
  return (data.query?.search ?? []).map((hit) => hit.title);
}

async function details(titles) {
  if (titles.length === 0) return [];
  const data = await api({
    action: "query", titles: titles.join("|"),
    prop: "imageinfo", iiprop: "url|size|extmetadata",
  });
  return Object.values(data.query?.pages ?? {})
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info) return null;
      const meta = info.extmetadata ?? {};
      const strip = (v) => (v?.value ?? "").replace(/<[^>]*>/g, "").trim();
      return {
        title: page.title,
        url: info.url,
        descriptionUrl: info.descriptionurl,
        width: info.width,
        height: info.height,
        licence: strip(meta.LicenseShortName) || strip(meta.UsageTerms),
        author: strip(meta.Artist) || "Unknown",
        credit: strip(meta.Credit),
      };
    })
    .filter(Boolean);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const manifest = existsSync(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, "utf8"))
    : [];
  const entries = Array.isArray(manifest) ? manifest : (manifest.images ?? []);
  const have = FORCE
    ? new Set()
    : new Set(entries.map((e) => e.source_url).filter(Boolean));

  const gaps = [];
  let added = 0;

  for (const [term, prefix, group, subject, want] of QUERIES) {
    console.log(subject);
    await sleep(1200);
    const titles = await search(term, want * 6);
    const candidates = (await details(titles))
      .filter((c) => c.width >= MIN_WIDTH)
      .filter((c) => /\.(jpe?g|png)$/i.test(c.title))
      .filter((c) => OK_LICENCE.test(c.licence))
      .filter((c) => !have.has(c.descriptionUrl));

    if (candidates.length === 0) {
      gaps.push(`${subject} — no free-licensed file over ${MIN_WIDTH}px`);
      console.log(`  ${subject}: nothing usable`);
      continue;
    }

    let n = 0;
    for (const c of candidates) {
      if (n >= want) break;
      const stem = `${prefix}-${String(n + 1).padStart(2, "0")}`;
      // With --force the manifest already holds this row; do not double it.
      if (FORCE && entries.some((e) => e.file.startsWith(`${stem}.`))) {
        entries.splice(
          entries.findIndex((e) => e.file.startsWith(`${stem}.`)),
          1,
        );
      }
      const ext = /\.png$/i.test(c.title) ? "png" : "jpg";
      const file = `${stem}.${ext}`;
      try {
        const res = await polite(c.url);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 40_000) continue;
        writeFileSync(path.join(OUT, file), buf);
        const needsAttribution = /^cc[ -]?by/i.test(c.licence);
        entries.push({
          file, group, subject,
          depicts_actual_property: group === "property",
          source_url: c.descriptionUrl,
          source_site: "commons.wikimedia.org",
          author: c.author,
          licence: c.licence,
          licence_url: c.descriptionUrl,
          attribution_required: needsAttribution,
          attribution_string: needsAttribution
            ? `${c.author}, ${c.licence}, via Wikimedia Commons`
            : null,
          width: c.width, height: c.height,
        });
        have.add(c.descriptionUrl);
        added++; n++;
        console.log(`  ${file}  ${c.width}x${c.height}  ${c.licence}`);
        await sleep(1500);
      } catch (err) {
        console.log(`  skip ${c.title}: ${err.message}`);
      }
    }
    if (n < want) gaps.push(`${subject} — wanted ${want}, got ${n}`);
  }

  writeFileSync(MANIFEST, JSON.stringify(entries, null, 2) + "\n");
  console.log(`\n${added} added, ${entries.length} in manifest.`);
  if (gaps.length) console.log(`\nGaps:\n${gaps.map((g) => `  - ${g}`).join("\n")}`);
}

await main();
