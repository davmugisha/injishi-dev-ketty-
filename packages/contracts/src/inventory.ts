import { z } from "zod";
import { BookingMode, CancellationTier, RoomPriceBasis } from "./booking";
import { HousekeepingStatus, RoomStatus } from "./ops";
import { ContactPhone, Domain, Uuid } from "./primitives";
import { PropertyPolicies, propertyPolicyFields, roomTypeDetailFields } from "./property-policies";
/**
 * The operator write path for inventory (ADR-009).
 *
 * The public read shapes live in `property-detail.ts` (`PropertyDetail`) and
 * `booking.ts` (`RoomTypeSummary`) and answer a guest's question: what can I book? These
 * answer an operator's: what do I have, and is it live? Two different questions,
 * two different shapes, so a draft property never accidentally serialises
 * through a public contract.
 *
 * Feature 1 of the shared spine covers properties only. Room types, rates and
 * publishing extend this file when features 2 and 3 land.
 */
/** A listing is a draft until someone publishes it. */
export const ListingStatus = z.enum(["draft", "published"]);
export type ListingStatus = z.infer<typeof ListingStatus>;
// ---------------------------------------------------------------------------
// Naming the workspace
// ---------------------------------------------------------------------------
/**
 * Every operator route names the workspace it acts in.
 *
 * `WorkspaceGuard` reads this from the body on a write and the query on a read,
 * and refuses a request that names none. It proves the caller HOLDS that
 * workspace and nothing more; whether the target row BELONGS to it is a separate
 * check the service makes (ADR-009 AC-14).
 */
export const WorkspaceScoped = z.object({ workspaceId: Uuid });
export type WorkspaceScoped = z.infer<typeof WorkspaceScoped>;
// ---------------------------------------------------------------------------
// Writing a property
// ---------------------------------------------------------------------------
/**
 * The address a property carries.
 *
 * Only the SECTOR is sent. A sector resolves upward to its district and its
 * province, so the picker collects all three to drive its cascade and the wire
 * carries the one id that is worth storing. `district_id` is derived server side
 * from the sector, on create and on every edit that changes it, so the two can
 * never disagree (D24, and ADR-009 Value sourcing).
 */
const propertyFields = {
    name: z
        .string()
        .trim()
        .min(2, "Give the property a name guests will recognise.")
        .max(200, "That name is too long for our records."),
    sectorId: z.number().int().positive("Choose a sector."),
    /**
     * The village the property stands in, which must lie in `sectorId`. It is
     * what puts a check-in in front of that village's leader and its cell's
     * executive (the guest register, 0114); with only a sector, the sector and
     * DASSO see the guest and the village never does. `null` clears it.
     */
    villageId: z.number().int().positive("Choose a village.").nullable().optional(),
    /**
     * Where the property is on the map, as the host pinned it. Inside Rwanda,
     * and both or neither: a guest is only ever shown a point the host gave
     * (the website used to invent one at the district centre). `null` clears.
     */
    latitude: z.number().gte(-2.9, "That point is outside Rwanda.").lte(-1.0, "That point is outside Rwanda.").nullable().optional(),
    longitude: z.number().gte(28.8, "That point is outside Rwanda.").lte(31.0, "That point is outside Rwanda.").nullable().optional(),
    /** The street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
    street: z.string().trim().max(200).optional(),
    description: z.string().trim().max(4000).optional(),
    /** `HH:MM` or `HH:MM:SS`; the column is a bare `time`. */
    checkInTime: z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use a time like 14:00.")
        .optional(),
    checkOutTime: z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use a time like 11:00.")
        .optional(),
    houseRules: z.string().trim().max(4000).optional(),
    /** 0117: the check-in window's end, the front desk, languages and the house rules as choices. */
    ...propertyPolicyFields,
    /**
     * Hide the exact pin from the public until a stay is confirmed. Already
     * respected by the public read path, so this is a real toggle, not a stub.
     */
    locationPrivacy: z.boolean().optional(),
    /**
     * How a guest, a tenant or an officer reaches the property itself, which is
     * not always its owner: a group runs several front desks. `null` clears it.
     */
    contactPhone: ContactPhone.nullable().optional(),
    contactEmail: z
        .string()
        .trim()
        .email("Use an email address like frontdesk@example.com.")
        .max(200)
        .nullable()
        .optional(),
};
export const CreatePropertyRequest = WorkspaceScoped.extend(propertyFields);
export type CreatePropertyRequest = z.infer<typeof CreatePropertyRequest>;
/**
 * Editing replaces only the fields sent.
 *
 * A partial rather than a full replace because the operator screens edit one
 * card at a time, and a full replace would make an untouched section silently
 * clear itself.
 */
