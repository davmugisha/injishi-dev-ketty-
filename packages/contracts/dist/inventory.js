"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertySetupProgress = exports.PropertySetupCounts = exports.UpdateRoomRequest = exports.CreateRoomsRequest = exports.InventoryRoomList = exports.InventoryRoom = exports.UploadedPropertyPhoto = exports.PropertyPhotoList = exports.ReorderPropertyPhotosRequest = exports.AttachPropertyPhotoRequest = exports.UpdateRatePlanRequest = exports.CreateRatePlanRequest = exports.OperatorRoomTypeList = exports.OperatorRoomType = exports.UpdateRoomTypeRequest = exports.CreateRoomTypeRequest = exports.RoomLabel = exports.PUBLISH_BLOCKER_LABEL = exports.PublishBlocker = exports.OperatorPropertyList = exports.OperatorRatePlanList = exports.OperatorRatePlan = exports.OperatorProperty = exports.PropertyPhoto = exports.OperatorPropertySummary = exports.PropertyAddress = exports.NEEDS_EVERY_BRANCH_MESSAGE = exports.BranchArchiveRefusal = exports.BranchArchiveReason = exports.BRANCH_ARCHIVE_BLOCKER_LABEL = exports.BranchArchiveBlocker = exports.UpdatePropertyRequest = exports.CreatePropertyRequest = exports.WorkspaceScoped = exports.ListingStatus = void 0;
exports.stepForPublishBlocker = stepForPublishBlocker;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const ops_1 = require("./ops");
const primitives_1 = require("./primitives");
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
exports.ListingStatus = zod_1.z.enum(["draft", "published"]);
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
exports.WorkspaceScoped = zod_1.z.object({ workspaceId: primitives_1.Uuid });
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
    name: zod_1.z
        .string()
        .trim()
        .min(2, "Give the property a name guests will recognise.")
        .max(200, "That name is too long for our records."),
    sectorId: zod_1.z.number().int().positive("Choose a sector."),
    /** The street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
    street: zod_1.z.string().trim().max(200).optional(),
    description: zod_1.z.string().trim().max(4000).optional(),
    /** `HH:MM` or `HH:MM:SS`; the column is a bare `time`. */
    checkInTime: zod_1.z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use a time like 14:00.")
        .optional(),
    checkOutTime: zod_1.z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use a time like 11:00.")
        .optional(),
    houseRules: zod_1.z.string().trim().max(4000).optional(),
    /**
     * Hide the exact pin from the public until a stay is confirmed. Already
     * respected by the public read path, so this is a real toggle, not a stub.
     */
    locationPrivacy: zod_1.z.boolean().optional(),
    /**
     * How a guest, a tenant or an officer reaches the property itself, which is
     * not always its owner: a group runs several front desks. `null` clears it.
     */
    contactPhone: primitives_1.ContactPhone.nullable().optional(),
    contactEmail: zod_1.z
        .string()
        .trim()
        .email("Use an email address like frontdesk@example.com.")
        .max(200)
        .nullable()
        .optional(),
};
exports.CreatePropertyRequest = exports.WorkspaceScoped.extend(propertyFields);
/**
 * Editing replaces only the fields sent.
 *
 * A partial rather than a full replace because the operator screens edit one
 * card at a time, and a full replace would make an untouched section silently
 * clear itself.
 */
exports.UpdatePropertyRequest = exports.WorkspaceScoped.extend(zod_1.z.object(propertyFields).partial().shape).extend({
    /**
     * The two digit branch id RRA issued for this location (ADR-054 AC-M2).
     * Edit only, never on create: setting it also needs `ebm.manage`, and it is
     * unique within the org forever, archived branches included. `null` clears it.
     */
    rraBranchId: zod_1.z
        .string()
        .regex(/^[0-9]{2}$/, "Use the two digit branch id RRA gave you, like 01.")
        .nullable()
        .optional(),
});
// ---------------------------------------------------------------------------
// Branches (ADR-054)
// ---------------------------------------------------------------------------
/**
 * Why a branch cannot be archived (AC-M3). A code, so the screen can list every
 * reason at once; the label is the operator's words.
 */
