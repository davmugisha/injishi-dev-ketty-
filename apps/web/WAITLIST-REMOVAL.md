# Removing waitlist mode

Launch day is a pull request that deletes this feature. There is no flag, no
environment variable and nothing to switch, which is deliberate: a gate with a
flag is a gate that can be left on, left off, or set differently on two
replicas. The cost of that choice is this file. If it is wrong, launch day goes
wrong, so keep it true as you change anything below.

Decision: [ADR-048](../../injishi.context/dox/adrs/048-waitlist-mode/index.md).

**Read this before you start.** There are three lists, not one. The third is the
one that matters: two of the files this feature added must be EDITED rather than
deleted, and one migration must never be touched at all. Deleting from the third
list is how launch day starts with no search presence and a database nobody can
rebuild.

---

## 1. Delete whole

Every path below exists only for the waitlist. Remove the file or the folder.

### `apps/web`

| Path | What it is |
|---|---|
| `src/app/(marketplace)/(gate)/` | the whole route group: the layout, the page, the unsubscribe page and its panel. (The typed OG image route that used to sit here was deleted on 2026-09-13 when `og.jpg` landed; nothing is left of it) |
| `src/components/waitlist/` | the header, the footer, the form, the bands and the image slot |
| `src/data/waitlist.ts` | the API client |
| `src/data/waitlist-content.ts` | every string on the page |
| `src/lib/waitlist-gate.ts` | the host and path matchers the gate reads |
| `tests/waitlist-gate.test.mjs` | the tests over those matchers and over the doors the waitlist header offers |
| `public/waitlist/` | the hero, the OG card, the two band images, the six district tiles and `ASSETS.md`, which records where each one came from |
| `WAITLIST-REMOVAL.md` | this file |

### `server/api`

| Path | What it is |
|---|---|
| `src/api/public/waitlist/` | the controller, the service, the throttler guard, the welcome mailer, its processor and the job contract |
| `src/api/admin/waitlist/` | the three staff-guarded routes and their service |
| `src/shared/pre-launch/` | `pre-launch.guard.ts`, its host list and its spec |
| `src/database/drizzle/waitlist.ts` | the Drizzle table (see list 3 about the MIGRATION, which is different) |

### `packages/contracts`

| Path | What it is |
|---|---|
| `src/waitlist.ts` | the signup contract, the three enums, their labels, and the admin shapes |
| `tests/waitlist.test.mjs` | the tests pinning that contract |
| `dist/waitlist.js`, `dist/waitlist.js.map`, `dist/waitlist.d.ts`, `dist/waitlist.d.ts.map` | the compiled copy of that contract. Delete these BY HAND: `dist/` is committed, and rebuilding the package after removing the source rewrites `dist/index.*` but never deletes a stale output file, so these four would ship on forever |

### `apps/admin`

| Path | What it is |
|---|---|
| `src/app/waitlist/` | the console section, its URL filters and paging, and its table |
| `src/lib/api/waitlist.ts` | the reader |
| `src/lib/api/geography.ts` | the district list the section's filter offers. Keep it if anything outside `src/app/waitlist/` imports `listDistricts` by then |
| `src/lib/actions/waitlist.ts` | the mark-invited action |

---

## 2. Edit, naming the lines

These files are not ours. Each carries a named change that must come back out.

| File | What to do |
|---|---|
| `apps/web/src/middleware.ts` | Delete the `@/lib/waitlist-gate` import and `toWaitlist`. (`GATED_HOSTS`, `normalizeHost`, `isGatedHost`, `WAITLIST_OPEN_PREFIXES` and `isWaitlistOpen` live in that deleted file, not here.) In `middleware()`, delete the `gated` line and restore the original body: `if (!isProtected(pathname)) return pass();` then the `isAuthPath` check, then the cookie check calling `bounce(request, "anonymous")`, then the single `verifySessionCookie` with `bounce(request, verdict)`. `bounce` itself is original and stays. |
| `apps/web/src/app/sw.ts` | `skipWaiting: true` goes back to `skipWaiting: false`, and the comment block above it comes out. The original comment was `// wait; Task 8 surfaces a soft "reload" prompt`. |
| `apps/web/src/data/geography.ts` | `fetchDistricts(provinceId?: number)` was `fetchDistricts(provinceId: number)`. **Safe to leave as it is**: the endpoint's filter is genuinely optional and the wider signature breaks no caller. Reverting is optional tidying, not removal. |
| `packages/contracts/src/index.ts` | Remove the `export * from "./waitlist";` line. |
| `server/api/src/api/public/public-api.module.ts` | Remove the `WaitlistModule` import and its entry in `imports`. |
| `server/api/src/api/admin/admin-api.module.ts` | Remove the `WaitlistAdminModule` import and its entry in `imports`. |
| `server/api/src/api/public/properties/properties.controller.ts` | Remove the `PreLaunchGuard` import, the `UseGuards` import if nothing else uses it, and the `@UseGuards(PreLaunchGuard)` line plus its comment block from **both** controllers, `PropertiesController` and `BookableController`. These are the three endpoints the guard covers: `GET /properties/:id`, `GET /properties/slug/:slug`, `GET /bookable/:roomTypeId`. |
| `server/api/src/database/drizzle/schema.ts` | Remove the `export * from './waitlist';` line. |
| `server/api/src/database/drizzle/enums.ts` | Remove `waitlistAudienceEnum`, `waitlistPropertyTypeEnum` and `waitlistSizeBandEnum`, with the `§11 WAITLIST` header above them. |
| `server/api/src/shared/queues/queues.module.ts` | Remove `waitlistEmail` and its comment from `QUEUES`. |
| `apps/admin/src/lib/nav.ts` | Remove the `waitlist` item and the `ClipboardList` import. |
| `apps/admin/src/lib/types.ts` | Remove `"waitlist"` from `NavKey`. |
| `apps/web/scripts/photo-manifest.json` | Remove the nine entries whose `"group"` is `"waitlist"` (nine, not ten: `og.jpg` is a crop of the hero and shares its entry). Then re-run `node scripts/generate-photo-credits.mjs`, which rewrites `src/data/generated/photo-credits.ts` and takes the nine rows off `/legal/photo-credits`. Never edit the generated file by hand. |
| `apps/web/src/components/layout/theme-pill.tsx` | The `tone` prop and its `page` entry in `TONES` were added so the waitlist header could carry the pill on a light ground (copy.md §8). The footer's `band` tone is the original and the default. **Safe to leave as it is**: the prop is optional and no marketplace caller passes it. Reverting is optional tidying, not removal. |

