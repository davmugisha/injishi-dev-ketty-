/**
 * "Set up your property", on the API, with the mutations the setup page calls:
 *   - once the fee is paid the owner can build the listing in review, and the API refuses to publish it until
 *     approval (`org_not_active`);
 *   - approval has already created the property from the registration (its name and sector), so setup starts with
 *     the property in place and names exactly what is missing: a priced room type and a photograph;
 *   - the owner fills in the property, adds a priced room type and a photograph, and only then publishes;
 *   - a publish with a missing step is refused by the API in words that name the step;
 *   - once published the property is readable on the public marketplace API, and pressing publish twice is safe.
 */
import { ApiError, apiRequest } from "../../src/server/api";
import {
  addPhoto,
  addRoomType,
  publish,
  readSetup,
  type SetupRead,
  SetupRefusal,
  updateProperty,
} from "../../src/server/mutations/setup";
import type { SourceContext } from "../../src/server/sources/types";
import { approvedBusiness, GASABO, registerBusiness } from "../lib/registration";
import type { Flow } from "./types";

/** The smallest valid PNG: one transparent pixel. */
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const businessWorkspace = (ctx: SourceContext) => {
  const ws = ctx.account?.workspaces.find((w) => w.kind === "business");
  if (!ws) throw new Error("the owner holds no business workspace");
  return ws.workspaceId;
};

/** Expect an ApiError of one of these statuses and return its words. */
async function apiRefusal(statuses: number[], call: () => Promise<unknown>, what: string): Promise<string> {
  try {
    await call();
  } catch (error) {
    if (error instanceof ApiError && statuses.includes(error.status)) return error.message;
    throw new Error(`${what}: expected HTTP ${statuses.join("/")}, got ${String(error)}`);
  }
  throw new Error(`${what}: expected a refusal, but it succeeded`);
}

