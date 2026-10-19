/**
 * The stays area on the API, through the screens' own mutations and live sources:
 *
 *   - Messages: the desk replies to a guest, a conversation closed after checkout refuses a reply, and a
 *     housekeeper (no `message.send`) is refused;
 *   - Stay and folio: a desk charge is posted before tax (its VAT read back folded into the line), a
 *     replayed press posts nothing new, the charge is voided with a reversing line, and cash is recorded
 *     exactly as typed, once per press; a housekeeper is refused;
 *   - Checkout: the next guest due out settles the rest in cash and is checked out; the stay closes, the
 *     bill closes at zero, the room goes to Dirty, Checkout moves on to the next guest, and the accountant
 *     (bills, but no `stay.checkout`) is refused.
 *
 * Targets are chosen from the live day (the next guest due out), never by fixture id, so a flow fails
 * with a reason when the day has run out of them (reseed with `node server/api/scripts/seed-interface.mjs`).
 */
import type { Departure, DeskRoom } from "@injishi/data/fixtures/frontdesk";
import type {
  ChargeDepartment,
  CheckoutCase,
  FolioLine,
  FolioPayment,
  MessageThread,
  Stay,
  StayRecord,
} from "@injishi/data/fixtures/stays";
import {
  checkOutStay,
  postFolioCharge,
  sendGuestMessage,
  takeCashPayment,
  voidFolioCharge,
} from "../../src/server/mutations/stays";
import { sources as desk } from "../../src/server/sources/frontdesk";
import { sources } from "../../src/server/sources/stays";
import type { SourceContext } from "../../src/server/sources/types";
import type { Flow } from "./types";

/** The stay page's collections, read as the page reads them: the stay first, then its bill. */
async function stayPage(ctx: SourceContext, ref: string) {
  const stay = (await sources["stays.stays"].get?.(ctx, ref)) as Stay | undefined;
  if (!stay) throw new Error(`stay ${ref} is not on the desk`);
  const lines = (await sources["stays.folioLines"].list(ctx)) as FolioLine[];
  const payments = (await sources["stays.folioPayments"].list(ctx)) as FolioPayment[];
  const records = (await sources["stays.stayRecords"].list(ctx)) as StayRecord[];
  const charges = lines.reduce((n, l) => n + l.amount, 0);
  const paid = payments.filter((p) => p.counted).reduce((n, p) => n + p.amount, 0);
  return { stay, lines, payments, records, balance: charges - paid };
}