---

## 3. Never delete, and why

**`server/api/src/database/drizzle/migrations/0033_waitlist_signups.sql`, its
snapshot, and its `meta/_journal.json` entry.**

Deleting a Drizzle migration drops no table and destroys no data. All it does is
desync the journal, so anybody rebuilding the database from scratch gets a
history that no longer matches the one every existing database actually ran.
Removing the table, if it is ever wanted, is a FORWARD migration that drops
`waitlist_signups` and the three enum types. It is not urgent and it is not part
of launch: one small table nothing joins to, holding contact details people gave
you on purpose, is not in anybody's way.

If you do write that forward migration, deal with the rows first. They are
personal data under Law 058/2021 and the people in them agreed to be emailed
when Injishi opened. Export or migrate them before dropping anything.

**`apps/web/src/app/robots.ts` and `apps/web/src/app/sitemap.ts`.**

REPLACE THE CONTENTS, DO NOT DELETE THE FILES. Both are net new to this app, and
"no robots.ts" is not a neutral state: it is the state `apps/web` was already in
while a half-built marketplace sat on a resolving domain, and it is the reason
they were written. Deleting them starts launch day with no search directives and
no sitemap at all.

- `robots.ts` currently allows `/waitlist` and disallows everything else. At
  launch that inverts: allow the marketplace, and keep `/waitlist/unsubscribe/`
  disallowed for as long as any unsubscribe link is still live in somebody's
  inbox.
- `sitemap.ts` currently lists `/waitlist` alone. At launch it should list the
  real routes, and the property half already exists: `GET
  /api/v1/properties/sitemap` (ADR-053, AC-I9) returns every publicly sellable
  property's slug and last publish, through the same visibility rule as the
  page. The launch sitemap reads it with `cache: "no-store"` (a revalidated
  sitemap would keep advertising a suspended business) and falls back to the
  site root alone when the API cannot be reached. That version was written and
  verified before the gate landed; `git log -- apps/web/src/app/sitemap.ts`
  finds it.
- `apps/web/tests/waitlist-search-directives.test.mjs` pins the waitlist rules
  in both files, so it fails the moment their contents change. Rewrite its
  expectations to the launch rules in the same change, and rename it; do not
  delete it, or the files that outlive the waitlist lose their only test.

**The stock images, until real photography replaces them.**

`copy.md` §11 is explicit that the ten files are stand-ins, that they are the
weakest part of the page, and that they are the first thing to replace. If
launch arrives before that happens, the images go with the page and nothing is
owed. If any of them has been reused anywhere outside `(gate)/`, it stops being
this feature's to delete — check before removing `public/waitlist/`.

---

## 4. Things this feature found and did not fix

Not removal steps. They outlive the waitlist and are enrolled elsewhere, and
they are listed here because this is the file somebody actually opens on launch
day.

- **`support-throttler.guard.ts` keys its client bucket on `req.ip` while
  Fastify runs without `trustProxy`.** Behind Traefik that makes the public
  support form's "10 per client per hour" a global cap: ten messages an hour
  from anyone at all exhausts it for everybody. Live today. The waitlist routed
  around it by keying on the leftmost `X-Forwarded-For` entry, which fixes one
  endpoint and leaves the cause. Scope feature 29.
- **`PreLaunchGuard` covers three endpoints, named one by one.** Any new
  unauthenticated public read added to the API before launch needs adding to it
  by hand, and nothing mechanical will remind you. This file is the only place
  that is written down.
- **ADR-048 says there is no audit log table to write to. That is not true.**
  `audit_events` exists in `server/api/src/database/drizzle/governance.ts` and
  six services already write to it. What is actually missing is a `waitlist`
  value in the `audit_subject_type` enum. So the CSV export and the mark-invited
  action write structured log lines, per AC-22, where they could have written
  audit rows for the price of one migration. Scope feature 30 is enrolled on the
  same wrong premise and should be re-read before it is designed.
