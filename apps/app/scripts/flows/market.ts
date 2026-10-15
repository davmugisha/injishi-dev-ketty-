/**
 * The marketplace and Sarah Kimani's web account, on the API, through the mutations the screens call:
 * the heart, a named list (create, add, rename, remove, delete), consent, contact details, and a booking
 * paid by mobile money on the mock rail, then cancelled. Guest routes declare no permission (ownership is
 * the guard), so the refusals are another person's list answering 404, a visitor with no session
 * answering 401, and a required consent that cannot be turned off answering 409.
 */
import type {
  GuestConsent,
  GuestProfile,
  MarketListing,
  PastTrip,
  SavedCollection,
  UpcomingTrip,
} from "@injishi/data/fixtures/market";
import {
  addToCollection,
  bookCheckout,
  cancelBooking,
  createCollection,
  deleteCollection,
  paymentAttempt,
  removeFromCollection,
  renameCollection,
  saveContact,
  setConsent,
  setSaved,
} from "../../src/server/mutations/market";
import { catalogue, sources } from "../../src/server/sources/market";
import { contextFor } from "../lib/harness";
import type { Flow } from "./types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const flows: Flow[] = [
  {
    name: "the heart saves a place and takes it off again, and a visitor with no session is refused",
    async run({ as, check, refused, step }) {
      const sarah = await as("guest");
      const listings = (await sources["market.listings"].list(sarah)) as MarketListing[];
      const target = listings.find((l) => !l.saved && l.mode === "stays");
      check(target, "every stay is already saved: nothing to heart");

      await setSaved(sarah, target.id, true);
      const after = (await sources["market.listings"].list(sarah)) as MarketListing[];
      check(after.find((l) => l.id === target.id)?.saved === true, `${target.name} is not saved after the heart`);
      // A second heart is the same row (ADR-032), never an error.
      await setSaved(sarah, target.id, true);
      step(`Sarah hearted ${target.name}; Explore shows it saved`);

      await setSaved(sarah, target.id, false);
      const off = (await sources["market.listings"].list(sarah)) as MarketListing[];
      check(off.find((l) => l.id === target.id)?.saved === false, `${target.name} is still saved after unhearting`);
      await refused(404, () => setSaved(sarah, target.id, false), "unhearting a place that is not saved");
      step("unhearted: Explore shows it unsaved, and a second unheart is a 404");

      const visitor = await contextFor(null);
      await refused(401, () => setSaved(visitor, target.id, true), "a visitor with no session hearting a place");
      step("a visitor with no session is refused with 401");
    },
  },
  {
    name: "a named list is created, filled, renamed, emptied and deleted; another person cannot touch it",
    async run({ as, check, refused, step }) {
      const sarah = await as("guest");
      const owner = await as("owner");
      const place = (await catalogue(sarah)).find((c) => c.domain === "residence");
      check(place, "the marketplace lists no home");

      const created = await createCollection(sarah, "Flow · Kigali weekend");
      const read = async () =>
        ((await sources["market.savedCollections"].list(sarah)) as SavedCollection[]).find((c) => c.id === created.id);
      check((await read())?.name === "Flow · Kigali weekend", "the new list is not on the account page");
      step(`Sarah created a list (${created.id})`);

      await addToCollection(sarah, created.id, place.id);
      const filled = await read();
      check(
        filled?.items.length === 1 && filled.items[0]?.name === place.name,
        `the list reads ${JSON.stringify(filled)}`,
      );
      check(filled.noun === "homes", `a list of homes is called "${filled.noun}"`);
      step(`added ${place.name}: the list holds one home`);

      await renameCollection(sarah, created.id, "Flow · Kigali homes");
      check((await read())?.name === "Flow · Kigali homes", "the rename did not land");
      step("renamed");

      await refused(
        404,
        () => renameCollection(owner, created.id, "Not yours"),
        "another person renaming Sarah's list",
      );
      await refused(404, () => deleteCollection(owner, created.id), "another person deleting Sarah's list");
      step("Eric (the owner persona) is refused with 404 on Sarah's list");

      // The account page names a saved place by its page address; the mutation resolves it.
      await removeFromCollection(sarah, created.id, filled.items[0].id);
      check((await read())?.items.length === 0, "the place is still in the list after removing it");
      step("removed the place from the list");

      await deleteCollection(sarah, created.id);
      check((await read()) === undefined, "the list is still on the account page after deleting it");
      await refused(404, () => deleteCollection(sarah, created.id), "deleting a list twice");
      step("deleted: gone from the account page, and a second delete is a 404");
    },
  },
  {
    name: "consent and contact details are changed and read back; booking messages cannot be turned off",
    async run({ as, check, refused, step }) {
      const sarah = await as("guest");
      const consents = async () => (await sources["market.consents"].list(sarah)) as GuestConsent[];
      const before = (await consents()).find((c) => c.id === "offers");
      check(before, "the offers switch is missing");

      await setConsent(sarah, "offers", !before.on);
      check((await consents()).find((c) => c.id === "offers")?.on === !before.on, "the offers choice did not change");
      await setConsent(sarah, "offers", before.on);
      check(
        (await consents()).find((c) => c.id === "offers")?.on === before.on,
        "the offers choice did not change back",
      );
      step(`offers switched ${before.on ? "off and on" : "on and off"} (two new consent rows)`);

      await refused(409, () => setConsent(sarah, "msg", false), "turning booking messages off");
      step("turning booking messages off is refused with 409");

      const profile = async () => ((await sources["market.guestProfiles"].list(sarah)) as GuestProfile[])[0];
      const was = await profile();
      check(was, "Sarah has no profile");
      await saveContact(sarah, { name: was.name, phone: "+254 700 111 222", country: "Kenya", locale: "rw" });
      const now = await profile();
      check(now?.mobile === "+254700111222" && now.language === "rw", `the profile reads ${JSON.stringify(now)}`);
      step("mobile and language saved and read back");
      await refused(
        400,
        () => saveContact(sarah, { name: was.name, phone: "", country: "Atlantis", locale: "en" }),
        "an unknown country",
      );
      await saveContact(sarah, { name: was.name, phone: was.mobile, country: was.country, locale: was.language });
      check((await profile())?.mobile === was.mobile, "the profile was not restored");
      step("an unknown country is refused with 400; the profile is restored");
    },
  },
  {
    name: "Sarah books the featured stay by mobile money, it lands in Upcoming, she cancels, it moves to Past",
    async run({ as, check, refused, step }) {
      const sarah = await as("guest");
      const token = crypto.randomUUID();
      const outcome = await bookCheckout(sarah, "instant", { network: "mtn_momo", number: "078 812 4417" }, token);
      let reference = outcome.status === "confirmed" ? outcome.booking.reference : outcome.attempt.booking?.reference;
      if (outcome.status === "awaiting_payment") {
        step("the prompt is on the handset (mock rail): polling");
        for (let i = 0; i < 30 && !reference; i++) {
          await sleep(1000);
          const attempt = await paymentAttempt(sarah, token);
          check(attempt.state === "prompting" || attempt.state === "confirmed", `the attempt became ${attempt.state}`);
          reference = attempt.booking?.reference;
        }
      }
      check(reference, "the payment never settled into a booking");
      step(`booked ${reference}`);

      // The same press again is the same intent, never a second charge.
      const replay = await bookCheckout(sarah, "instant", { network: "mtn_momo", number: "078 812 4417" }, token);
      const replayRef = replay.status === "confirmed" ? replay.booking.reference : replay.attempt.booking?.reference;
      check(replayRef === reference, `replaying the press made ${replayRef}, not ${reference}`);

      const upcoming = (await sources["market.upcomingTrips"].list(sarah)) as UpcomingTrip[];
      const trip = upcoming.find((t) => t.id === reference);
      check(
        trip?.facts.some((f) => f.chip === "Paid"),
        `Upcoming reads ${JSON.stringify(trip)}`,
      );
      step("Upcoming shows it paid");

      const owner = await as("owner");
      await refused(404, () => cancelBooking(owner, reference), "another person cancelling Sarah's booking");

      await cancelBooking(sarah, reference);
      const past = (await sources["market.pastTrips"].list(sarah)) as PastTrip[];
      const gone = past.find((t) => t.id === reference);
      check(gone?.dates.startsWith("Cancelled"), `Past reads ${JSON.stringify(gone)}`);
      check(
        !((await sources["market.upcomingTrips"].list(sarah)) as UpcomingTrip[]).some((t) => t.id === reference),
        "the cancelled booking is still upcoming",
      );
      step(`cancelled: Past shows "${gone.dates}" and "${gone.money.chip}"`);
    },
  },
];