exports.BranchArchiveBlocker = zod_1.z.enum([
    "head_office",
    "guest_in_house",
    "upcoming_booking",
    "open_folio",
    "last_branch_of_member",
]);
exports.BRANCH_ARCHIVE_BLOCKER_LABEL = {
    head_office: "It is the head office. Make another branch the head office first.",
    guest_in_house: "A guest is staying there now.",
    upcoming_booking: "A booking is due to arrive there today or later.",
    open_folio: "A bill there is still open.",
    last_branch_of_member: "It is the only branch some of your team can work at.",
};
/** One reason, with the people it names when it is about the team. */
exports.BranchArchiveReason = zod_1.z.object({
    code: exports.BranchArchiveBlocker,
    /** Names of the members limited to this branch alone. Set for `last_branch_of_member`. */
    members: zod_1.z.array(zod_1.z.string()).optional(),
});
/** The 409 body an archive refusal carries: `message` is the first reason. */
exports.BranchArchiveRefusal = zod_1.z.object({
    message: zod_1.z.string(),
    reasons: zod_1.z.array(exports.BranchArchiveReason),
});
/** The words a member limited to some branches is refused with (AC-M6). */
exports.NEEDS_EVERY_BRANCH_MESSAGE = "This needs access to every branch.";
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
exports.PropertyAddress = zod_1.z.object({
    provinceId: zod_1.z.number().int().nullable(),
    provinceName: zod_1.z.string().nullable(),
    districtId: zod_1.z.number().int().nullable(),
    districtName: zod_1.z.string().nullable(),
    sectorId: zod_1.z.number().int().nullable(),
    sectorName: zod_1.z.string().nullable(),
    street: zod_1.z.string().nullable(),
});
/** One row in the operator's property list. */
exports.OperatorPropertySummary = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    /**
     * The public address, minted at publish and never by a reader (ADR-053).
     *
     * Null until the first publish. It SURVIVES an unpublish on purpose, so a
     * republished property keeps the address every bookmark and search result
     * already points at (AC-I6).
     */
    slug: zod_1.z.string().nullable(),
    address: exports.PropertyAddress,
    listingStatus: exports.ListingStatus,
    publishedAt: zod_1.z.string().nullable(),
    roomTypeCount: zod_1.z.number().int(),
    /** Sellable rooms across every active room type. The inventory truth. */
    sellableRoomCount: zod_1.z.number().int(),
    /** ADR-054: exactly one active branch of a hospitality business is its head office. */
    isHeadOffice: zod_1.z.boolean(),
    /** The two digit branch id RRA issued for this location, or null. */
    rraBranchId: zod_1.z.string().nullable(),
    /** The business's own short code for the branch ("ISG"), or null until one is chosen. */
    branchCode: zod_1.z.string().nullable(),
    /** Set when the branch is archived; its history stays readable. */
    archivedAt: zod_1.z.string().nullable(),
});
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
exports.PropertyPhoto = zod_1.z.object({
    id: primitives_1.Uuid,
    objectKey: zod_1.z.string().min(1),
    /** 0 based, dense, and the order the operator chose. */
    position: zod_1.z.number().int().nonnegative(),
    /** Exactly one per property, which a partial unique index enforces. */
    isCover: zod_1.z.boolean(),
    caption: zod_1.z.string().nullable(),
    url: zod_1.z.string(),
});
/**
 * One property in full, as its owner sees it.
 *
 * `photos` carries real rows since ADR-053. It used to be permanently empty
 * with a comment saying object storage was unbuilt; F-S09 landed, photos became
 * a publish condition, and a `jsonb` array of keys could not carry a cover flag
 * or an order, so they became rows.
 */
