// A write's key (mobile spec 0003, the outbox child's Ids): `crypto.randomUUID()` where the runtime has
// it, else a version 4 UUID from `Math.random`. The key only has to be unique per account, because the
// server scopes keys by user. Milestone 4 switches this to expo-crypto's `randomUUID`.

export function newId(): string {
  const native = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID;
  if (typeof native === "function") return native.call(globalThis.crypto);
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const variant = ((Math.floor(Math.random() * 4) + 8) as number).toString(16);
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}
