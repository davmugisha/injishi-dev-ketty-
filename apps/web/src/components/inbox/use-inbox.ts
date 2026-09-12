"use client";

/**
 * The three subscriptions every inbox screen needs, and the ONE rule they all
 * obey: nothing in `localStorage` is read during a render.
 *
 * `readGuestStay`, `readOrderStore` and `readInboxMarks` all answer differently
 * on the server (null, empty, empty) from the way they answer in a browser that
 * has been used. Reading them while rendering therefore produces a first paint
 * that disagrees with the server's, and React discards the subtree and rebuilds
 * it — with, in this app, a visible flash of five empty department rows. So
 * every hook below starts in a `mounted: false` state that MATCHES the server,
 * fills itself in an effect, and then re-fills on every write.
 *
 * `mounted` is handed back rather than kept private because the screens need to
 * tell two situations apart that both look like "no stay": the browser has not
 * answered yet, and the browser has answered "you are not checked in". The
 * first is a skeleton; the second is a screen with an offer on it. Collapsing
 * them is how a guest who IS checked in gets told to check in, for one frame,
 * on every page load.
 */

import { useEffect, useState } from "react";

import { readGuestStay, subscribeGuestStay, type GuestStay } from "@/lib/guest-stay";
import { subscribeOrderStore } from "@/lib/order-store";
import { readInboxMarks, subscribeInboxRead, type ReadMarks } from "./read-state";

/** The demo stay in this browser, kept current across tabs and screens. */
export function useGuestStayValue(): { mounted: boolean; stay: GuestStay | null } {
  const [value, setValue] = useState<{ mounted: boolean; stay: GuestStay | null }>({
    mounted: false,
    stay: null,
  });

  useEffect(() => {
    const sync = () => setValue({ mounted: true, stay: readGuestStay() });
    sync();
    return subscribeGuestStay(sync);
  }, []);

  return value;
}

/**
 * A counter that ticks on every write to the order/chat store.
 *
 * A VERSION NUMBER rather than the data itself, so a screen can call
 * `readThreads`, `readThread` or `readOrder` at the moment it renders and get
 * one consistent view of the store, instead of this hook holding three copies
 * that drift. It is the whole reason an order advancing in the operator app
 * shows up in the guest's thread without a reload: `subscribeOrderStore` fires,
 * the version moves, the screen re-reads.
 */
export function useOrderStoreVersion(): { mounted: boolean; version: number } {
  const [value, setValue] = useState({ mounted: false, version: 0 });

  useEffect(() => {
    const sync = () => setValue((previous) => ({ mounted: true, version: previous.version + 1 }));
    sync();
    return subscribeOrderStore(sync);
  }, []);

  return value;
}

/** Which thread the guest has read up to. Empty until the browser answers. */
export function useInboxMarks(): ReadMarks {
  const [marks, setMarks] = useState<ReadMarks>({});

  useEffect(() => {
    const sync = () => setMarks(readInboxMarks());
    sync();
    return subscribeInboxRead(sync);
  }, []);

  return marks;
}
