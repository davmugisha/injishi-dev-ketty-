// A version number that moves whenever an outbox row changes, so screens read the rows again
// (`useSyncExternalStore` in `index.ts`). The rows themselves stay in SQLite.

type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;

export function notifyOutbox(): void {
  version += 1;
  for (const listener of listeners) listener();
}

export function outboxVersion(): number {
  return version;
}

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
