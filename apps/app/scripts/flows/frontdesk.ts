/**
 * The front desk's day, on the API, through the screens' own mutations and live sources:
 *
 *   - a request to book is approved and another declined (Reservations → Requests);
 *   - an arrival with no room is given one and checked in, and cash counted at the desk lands on the
 *     bill once, however many times the press is replayed (Today → Assign, Check-in);
 *   - a guest who never came is recorded as a no-show, and the room held for them goes back on sale;
 *   - a walk-in is checked in from the walk-in screen into a ready room of the type chosen, with its bill,
 *     and the claim code goes to their email; a guest who booked with an account has nothing to claim;
 *   - a booking is cancelled at the guest's request and refunded on its tier (Reservations → Cancel);
 *   - people without the permission are refused: a housekeeper (no desk permission at all) and the
 *     accountant (reads the money, decides no reservation).
 *
 * Targets are chosen from the live day, not by fixture id, so a flow fails with a reason when the day
 * has run out of them (reseed with `node server/api/scripts/seed-interface.mjs`).
 */
import type {
  Arrival,
  BookingRequest,
  CheckInFile,
  DeskRoom,
  InHouseStay,
  Reservation,
  RoomType,
} from "@injishi/data/fixtures/frontdesk";
import type { Stay } from "@injishi/data/fixtures/stays";
import {
  approveRequest,
  assignRoom,
  cancelReservation,
  checkIn,
  declineRequest,
  markNoShow,
  sendClaimInvite,
  walkIn,
} from "../../src/server/mutations/frontdesk";
import { sources } from "../../src/server/sources/frontdesk";
import { sources as staySources } from "../../src/server/sources/stays";
import type { SourceContext } from "../../src/server/sources/types";
import type { Flow } from "./types";

const list = async <T>(name: keyof typeof sources, ctx: SourceContext) => (await sources[name].list(ctx)) as T[];

