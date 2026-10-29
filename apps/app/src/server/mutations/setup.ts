/**
 * Setting up a property, from the moment the registration fee is paid, through the API's inventory routes
 * (`/api/v1/inventory/*`, `listing.manage`). Plain functions: the server actions behind the setup page and the
 * verify flows both call them.
 *
 * Whether the business may do any of this is the API's call and nobody else's: a business in review holds
 * `listing.manage` and nothing else (`canSetUpDuringReview`), so it can build its listing while the documents are
 * read, and the API refuses its publish until it is `active` (`org_not_active`). Before payment, or once rejected
 * or suspended, it holds nothing and every write below is refused with the registration gate's own words.
 * This file adds no second gate. It only (a) reads where the setup stands, (b) refuses a request that must not
 * even be sent, and (c) lets the page ask the question first, so an unapproved business is shown a plain
 * explanation instead of forms that would be refused.
 */
import {
  isFoodVenue,
  isSetupStepDone,
  type PropertySetupCounts,
  type RoomPriceBasis,
  type SetupStep as KindStep,
  type SetupVocabulary,
  setupKindLabel,
  setupStepsFor,
  setupVocabularyFor,
  tidyPlaceName,
} from "@injishi/contracts";
import type { Workspace } from "../auth";
import type { SourceContext } from "../sources/types";

/** A request the screen can word for the owner, refused before it reaches the API. */
export class SetupRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SetupRefusal";
  }
}

// ── API shapes (as server/api answers; the app does not depend on @injishi/contracts) ─────────────

/** One entry of GET /api/v1/inventory/properties (OperatorPropertySummary), the fields read here. */
interface ApiPropertySummary {
  id: string;
  name: string;
  slug: string | null;
  listingStatus: string;
  publishedAt: string | null;
  address: {
    sectorId?: number | null;
    sectorName?: string | null;
    districtName?: string | null;
    cellId?: number | null;
    cellName?: string | null;
    villageId?: number | null;
    villageName?: string | null;
    street?: string | null;
  } & Record<string, unknown>;
  roomTypeCount: number;
}

/** GET /api/v1/inventory/properties/:id (OperatorProperty), the fields read here. */
export interface ApiProperty extends ApiPropertySummary {
  description: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  houseRules?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  photos: { id: string; objectKey: string; position: number; isCover: boolean; caption: string | null; url: string }[];
  roomTypes: {
    id: string;
    name: string;
    status: "active" | "archived";
    basePriceRwf: number | null;
    priceBasis?: RoomPriceBasis;
    sellableRoomCount: number;
  }[];
}

/** GET /api/v1/inventory/setup (PropertySetupProgress): counts the checklist is judged against. */
export interface ApiSetupProgress {
  orgId: string;
  legalName: string;
  domain: string;
  accommodationClass: string | null;
  accommodationClassOther: string | null;
  entityGroup: string | null;
  businessKind?: string | null;
  propertyId: string | null;
  propertyName: string | null;
  counts: {
    properties: number;
    roomTypes: number;
    pricedRoomTypes: number;
    rooms: number;
    photos: number;
    published: number;
  } & Record<string, number>;
}

/** The kind facts `setupStepsFor` and friends read, from the setup counts' answer. */
function kindOf(progress: ApiSetupProgress) {
  return {
    domain: progress.domain as "hospitality" | "residence",
    accommodationClass: progress.accommodationClass,
    accommodationClassOther: progress.accommodationClassOther ?? null,
    entityGroup: progress.entityGroup ?? null,
    businessKind: progress.businessKind ?? null,
  };
}

export interface Place {
  id: number;
  name: string;
}

// ── Reading where setup stands ─────────────────────────────────────────────────────────────────────

/** The four things a listing needs before the API lets it publish, in the order a person does them. */
export type StepKey = "property" | "room_type" | "photo" | "publish";

export interface SetupStep {
  key: StepKey;
  title: string;
  done: boolean;
}

