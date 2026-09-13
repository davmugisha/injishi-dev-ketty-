// Verify the ADR-053 thread end to end: appoint, author, publish, read, suspend.
//
// The tenth verify script, and the second that WRITES. `verify-walk-in.mjs`
// explains why a writing verifier is sometimes the only honest one; the same
// applies here twice over, because the things being proved are a government
// appointment and a listing going live, and neither can be observed without
// making one.
//
// WHAT IT PROVES, in order:
//   A. A super admin appoints a field verifier, and BOTH grant time refusals
//      fire: the opposing gate role in an overlapping scope (a country grant
//      contains a district one), and a person who holds a role in a business
//      inside the region. The same grant OUTSIDE that region is allowed, so the
//      rule is about overlap rather than about ever holding a business.
//   B. The officer's own console reads their body's real name, their own
//      government title and their region IN WORDS, all from the server.
//   C. An operator authors a priced room type with its default rate plan,
//      uploads and attaches a photograph, and publishes.
//   D. Publishing is refused, on a property created clean, once for each of the
//      three conditions, and the refusal NAMES the one that failed.
//   E. Two simultaneous presses produce one publish, one slug and one
//      `published_at`. A colliding name takes a numeric suffix at mint time.
//   F. A signed out visitor opens it. Suspending the business removes it from
//      the public read with NO second write, and reinstating restores it with no
//      republish. Unpublishing keeps the address.
//   G. The grant and the revoke each wrote an `audit_events` row.
//
// WHAT IT LEAVES BEHIND: a room type, some photographs and a second property on
// the seeded business, all named `ADR-053` or "Umurage Guesthouse". It is meant
// for a SAMPLE MARKED database (`pnpm dev:stack:reset` then `pnpm db:seed`), and
// re-running it simply adds another colliding property, which is itself part of
// what it proves.
//
// THE OTP CAP WILL BITE YOU: five codes per address per hour. Sessions are
// therefore cached between runs, in the OS temp directory rather than beside
// this file, because the cache holds live session cookies and a credential does
// not belong in a repository.
//
// Run it with the API on 8000:  node scripts/verify-adr053-thread.mjs
const BASE = process.env.API_BASE || "http://127.0.0.1:8000";

/** Real district ids. Gasabo is where the host's business is; 101 is Nyarugenge. */
const GASABO = 102;
const NYARUGENGE = 101;
/** A sector inside Gasabo, so the derived district stays the business's own. */
const GASABO_SECTOR = 10201;

let pass = 0;
let fail = 0;
const failures = [];