exports.OperatorProperty = exports.OperatorPropertySummary.extend({
    description: zod_1.z.string().nullable(),
    checkInTime: zod_1.z.string().nullable(),
    checkOutTime: zod_1.z.string().nullable(),
    houseRules: zod_1.z.string().nullable(),
    locationPrivacy: zod_1.z.boolean(),
    timezone: zod_1.z.string(),
    contactPhone: zod_1.z.string().nullable(),
    contactEmail: zod_1.z.string().nullable(),
    photos: zod_1.z.array(exports.PropertyPhoto),
    /**
     * Empty until feature 2 builds the room type write path. An empty array is a
     * real answer here: a property with no room types is exactly what a newly
     * created one is, and it is why publishing refuses.
     */
    roomTypes: zod_1.z.array(zod_1.z.object({
        id: primitives_1.Uuid,
        name: zod_1.z.string(),
        domain: primitives_1.Domain,
        status: zod_1.z.enum(["active", "archived"]),
        basePriceRwf: zod_1.z.number().int().nullable(),
        sellableRoomCount: zod_1.z.number().int(),
    })),
});
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
exports.OperatorRatePlan = zod_1.z.object({
    id: primitives_1.Uuid,
    roomTypeId: primitives_1.Uuid,
    roomTypeName: zod_1.z.string().nullable(),
    name: zod_1.z.string(),
    status: zod_1.z.enum(["active", "archived"]),
    /** Exactly one per room type, which the database enforces. */
    isDefault: zod_1.z.boolean(),
    basePriceRwf: zod_1.z.number().int().nullable(),
    cautionRwf: zod_1.z.number().int().nullable(),
    baseOccupancy: zod_1.z.number().int().nullable(),
    singleOccupancyPriceRwf: zod_1.z.number().int().nullable(),
    cancellationTier: booking_1.CancellationTier.nullable(),
    nonRefundable: zod_1.z.boolean(),
    bookingMode: booking_1.BookingMode.nullable(),
    minStay: zod_1.z.number().int().nullable(),
    maxStay: zod_1.z.number().int().nullable(),
    /** Set when this plan FOLLOWS another one (F-L03). */
    parentRatePlanId: primitives_1.Uuid.nullable(),
    parentRatePlanName: zod_1.z.string().nullable(),
    derivationKind: zod_1.z.enum(["percentage", "fixed_amount"]).nullable(),
    derivationValue: zod_1.z.number().nullable(),
});
exports.OperatorRatePlanList = zod_1.z.object({
    ratePlans: zod_1.z.array(exports.OperatorRatePlan),
});
exports.OperatorPropertyList = zod_1.z.object({
    properties: zod_1.z.array(exports.OperatorPropertySummary),
});
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
exports.PublishBlocker = zod_1.z.enum([
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
]);
exports.PUBLISH_BLOCKER_LABEL = {
    org_not_active: "Publishing opens once your business is approved.",
    missing_name: "Give the property a name.",
    missing_sector: "Choose the sector the property is in.",
    no_active_room_type: "Add at least one room type.",
    no_priced_room_type: "At least one room type needs a price.",
    no_sellable_room: "At least one room has to be available to sell.",
    no_photo: "Add at least one photograph of the property.",
};
/** Which screen a blocker sends the operator back to. */
function stepForPublishBlocker(blocker) {
    switch (blocker) {
        case "org_not_active":
            return "registration";
        case "missing_name":
        case "missing_sector":
            return "property";
        case "no_active_room_type":
        case "no_priced_room_type":
        case "no_sellable_room":
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
    name: zod_1.z
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
    maxGuests: zod_1.z
        .number()
        .int()
        .positive("A room sleeps at least one person.")
        .max(50, "That is more people than a room type should hold."),
    /** RWF, whole units. The currency is `RWF` everywhere and is not asked. */
    basePriceRwf: zod_1.z
        .number()
        .int()
        .nonnegative("A price cannot be negative.")
        .max(100000000, "That price is outside what we can record.")
        .nullable(),
    bookingMode: booking_1.BookingMode.optional(),
    cancellationTier: booking_1.CancellationTier.optional(),
    /** How many rooms of this type exist. Seeds nothing; `rooms` is the truth. */
    roomCount: zod_1.z.number().int().positive().max(10000).optional(),
};
/**
 * What one physical room or unit is called on the door: `101`, `Tent 4`,
 * `Apartment B2`. Unique within its property, which the service enforces.
 */
exports.RoomLabel = zod_1.z
    .string()
    .trim()
    .min(1, "Give every room a number or a name.")
    .max(60, "That room name is too long.");
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
exports.CreateRoomTypeRequest = exports.WorkspaceScoped.extend({
    ...roomTypeFields,
    roomLabels: zod_1.z.array(exports.RoomLabel).max(500, "Add at most 500 rooms at once.").optional(),
});
/**
 * Editing a room type replaces only the fields sent, like every other operator
 * edit here, and adds the one field a create cannot send: archiving it.
 */
exports.UpdateRoomTypeRequest = exports.WorkspaceScoped.extend(zod_1.z.object({
    ...roomTypeFields,
    status: zod_1.z.enum(["active", "archived"]),
}).partial().shape);
/** A room type, as its owner sees it. */
exports.OperatorRoomType = zod_1.z.object({
    id: primitives_1.Uuid,
    propertyId: primitives_1.Uuid,
    name: zod_1.z.string(),
    domain: primitives_1.Domain,
    status: zod_1.z.enum(["active", "archived"]),
    maxGuests: zod_1.z.number().int().nullable(),
    basePriceRwf: zod_1.z.number().int().nullable(),
    bookingMode: booking_1.BookingMode.nullable(),
    cancellationTier: booking_1.CancellationTier.nullable(),
    roomCount: zod_1.z.number().int(),
    sellableRoomCount: zod_1.z.number().int(),
    /** The plan this type sells on by default. Exactly one, always. */
    defaultRatePlanId: primitives_1.Uuid.nullable(),
});
exports.OperatorRoomTypeList = zod_1.z.object({
    roomTypes: zod_1.z.array(exports.OperatorRoomType),
});
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
    name: zod_1.z
        .string()
        .trim()
        .min(2, "Give the rate plan a name.")
        .max(200, "That name is too long for our records."),
    basePriceRwf: zod_1.z
        .number()
        .int()
        .nonnegative("A price cannot be negative.")
        .max(100000000, "That price is outside what we can record.")
        .nullable(),
    /** How many people the base price covers. Commercial, not physical. */
    baseOccupancy: zod_1.z.number().int().positive().max(50).optional(),
    cancellationTier: booking_1.CancellationTier.optional(),
    nonRefundable: zod_1.z.boolean().optional(),
    bookingMode: booking_1.BookingMode.optional(),
    isDefault: zod_1.z.boolean().optional(),
};
exports.CreateRatePlanRequest = exports.WorkspaceScoped.extend(ratePlanFields);
exports.UpdateRatePlanRequest = exports.WorkspaceScoped.extend(zod_1.z.object({
    ...ratePlanFields,
    status: zod_1.z.enum(["active", "archived"]),
}).partial().shape);
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
exports.AttachPropertyPhotoRequest = exports.WorkspaceScoped.extend({
    objectKey: zod_1.z.string().min(1),
    /** Appended last when absent, which is what an operator adding one expects. */
    position: zod_1.z.number().int().nonnegative().optional(),
    /** The first photograph on a property becomes the cover whatever this says. */
    isCover: zod_1.z.boolean().optional(),
    caption: zod_1.z.string().trim().max(300).optional(),
});
/**
 * Reorder, re caption, or move the cover, in one call.
 *
 * One call rather than a PATCH per photograph because reordering is ONE act: a
 * drag that lands renumbers several rows at once, and applying that as five
 * requests leaves the order half written when the fourth one fails.
 */
