// What a read or a send learns about the session, told to the session provider (mobile spec 0003):
// the API answered 401 (the session expired), or `403 two_factor_required` (the step up is owed). A
// small bridge, so the outbox and the query layer need not import the React provider.

type Listener = () => void;

const listeners = { signedOut: new Set<Listener>(), stepUp: new Set<Listener>() };

export const sessionEvents = {
  /** The API said this session is no longer signed in. */
  signedOut(): void {
    for (const listener of listeners.signedOut) listener();
  },
  /** The API asked for the emailed step up code. */
  stepUpRequired(): void {
    for (const listener of listeners.stepUp) listener();
  },
  on(event: keyof typeof listeners, listener: Listener): () => void {
    listeners[event].add(listener);
    return () => listeners[event].delete(listener);
  },
};