export const flows: Flow[] = [
  {
    name: "a request to book is approved, another is declined, and a housekeeper can do neither",
    async run({ as, check, refused, step }) {
      const eric = await as("frontdesk");
      const requests = await list<BookingRequest>("frontdesk.bookingRequests", eric);
      check(requests.length >= 2, `only ${requests.length} requests are waiting; reseed the interface world`);
      const [first, second] = requests;
      check(first.left && first.autoDeclines.startsWith("Auto-declines"), `a request reads ${JSON.stringify(first)}`);

      const jeanne = await as("housekeeper");
      await refused(403, () => approveRequest(jeanne, first.id), "a housekeeper approving a request");
      step("a housekeeper (no reservation.approve) is refused with 403");

      await approveRequest(eric, first.id);
      const afterApprove = await list<BookingRequest>("frontdesk.bookingRequests", eric);
      check(!afterApprove.some((r) => r.id === first.id), `${first.id} is still waiting after approval`);
      const confirmed = (await list<Reservation>("frontdesk.reservations", eric)).find((r) => r.id === first.id);
      check(
        confirmed?.status === "Confirmed" && confirmed.kind !== "request",
        `${first.id} reads ${JSON.stringify(confirmed)}`,
      );
      step(`Eric approved ${first.id} (${first.name}): it left the queue and reads Confirmed in Reservations`);
      await refused(409, () => approveRequest(eric, first.id), "approving an answered request again");

      await declineRequest(eric, second.id);
      const reservations = await list<Reservation>("frontdesk.reservations", eric);
      check(!reservations.some((r) => r.id === second.id), `${second.id} is still listed after it was declined`);
      check(
        !(await list<BookingRequest>("frontdesk.bookingRequests", eric)).some((r) => r.id === second.id),
        `${second.id} is still waiting after it was declined`,
      );
      step(`Eric declined ${second.id} (${second.name}): refunded in full, gone from both lists`);
    },
  },
  {
    name: "an arrival without a room is given one and checked in, and desk cash lands on the bill once",
    async run({ as, check, refused, step }) {
      const eric = await as("frontdesk");
      const arrivals = await list<Arrival>("frontdesk.arrivals", eric);
      const roomless = arrivals.find((a) => !a.room);
      check(roomless, "no arrival without a room is left today; reseed the interface world");
      const rooms = await list<DeskRoom>("frontdesk.rooms", eric);
      const free = rooms.find(
        (r) => r.roomType === roomless.roomType && (r.status === "clean" || r.status === "inspected"),
      );
      check(free, `no ${roomless.roomType} room is ready for ${roomless.name}`);

      const jeanne = await as("housekeeper");
      await refused(403, () => assignRoom(jeanne, roomless.bookingId, free.room), "a housekeeper assigning a room");

      await assignRoom(eric, roomless.bookingId, free.room);
      const assigned = (await list<Arrival>("frontdesk.arrivals", eric)).find(
        (a) => a.bookingId === roomless.bookingId,
      );
      check(assigned?.room === free.room, `after Assign, ${roomless.bookingId} reads room ${assigned?.room}`);
      const heldNow = (await list<DeskRoom>("frontdesk.rooms", eric)).find((r) => r.room === free.room);
      check(
        heldNow?.status === "occupied" && heldNow.note.includes(roomless.bookingId),
        `room ${free.room} reads ${JSON.stringify(heldNow)}`,
      );
      step(
        `Eric gave ${roomless.name} room ${free.room}: Today shows it, and the room reads as held for ${roomless.bookingId}`,
      );

      // The same room for anybody else is the API's to refuse: a hold over a hold.
      const other = (await list<Arrival>("frontdesk.arrivals", eric)).find(
        (a) => a.bookingId !== roomless.bookingId && a.roomType === roomless.roomType,
      );
      if (other) {
        await refused(409, () => assignRoom(eric, other.bookingId, free.room), "holding a held room for another guest");
        step(`holding ${free.room} for ${other.bookingId} as well is refused with 409`);
      }

      const file = (await sources["frontdesk.checkIns"].get?.(eric, roomless.bookingId)) as CheckInFile | undefined;
      check(
        file && !file.stayId && file.rooms.some((r) => r.room === free.room),
        `the check-in file reads ${JSON.stringify(file)?.slice(0, 300)}`,
      );
      const key = crypto.randomUUID();
      const cash = { amountRwf: 20_000, idempotencyKey: key };
      const done = await checkIn(eric, { bookingRef: roomless.bookingId, roomLabel: free.room, cash });
      check(done.stayReference?.startsWith("ST-"), `the stay opened with reference ${done.stayReference}`);
      const stayRow = async () =>
        (await list<InHouseStay>("frontdesk.inHouse", eric)).find((s) => s.stayId === done.stayReference);
      const once = (await stayRow())?.balance;
      // A replayed press (a retry, a second tab) opens nothing new and records the cash once.
      const again = await checkIn(eric, { bookingRef: roomless.bookingId, roomLabel: free.room, cash });
      check(again.stayId === done.stayId, `the replay opened another stay: ${again.stayId}`);
      const inHouse = await stayRow();
      check(inHouse?.balance === once, `the bill moved on the replay: ${once} then ${inHouse?.balance}`);
      check(inHouse && inHouse.room === free.room, `${done.stayReference} is not in house in ${free.room}`);
      check(
        !(await list<Arrival>("frontdesk.arrivals", eric)).some((a) => a.bookingId === roomless.bookingId),
        "the guest is still listed as arriving",
      );
      const after = (await sources["frontdesk.checkIns"].get?.(eric, roomless.bookingId)) as CheckInFile;
      check(
        after.stayId === done.stayReference && after.folioId === done.folioNumber,
        `the check-in file reads ${after.stayId} / ${after.folioId}`,
      );
      // The room the guest paid online is credited at check in (every night, at the locked rate), and the
      // 20,000 counted at the desk once; no night has been charged yet.
      const booked = (await list<Reservation>("frontdesk.reservations", eric)).find((r) => r.id === roomless.bookingId);
      check(booked, `${roomless.bookingId} is not in Reservations`);
      const expected = -(booked.firstNight * booked.nights) - 20_000;
      check(inHouse.balance === expected, `the bill reads ${inHouse.balance}, expected ${expected}`);
      step(
        `checked in to ${free.room} as ${done.stayReference} on bill ${done.folioNumber}; RWF 20,000 cash recorded once though the press was sent twice (balance ${inHouse.balance})`,
      );
    },
  },
  {
    name: "a guest who never came is recorded as a no-show, and their room goes back on sale",
    async run({ as, check, refused, step }) {
      const eric = await as("frontdesk");
      const reservations = await list<Reservation>("frontdesk.reservations", eric);
      const missing = reservations.find((r) => r.kind === "noshow");
      check(missing, "nobody is left not arrived; reseed the interface world");
      check(missing.noShowQuote, `${missing.id} carries no no-show quote`);
      const future = reservations.find((r) => r.kind === "future");
      check(future, "no future booking to probe the refusal with");
      await refused(
        409,
        () => markNoShow(eric, future.id, "Did not arrive · no contact"),
        "a no-show before the arrival day",
      );

      const finance = await as("finance");
      await refused(
        403,
        () => markNoShow(finance, missing.id, "Did not arrive · no contact"),
        "the accountant recording a no-show",
      );
      step("the accountant (money.view, no reservation.approve) is refused with 403; a booking not yet due is 409");

      const heldRoom = missing.room;
      await markNoShow(eric, missing.id, "Did not arrive · no contact");
      const after = (await list<Reservation>("frontdesk.reservations", eric)).find((r) => r.id === missing.id);
      check(after?.status === "No-show" && after.kind === "cancelled", `${missing.id} reads ${JSON.stringify(after)}`);
      check(after.info?.includes("Did not arrive"), `the reason is not on the record: ${after.info}`);
      if (heldRoom) {
        const room = (await list<DeskRoom>("frontdesk.rooms", eric)).find((r) => r.room === heldRoom);
        check(
          room && !room.note.includes(missing.id),
          `room ${heldRoom} is still held for ${missing.id}: ${room?.note}`,
        );
      }
      await refused(409, () => markNoShow(eric, missing.id, "again"), "recording the same no-show twice");
      step(
        `${missing.id} (${missing.guest}) recorded as a no-show: ${missing.noShowQuote.rule} Room ${heldRoom ?? "none"} released`,
      );
    },
  },
  {
    name: "a walk-in is checked in to a ready room of the chosen type with its bill, and gets the claim code by email",
    async run({ as, check, refused, step }) {
      const eric = await as("frontdesk");
      const types = await list<RoomType>("frontdesk.roomTypes", eric);
      const type = types.find((t) => t.free > 0 && !t.soldNote);
      check(type, "no room type has a room free tonight; reseed the interface world");
      const input = {
        roomTypeId: type.id,
        nights: 2,
        guestName: "Flow Walk-in Guest",
        phone: "+250 788 000 111",
        email: "walkin.flow@app.demo.injishi.com",
      };

      const jeanne = await as("housekeeper");
      await refused(403, () => walkIn(jeanne, input), "a housekeeper checking a walk-in in");
      step("a housekeeper (no stay.checkin) is refused with 403");

      const done = await walkIn(eric, input);
      check(done.stayReference?.startsWith("ST-"), `the walk-in opened with reference ${done.stayReference}`);
      const inHouse = (await list<InHouseStay>("frontdesk.inHouse", eric)).find((s) => s.stayId === done.stayReference);
      check(
        inHouse && inHouse.name === input.guestName && inHouse.source === "Walk-in" && inHouse.room === done.room,
        `Today reads ${JSON.stringify(inHouse)}`,
      );
      check(done.folioNumber && inHouse.folioId === done.folioNumber, `the bill reads ${done.folioNumber}`);
      const after = (await list<RoomType>("frontdesk.roomTypes", eric)).find((t) => t.id === type.id);
      check(after?.free === type.free - 1, `${type.name} reads ${after?.free} free, was ${type.free}`);
      const page = (await staySources["stays.stays"].get?.(await as("frontdesk"), done.stayReference ?? "")) as
        | Stay
        | undefined;
      check(
        page?.guest === input.guestName && page.bookingId === "Walk-in",
        `the stay page reads ${JSON.stringify(page)}`,
      );
      step(
        `${input.guestName} checked in as a walk-in to ${type.name} room ${done.room} (${done.stayReference}, bill ${done.folioNumber}); ${type.name} now has ${after?.free} free`,
      );

      // The claim code: the walk-in has no account, so it can be (re)sent to the address on the stay.
      const invite = await sendClaimInvite(eric, done.stayReference ?? done.stayId);
      check(invite.claimCode && invite.email === input.email, `the invite reads ${JSON.stringify(invite)}`);
      step(
        `claim code ${invite.claimCode} ${invite.invitationSent ? "emailed" : "not emailed (mail relay refused)"} to ${invite.email}`,
      );

      // A guest who booked with an account has the stay in their app already: there is nothing to claim.
      const booked = (await list<InHouseStay>("frontdesk.inHouse", eric)).find((s) => s.source !== "Walk-in");
      check(booked, "no booked guest is in house to probe the refusal with");
      await refused(
        409,
        () => sendClaimInvite(eric, booked.stayId),
        "a claim code for a guest who booked with an account",
      );
      step(`a claim code for ${booked.name}, who booked with an Injishi account, is refused with 409`);
    },
  },
  {
    name: "a booking is cancelled at the guest's request and refunded on its tier",
    async run({ as, check, refused, step }) {
      const eric = await as("frontdesk");
      const reservations = await list<Reservation>("frontdesk.reservations", eric);
      const target = reservations.find((r) => r.kind === "future" && r.cancelQuote);
      check(target?.cancelQuote, "no future booking left to cancel; reseed the interface world");
      const quote = target.cancelQuote;

      const jeanne = await as("housekeeper");
      await refused(
        403,
        () => cancelReservation(jeanne, target.id, "Guest changed plans"),
        "a housekeeper cancelling a booking",
      );

      const outcome = await cancelReservation(eric, target.id, "Guest changed plans");
      check(
        outcome.refundRwf === quote.refund && outcome.keptRwf === quote.kept,
        `quoted ${JSON.stringify(quote)}, got ${JSON.stringify(outcome)}`,
      );
      const after = (await list<Reservation>("frontdesk.reservations", eric)).find((r) => r.id === target.id);
      check(after?.status === "Cancelled" && after.kind === "cancelled", `${target.id} reads ${JSON.stringify(after)}`);
      await refused(409, () => cancelReservation(eric, target.id, "again"), "cancelling a cancelled booking");
      step(
        `${target.id} cancelled at the guest's request: RWF ${outcome.refundRwf} refunded, RWF ${outcome.keptRwf} kept, exactly as quoted`,
      );
    },
  },
];