exports.ReorderPropertyPhotosRequest = exports.WorkspaceScoped.extend({
    photos: zod_1.z
        .array(zod_1.z.object({
        id: primitives_1.Uuid,
        position: zod_1.z.number().int().nonnegative(),
        isCover: zod_1.z.boolean().optional(),
        caption: zod_1.z.string().trim().max(300).nullable().optional(),
    }))
        .min(1, "Name at least one photograph."),
});
exports.PropertyPhotoList = zod_1.z.object({
    photos: zod_1.z.array(exports.PropertyPhoto),
});
/**
 * A stored property photograph, as the upload route reports it back.
 *
 * A sibling of `UploadedObject` rather than a widening of it: that shape pins
 * `kind` to the literal `certificate`, and the registration wizard parses
 * against it. Loosening it to an enum would weaken a check that is already doing
 * its job, to save declaring five fields.
 */
exports.UploadedPropertyPhoto = zod_1.z.object({
    objectKey: zod_1.z.string().min(1),
    kind: zod_1.z.literal("property_photo"),
    mime: zod_1.z.string(),
    sizeBytes: zod_1.z.number().int().nonnegative(),
    filename: zod_1.z.string(),
    /** A short lived signed read, so the operator sees the picture immediately. */
    url: zod_1.z.string(),
});
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
exports.InventoryRoom = zod_1.z.object({
    id: primitives_1.Uuid,
    roomTypeId: primitives_1.Uuid,
    label: zod_1.z.string().nullable(),
    status: ops_1.RoomStatus,
    /** New rooms are `clean`, the column default: nobody has slept in them. */
    housekeeping: ops_1.HousekeepingStatus,
});
exports.InventoryRoomList = zod_1.z.object({
    rooms: zod_1.z.array(exports.InventoryRoom),
});
/** Add rooms to a room type, each with the label on its door. */
exports.CreateRoomsRequest = exports.WorkspaceScoped.extend({
    labels: zod_1.z
        .array(exports.RoomLabel)
        .min(1, "Add at least one room.")
        .max(500, "Add at most 500 rooms at once."),
});
/**
 * Renumber a room, or take it out of what can be sold.
 *
 * `status` is the SALES state (available, maintenance, out of service). Whether
 * it is clean stays housekeeping's, on `POST /ops/rooms/:id/housekeeping`.
 */
