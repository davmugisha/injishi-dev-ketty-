/**
 * Prints the documents a live source returns for one persona, optionally only those whose naturalKey matches.
 * A debugging aid for parity work:
 *   pnpm --filter @injishi/app exec tsx scripts/print-live.ts frontdesk.reservations frontdesk [BK-XXXX-XXXX]
 */
import type { PersonaId } from "@injishi/data";
import { liveSources } from "../src/server/sources/index";
import { contextFor, fail, main } from "./lib/harness";

void main(async () => {
  const [collection, persona, key] = process.argv.slice(2);
  const source = liveSources[collection ?? ""];
  if (!source) fail(`no live source for "${collection}"`);
  const docs = await source.list(await contextFor((persona || null) as PersonaId | null));
  const field = source.naturalKey ?? "id";
  const picked = key ? docs.filter((d) => String((d as Record<string, unknown>)[field]) === key) : docs;
  console.log(JSON.stringify(picked, null, 2));
  return `PRINTED ${picked.length} of ${docs.length}`;
});