export const UpdatePropertyRequest = WorkspaceScoped.extend(z.object(propertyFields).partial().shape).extend({
    /**
     * The two digit branch id RRA issued for this location (ADR-054 AC-M2).
     * Edit only, never on create: setting it also needs `ebm.manage`, and it is
     * unique within the org forever, archived branches included. `null` clears it.
     */
    rraBranchId: z
        .string()
        .regex(/^[0-9]{2}$/, "Use the two digit branch id RRA gave you, like 01.")
        .nullable()
        .optional(),
});
export type UpdatePropertyRequest = z.infer<typeof UpdatePropertyRequest>;
// ---------------------------------------------------------------------------
// Branches (ADR-054)
// ---------------------------------------------------------------------------
/**
 * Why a branch cannot be archived (AC-M3). A code, so the screen can list every
 * reason at once; the label is the operator's words.
 */
export const BranchArchiveBlocker = z.enum([
    "head_office",
    "guest_in_house",
    "upcoming_booking",
    "open_folio",
    "last_branch_of_member",
]);
export type BranchArchiveBlocker = z.infer<typeof BranchArchiveBlocker>;
export const BRANCH_ARCHIVE_BLOCKER_LABEL: Readonly<Record<BranchArchiveBlocker, string>> = {
    head_office: "It is the head office. Make another branch the head office first.",
    guest_in_house: "A guest is staying there now.",
    upcoming_booking: "A booking is due to arrive there today or later.",
    open_folio: "A bill there is still open.",
    last_branch_of_member: "It is the only branch some of your team can work at.",
};
/** One reason, with the people it names when it is about the team. */
export const BranchArchiveReason = z.object({
    code: BranchArchiveBlocker,
    /** Names of the members limited to this branch alone. Set for `last_branch_of_member`. */
    members: z.array(z.string()).optional(),
});
export type BranchArchiveReason = z.infer<typeof BranchArchiveReason>;
/** The 409 body an archive refusal carries: `message` is the first reason. */
export const BranchArchiveRefusal = z.object({
    message: z.string(),
    reasons: z.array(BranchArchiveReason),
});
export type BranchArchiveRefusal = z.infer<typeof BranchArchiveRefusal>;
/** The words a member limited to some branches is refused with (AC-M6). */
export const NEEDS_EVERY_BRANCH_MESSAGE = "This needs access to every branch.";
// ---------------------------------------------------------------------------
// Reading a property back
// ---------------------------------------------------------------------------
/**
 * The resolved address, sent with names as well as ids.
 *
 * The ids let the picker reopen on the right selection; the names let a list
 * render without three more requests. Province and district are JOINED from the
 * sector rather than stored, which is the whole reason only the sector is
 * written.
 */
export const PropertyAddress = z.object({
    provinceId: z.number().int().nullable(),
    provinceName: z.string().nullable(),
    districtId: z.number().int().nullable(),
    districtName: z.string().nullable(),
    sectorId: z.number().int().nullable(),
    sectorName: z.string().nullable(),
    /** Resolved from the village. Default null so an older API's body still parses. */
    cellId: z.number().int().nullable().default(null),
    cellName: z.string().nullable().default(null),
    villageId: z.number().int().nullable().default(null),
    villageName: z.string().nullable().default(null),
    street: z.string().nullable(),
});
export type PropertyAddress = z.infer<typeof PropertyAddress>;
/** One row in the operator's property list. */
export const OperatorPropertySummary = z.object({
    id: Uuid,
    name: z.string(),
    /**
     * The public address, minted at publish and never by a reader (ADR-053).
     *
     * Null until the first publish. It SURVIVES an unpublish on purpose, so a
     * republished property keeps the address every bookmark and search result
     * already points at (AC-I6).
     */
    slug: z.string().nullable(),
    address: PropertyAddress,
    listingStatus: ListingStatus,
    publishedAt: z.string().nullable(),
    roomTypeCount: z.number().int(),
    /** Sellable rooms across every active room type. The inventory truth. */
    sellableRoomCount: z.number().int(),
    /** ADR-054: exactly one active branch of a hospitality business is its head office. */
    isHeadOffice: z.boolean(),
    /** The two digit branch id RRA issued for this location, or null. */
    rraBranchId: z.string().nullable(),
    /** The business's own short code for the branch ("ISG"), or null until one is chosen. */
    branchCode: z.string().nullable(),
    /** Set when the branch is archived; its history stays readable. */
    archivedAt: z.string().nullable(),
});
export type OperatorPropertySummary = z.infer<typeof OperatorPropertySummary>;
/**
 * One photograph of a property (ADR-053).
 *
 * A ROW, not an entry in a `jsonb` array, and the difference is the whole
 * reason the migration exists. A row can carry an order that survives an edit,
 * a cover flag, and a caption, and it rides `stored_objects` so it inherits
 * retention and legal hold like every other stored object.
 *
 * `url` is a SHORT LIVED read, not a permanent address. The bucket is private,
 * so there is no public URL to hand out; this is signed at read time and
 * expires. A caller that needs to show the picture again later asks again.
 */