export const flows: Flow[] = [
  {
    name: "in review the owner can build the listing, but the API refuses to publish it until approval",
    async run({ asEmail, check, step }) {
      const business = await registerBusiness(GASABO, "setup-review");
      const owner = await asEmail(business.email);
      const workspaceId = businessWorkspace(owner);

      let read: SetupRead = await readSetup(owner, workspaceId);
      check(read.open, "setup is closed for a paid business in review");
      if (!read.open) return;
      check(!read.approved, "a business in review reads as approved");
      check(read.status === "tin_verified", `setup reports status ${read.status}, not tin_verified`);
      check(read.businessName === business.legalName, `setup names "${read.businessName}"`);
      check(
        read.blockers[0] === "Publishing opens once your business is approved.",
        `the first blocker is "${read.blockers[0]}"`,
      );
      const created = read.property;
      check(created, "the registration did not create the property");
      if (!created) return;
      step("setup opens in review, and names approval as the first thing publishing waits for");

      await addRoomType(owner, workspaceId, created.id, {
        name: "Garden Room",
        maxGuests: 2,
        basePriceRwf: 40_000,
        roomCount: 2,
      });
      await addPhoto(owner, workspaceId, created.id, new Blob([PNG], { type: "image/png" }), "Front");
      read = await readSetup(owner, workspaceId);
      check(read.open && read.counts.pricedRoomTypes > 0 && read.counts.photos > 0, "the writes did not land");
      step("a priced room type and a photograph are saved while in review");

      const words = await apiRefusal([409], () => publish(owner, workspaceId, created.id), "publishing before approval");
      check(/approved/i.test(words), `the publish refusal does not mention approval: ${words}`);
      step(`publishing is refused: ${words}`);

      let refused = false;
      try {
        await readSetup(owner, "00000000-0000-4000-8000-000000000000");
      } catch (error) {
        refused = error instanceof SetupRefusal;
      }
      check(refused, "a workspace that is not the owner's was read instead of refused");
    },
  },
  {
    name: "an approved owner sets up the property, a priced room type and a photo, then publishes it to the marketplace",
    async run({ asEmail, check, step }) {
      const approved = await approvedBusiness("setup-open");
      const owner = await asEmail(approved.email);
      const workspaceId = businessWorkspace(owner);

      let read: SetupRead = await readSetup(owner, workspaceId);
      check(read.open, "setup is closed for an approved business");
      check(read.businessName === approved.legalName, `setup names "${read.businessName}"`);
      const created = read.property;
      check(created, "approval did not create the property from the registration");
      check(
        created.name === approved.legalName,
        `the property is named "${created.name}", not the registered "${approved.legalName}"`,
      );
      check(created.listingStatus === "draft", `the new property is ${created.listingStatus}, not draft`);
      check(
        created.address.sectorName === "Bumbogo",
        `the property sits in ${String(created.address.sectorName)}, not the registered Bumbogo`,
      );
      check(read.steps.find((s) => s.key === "property")?.done, "the property step is not done");
      check(
        !read.steps.find((s) => s.key === "room_type")?.done && !read.published,
        "a later step is done before anything was set up",
      );
      check(read.blockers.length === 2, `blockers: ${read.blockers.join(" | ")}`);
      step(`approved: setup is open with ${created.name} as a draft; it still needs a room type and a photograph`);

      const screenWords = await (async () => {
        try {
          await updateProperty(owner, workspaceId, created.id, { checkInTime: "2pm" });
        } catch (error) {
          return error instanceof SetupRefusal ? error.message : "";
        }
        return "";
      })();
      check(/14:00/.test(screenWords), `a bad check-in time was not refused in words: "${screenWords}"`);
      await updateProperty(owner, workspaceId, created.id, {
        description: "A quiet guest house near Kimironko market.",
        street: "KG 11 Ave",
        checkInTime: "14:00",
        checkOutTime: "11:00",
      });
      read = await readSetup(owner, workspaceId);
      check(
        read.open && read.property?.description === "A quiet guest house near Kimironko market.",
        "the description was not saved",
      );
      check(
        read.open && read.property?.checkInTime === "14:00:00",
        `check-in is ${read.open ? String(read.property?.checkInTime) : "closed"}`,
      );
      step("description, street and times saved on the draft");

      const early = await apiRefusal(
        [400, 409, 422],
        () => publish(owner, workspaceId, created.id),
        "publishing with nothing to sell",
      );
      check(/room type|photo/i.test(early), `the refusal does not name what is missing: "${early}"`);
      step(`publishing now is refused: ${early}`);

      await addRoomType(owner, workspaceId, created.id, {
        name: "Standard room",
        maxGuests: 2,
        basePriceRwf: 45_000,
        roomCount: 5,
      });
      read = await readSetup(owner, workspaceId);
      check(
        read.open && read.counts.pricedRoomTypes === 1,
        `priced room types: ${read.open ? read.counts.pricedRoomTypes : "closed"}`,
      );
      check(read.open && read.counts.rooms === 5, `rooms: ${read.open ? read.counts.rooms : "closed"}`);
      check(
        read.open && read.blockers.length === 1 && /photo/i.test(read.blockers[0] ?? ""),
        `blockers: ${read.open ? read.blockers.join(" | ") : ""}`,
      );
      step("a priced room type with five rooms; only the photograph is missing");

      const refusedWords = await (async () => {
        try {
          await addPhoto(owner, workspaceId, created.id, new Blob([PNG], { type: "application/pdf" }));
        } catch (error) {
          return error instanceof SetupRefusal ? error.message : "";
        }
        return "";
      })();
      check(/JPEG, PNG or WebP/.test(refusedWords), `a PDF was not refused as a photograph: "${refusedWords}"`);

      await addPhoto(owner, workspaceId, created.id, new Blob([PNG], { type: "image/png" }), "Front of the house");
      read = await readSetup(owner, workspaceId);
      check(read.open && read.counts.photos === 1, `photos: ${read.open ? read.counts.photos : "closed"}`);
      check(read.open && read.blockers.length === 0, `blockers remain: ${read.open ? read.blockers.join(" | ") : ""}`);
      step("a photograph attached; nothing left to fix");

      const published = await publish(owner, workspaceId, created.id);
      check(published.listingStatus === "published", `publish left it ${published.listingStatus}`);
      check(published.slug, "a published property has no public address");
      const again = await publish(owner, workspaceId, created.id);
      check(again.listingStatus === "published", "pressing publish twice un-published it");
      read = await readSetup(owner, workspaceId);
      check(read.open && read.published, "setup does not read the property as published");

      // Signed out, as a guest browsing the marketplace: the by-slug read, and the marketplace listing read.
      const bySlug = await apiRequest<{ id?: string; name?: string; slug?: string }>(
        null,
        `/api/v1/properties/slug/${published.slug}`,
      );
      check(bySlug.id === created.id, `the public by-slug read answered ${JSON.stringify(bySlug).slice(0, 140)}`);
      check(bySlug.name === created.name, `the public page names it "${bySlug.name}", not "${created.name}"`);
      // The list the public website's search and home page draw from (apps/web data/discovery.ts). Not
      // /marketplace/*: that is the operator app's own market screens, which list only curated cards.
      const list = await apiRequest<unknown>(null, "/api/v1/properties");
      check(
        JSON.stringify(list).includes(created.id),
        "the public property list does not include the published property",
      );
      step(`published at ${published.slug}; a signed-out guest finds it in the public list and opens it by slug`);
    },
  },
];
