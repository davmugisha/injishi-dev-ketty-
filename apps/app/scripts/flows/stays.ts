/**
 * Guest conversations on the API: the desk replies to a guest with the Messages screen's own mutation,
 * the reply is read back on the conversation through the live source, a conversation closed after
 * checkout refuses a reply, and a housekeeper (no `message.send`) is refused.
 */
import type { MessageThread } from "@injishi/data/fixtures/stays";
import { sendGuestMessage } from "../../src/server/mutations/stays";
import { sources } from "../../src/server/sources/stays";
import type { Flow } from "./types";

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
];
