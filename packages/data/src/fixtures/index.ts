// Aggregates every area fixture file. Leaves edit only their own area file, never this index.
import type { FixtureSet } from "../types.ts";
import { fixtures as accountingFixtures } from "./accounting.ts";
import { fixtures as adminFixtures } from "./admin.ts";
import { fixtures as commercialFixtures } from "./commercial.ts";
import { fixtures as financeFixtures } from "./finance.ts";
import { fixtures as frontdeskFixtures } from "./frontdesk.ts";
import { fixtures as guestFixtures } from "./guest.ts";
import { fixtures as marketFixtures } from "./market.ts";
import { fixtures as operationsFixtures } from "./operations.ts";
import { fixtures as outletsFixtures } from "./outlets.ts";
import { fixtures as oversightFixtures } from "./oversight.ts";
import { fixtures as ownerFixtures } from "./owner.ts";
import { fixtures as payrollFixtures } from "./payroll.ts";
import { fixtures as peopleFixtures } from "./people.ts";
import { fixtures as platformFixtures } from "./platform.ts";
import { fixtures as platformopsFixtures } from "./platformops.ts";
import { fixtures as publicFixtures } from "./public.ts";
import { fixtures as residenceFixtures } from "./residence.ts";
import { fixtures as residentFixtures } from "./resident.ts";
import { fixtures as sharedFixtures } from "./shared.ts";
import { fixtures as staffFixtures } from "./staff.ts";
import { fixtures as staysFixtures } from "./stays.ts";
import { fixtures as stockFixtures } from "./stock.ts";

export const fixtureSets: Record<string, FixtureSet> = {
  platform: platformFixtures,
  shared: sharedFixtures,
  owner: ownerFixtures,
  commercial: commercialFixtures,
  operations: operationsFixtures,
  frontdesk: frontdeskFixtures,
  stays: staysFixtures,
  finance: financeFixtures,
  accounting: accountingFixtures,
  people: peopleFixtures,
  payroll: payrollFixtures,
  staff: staffFixtures,
  outlets: outletsFixtures,
  stock: stockFixtures,
  residence: residenceFixtures,
  resident: residentFixtures,
  guest: guestFixtures,
  market: marketFixtures,
  public: publicFixtures,
  oversight: oversightFixtures,
  admin: adminFixtures,
  platformops: platformopsFixtures,
};

/** Every collection across all areas, keyed by collection name. */
export function allCollections(): Record<string, FixtureSet[string]> {
  const out: Record<string, FixtureSet[string]> = {};
  for (const [area, set] of Object.entries(fixtureSets)) {
    for (const [name, docs] of Object.entries(set)) {
      if (!name.startsWith(`${area}.`)) throw new Error(`fixture collection "${name}" must start with "${area}."`);
      out[name] = docs;
    }
  }
  return out;
}
