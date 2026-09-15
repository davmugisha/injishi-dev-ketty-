"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SETUP_STEP_KEYS = void 0;
exports.currentAccommodationClass = currentAccommodationClass;
exports.setupVocabularyFor = setupVocabularyFor;
exports.setupStepsFor = setupStepsFor;
exports.isSetupStepDone = isSetupStepDone;
exports.setupCompletion = setupCompletion;
const rdb_1 = require("./rdb");
/**
 * What an APPROVED business sets up before it can trade, per kind of business.
 *
 * The ONE definition. The operator app's checklist renders it, the approval mail
 * points at it, and `PropertySetupCounts` is only the raw numbers it is judged
 * against. Neither side decides for itself what "done" means, so a hotel cannot
 * be told it is finished by one screen and unfinished by another.
 *
 * WHY THE STEPS DIFFER. Every business sells the same underlying rows — a
 * property, room types, rooms — but not the same words or the same obligations.
 * A tented camp sells tents and runs a kitchen; an apartment block sells units
 * and runs no restaurant; a landlord lets units by the month and has no
 * departments at all. So the vocabulary and which steps are REQUIRED follow the
 * business, and the underlying calls do not.
 *
 * Nothing here opens a door. The registration gate still decides whether a
 * business may write any of this (D20): these steps only exist once it is
 * `active`, which is the ruling this file was written under (2026-09-13).
 */
/** Every step any business can have, in the order the checklist shows them. */
exports.SETUP_STEP_KEYS = [
    "property",
    "contact",
    "departments",
    "room_types",
    "rooms",
    "photos",
    "amenities",
    "outlets",
    "staff",
    "listing",
];
/** Retired codes read as the class that replaced them (D24). */
const CURRENT_CLASS = {
    town_hotel: "hotel",
    vacation_hotel_resort: "hotel",
    serviced_apartment: "apartment",
    cottage: "lodge",
};
const HOSPITALITY_VOCABULARY = {
    hotel: { typePlural: "Room types", unitPlural: "rooms", unitSingular: "room", pricePeriod: "per night" },
    motel: { typePlural: "Room types", unitPlural: "rooms", unitSingular: "room", pricePeriod: "per night" },
    tented_camp: { typePlural: "Tent types", unitPlural: "tents", unitSingular: "tent", pricePeriod: "per night" },
    guest_house: { typePlural: "Room types", unitPlural: "rooms", unitSingular: "room", pricePeriod: "per night" },
    apartment: { typePlural: "Apartment types", unitPlural: "apartments", unitSingular: "apartment", pricePeriod: "per night" },
    lodge: { typePlural: "Room and cottage types", unitPlural: "rooms and cottages", unitSingular: "room", pricePeriod: "per night" },
    villa: { typePlural: "Villa types", unitPlural: "villas", unitSingular: "villa", pricePeriod: "per night" },
    other: { typePlural: "Room types", unitPlural: "rooms", unitSingular: "room", pricePeriod: "per night" },
};
const RESIDENCE_VOCABULARY = {
    typePlural: "Unit types",
    unitPlural: "units",
    unitSingular: "unit",
    pricePeriod: "per month",
};
/**
 * Which hospitality classes run departments and outlets as a matter of course.
 *
 * A hotel, motel, lodge and tented camp run a front office, housekeeping and a
 * kitchen with somebody in charge of each, so departments are REQUIRED and
 * outlets (a restaurant, a bar) are offered. A guest house, an apartment block,
 * a villa or an unusual business often runs with the owner doing all of it, so
 * departments are recommended rather than demanded, and outlets are still
 * offered for the ones that do serve food.
 */
const RUNS_DEPARTMENTS = new Set([
    "hotel",
    "motel",
    "lodge",
    "tented_camp",
]);
/** Resolve a stored class, retired or unknown, to one the steps are keyed on. */
function currentAccommodationClass(stored) {
    const current = rdb_1.AccommodationClass.safeParse(stored);
    if (current.success)
        return current.data;
    const retired = rdb_1.RetiredAccommodationClass.safeParse(stored);
    if (retired.success)
        return CURRENT_CLASS[retired.data];
    // A hospitality business with no class on file is set up like "other":
    // every step offered, the heavy ones recommended rather than required.
    return "other";
}
/** The words a business uses, for its checklist and its forms. */
function setupVocabularyFor(business) {
    if (business.domain === "residence")
        return RESIDENCE_VOCABULARY;
    return HOSPITALITY_VOCABULARY[currentAccommodationClass(business.accommodationClass)];
}
/**
 * The steps this business sets up, in order.
 *
 * Residence has no departments and no outlets: a landlord lets units, and a
 * restaurant in the building is somebody else's business.
 */
