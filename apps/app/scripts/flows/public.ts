/**
 * The public help centre on the API: the contact form opens a real support ticket (for a visitor with no
 * session and for a signed-in owner), and its Business choice lists only the branches the signed-in
 * person works at. A request for "my businesses" with no session is refused, and a malformed ticket
 * is refused by the intake's own schema. The hosts page's waitlist joins the API's owner list (and the
 * same address again is recognised, never added twice), and its demo request becomes a support ticket.
 * The API throttles both intakes per client (waitlist 5 an hour), so each run makes few calls.
 */
import type { SupportBusiness } from "@injishi/data/fixtures/public";
import { joinOwnerWaitlist, openSupportTicket, PublicInputError, requestDemo } from "../../src/server/mutations/public";
import { sources } from "../../src/server/sources/public";
import { contextFor } from "../lib/harness";
import type { Flow } from "./types";

export const flows: Flow[] = [
  {
    name: "the help form opens a support ticket, and the Business choice is the person's own branches",
    async run({ as, check, refused, step }) {
      const visitor = await contextFor(null);
      const run = Date.now().toString(36);
      const owner = await as("owner");
      const sarah = await as("guest");

      const mine = (await sources["public.supportBusinesses"].list(owner)) as SupportBusiness[];
      check(
        mine.some((b) => b.name === "Isangano Lakeside Hotel"),
        `the owner's businesses read ${JSON.stringify(mine)}`,
      );
      const none = (await sources["public.supportBusinesses"].list(sarah)) as SupportBusiness[];
      check(none.length === 0, `a guest who works nowhere lists ${JSON.stringify(none)}`);
      check(
        ((await sources["public.supportBusinesses"].list(visitor)) as SupportBusiness[]).length === 0,
        "a visitor lists businesses",
      );
      step(`the owner chooses among ${mine.length} branch(es); Sarah and a visitor among none`);

      const anonymous = await openSupportTicket(visitor, {
        topic: "booking",
        message: "Category: Bookings and channels\n\nFlow check: a visitor asks about a booking.",
        // One address per run: the intake throttles per email, and a rerun must not read as abuse.
        email: `flow.visitor.${run}@app.demo.injishi.com`,
      });
      check(/^[0-9a-f-]{36}$/.test(anonymous.id), `the ticket id is ${anonymous.id}`);
      const signedIn = await openSupportTicket(owner, {
        topic: "payment",
        message: `Category: Payments and refunds\nBusiness: ${mine[0]?.name}\n\nFlow check: a MoMo payment shows Pending.`,
        email: `flow.owner.${run}@app.demo.injishi.com`,
      });
      check(signedIn.id !== anonymous.id, "two submissions made one ticket");
      step(`tickets opened: ${anonymous.id} (visitor) and ${signedIn.id} (owner)`);

      await refused(401, () => visitor.api.get("/api/v1/me/businesses"), "a visitor reading 'my businesses'");
      await refused(
        400,
        () => openSupportTicket(visitor, { topic: "other", message: "x", email: "not an email" }),
        "a ticket with no valid reply address",
      );
      step("no session on /me/businesses is a 401; a ticket with no valid email is a 400");
    },
  },
  {
    name: "the hosts page: Join the waitlist adds an owner once; Request demo opens a support ticket",
    async run({ check, step }) {
      const visitor = await contextFor(null);
      const run = Date.now().toString(36);
      const signup = {
        fullName: "Flow Owner",
        email: `flow.waitlist.${run}@app.demo.injishi.com`,
        phone: "078 300 1122",
        businessName: "Flow Check Guest House (demo)",
        district: "Rubavu",
        propertyType: "guest_house" as const,
        sizeBand: "6_20" as const,
        marketingOptIn: false,
      };
      const joined = await joinOwnerWaitlist(visitor, signup);
      check(
        /^[0-9a-f-]{36}$/.test(joined.id) && !joined.alreadyJoined,
        `the signup answered ${JSON.stringify(joined)}`,
      );
      const again = await joinOwnerWaitlist(visitor, signup);
      check(again.alreadyJoined && again.id === joined.id, `the same address again answered ${JSON.stringify(again)}`);
      step(`${signup.email} joined the owner waitlist (${joined.id}); joining again is recognised, not added`);

      let refused = false;
      try {
        await joinOwnerWaitlist(visitor, { ...signup, district: "Atlantis" });
      } catch (error) {
        refused = error instanceof PublicInputError;
      }
      check(refused, "a district that does not exist was not refused");
      step("a district that is not one of Rwanda's thirty is refused before anything is sent");

      const ticket = await requestDemo(visitor, {
        name: "Flow Owner",
        email: `flow.demo.${run}@app.demo.injishi.com`,
        phone: "078 300 1122",
        business: "Flow Check Guest House (demo)",
        businessType: "Guest house",
        district: "Rubavu",
        heardFrom: "Web search",
        format: "At my property",
      });
      check(/^[0-9a-f-]{36}$/.test(ticket.id), `the demo request answered ${JSON.stringify(ticket)}`);
      step(`Request demo opened support ticket ${ticket.id}`);
    },
  },
];