export type SetupRead =
  | {
      /** Unpaid, sent back, suspended or unclaimed: setup is closed, and the owner is told where it stands. */
      open: false;
      workspaceId: string;
      businessName: string;
      status: string | null;
    }
  | {
      open: true;
      workspaceId: string;
      businessName: string;
      /** The registration status; anything but `active` means the business is still in review. */
      status: string | null;
      /** Approved and active: the only state in which Publish is allowed. */
      approved: boolean;
      domain: string;
      accommodationClass: string | null;
      accommodationClassOther: string | null;
      entityGroup: string | null;
      /** Coffee shop / bar: setup speaks venue, not hotel rooms. */
      foodVenue: boolean;
      /** "hotel", "villa", "coffee shop": the kind, for the page's words. */
      kindLabel: string;
      /** The words this kind uses, and how its prices are counted. */
      words: SetupVocabulary;
      /** This kind's whole checklist (`setupStepsFor`), each judged done against the counts. */
      checklist: (KindStep & { done: boolean })[];
      /** Every property of the business, so the page can switch between branches. */
      properties: { id: string; name: string }[];
      property: ApiProperty | null;
      counts: ApiSetupProgress["counts"];
      steps: SetupStep[];
      /** What the API would refuse a publish for, in words, in the order to fix them. */
      blockers: string[];
      published: boolean;
    };

/** The signed-in person's business workspace by id, or a refusal. */
export function workspaceOf(ctx: SourceContext, workspaceId: string): Workspace {
  const ws = ctx.account?.workspaces.find((w) => w.workspaceId === workspaceId && w.kind === "business");
  if (!ws) throw new SetupRefusal("That is not one of your businesses.");
  return ws;
}

/** The words for what stops a publish, from the same facts the API refuses on (publish-eligibility). */
export function blockersFor(
  counts: ApiSetupProgress["counts"],
  hasProperty: boolean,
  foodVenue = false,
  approved = true,
): string[] {
  const out: string[] = [];
  if (!approved) out.push("Publishing opens once your business is approved.");
  if (!hasProperty) {
    out.push(
      foodVenue
        ? "Add the venue: its name and the sector it is in."
        : "Add the property: its name and the sector it is in.",
    );
  }
  if (hasProperty && counts.roomTypes === 0) {
    out.push(foodVenue ? "Add at least one priced item you sell." : "Add at least one room type.");
  } else if (hasProperty && counts.pricedRoomTypes === 0) {
    out.push(foodVenue ? "At least one item needs a price." : "At least one room type needs a price.");
  }
  if (hasProperty && counts.photos === 0) {
    out.push(
      foodVenue
        ? "Add at least one photograph of the venue."
        : "Add at least one photograph of the property.",
    );
  }
  return out;
}

export async function readSetup(ctx: SourceContext, workspaceId: string, propertyId?: string): Promise<SetupRead> {
  const ws = workspaceOf(ctx, workspaceId);
  const businessName = ws.orgName ?? ws.label;
  // The registration gate: an unpaid, rejected, suspended or unclaimed business holds no `listing.manage`, and
  // the inventory routes would refuse. Asking the API is not needed to know that; the grant already says it.
  const approved = ws.registrationStatus === "active";
  if (!approved && !ws.permissions.includes("listing.manage")) {
    return { open: false, workspaceId, businessName, status: ws.registrationStatus };
  }
  const api = { workspaceId };
  const { properties } = await ctx.api.get<{ properties: ApiPropertySummary[] }>("/api/v1/inventory/properties", api);
  // The branch asked for, or the first: a business registered with several sets each up in turn.
  const first = properties.find((p) => p.id === propertyId) ?? properties[0] ?? null;
  const [property, progress] = await Promise.all([
    first ? ctx.api.get<ApiProperty>(`/api/v1/inventory/properties/${first.id}`, api) : Promise.resolve(null),
    ctx.api.get<ApiSetupProgress>("/api/v1/inventory/setup", { ...api, query: { propertyId: first?.id } }),
  ]);
  const { counts } = progress;
  const published = property?.listingStatus === "published";
  const kind = kindOf(progress);
  const foodVenue = isFoodVenue(kind);
  const words = setupVocabularyFor(kind);
  const typeTitle = foodVenue ? "What you sell" : `A priced ${words.unitSingular} type`;
  return {
    open: true,
    workspaceId,
    businessName,
    status: ws.registrationStatus,
    approved,
    domain: progress.domain,
    accommodationClass: progress.accommodationClass,
    accommodationClassOther: progress.accommodationClassOther ?? null,
    entityGroup: progress.entityGroup ?? null,
    foodVenue,
    kindLabel: setupKindLabel(kind),
    words,
    checklist: setupStepsFor(kind).map((s) => ({
      ...s,
      done: isSetupStepDone(s.key, counts as PropertySetupCounts),
    })),
    properties: properties.map((p) => ({ id: p.id, name: p.name })),
    property,
    counts,
    steps: [
      { key: "property", title: foodVenue ? "Venue details" : "Property details", done: !!property },
      { key: "room_type", title: typeTitle, done: counts.pricedRoomTypes > 0 },
      { key: "photo", title: "A photograph", done: counts.photos > 0 },
      { key: "publish", title: "Publish", done: published },
    ],
    blockers: blockersFor(counts, !!property, foodVenue, approved),
    published,
  };
}