exports.UpdateRoomRequest = exports.WorkspaceScoped.extend({
    label: exports.RoomLabel.optional(),
    status: ops_1.RoomStatus.optional(),
});
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
exports.PropertySetupCounts = zod_1.z.object({
    properties: zod_1.z.number().int(),
    contactDetails: zod_1.z.number().int(),
    departments: zod_1.z.number().int(),
    departmentHeads: zod_1.z.number().int(),
    roomTypes: zod_1.z.number().int(),
    pricedRoomTypes: zod_1.z.number().int(),
    rooms: zod_1.z.number().int(),
    photos: zod_1.z.number().int(),
    amenities: zod_1.z.number().int(),
    outlets: zod_1.z.number().int(),
    /** Members other than owners, plus invitations still waiting to be accepted. */
    staff: zod_1.z.number().int(),
    published: zod_1.z.number().int(),
});
exports.PropertySetupProgress = zod_1.z.object({
    orgId: primitives_1.Uuid,
    legalName: zod_1.z.string(),
    domain: primitives_1.Domain,
    accommodationClass: zod_1.z.string().nullable(),
    /**
     * Free-text when `accommodationClass` is `other` (coffee shop, bar &
     * restaurant, etc.). Null on the eight lodging classes and on residence.
     */
    accommodationClassOther: zod_1.z.string().nullable(),
    /**
     * RDB entity group on the org. Coffee shops and bars land in
     * `restaurant_bar_nightclub`; hotels in `accommodation`. Drives setup
     * vocabulary so a venue is not asked for rooms.
     */
    entityGroup: zod_1.z.string().nullable(),
    propertyId: primitives_1.Uuid.nullable(),
    propertyName: zod_1.z.string().nullable(),
    counts: exports.PropertySetupCounts,
});
//# sourceMappingURL=inventory.js.map