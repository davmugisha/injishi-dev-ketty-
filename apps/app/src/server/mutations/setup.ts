/**
 * Setting up a property after the registration is approved, through the API's inventory routes
 * (`/api/v1/inventory/*`, `listing.manage`). Plain functions: the server actions behind the setup page and the
 * verify flows both call them.
 *
 * Whether the business may do any of this is the API's call and nobody else's: a business that is not `active`
 * holds no `listing.manage`, so every write below is refused with the registration gate's own words (rule D20).
 * This file adds no second gate. It only (a) reads where the setup stands, (b) refuses a request that must not
 * even be sent, and (c) lets the page ask the question first, so an unapproved business is shown a plain
 * explanation instead of forms that would be refused.
 */
import { tidyPlaceName } from "@injishi/contracts";
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
export interface ApiPropertySummary {
  id: string;
  name: string;
  slug: string | null;
  listingStatus: string;
  publishedAt: string | null;
  address: { sectorName?: string | null; districtName?: string | null; street?: string | null } & Record<
    string,
    unknown
  >;
  roomTypeCount: number;
}

/** GET /api/v1/inventory/properties/:id (OperatorProperty), the fields read here. */
export interface ApiProperty extends ApiPropertySummary {
  description: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  photos: { id: string; objectKey: string; position: number; isCover: boolean; caption: string | null; url: string }[];
  roomTypes: {
    id: string;
    name: string;
    status: "active" | "archived";
    basePriceRwf: number | null;
    sellableRoomCount: number;
  }[];
}

/** GET /api/v1/inventory/setup (PropertySetupProgress): counts the checklist is judged against. */
export interface ApiSetupProgress {
  orgId: string;
  legalName: string;
  domain: string;
  accommodationClass: string | null;
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
      /** The registration is not approved: setup is closed, and the owner is told where it stands. */
      open: false;
      workspaceId: string;
      businessName: string;
      status: string | null;
    }
  | {
      open: true;
      workspaceId: string;
      businessName: string;
      domain: string;
      accommodationClass: string | null;
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
export function blockersFor(counts: ApiSetupProgress["counts"], hasProperty: boolean): string[] {
  const out: string[] = [];
  if (!hasProperty) out.push("Add the property: its name and the sector it is in.");
  if (hasProperty && counts.roomTypes === 0) out.push("Add at least one room type.");
  else if (hasProperty && counts.pricedRoomTypes === 0) out.push("At least one room type needs a price.");
  if (hasProperty && counts.photos === 0) out.push("Add at least one photograph of the property.");
  return out;
}

export async function readSetup(ctx: SourceContext, workspaceId: string): Promise<SetupRead> {
  const ws = workspaceOf(ctx, workspaceId);
  const businessName = ws.orgName ?? ws.label;
  // The registration gate: before approval the workspace holds no permissions at all, and the inventory
  // routes would refuse. Asking the API is not needed to know that; the grant already says it.
  if (ws.registrationStatus !== "active") {
    return { open: false, workspaceId, businessName, status: ws.registrationStatus };
  }
  const api = { workspaceId };
  const { properties } = await ctx.api.get<{ properties: ApiPropertySummary[] }>("/api/v1/inventory/properties", api);
  const first = properties[0] ?? null;
  const [property, progress] = await Promise.all([
    first ? ctx.api.get<ApiProperty>(`/api/v1/inventory/properties/${first.id}`, api) : Promise.resolve(null),
    ctx.api.get<ApiSetupProgress>("/api/v1/inventory/setup", { ...api, query: { propertyId: first?.id } }),
  ]);
  const { counts } = progress;
  const published = property?.listingStatus === "published";
  return {
    open: true,
    workspaceId,
    businessName,
    domain: progress.domain,
    accommodationClass: progress.accommodationClass,
    property,
    counts,
    steps: [
      { key: "property", title: "Property details", done: !!property },
      { key: "room_type", title: "A priced room type", done: counts.pricedRoomTypes > 0 },
      { key: "photo", title: "A photograph", done: counts.photos > 0 },
      { key: "publish", title: "Publish", done: published },
    ],
    blockers: blockersFor(counts, !!property),
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
  input: { description?: string; street?: string; checkInTime?: string; checkOutTime?: string },
): Promise<ApiPropertySummary> {
  workspaceOf(ctx, workspaceId);
  const time = /^\d{2}:\d{2}$/;
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
    },
    { workspaceId },
  );
}

/**
 * Add a room type with its price (`POST /inventory/properties/:id/room-types`). The price is what its default
 * rate plan sells at, whole RWF per person per night: the API counts a room type as priced from that plan.
 */
export async function addRoomType(
  ctx: SourceContext,
  workspaceId: string,
  propertyId: string,
  input: { name: string; maxGuests: number; basePriceRwf: number; roomCount: number },
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