// ── Places (the address cascade: province → district → sector) ─────────────────────────────────────

/** Names as people write them ("Eastern Province", not "EAST"). */
const tidy = (rows: Place[]): Place[] => rows.map((p) => ({ ...p, name: tidyPlaceName(p.name) }));

export async function provinces(ctx: SourceContext): Promise<Place[]> {
  return tidy(await ctx.api.get<Place[]>("/api/v1/geography/provinces"));
}

export async function districts(ctx: SourceContext, provinceId: number): Promise<Place[]> {
  return tidy(await ctx.api.get<Place[]>("/api/v1/geography/districts", { query: { provinceId } }));
}

export async function sectors(ctx: SourceContext, districtId: number): Promise<Place[]> {
  return tidy(await ctx.api.get<Place[]>("/api/v1/geography/sectors", { query: { districtId } }));
}

export async function cells(ctx: SourceContext, sectorId: number): Promise<Place[]> {
  return tidy(await ctx.api.get<Place[]>("/api/v1/geography/cells", { query: { sectorId } }));
}

export async function villages(ctx: SourceContext, cellId: number): Promise<Place[]> {
  return tidy(await ctx.api.get<Place[]>("/api/v1/geography/villages", { query: { cellId } }));
}

// ── Writing ────────────────────────────────────────────────────────────────────────────────────────

function text(value: string | undefined | null, max: number): string | undefined {
  const t = value?.trim();
  return t ? t.slice(0, max) : undefined;
}

/** Create the property and its draft listing (`POST /inventory/properties`). */
export async function createProperty(
  ctx: SourceContext,
  workspaceId: string,
  input: { name: string; sectorId: number; street?: string; description?: string },
): Promise<ApiPropertySummary> {
  workspaceOf(ctx, workspaceId);
  const name = input.name.trim();
  if (name.length < 2) throw new SetupRefusal("Give the property a name guests will recognise.");
  if (!Number.isInteger(input.sectorId) || input.sectorId <= 0) throw new SetupRefusal("Choose the sector it is in.");
  return ctx.api.post<ApiPropertySummary>(
    "/api/v1/inventory/properties",
    {
      workspaceId,
      name,
      sectorId: input.sectorId,
      street: text(input.street, 200),
      description: text(input.description, 4000),
    },
    { workspaceId },
  );
}

/**
 * Fill in the property approval already created from the registration (`PATCH /inventory/properties/:id`): a
 * description guests read, the street, and the times. Only the fields sent change.
 */
export async function updateProperty(
  ctx: SourceContext,
  workspaceId: string,
  propertyId: string,
  input: {
    description?: string;
    street?: string;
    checkInTime?: string;
    checkOutTime?: string;
    villageId?: number | null;
    contactPhone?: string;
    contactEmail?: string;
    houseRules?: string;
  },
): Promise<ApiPropertySummary> {
  workspaceOf(ctx, workspaceId);
  const time = /^\d{2}:\d{2}$/;
  const email = input.contactEmail?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SetupRefusal("Use an email like frontdesk@example.com.");
  if (input.checkInTime && !time.test(input.checkInTime)) throw new SetupRefusal("Use a check-in time like 14:00.");
  if (input.checkOutTime && !time.test(input.checkOutTime)) throw new SetupRefusal("Use a check-out time like 11:00.");
  return ctx.api.patch<ApiPropertySummary>(
    `/api/v1/inventory/properties/${propertyId}`,
    {
      workspaceId,
      description: text(input.description, 4000),
      street: text(input.street, 200),
      checkInTime: input.checkInTime || undefined,
      checkOutTime: input.checkOutTime || undefined,
      villageId: input.villageId === undefined ? undefined : input.villageId,
      // An emptied field clears the contact; one never touched is not sent.
      contactPhone: input.contactPhone === undefined ? undefined : phoneE164(input.contactPhone),
      contactEmail: input.contactEmail === undefined ? undefined : email || null,
      houseRules: input.houseRules === undefined ? undefined : text(input.houseRules, 4000) ?? "",
    },
    { workspaceId },
  );
}