function check(label, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Sessions are CACHED to disk between runs.
 *
 * Not a convenience: the OTP cap is five codes per address per hour, and reaching
 * it locks that address for a full hour — so a handful of reruns while fixing the
 * harness would lock the accounts the harness needs.
 */
const JAR_FILE = join(tmpdir(), "injishi-verify-adr053-sessions.json");

function loadJars() {
  try {
    return existsSync(JAR_FILE) ? JSON.parse(readFileSync(JAR_FILE, "utf8")) : {};
  } catch {
    return {};
  }
}

const JARS = loadJars();

function saveJars() {
  writeFileSync(JAR_FILE, JSON.stringify(JARS, null, 1));
}

/** A tiny cookie jar: Better Auth sets several and they all have to come back. */
function makeSession(seed) {
  const jar = new Map(Object.entries(seed ?? {}));
  return {
    cookie: () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb(res) {
      const raw = res.headers.getSetCookie?.() ?? [];
      for (const line of raw) {
        const [pair] = line.split(";");
        const idx = pair.indexOf("=");
        if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    },
    snapshot: () => Object.fromEntries(jar),
  };
}

async function call(session, method, path, body, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (session) headers.cookie = session.cookie();
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (session) session.absorb(res);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

/** Better Auth refuses a request with no Origin; web's own origin is the real one. */
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";

async function signIn(email) {
  // A cached session first. `/me/profile` is the cheapest authenticated read
  // that answers 401 rather than 404 when the cookie is dead.
  const cached = JARS[email];
  if (cached) {
    const reused = makeSession(cached);
    const probe = await call(reused, "GET", "/api/v1/me/profile");
    if (probe.status === 200) {
      console.log(`  (reusing cached session for ${email})`);
      return reused;
    }
  }

  const session = makeSession();
  const origin = { origin: WEB_ORIGIN };
  await call(
    session,
    "POST",
    "/api/auth/email-otp/send-verification-otp",
    { email, type: "sign-in" },
    origin,
  );
  const res = await call(
    session,
    "POST",
    "/api/auth/sign-in/email-otp",
    { email, otp: "123456" },
    origin,
  );
  if (res.status !== 200) {
    throw new Error(`sign-in failed for ${email}: ${res.status} ${res.text.slice(0, 200)}`);
  }
  JARS[email] = session.snapshot();
  saveJars();
  return session;
}

const main = async () => {
  console.log("\n=== A. Appoint an officer (AC-G1, AC-G2, AC-G3, AC-G10) ===");
  const admin = await signIn("admin@injishi.com");

  const dir = await call(
    admin,
    "GET",
    "/api/v1/admin/users?pageSize=100&reason=ADR-053%20slice%201%20verification",
  );
  check("admin directory reads", dir.status === 200, `status ${dir.status}`);
  const people = dir.json?.items ?? [];
  const byEmail = new Map(people.map((u) => [u.email, u]));
  const guest = byEmail.get("guest@injishi.com");
  const host = byEmail.get("host@injishi.com");
  const localgov = byEmail.get("localgov@injishi.com");
  check(
    "found guest, host and localgov in the directory",
    Boolean(guest && host && localgov),
    `saw ${people.length} users`,
  );
  if (!guest || !host || !localgov) return;

  // Clean slate. A previous run's grant would make the conflict cases pass or
  // fail for the wrong reason, and leaving one behind pollutes a shared database.
  for (const person of [guest, host]) {
    if (person.oversight) {
      await call(
        admin,
        "DELETE",
        `/api/v1/admin/users/${person.id}/oversight/${person.oversight.id}?reason=${encodeURIComponent("ADR-053 rerun cleanup")}`,
      );
    }
  }

  const granted = await call(admin, "POST", `/api/v1/admin/users/${guest.id}/oversight`, {
    oversightRole: "business_field_verifier",
    governmentBodyCode: "PSF",
    governmentTitle: "Business Registration Officer",
    scopeLevel: "district",
    districtId: GASABO,
    reason: "ADR-053 slice 1 verification",
  });
  check(
    "AC-G1 grant a field verifier at PSF, Gasabo",
    granted.status === 201,
    `status ${granted.status} ${granted.text.slice(0, 200)}`,
  );
  check(
    "AC-G1 the grant carries the body NAME, the title and the region",
    granted.json?.governmentBodyName === "Private Sector Federation" &&
      granted.json?.governmentTitle === "Business Registration Officer" &&
      typeof granted.json?.scopeLabel === "string" &&
      granted.json.scopeLabel.length > 0,
    JSON.stringify(granted.json),
  );

  // AC-G2: localgov@ already holds business_field_verifier in district 101.
  // A country-scoped approver grant contains Gasabo, so it must be refused.
  const overlap = await call(admin, "POST", `/api/v1/admin/users/${localgov.id}/oversight`, {
    oversightRole: "business_approver",
    governmentBodyCode: "MINALOC",
    governmentTitle: "BDO",
    scopeLevel: "country",
    reason: "ADR-053 slice 1 verification",
  });
  check(
    "AC-G2 opposing role at COUNTRY scope over an existing district grant is refused",
    overlap.status === 409 &&
      overlap.json?.code === "oversight_scope_conflict",
    `status ${overlap.status} ${overlap.text.slice(0, 240)}`,
  );

  // AC-G3: host@ owns Umurage Hospitality Ltd, which sits in GASABO. An oversight
  // grant over Gasabo is therefore a conflict of interest and must be refused.
  const orgConflict = await call(admin, "POST", `/api/v1/admin/users/${host.id}/oversight`, {
    oversightRole: "business_field_verifier",
    governmentBodyCode: "PSF",
    governmentTitle: "Officer",
    scopeLevel: "district",
    districtId: GASABO,
    reason: "ADR-053 slice 1 verification",
  });
  check(
    "AC-G3 a grant to somebody holding an org role in that region is refused",
    orgConflict.status === 409 &&
      orgConflict.json?.code === "oversight_org_role_conflict",
    `status ${orgConflict.status} ${orgConflict.text.slice(0, 240)}`,
  );

  // The same person, OUTSIDE their business's district, is allowed. The rule is
  // about overlap, not about ever holding a business.
  const farAway = await call(admin, "POST", `/api/v1/admin/users/${host.id}/oversight`, {
    oversightRole: "business_field_verifier",
    governmentBodyCode: "PSF",
    governmentTitle: "Officer",
    scopeLevel: "district",
    districtId: NYARUGENGE,
    reason: "ADR-053 slice 1 verification",
  });
  check(
    "AC-G3 the same grant OUTSIDE that region is allowed",
    farAway.status === 201,
    `status ${farAway.status} ${farAway.text.slice(0, 200)}`,
  );
  if (farAway.status === 201) {
    await call(
      admin,
      "DELETE",
      `/api/v1/admin/users/${host.id}/oversight/${farAway.json.id}?reason=${encodeURIComponent("ADR-053 cleanup")}`,
    );
  }

  const retired = await call(admin, "POST", `/api/v1/admin/users/${guest.id}/oversight`, {
    oversightRole: "business_approver",
    governmentBodyCode: "NOT_A_REAL_BODY",
    governmentTitle: "Officer",
    scopeLevel: "country",
    reason: "ADR-053 slice 1 verification",
  });
  check(
    "a grant naming an unknown government body is refused",
    retired.status === 400,
    `status ${retired.status}`,
  );

  console.log("\n=== B. The officer sees their own posting (AC-G5) ===");
  const guestSession = await signIn("guest@injishi.com");
  const mine = await call(guestSession, "GET", "/api/v1/me/oversight");
  check("me/oversight reads", mine.status === 200, `status ${mine.status}`);
  const seat = mine.json?.consoles?.[0];
  check(
    "AC-G5 body name, own title and region all come from the server",
    seat?.bodyName === "Private Sector Federation" &&
      seat?.title === "Business Registration Officer" &&
      seat?.scopeLabel?.length > 0 &&
      seat?.console === "verification",
    JSON.stringify(seat),
  );

  console.log("\n=== C. Author inventory and publish (AC-I1 to AC-I6, AC-I10) ===");
  const hostSession = await signIn("host@injishi.com");
  const ws = await call(hostSession, "GET", "/api/v1/me/workspaces");
  const business = (ws.json?.workspaces ?? []).find(
    (w) => w.kind === "business" && w.permissions?.includes("listing.manage"),
  );
  check("host holds a business workspace with listing.manage", Boolean(business));
  if (!business) return;
  const wsId = business.workspaceId;
  const H = { "x-workspace-id": wsId };

  const props = await call(
    hostSession,
    "GET",
    // The header alone names the workspace since task 18 dropped the query
    // parameter the route used to validate and discard.
    `/api/v1/inventory/properties`,
    undefined,
    H,
  );
  const property = props.json?.properties?.[0];
  check("host has a property", Boolean(property), JSON.stringify(props.json).slice(0, 200));
  if (!property) return;
  const pid = property.id;

  // The seeded property has NO sector, and publishing requires one (AC-I4). Set
  // a sector inside Gasabo so the derived district stays the business's own.
  const sector = await call(
    hostSession,
    "PATCH",
    `/api/v1/inventory/properties/${pid}`,
    { workspaceId: wsId, sectorId: GASABO_SECTOR },
    H,
  );
  check("give the property a sector", sector.status === 200, `status ${sector.status} ${sector.text.slice(0, 200)}`);

  const roomType = await call(
    hostSession,
    "POST",
    `/api/v1/inventory/properties/${pid}/room-types`,
    {
      workspaceId: wsId,
      name: `ADR-053 Verified Double ${Date.now()}`,
      maxGuests: 2,
      basePriceRwf: 75000,
      bookingMode: "instant_book",
    },
    H,
  );
  check(
    "AC-I1 create a room type",
    roomType.status === 201 || roomType.status === 200,
    `status ${roomType.status} ${roomType.text.slice(0, 240)}`,
  );
  check(
    "AC-I1/AC-I2 it was written with a DEFAULT rate plan and the price",
    roomType.json?.defaultRatePlanId != null && roomType.json?.basePriceRwf === 75000,
    JSON.stringify(roomType.json),
  );
  const rtId = roomType.json?.id;

  const plan = await call(
    hostSession,
    "POST",
    `/api/v1/inventory/room-types/${rtId}/rate-plans`,
    {
      workspaceId: wsId,
      name: "Non-refundable",
      basePriceRwf: 67500,
      nonRefundable: true,
      isDefault: true,
    },
    H,
  );
  check("AC-I2 create a second rate plan as the default", plan.status === 201, `status ${plan.status} ${plan.text.slice(0, 200)}`);
  check("AC-I2 the new plan is the default", plan.json?.isDefault === true, JSON.stringify(plan.json));

  const after = await call(
    hostSession,
    "GET",
    `/api/v1/inventory/properties/${pid}/room-types`,
    undefined,
    H,
  );
  const mineRt = (after.json?.roomTypes ?? []).find((r) => r.id === rtId);
  check(
    "AC-I2 exactly one default survived the move",
    mineRt?.defaultRatePlanId === plan.json?.id,
    `expected ${plan.json?.id}, saw ${mineRt?.defaultRatePlanId}`,
  );

  console.log("\n--- publish refusals before a photograph exists (AC-I4) ---");
  // The seeded property may already carry photographs from an earlier run, so
  // this asks only that publishing ANSWERS one of the two legitimate ways:
  // refused naming a condition, or published. AC-I4 itself is proven above on a
  // property created clean.
  const refusedNoPhoto = await call(
    hostSession,
    "POST",
    `/api/v1/inventory/properties/${pid}/publish`,
    undefined,
    H,
  );
  check(
    "the seeded property either publishes or is refused naming a condition",
    refusedNoPhoto.status === 200 ||
      (refusedNoPhoto.status === 409 &&
        Array.isArray(refusedNoPhoto.json?.blockers) &&
        refusedNoPhoto.json.blockers.length > 0),
    `status ${refusedNoPhoto.status} ${refusedNoPhoto.text.slice(0, 200)}`,
  );

  /*
   * THE REFUSALS NEED A CLEAN PROPERTY.
   *
   * The seeded one accumulates room types and photographs across runs, so the
   * "no photograph" refusal cannot be provoked on it a second time. A fresh
   * property is empty by construction, and publishing it also collides its slug
   * with the one above, which is the collision case AC-I5 asks for.
   */
  console.log("\n--- the refusals, on a property created clean (AC-I4, AC-I5) ---");
  const freshProp = await call(
    hostSession,
    "POST",
    "/api/v1/inventory/properties",
    {
      workspaceId: wsId,
      name: "Umurage Guesthouse",
      sectorId: GASABO_SECTOR,
    },
    H,
  );
  check("create a second property with a COLLIDING name", freshProp.status === 201, `status ${freshProp.status} ${freshProp.text.slice(0, 200)}`);
  const fid = freshProp.json?.id;

  if (fid) {
    const noRoomType = await call(hostSession, "POST", `/api/v1/inventory/properties/${fid}/publish`, undefined, H);
    check(
      "AC-I4 refused with no room type, naming it",
      noRoomType.status === 409 && /room type/i.test(String(noRoomType.json?.message)),
      `status ${noRoomType.status} ${noRoomType.text.slice(0, 200)}`,
    );

    const unpriced = await call(
      hostSession,
      "POST",
      `/api/v1/inventory/properties/${fid}/room-types`,
      { workspaceId: wsId, name: "Unpriced Room", maxGuests: 2, basePriceRwf: null },
      H,
    );
    check("create a room type with NO price", unpriced.status === 201, `status ${unpriced.status} ${unpriced.text.slice(0, 160)}`);
    const noPrice = await call(hostSession, "POST", `/api/v1/inventory/properties/${fid}/publish`, undefined, H);
    check(
      "AC-I4 refused when nothing is priced, naming it",
      noPrice.status === 409 && /price/i.test(String(noPrice.json?.message)),
      `status ${noPrice.status} ${noPrice.text.slice(0, 200)}`,
    );

    const priced = await call(
      hostSession,
      "PATCH",
      `/api/v1/inventory/room-types/${unpriced.json?.id}`,
      { workspaceId: wsId, basePriceRwf: 50000 },
      H,
    );
    check("price it", priced.status === 200, `status ${priced.status}`);
    const noPhoto = await call(hostSession, "POST", `/api/v1/inventory/properties/${fid}/publish`, undefined, H);
    check(
      "AC-I4 refused with no photograph, NAMING the photograph",
      noPhoto.status === 409 && /photograph/i.test(String(noPhoto.json?.message)),
      `status ${noPhoto.status} ${noPhoto.text.slice(0, 200)}`,
    );
    check(
      "AC-I4 and the refusal carries the blocker code no_photo",
      Array.isArray(noPhoto.json?.blockers) && noPhoto.json.blockers.includes("no_photo"),
      noPhoto.text.slice(0, 200),
    );
  }

  console.log("\n--- upload and attach a photograph (AC-I3) ---");
  // A 1x1 PNG. Real bytes, because the storage adapter writes them.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  );
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "verify.png");
  const upload = await call(hostSession, "POST", "/api/v1/uploads/property-photo", form);
  check(
    "AC-I3 upload a property photograph",
    upload.status === 201 || upload.status === 200,
    `status ${upload.status} ${upload.text.slice(0, 240)}`,
  );
  check(
    "AC-I3 the upload comes back as kind property_photo with a signed url",
    upload.json?.kind === "property_photo" && typeof upload.json?.url === "string",
    JSON.stringify(upload.json).slice(0, 200),
  );

  const attached = await call(
    hostSession,
    "POST",
    `/api/v1/inventory/properties/${pid}/photos`,
    { workspaceId: wsId, objectKey: upload.json?.objectKey, caption: "Front elevation" },
    H,
  );
  check("AC-I3 attach it to the property", attached.status === 201, `status ${attached.status} ${attached.text.slice(0, 240)}`);
  const photos = attached.json?.photos ?? [];
  check(
    "AC-I3 the FIRST photograph becomes the cover, at position 0",
    photos.length >= 1 && photos.some((p) => p.isCover && p.position === 0),
    JSON.stringify(photos).slice(0, 300),
  );

  const badKey = await call(
    hostSession,
    "POST",
    `/api/v1/inventory/properties/${pid}/photos`,
    { workspaceId: wsId, objectKey: "certificate/not-a-photo.pdf" },
    H,
  );
  check(
    "a key that is not a property photograph is refused",
    badKey.status === 400,
    `status ${badKey.status}`,
  );

  console.log("\n--- publish (AC-I5, AC-I10) ---");
  const [first, second] = await Promise.all([
    call(hostSession, "POST", `/api/v1/inventory/properties/${pid}/publish`, undefined, H),
    call(hostSession, "POST", `/api/v1/inventory/properties/${pid}/publish`, undefined, H),
  ]);
  check(
    "AC-I10 two simultaneous presses both succeed",
    first.status === 200 && second.status === 200,
    `${first.status} / ${second.status}`,
  );
  check(
    "AC-I10 and produce ONE slug and one published_at",
    first.json?.slug && first.json.slug === second.json?.slug &&
      first.json?.publishedAt === second.json?.publishedAt,
    `${first.json?.slug} / ${second.json?.slug}`,
  );
  const slug = first.json?.slug;
  check("AC-I5 the slug is minted from the property name", typeof slug === "string" && slug.length > 0, String(slug));
  check("AC-I5 the listing is published", first.json?.listingStatus === "published", String(first.json?.listingStatus));

  if (fid) {
    const form2 = new FormData();
    form2.append("file", new Blob([png], { type: "image/png" }), "verify2.png");
    const up2 = await call(hostSession, "POST", "/api/v1/uploads/property-photo", form2);
    await call(
      hostSession,
      "POST",
      `/api/v1/inventory/properties/${fid}/photos`,
      { workspaceId: wsId, objectKey: up2.json?.objectKey },
      H,
    );
    const pub2 = await call(hostSession, "POST", `/api/v1/inventory/properties/${fid}/publish`, undefined, H);
    check("publish the colliding property", pub2.status === 200, `status ${pub2.status} ${pub2.text.slice(0, 200)}`);
    check(
      "AC-I5 a slug collision is resolved with a numeric suffix at mint time",
      typeof pub2.json?.slug === "string" &&
        pub2.json.slug !== slug &&
        pub2.json.slug.startsWith("umurage-guesthouse-"),
      `first "${slug}", second "${pub2.json?.slug}"`,
    );
    const bothOpen = await call(null, "GET", `/api/v1/properties/slug/${pub2.json?.slug}`);
    check("AC-I5 and both properties open at their own address", bothOpen.status === 200, `status ${bothOpen.status}`);
  }

  console.log("\n=== D. The public read (AC-I8) ===");
  const anonRead = await call(null, "GET", `/api/v1/properties/slug/${slug}`);
  check("AC-I8 a signed-out visitor can open the published property", anonRead.status === 200, `status ${anonRead.status}`);
  check(
    "AC-I8 and it carries the photograph that was attached",
    (anonRead.json?.photos ?? []).length >= 1,
    JSON.stringify(anonRead.json?.photos),
  );

  console.log("\n--- suspension takes effect with NO second write (AC-I8) ---");
  const orgId = business.orgId ?? property.orgId;
  const suspend = await call(
    admin,
    "POST",
    `/api/v1/admin/orgs/${orgId}/suspend`,
    { reason: "ADR-053 slice 1 verification" },
  );
  if (suspend.status !== 200 && suspend.status !== 201) {
    check(`suspend the business (status ${suspend.status})`, false, suspend.text.slice(0, 240));
  } else {
    check("suspend the business", true);
    const gone = await call(null, "GET", `/api/v1/properties/slug/${slug}`);
    check(
      "AC-I8 the property disappears from the public read on suspension alone",
      gone.status === 404,
      `status ${gone.status}`,
    );
    const reinstate = await call(
      admin,
      "POST",
      `/api/v1/admin/orgs/${orgId}/reinstate`,
      { reason: "ADR-053 slice 1 verification" },
    );
    check("reinstate the business", reinstate.status === 200 || reinstate.status === 201, `status ${reinstate.status}`);
    const back = await call(null, "GET", `/api/v1/properties/slug/${slug}`);
    check(
      "AC-I8 and comes back with NO republish",
      back.status === 200,
      `status ${back.status}`,
    );
  }

  console.log("\n=== E. Unpublish keeps the address (AC-I6), invariants (AC-I7) ===");
  const lastPhoto = (await call(hostSession, "GET", `/api/v1/inventory/properties/${pid}/photos`, undefined, H)).json?.photos ?? [];
  if (lastPhoto.length === 1) {
    const refusedDelete = await call(
      hostSession,
      "DELETE",
      `/api/v1/inventory/properties/${pid}/photos/${lastPhoto[0].id}`,
      undefined,
      H,
    );
    check(
      "AC-I7 removing the last photograph of a PUBLISHED property is refused",
      refusedDelete.status === 409,
      `status ${refusedDelete.status} ${refusedDelete.text.slice(0, 200)}`,
    );
  } else {
    console.log(`  note  property has ${lastPhoto.length} photographs, skipping the last-photo refusal`);
  }

  const unpub = await call(hostSession, "POST", `/api/v1/inventory/properties/${pid}/unpublish`, undefined, H);
  check("AC-I6 unpublish returns the listing to draft", unpub.status === 200 && unpub.json?.listingStatus === "draft", `status ${unpub.status} ${unpub.json?.listingStatus}`);
  check("AC-I6 and KEEPS the slug", unpub.json?.slug === slug, `${unpub.json?.slug} vs ${slug}`);
  const goneAgain = await call(null, "GET", `/api/v1/properties/slug/${slug}`);
  check("an unpublished property is not publicly readable", goneAgain.status === 404, `status ${goneAgain.status}`);

  const republished = await call(hostSession, "POST", `/api/v1/inventory/properties/${pid}/publish`, undefined, H);
  check("AC-I6 a republish returns the SAME public address", republished.json?.slug === slug, `${republished.json?.slug} vs ${slug}`);

  console.log("\n=== F. The officer may not gate their own business (AC-G3, act time) ===");
  const revoked = await call(
    admin,
    "DELETE",
    `/api/v1/admin/users/${guest.id}/oversight/${granted.json?.id}?reason=${encodeURIComponent("ADR-053 slice 1 verification")}`,
  );
  check("AC-G1 revoke the appointment", revoked.status === 204, `status ${revoked.status} ${revoked.text.slice(0, 200)}`);
  const afterRevoke = await call(guestSession, "GET", "/api/v1/me/oversight");
  check(
    "a revoked grant is simply absent",
    (afterRevoke.json?.consoles ?? []).length === 0,
    JSON.stringify(afterRevoke.json?.consoles),
  );

  console.log("\n=== G. The audit trail (AC-G10) ===");
  const audit = await call(
    admin,
    "GET",
    "/api/v1/admin/audit?reason=ADR-053%20slice%201%20verification",
  );
  const events = audit.json?.items ?? [];
  const kinds = new Set(events.map((e) => e.eventType));
  check(
    "AC-G10 the grant and the revoke each wrote an audit_events row",
    kinds.has("admin.user.oversight_granted") && kinds.has("admin.user.oversight_revoked"),
    `audit status ${audit.status}, saw ${[...kinds].slice(0, 8).join(", ")}`,
  );
};

main()
  .then(() => {
    console.log(`\n==================== ${pass} passed, ${fail} failed ====================`);
    if (failures.length) console.log("Failed:\n - " + failures.join("\n - "));
    process.exit(fail === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error("\nHARNESS ERROR:", error.message);
    process.exit(2);
  });