export const PropertyPhoto = z.object({
    id: Uuid,
    objectKey: z.string().min(1),
    /** 0 based, dense, and the order the operator chose. */
    position: z.number().int().nonnegative(),
    /** Exactly one per property, which a partial unique index enforces. */
    isCover: z.boolean(),
    caption: z.string().nullable(),
    url: z.string(),
});
export type PropertyPhoto = z.infer<typeof PropertyPhoto>;
/**
 * One property in full, as its owner sees it.
 *
 * `photos` carries real rows since ADR-053. It used to be permanently empty
 * with a comment saying object storage was unbuilt; F-S09 landed, photos became
 * a publish condition, and a `jsonb` array of keys could not carry a cover flag
 * or an order, so they became rows.
 */
export const OperatorProperty = OperatorPropertySummary.extend({
    ...PropertyPolicies.shape,
    description: z.string().nullable(),
    checkInTime: z.string().nullable(),
    checkOutTime: z.string().nullable(),
    houseRules: z.string().nullable(),
    locationPrivacy: z.boolean(),
    timezone: z.string(),
    contactPhone: z.string().nullable(),
    contactEmail: z.string().nullable(),
    /** The map point the host pinned; null until they do. Default null for an older API. */
    latitude: z.number().nullable().default(null),
    longitude: z.number().nullable().default(null),
    photos: z.array(PropertyPhoto),
    /**
     * Empty until feature 2 builds the room type write path. An empty array is a
     * real answer here: a property with no room types is exactly what a newly
     * created one is, and it is why publishing refuses.
     */
    roomTypes: z.array(z.object({
        id: Uuid,
        name: z.string(),
        domain: Domain,
        status: z.enum(["active", "archived"]),
        basePriceRwf: z.number().int().nullable(),
        priceBasis: RoomPriceBasis.default("per_person"),
        sellableRoomCount: z.number().int(),
        /** 0117. Optional, so an older API's answer still parses. */
        maxGuests: z.number().int().nullish(),
        maxAdults: z.number().int().nullish(),
        maxChildren: z.number().int().nullish(),
        roomCategory: z.string().nullish(),
        beds: z.array(z.object({ type: z.string(), count: z.number().int().positive() })).nullish(),
        sizeM2: z.number().int().nullish(),
        bathroom: z.enum(["private", "shared"]).nullish(),
        singleGuestPriceRwf: z.number().int().nullish(),
    })),
});
export type OperatorProperty = z.infer<typeof OperatorProperty>;
/**
 * A rate plan, as its owner sees it (ADR-035, wave 2 follow-up).
 *
 * **`rate_plans` is one of the richest tables in the schema and nothing read
 * it.** No contract, no repository, no route — so the Rate plans lens was a
 * placeholder and the Room types screen had to say out loud that it would not
 * guess at them.
 *
 * THE DISTINCTION THIS SHAPE CARRIES is the one the screen exists to teach: a
 * room type is WHAT THE GUEST GETS, a rate plan is THE TERMS IT SELLS ON. The
 * same rooms sell several ways at once — flexible, non refundable, bed and
 * breakfast — which is why a plan names its room type rather than the other
 * way round.
 *
 * `parentRatePlanId` and the derivation are on the wire because a DERIVED plan
 * is the whole point of the feature (F-L03): non refundable is flexible minus
 * ten percent, and it MOVES when the parent moves. A screen showing only the
 * computed price would hide the relationship that keeps them in step.
 *
 * `baseOccupancy` is COMMERCIAL and deliberately not the room type's physical
 * `maxGuests`: it is how many people the base price covers, and the gap between
 * the two is what extra person pricing bridges (F-L05).
 */
