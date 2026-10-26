// Every area's live sources, keyed by collection name. Leaves edit only their own area file, never this index.

import { sources as accounting } from "./accounting";
import { sources as admin } from "./admin";
import { sources as commercial } from "./commercial";
import { sources as finance } from "./finance";
import { sources as frontdesk } from "./frontdesk";
import { sources as guest } from "./guest";
import { sources as market } from "./market";
import { sources as operations } from "./operations";
import { sources as outlets } from "./outlets";
import { sources as oversight } from "./oversight";
import { sources as owner } from "./owner";
import { sources as payroll } from "./payroll";
import { sources as people } from "./people";
import { sources as platform } from "./platform";
import { sources as platformops } from "./platformops";
import { sources as publicArea } from "./public";
import { sources as residence } from "./residence";
import { sources as resident } from "./resident";
import { sources as shared } from "./shared";
import { sources as staff } from "./staff";
import { sources as stays } from "./stays";
import { sources as stock } from "./stock";
import type { LiveSource } from "./types";

const areas = {
  platform,
  shared,
  owner,
  commercial,
  operations,
  frontdesk,
  stays,
  finance,
  accounting,
  people,
  payroll,
  staff,
  outlets,
  stock,
  residence,
  resident,
  guest,
  market,
  public: publicArea,
  oversight,
  admin,
  platformops,
};

/** Collection name → live source. A collection absent here is served by the fixture store as sample data. */
export const liveSources: Record<string, LiveSource> = {};
for (const [area, set] of Object.entries(areas)) {
  for (const [name, source] of Object.entries(set as Record<string, LiveSource>)) {
    if (!name.startsWith(`${area}.`)) throw new Error(`live source "${name}" must be declared in sources/${area}.ts`);
    liveSources[name] = source;
  }
}

export function isLive(collection: string): boolean {
  return collection in liveSources;
}