function setupStepsFor(business) {
    const words = setupVocabularyFor(business);
    const residence = business.domain === "residence";
    const cls = residence ? null : currentAccommodationClass(business.accommodationClass);
    const departmentsRequired = cls !== null && RUNS_DEPARTMENTS.has(cls);
    const steps = [
        {
            key: "property",
            title: "Property profile",
            description: residence
                ? "The building tenants will live in: its name, address and house rules."
                : "The place guests will book: its name, address, check-in and check-out times.",
            required: true,
        },
        {
            key: "contact",
            title: "Contact details",
            description: residence
                ? "The phone number and email tenants and officers reach the property on."
                : "The front desk phone number and email guests and officers reach you on.",
            required: true,
        },
    ];
    if (!residence) {
        steps.push({
            key: "departments",
            title: "Departments and heads",
            description: departmentsRequired
                ? "Front office, housekeeping, food and beverage and the rest, each with the name and phone number of its head."
                : "If you run separate teams, name each department and who heads it, with their phone number.",
            required: departmentsRequired,
        });
    }
    steps.push({
        key: "room_types",
        title: words.typePlural,
        description: `What you ${residence ? "let" : "sell"}, how many people each sleeps, and its price ${words.pricePeriod}.`,
        required: true,
    }, {
        key: "rooms",
        title: `Your ${words.unitPlural}`,
        description: `Every ${words.unitSingular} by the number or name on its door, so bookings${residence ? " and leases" : ""} land on a real one and its cleaning status can be tracked.`,
        required: true,
    }, {
        key: "photos",
        title: "Photos",
        description: "Pictures of the property. A listing needs at least one before it can go live.",
        required: true,
    }, {
        key: "amenities",
        title: "Amenities",
        description: residence
            ? "What the building includes: water, parking, security, internet."
            : "What a stay includes: Wi-Fi, breakfast, parking, a pool.",
        required: false,
    });
    if (!residence) {
        steps.push({
            key: "outlets",
            title: "Outlets",
            description: "Restaurants, bars, a spa or a shop guests can order from, and who runs each.",
            required: false,
        });
    }
    steps.push({
        key: "staff",
        title: "Staff members",
        description: residence
            ? "Invite a property manager to help run the building."
            : "Invite your manager, front office and housekeeping staff, each with the role that decides what they can do.",
        required: false,
    }, {
        key: "listing",
        title: "Go live",
        description: residence
            ? "Publish your units so tenants and brokers can find them."
            : "Publish the property on the marketplace so guests can book it.",
        required: false,
    });
    return steps;
}
/** Is one step finished, judged against the counts the API returned? */
function isSetupStepDone(key, counts) {
    switch (key) {
        case "property":
            return counts.properties > 0;
        case "contact":
            return counts.contactDetails > 0;
        case "departments":
            // Seeded departments exist the moment a property does, so "done" is
            // somebody having named who heads at least one of them.
            return counts.departmentHeads > 0;
        case "room_types":
            return counts.pricedRoomTypes > 0;
        case "rooms":
            return counts.rooms > 0;
        case "photos":
            return counts.photos > 0;
        case "amenities":
            return counts.amenities > 0;
        case "outlets":
            return counts.outlets > 0;
        case "staff":
            return counts.staff > 0;
        case "listing":
            return counts.published > 0;
    }
}
/** How much of the checklist is finished: all steps, and the required ones. */
function setupCompletion(steps, counts) {
    let done = 0;
    let requiredDone = 0;
    let requiredTotal = 0;
    for (const step of steps) {
        const finished = isSetupStepDone(step.key, counts);
        if (finished)
            done += 1;
        if (step.required) {
            requiredTotal += 1;
            if (finished)
                requiredDone += 1;
        }
    }
    return { done, total: steps.length, requiredDone, requiredTotal };
}
//# sourceMappingURL=setup-steps.js.map