export const OperatorRatePlan = z.object({
    id: Uuid,
    roomTypeId: Uuid,
    roomTypeName: z.string().nullable(),
    name: z.string(),
    status: z.enum(["active", "archived"]),
    /** Exactly one per room type, which the database enforces. */
    isDefault: z.boolean(),
    basePriceRwf: z.number().int().nullable(),
    cautionRwf: z.number().int().nullable(),
    baseOccupancy: z.number().int().nullable(),
    singleOccupancyPriceRwf: z.number().int().nullable(),
    cancellationTier: CancellationTier.nullable(),
    nonRefundable: z.boolean(),
    bookingMode: BookingMode.nullable(),
    minStay: z.number().int().nullable(),
    maxStay: z.number().int().nullable(),
    /** Set when this plan FOLLOWS another one (F-L03). */
    parentRatePlanId: Uuid.nullable(),
    parentRatePlanName: z.string().nullable(),
    derivationKind: z.enum(["percentage", "fixed_amount"]).nullable(),
    derivationValue: z.number().nullable(),
});
export type OperatorRatePlan = z.infer<typeof OperatorRatePlan>;
export const OperatorRatePlanList = z.object({
    ratePlans: z.array(OperatorRatePlan),
});
export type OperatorRatePlanList = z.infer<typeof OperatorRatePlanList>;
export const OperatorPropertyList = z.object({
    properties: z.array(OperatorPropertySummary),
});
export type OperatorPropertyList = z.infer<typeof OperatorPropertyList>;
// ---------------------------------------------------------------------------
// Why publishing was refused
// ---------------------------------------------------------------------------
/**
 * A code, not a sentence, for the reason a rejection reason is a code: the
 * operator screen has to send someone back to the part that is wrong, and it
 * cannot read prose to work out which part that is (ADR-009 AC-7).
 *
 * Defined now, with the property level reasons already usable, so feature 3 adds
 * cases to an enum that exists rather than inventing one late.
 */
export const PublishBlocker = z.enum([
    "org_not_active",
    "missing_name",
    "missing_sector",
    "no_active_room_type",
    "no_priced_room_type",
    "no_sellable_room",
    /**
     * ADR-053. ADR-009's follow up said photos become required to publish once
     * F-S09 landed, and to revisit then. It landed, and the answer is yes: a
     * listing nobody can see is not a listing.
     */
    "no_photo",
    /** 0117: a stay says its check-in window, its front desk and a language its staff speak. */
    "missing_check_in",
    "missing_front_desk",
    "missing_language",
    /** 0117: every room type of a stay says its beds and how many adults it takes. */
    "room_type_without_beds",
]);
export type PublishBlocker = z.infer<typeof PublishBlocker>;
export const PUBLISH_BLOCKER_LABEL: Readonly<Record<PublishBlocker, string>> = {
    org_not_active: "Publishing opens once your business is approved.",
    missing_name: "Give the property a name.",
    missing_sector: "Choose the sector the property is in.",
    no_active_room_type: "Add at least one room type.",
    no_priced_room_type: "At least one room type needs a price.",
    no_sellable_room: "At least one room has to be available to sell.",
    no_photo: "Add at least one photograph of the property.",
    missing_check_in: "Say when guests can check in.",
    missing_front_desk: "Say when the front desk is open.",
    missing_language: "Pick at least one language your staff speak.",
    room_type_without_beds: "Give every room type its beds and the number of adults it takes.",
};
/** Which screen a blocker sends the operator back to. */
export function stepForPublishBlocker(blocker: PublishBlocker): "registration" | "property" | "room_types" | "photos" {
    switch (blocker) {
        case "org_not_active":
            return "registration";
        case "missing_name":
        case "missing_sector":
        case "missing_check_in":
        case "missing_front_desk":
        case "missing_language":
            return "property";
        case "no_active_room_type":
        case "no_priced_room_type":
        case "no_sellable_room":
        case "room_type_without_beds":
            return "room_types";
        case "no_photo":
            return "photos";
    }
}
// ---------------------------------------------------------------------------
// Writing a room type
// ---------------------------------------------------------------------------
/**
 * The room type write path (ADR-053, AC-I1).
 *
 * **A room type is WHAT THE GUEST GETS; a rate plan is THE TERMS IT SELLS ON.**
 * That distinction is `OperatorRatePlan`'s to teach, and this shape stays on the
 * near side of it: a name, how many people fit, and the one price that seeds the
 * default plan.
 *
 * `basePriceRwf` is written TWICE, to the deprecated `room_types` column and to
 * the default `rate_plans` row, because every current reader still reads the
 * column. ADR-009's contract phase moves them and is deferred again, on purpose,
 * rather than swallowed here.
 */
