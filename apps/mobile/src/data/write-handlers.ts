/**
 * Every queued write's handler, registered once, at import.
 *
 * `app/_layout.tsx` imports this module, so by the time the root layout reads
 * the queue back from the keychain and drains it, all six kinds can be sent.
 *
 * ## Why this exists
 *
 * Handlers used to be registered by `useOfflineSubmit` in an effect, which ran
 * only while the screen owning that write was mounted. The queue persists
 * across a process kill, which is its whole point, and after a cold start the
 * screen that queued an item is usually NOT mounted. A drain then found no
 * handler and marked the person's intent `failed-retryable` with
 * `queue.noHandler`, "This app does not know how to send that yet", about a
 * message it had sent a hundred times before the restart.
 *
 * `useOfflineSubmit` still registers a handler for a kind nobody registered,
 * as a fallback for a screen rendered without this module (a screen test). It
 * never replaces one registered here.
 *
 * ## `fixtureBacked`
 *
 * Five of the six still land in the in-memory fixture store. They are marked,
 * so the queue never uploads their attachments to `POST /uploads`: nothing on
 * a server would ever reference those object keys. `recordPayment` writes to
 * the API and is not marked.
 */
import { queryClient } from '@/lib/query-client';
import { landlordKeys } from '@/lib/query-keys';
import { registerHandler } from './write-queue';
import { fileTicketHandler } from './tickets';
import { saveToggleHandler } from './saved';
import { sendMessageHandler } from './threads';
import { revealHandler } from './broker';
import { checkInHandler } from '@/screens/host/host-store';
import { recordPaymentHandler, type RecordRentIntent } from '@/queries/landlord';

let registered = false;

/** Idempotent. Called below at import; exported for a test that resets the queue. */
export function registerWriteHandlers(): void {
  if (registered) return;
  registered = true;

  registerHandler('fault', fileTicketHandler, { fixtureBacked: true });
  registerHandler('save', saveToggleHandler, { fixtureBacked: true });
  registerHandler('message', sendMessageHandler, { fixtureBacked: true });
  registerHandler('reveal', revealHandler, { fixtureBacked: true });
  registerHandler('checkIn', checkInHandler, { fixtureBacked: true });

  registerHandler<RecordRentIntent>('recordPayment', async (intent, context) => {
    const outcome = await recordPaymentHandler(intent, context);
    // The rent roll the payment belongs to is stale the moment it lands. A
    // replay runs with no screen mounted, so the invalidation happens here.
    if (outcome.status === 'ok') {
      void queryClient.invalidateQueries({ queryKey: landlordKeys.rentRoll(intent.workspaceId) });
    }
    return outcome;
  });
}

/** Tests only: allow `registerWriteHandlers` to run again after `resetQueue`. */
export function resetWriteHandlersForTest(): void {
  registered = false;
}

registerWriteHandlers();
