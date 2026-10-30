// Nothing of an account outlives it on the phone (mobile spec 0003, AC-9, D-k): signing out, or another
// account signing in, deletes its outbox rows, their files and its kept reads.

import { forgetCache, queryClient } from "@/lib/query-client";
import { notifyOutbox } from "./outbox/notify";
import { deleteAccountRows, otherAccounts } from "./outbox/store";

/** Delete everything one account left on this phone. */
export async function wipeAccount(userId: string): Promise<void> {
  // Rows carry no file until milestone 4's photos, which delete theirs here.
  deleteAccountRows(userId);
  queryClient.removeQueries({ queryKey: ["u", userId] });
  await forgetCache(userId);
  notifyOutbox();
}

/** A different account signed in: what the others left is deleted, never sent under this one. */
export async function wipeOtherAccounts(userId: string, alsoForget: string | null): Promise<void> {
  const others = new Set(otherAccounts(userId));
  if (alsoForget && alsoForget !== userId) others.add(alsoForget);
  for (const other of others) await wipeAccount(other);
}