const roomTypeFields = {
    name: z
        .string()
        .trim()
        .min(2, "Give the room type a name guests will recognise.")
        .max(200, "That name is too long for our records."),
    /**
     * How many people the room physically sleeps.
     *
     * Deliberately NOT the rate plan's `baseOccupancy`, which is commercial: how
     * many the base price covers. The gap between the two is what extra person
     * pricing bridges (F-L05).
     */
    maxGuests: z
        .number()
        .int()
        .positive("A room sleeps at least one person.")
        .max(50, "That is more people than a room type should hold."),
    /** RWF, whole units. The currency is `RWF` everywhere and is not asked. */
    basePriceRwf: z
        .number()
        .int()
        .nonnegative("A price cannot be negative.")
        .max(100_000_000, "That price is outside what we can record.")
        .nullable(),
    bookingMode: BookingMode.optional(),
    cancellationTier: CancellationTier.optional(),
    /**
     * Per person (the default), per whole unit, or per menu item. A `per_item`
     * row is never bookable, so it is stored with no booking mode.
     */
    priceBasis: RoomPriceBasis.optional(),
    /** How many rooms of this type exist. Seeds nothing; `rooms` is the truth. */
    roomCount: z.number().int().positive().max(10_000).optional(),
    /** 0117: the kind of room, its beds, who may sleep there, its size and bathroom, the one guest price. */
    ...roomTypeDetailFields,
};
/**
 * What one physical room or unit is called on the door: `101`, `Tent 4`,
 * `Apartment B2`. Unique within its property, which the service enforces.
 */
export const RoomLabel = z
    .string()
    .trim()
    .min(1, "Give every room a number or a name.")
    .max(60, "That room name is too long.");
export type RoomLabel = z.infer<typeof RoomLabel>;
/**
 * Creating a room type may name its rooms in the same call.
 *
 * `roomLabels` is how a new property gets SELLABLE rooms at all: `roomCount`
 * alone seeds nothing, so a property set up without rooms could never publish
 * and its room status board stayed empty. When labels are sent they win and
 * `roomCount` follows them; when only a count is sent, that many rooms are
 * created with numbered labels. Create only — an edit adds rooms through the
 * rooms route, where each one can be named.
 */
export const CreateRoomTypeRequest = WorkspaceScoped.extend({
    ...roomTypeFields,
    roomLabels: z.array(RoomLabel).max(500, "Add at most 500 rooms at once.").optional(),
});
export type CreateRoomTypeRequest = z.infer<typeof CreateRoomTypeRequest>;
/**
 * Editing a room type replaces only the fields sent, like every other operator
 * edit here, and adds the one field a create cannot send: archiving it.
 */
export const UpdateRoomTypeRequest = WorkspaceScoped.extend(z.object({
    ...roomTypeFields,
    status: z.enum(["active", "archived"]),
}).partial().shape);
export type UpdateRoomTypeRequest = z.infer<typeof UpdateRoomTypeRequest>;
/** A room type, as its owner sees it. */
export const OperatorRoomType = z.object({
    id: Uuid,
    propertyId: Uuid,
    name: z.string(),
    domain: Domain,
    status: z.enum(["active", "archived"]),
    maxGuests: z.number().int().nullable(),
    basePriceRwf: z.number().int().nullable(),
    bookingMode: BookingMode.nullable(),
    cancellationTier: CancellationTier.nullable(),
    priceBasis: RoomPriceBasis.default("per_person"),
    roomCount: z.number().int(),
    sellableRoomCount: z.number().int(),
    /** The plan this type sells on by default. Exactly one, always. */
    defaultRatePlanId: Uuid.nullable(),
});
export type OperatorRoomType = z.infer<typeof OperatorRoomType>;
export const OperatorRoomTypeList = z.object({
    roomTypes: z.array(OperatorRoomType),
});
export type OperatorRoomTypeList = z.infer<typeof OperatorRoomTypeList>;
// ---------------------------------------------------------------------------
// Writing a rate plan
// ---------------------------------------------------------------------------
/**
 * The rate plan write path (ADR-053, AC-I2).
 *
 * `isDefault` is accepted and MOVES the flag rather than failing: an operator
 * changing which plan sells by default is an ordinary act, not an error, and the
 * partial unique index would otherwise turn it into one.
 */
