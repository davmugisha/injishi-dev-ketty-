import type { GuestThread, OrderableList, OrderableOutlet } from "@injishi/contracts";
import type { ApiResult } from "@/lib/api";

/**
 * Whether a conversation may be ordered into, and from which outlets
 * (ADR-050 D-n, D-s).
 *
 * THE BUG THIS REPLACES was one line in `conversation-screen.tsx`:
 *
 *     thread.status === "active" && (thread.scope === "stay" || thread.kind === "department_request")
 *
 * a guess made in the browser from two fields that describe what a thread IS,
 * not what its reader may do. A guest checked in at Amahoro, with their own
 * booking's `reservation` thread open, was offered nothing — while
 * `GET /me/orderable` answered with an outlet for that very person. The thread's
 * shape was never the question.
 *
 * The question is the server's, and it is the only one that has the inputs:
 * the caller's open stays, each outlet's ordering policy, its hours, its stock.
 * So this module asks it (`GET /me/orderable?propertyId=…`) and reads the
 * answer. It decides ONLY three things the answer does not state outright:
 * when it is not worth asking at all, what an unreadable answer means, and
 * which outlets in the answer belong to this conversation.
 *
 * `apps/web/tests/thread-ordering.test.mjs` exercises it over (status,
 * propertyId, answer), the reservation-thread case included.
 */

/** Everything a conversation needs from its thread to decide about ordering. */
type OrderableThread = Pick<GuestThread, "status" | "propertyId">;

type ThreadOrdering =
  /**
   * Not worth asking, and the reason. An archived conversation would have its
   * order refused with a 409, and a thread with no resolvable property has no
   * `propertyId` to ask about — `GET /me/orderable` with no property answers
   * about the caller's stays generally, which would offer a Kigali café inside
   * a conversation with a Musanze lodge.
   */
  | { state: "unavailable"; reason: "archived" | "no-property" }
  /** Asked, still waiting. The composer shows nothing rather than a false no. */
  | { state: "asking" }
  /** Asked and answered: nothing here takes an order from this person now. */
  | { state: "none" }
  /** At least one outlet at this conversation's property. */
  | { state: "offered"; outlets: OrderableOutlet[] };

/**
 * Is it worth calling `GET /me/orderable` for this thread at all?
 *
 * Exported so the screen's effect can skip the request instead of firing one
 * whose answer it would throw away — an archived conversation from 2024 should
 * not cost a policy resolution every time somebody scrolls back through it.
 */
export function mayAskOrderable(thread: OrderableThread): boolean {
  return thread.status === "active" && thread.propertyId !== null;
}

/**
 * The verdict, given the thread and whatever `GET /me/orderable?propertyId=…`
 * came back with. `null` means the call has not answered yet.
 *
 * THE ANSWER IS FILTERED BY PROPERTY, and that is not belt-and-braces: the
 * `propertyId` query parameter ADDS a property to the ones resolved from the
 * caller's stays (`guest-ordering.service.ts`), it does not restrict to it. A
 * guest in house at two hotels asking about one gets both back. Offering the
 * wrong hotel's outlet here would produce an order the API then refuses,
 * because `assertOrderableThread` checks the thread's property against the
 * outlet's — so the filter is what keeps the button honest rather than what
 * keeps it tidy.
 *
 * AN UNREADABLE ANSWER IS `none`, not an error. Ordering is an addition to a
 * conversation, and the conversation itself loaded fine; an error banner over
 * a chat because an optional side call timed out is noise about something the
 * reader did not ask for. A signed-out session is not this module's to report
 * either — the screen around it already renders that for the thread read.
 */
export function threadOrdering(
  thread: OrderableThread,
  answer: ApiResult<OrderableList> | null,
): ThreadOrdering {
  if (thread.status === "archived") return { state: "unavailable", reason: "archived" };
  if (thread.propertyId === null) return { state: "unavailable", reason: "no-property" };

  if (answer === null) return { state: "asking" };
  if (answer.status !== "ok") return { state: "none" };

  const outlets = answer.data.outlets.filter((outlet) => outlet.propertyId === thread.propertyId);
  return outlets.length === 0 ? { state: "none" } : { state: "offered", outlets };
}