/** A Rwandan number as the API stores it: `+2507…`. Empty clears it; anything else is refused here. */
function phoneE164(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, "");
  if (!digits) return null;
  const local = digits.replace(/^\+?250/, "").replace(/^0/, "");
  if (!/^7\d{8}$/.test(local)) throw new SetupRefusal("Use a phone number like 078 123 4567.");
  return `+250${local}`;
}

/**
 * Add a room type with its price (`POST /inventory/properties/:id/room-types`). The price is what its default
 * rate plan sells at, whole RWF per person per night: the API counts a room type as priced from that plan.
 */
export async function addRoomType(
  ctx: SourceContext,
  workspaceId: string,
  propertyId: string,
  input: { name: string; maxGuests: number; basePriceRwf: number; roomCount: number; priceBasis?: RoomPriceBasis },
): Promise<{ id: string }> {
  workspaceOf(ctx, workspaceId);
  const name = input.name.trim();
  if (name.length < 2) throw new SetupRefusal("Give the room type a name guests will recognise.");
  if (!Number.isInteger(input.maxGuests) || input.maxGuests < 1)
    throw new SetupRefusal("A room sleeps at least one person.");
  if (!Number.isInteger(input.basePriceRwf) || input.basePriceRwf < 0)
    throw new SetupRefusal("Enter the price in whole francs.");
  if (!Number.isInteger(input.roomCount) || input.roomCount < 1)
    throw new SetupRefusal("Say how many rooms of this type there are.");
  return ctx.api.post<{ id: string }>(
    `/api/v1/inventory/properties/${propertyId}/room-types`,
    {
      workspaceId,
      name,
      maxGuests: input.maxGuests,
      basePriceRwf: input.basePriceRwf,
      roomCount: input.roomCount,
      priceBasis: input.priceBasis ?? "per_person",
      // Without a mode a stay publishes but guests see "can't be booked online". A venue's menu item is
      // listed, never booked, so it is sent without one.
      bookingMode: input.priceBasis === "per_item" ? undefined : "instant_book",
      cancellationTier: "flexible",
    },
    { workspaceId },
  );
}

/** Photographs the API accepts. It checks the bytes too; this only saves a round trip for the obvious. */
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Add a photograph: the bytes go up first (`POST /uploads/property-photo`, multipart), then the key is attached
 * to the property (`POST /inventory/properties/:id/photos`). Two steps on the API for a reason it documents: a
 * large upload has no business inside a transaction, and a failed attach can be retried without the file.
 */
export async function addPhoto(
  ctx: SourceContext,
  workspaceId: string,
  propertyId: string,
  file: Blob & { name?: string },
  caption?: string,
): Promise<{ id: string }> {
  workspaceOf(ctx, workspaceId);
  if (!file || file.size === 0) throw new SetupRefusal("Choose a photograph to add.");
  if (!PHOTO_TYPES.has(file.type)) throw new SetupRefusal("Use a JPEG, PNG or WebP photograph.");
  if (file.size > PHOTO_MAX_BYTES) throw new SetupRefusal("A photograph must be 8 MB or smaller.");
  const form = new FormData();
  form.set("file", file, file.name ?? "photo");
  const uploaded = await ctx.api.upload<{ objectKey: string }>("/api/v1/uploads/property-photo", form);
  return ctx.api.post<{ id: string }>(
    `/api/v1/inventory/properties/${propertyId}/photos`,
    { workspaceId, objectKey: uploaded.objectKey, caption: text(caption, 300) },
    { workspaceId },
  );
}

/** Put the property on the marketplace (`POST /inventory/properties/:id/publish`). Pressing it twice is safe. */
export async function publish(
  ctx: SourceContext,
  workspaceId: string,
  propertyId: string,
): Promise<ApiPropertySummary> {
  workspaceOf(ctx, workspaceId);
  return ctx.api.post<ApiPropertySummary>(`/api/v1/inventory/properties/${propertyId}/publish`, {}, { workspaceId });
}

/** Take it off the marketplace (`POST /inventory/properties/:id/unpublish`). The address is kept for a republish. */
export async function unpublish(
  ctx: SourceContext,
  workspaceId: string,
  propertyId: string,
): Promise<ApiPropertySummary> {
  workspaceOf(ctx, workspaceId);
  return ctx.api.post<ApiPropertySummary>(`/api/v1/inventory/properties/${propertyId}/unpublish`, {}, { workspaceId });
}