const ratePlanFields = {
    name: z
        .string()
        .trim()
        .min(2, "Give the rate plan a name.")
        .max(200, "That name is too long for our records."),
    basePriceRwf: z
        .number()
        .int()
        .nonnegative("A price cannot be negative.")
        .max(100_000_000, "That price is outside what we can record.")
        .nullable(),
    /** How many people the base price covers. Commercial, not physical. */
    baseOccupancy: z.number().int().positive().max(50).optional(),
    cancellationTier: CancellationTier.optional(),
    nonRefundable: z.boolean().optional(),
    bookingMode: BookingMode.optional(),
    isDefault: z.boolean().optional(),
};
export const CreateRatePlanRequest = WorkspaceScoped.extend(ratePlanFields);
export type CreateRatePlanRequest = z.infer<typeof CreateRatePlanRequest>;
export const UpdateRatePlanRequest = WorkspaceScoped.extend(z.object({
    ...ratePlanFields,
    status: z.enum(["active", "archived"]),
}).partial().shape);
export type UpdateRatePlanRequest = z.infer<typeof UpdateRatePlanRequest>;
// ---------------------------------------------------------------------------
// Attaching a photograph
// ---------------------------------------------------------------------------
/**
 * Attach an already uploaded object to a property (ADR-053, AC-I3).
 *
 * The bytes went up first, at `POST /api/v1/uploads/property-photo`, and this
 * call carries the KEY. Two steps rather than one, for the reason the
 * certificate path already splits them: a large upload has no business inside a
 * transaction, and a failed attach can be retried without sending the file again.
 */
export const AttachPropertyPhotoRequest = WorkspaceScoped.extend({
    objectKey: z.string().min(1),
    /** Appended last when absent, which is what an operator adding one expects. */
    position: z.number().int().nonnegative().optional(),
    /** The first photograph on a property becomes the cover whatever this says. */
    isCover: z.boolean().optional(),
    caption: z.string().trim().max(300).optional(),
});
export type AttachPropertyPhotoRequest = z.infer<typeof AttachPropertyPhotoRequest>;
/**
 * Reorder, re caption, or move the cover, in one call.
 *
 * One call rather than a PATCH per photograph because reordering is ONE act: a
 * drag that lands renumbers several rows at once, and applying that as five
 * requests leaves the order half written when the fourth one fails.
 */
export const ReorderPropertyPhotosRequest = WorkspaceScoped.extend({
    photos: z
        .array(z.object({
            id: Uuid,
            position: z.number().int().nonnegative(),
            isCover: z.boolean().optional(),
            caption: z.string().trim().max(300).nullable().optional(),
        }))
        .min(1, "Name at least one photograph."),
});
export type ReorderPropertyPhotosRequest = z.infer<typeof ReorderPropertyPhotosRequest>;
export const PropertyPhotoList = z.object({
    photos: z.array(PropertyPhoto),
});
export type PropertyPhotoList = z.infer<typeof PropertyPhotoList>;
/**
 * A stored property photograph, as the upload route reports it back.
 *
 * A sibling of `UploadedObject` rather than a widening of it: that shape pins
 * `kind` to the literal `certificate`, and the registration wizard parses
 * against it. Loosening it to an enum would weaken a check that is already doing
 * its job, to save declaring five fields.
 */