export const flows: Flow[] = [
  {
    name: "the desk replies to a guest, a closed conversation refuses a reply, a housekeeper cannot reply",
    async run({ as, check, refused, step }) {
      const eric = await as("frontdesk");
      const threads = (await sources["stays.threads"].list(eric)) as MessageThread[];
      const open = threads.find((t) => !t.closed && t.status === "Open");
      check(open, "no open conversation is waiting on the desk; reseed the interface world");
      const closed = threads.find((t) => t.closed);
      check(closed, "no closed conversation to probe the refusal with");

      const body = `Flow check ${new Date().toISOString()}: your room is being prepared.`;
      await sendGuestMessage(eric, open.id, body);
      const after = ((await sources["stays.threads"].list(eric)) as MessageThread[]).find((t) => t.id === open.id);
      const last = after?.messages.at(-1);
      check(last?.t === "staff" && last.text === body, `the conversation ends with ${JSON.stringify(last)}`);
      check(after?.status === "Waiting on guest", `after the reply the conversation reads ${after?.status}`);
      step(`Eric replied to ${open.name}: the reply is on the conversation, which now waits on the guest`);

      await refused(
        409,
        () => sendGuestMessage(eric, closed.id, "Hello again"),
        "replying on a conversation closed after checkout",
      );
      step(`${closed.name}'s conversation, closed after checkout, refuses a reply with 409`);

      const jeanne = await as("housekeeper");
      await refused(403, () => sendGuestMessage(jeanne, open.id, "Hello"), "a housekeeper replying to a guest");
      step("a housekeeper (no message.send) is refused with 403");
    },
  },
  {
    name: "a desk charge is posted before tax and voided with a reversal, cash is recorded as typed, once per press",
    async run({ as, check, refused, step }) {
      const eric = await as("frontdesk");
      const [next] = (await sources["stays.stays"].list(eric)) as Stay[];
      check(next, "nobody is in house; reseed the interface world");
      const ref = next.id;
      const before = await stayPage(await as("frontdesk"), ref);
      const [dept] = (await sources["stays.chargeDepartments"].list(eric)) as ChargeDepartment[];
      check(dept, "the property has no revenue department a desk charge can earn for");

      const jeanne = await as("housekeeper");
      const charge = {
        stayRef: ref,
        department: dept.id,
        amountRwf: 10_000,
        description: "Flow check minibar",
        reason: "Minibar count",
        idempotencyKey: crypto.randomUUID(),
      };
      await refused(403, () => postFolioCharge(jeanne, charge), "a housekeeper posting a charge");
      step("a housekeeper (no folio.charge) is refused with 403");

      const posted = await postFolioCharge(eric, charge);
      const afterPost = await stayPage(await as("frontdesk"), ref);
      const line = afterPost.lines.find((l) => l.id === posted.chargeId);
      check(line, `the charge ${posted.chargeId} is not on ${ref}'s bill`);
      check(line.title === "Flow check minibar · Minibar count", `the line reads ${line.title}`);
      check(line.amount > 10_000 && line.mine && line.dept === dept.id, `the line reads ${JSON.stringify(line)}`);
      check(
        afterPost.balance === before.balance + line.amount,
        `the balance moved from ${before.balance} to ${afterPost.balance}, the line is ${line.amount}`,
      );
      // The press replayed (a retry, a second tab): the API answers with the first charge and posts nothing.
      await postFolioCharge(eric, charge);
      const replayed = await stayPage(await as("frontdesk"), ref);
      check(replayed.lines.length === afterPost.lines.length, "the replayed press posted a second line");
      step(
        `posted RWF 10,000 before VAT to ${dept.id} on ${ref}: it reads RWF ${line.amount} with its VAT, mine, and a replayed press posted nothing`,
      );

      const voided = await voidFolioCharge(eric, {
        stayRef: ref,
        chargeId: line.id,
        reason: "Wrong amount",
        idempotencyKey: crypto.randomUUID(),
      });
      const afterVoid = await stayPage(await as("frontdesk"), ref);
      const original = afterVoid.lines.find((l) => l.id === line.id);
      const reversal = afterVoid.lines.find(
        (l) => l.reversal && l.title === `Reversal of ${charge.description} · ${charge.reason}`,
      );
      check(original?.voided, `the voided line reads ${JSON.stringify(original)}`);
      check(reversal?.amount === -line.amount, `the reversal reads ${JSON.stringify(reversal)}`);
      check(afterVoid.balance === before.balance && voided.balanceRwf === before.balance, "the void did not net out");
      step(
        "voided with a reason: the original stays, struck, and a reversal of the same amount (VAT with it) nets it out",
      );

      const cash = { stayRef: ref, amountRwf: 5_000, idempotencyKey: crypto.randomUUID() };
      await takeCashPayment(eric, cash);
      await takeCashPayment(eric, cash);
      const afterCash = await stayPage(await as("frontdesk"), ref);
      const cashLines = afterCash.payments.filter((p) => !before.payments.some((b) => b.id === p.id));
      check(cashLines.length === 1, `${cashLines.length} payment lines for one press`);
      check(
        cashLines[0]?.amount === 5_000 && cashLines[0].tender === "Cash" && cashLines[0].counted,
        "cash reads wrong",
      );
      check(afterCash.balance === before.balance - 5_000, `the balance reads ${afterCash.balance}`);
      // Today's Departures reads the same bill.
      const row = ((await desk["frontdesk.departures"].list(await as("frontdesk"))) as Departure[]).find(
        (d) => d.bookingId === afterCash.stay.bookingId,
      );
      if (row) check(row.balance === afterCash.balance, `Today shows ${row.balance}, the bill ${afterCash.balance}`);
      step(
        `RWF 5,000 cash recorded exactly as typed, once though the press was sent twice (balance ${afterCash.balance})`,
      );
    },
  },
  {
    name: "the next guest due out settles in cash and is checked out; the accountant cannot check anyone out",
    async run({ as, check, refused, step }) {
      const eric = await as("frontdesk");
      const [c] = (await sources["stays.checkouts"].list(eric)) as CheckoutCase[];
      check(c, "nobody is due out; reseed the interface world");
      const finance = await as("finance");
      await refused(403, () => checkOutStay(finance, c.stayId), "the accountant checking a guest out");
      step("the accountant (bills, but no stay.checkout) is refused with 403");

      if (c.guestShare > 0) {
        await takeCashPayment(eric, {
          stayRef: c.stayId,
          amountRwf: c.guestShare,
          idempotencyKey: crypto.randomUUID(),
        });
      }
      const settled = await stayPage(await as("frontdesk"), c.stayId);
      check(settled.balance === 0, `${c.stayId} still reads ${settled.balance} after settling`);

      const out = await checkOutStay(eric, c.stayId);
      check(
        out.folioStatus === "closed" && out.balanceRwf === 0,
        `the bill reads ${out.folioStatus} ${out.balanceRwf}`,
      );
      const after = await stayPage(await as("frontdesk"), c.stayId);
      const stayRecord = after.records.find((r) => r.kind === "Stay");
      const folioRecord = after.records.find((r) => r.kind === "Folio");
      check(stayRecord?.current === 3, `the stay record reads ${JSON.stringify(stayRecord)}`);
      check(folioRecord?.current === 2, `the folio record reads ${JSON.stringify(folioRecord)}`);
      const room = ((await desk["frontdesk.rooms"].list(await as("frontdesk"))) as DeskRoom[]).find(
        (r) => r.room === c.room,
      );
      check(room?.status === "dirty", `room ${c.room} reads ${JSON.stringify(room)}`);
      const [nextUp] = (await sources["stays.checkouts"].list(await as("frontdesk"))) as CheckoutCase[];
      check(nextUp?.stayId !== c.stayId, "Checkout still opens on the guest who left");
      await refused(409, () => checkOutStay(eric, c.stayId), "checking the same guest out twice");
      step(
        `${c.guest} (${c.stayId}) paid the RWF ${c.guestShare} left in cash and checked out: bill ${out.folioNumber} closed at zero, room ${c.room} Dirty, Checkout moved on to ${nextUp?.guest ?? "nobody"}`,
      );
    },
  },
];