export const UploadedPropertyPhoto = z.object({
    objectKey: z.string().min(1),
    kind: z.literal("property_photo"),
    mime: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    filename: z.string(),
    /** A short lived signed read, so the operator sees the picture immediately. */
    url: z.string(),
});
export type UploadedPropertyPhoto = z.infer<typeof UploadedPropertyPhoto>;
// ---------------------------------------------------------------------------
// Rooms and units: the physical inventory
// ---------------------------------------------------------------------------
/**
 * One physical room, tent, villa or rental unit, as its owner sets it up.
 *
 * A hotel room and a residence unit are the SAME row (`rooms`): a lease names a
 * room, a stay names a room, and a room type is what either one is sold as. The
 * operator app words it per business ("Room 101", "Unit B2"), the wire does not.
 *
 * Not `OperatorRoom` (ops.ts), which is TODAY's board: who is in it and whether
 * it is clean. This is setup, so it carries what setup edits.
 */
export const InventoryRoom = z.object({
    id: Uuid,
    roomTypeId: Uuid,
    label: z.string().nullable(),
    status: RoomStatus,
    /** New rooms are `clean`, the column default: nobody has slept in them. */
    housekeeping: HousekeepingStatus,
});
export type InventoryRoom = z.infer<typeof InventoryRoom>;
export const InventoryRoomList = z.object({
    rooms: z.array(InventoryRoom),
});
export type InventoryRoomList = z.infer<typeof InventoryRoomList>;
/** Add rooms to a room type, each with the label on its door. */
export const CreateRoomsRequest = WorkspaceScoped.extend({
    labels: z
        .array(RoomLabel)
        .min(1, "Add at least one room.")
        .max(500, "Add at most 500 rooms at once."),
});
export type CreateRoomsRequest = z.infer<typeof CreateRoomsRequest>;
/**
 * Renumber a room, or take it out of what can be sold.
 *
 * `status` is the SALES state (available, maintenance, out of service). Whether
 * it is clean stays housekeeping's, on `POST /ops/rooms/:id/housekeeping`.
 */
export const UpdateRoomRequest = WorkspaceScoped.extend({
    label: RoomLabel.optional(),
    status: RoomStatus.optional(),
});
export type UpdateRoomRequest = z.infer<typeof UpdateRoomRequest>;
// ---------------------------------------------------------------------------
// Setting a business up after approval
// ---------------------------------------------------------------------------
/**
 * How far an approved business has got with setting up its property.
 *
 * COUNTS, not booleans, so the checklist can say "3 room types, 42 rooms"
 * rather than a tick, and so the step definitions in `setup-steps.ts` decide
 * what "done" means in one place instead of the API and the app each deciding.
 *
 * `propertyId` is the property the counts are about: the one asked for, or the
 * first one on the business, or null when there is none yet — which is exactly
 * the state a business is in on the day it is approved.
 */
export const PropertySetupCounts = z.object({
    properties: z.number().int(),
    contactDetails: z.number().int(),
    departments: z.number().int(),
    departmentHeads: z.number().int(),
    roomTypes: z.number().int(),
    pricedRoomTypes: z.number().int(),
    rooms: z.number().int(),
    photos: z.number().int(),
    amenities: z.number().int(),
    outlets: z.number().int(),
    /** Members other than owners, plus invitations still waiting to be accepted. */
    staff: z.number().int(),
    published: z.number().int(),
});
export type PropertySetupCounts = z.infer<typeof PropertySetupCounts>;
export const PropertySetupProgress = z.object({
    orgId: Uuid,
    legalName: z.string(),
    domain: Domain,
    accommodationClass: z.string().nullable(),
    /**
     * Free-text when `accommodationClass` is `other` (coffee shop, bar &
     * restaurant, etc.). Null on the eight lodging classes and on residence.
     */
    accommodationClassOther: z.string().nullable(),
    /**
     * RDB entity group on the org. Coffee shops and bars land in
     * `restaurant_bar_nightclub`; hotels in `accommodation`. Drives setup
     * vocabulary so a venue is not asked for rooms.
     */
    entityGroup: z.string().nullable(),
    /**
     * What the business said it is at registration (`orgs.business_kind`): a
     * hotel, a villa, a coffee shop. The one field setup should branch on; the
     * class and entity group are kept for a business registered before it.
     * Default null so an older API's body still parses.
     */
    businessKind: z.string().nullable().default(null),
    propertyId: Uuid.nullable(),
    propertyName: z.string().nullable(),
    counts: PropertySetupCounts,
});
export type PropertySetupProgress = z.infer<typeof PropertySetupProgress>;