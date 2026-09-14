"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readGuestStay,
  subscribeGuestStay,
  type GuestStay,
} from "@/lib/guest-stay";
import {
  readOrders,
  subscribeOrderStore,
  type RoomOrder,
} from "@/lib/order-store";

/**
 * The two reads every stay screen starts from, done the one safe way.
 *
 * Both stores answer `null` / empty on the server, so reading either during a
 * render produces a first client paint that disagrees with the server's HTML
 * and React discards the tree. Both hooks therefore start from the server's
 * answer, re-read in an effect, and subscribe — which is also what makes a
 * check-in performed on the hub reach the order screen without a reload.
 *
 * `ready` is returned separately from the value because "we have not looked
 * yet" and "we looked and there is nothing" must render differently. Collapsing
 * them is how a checked-in guest came to see the check-in prompt flash on every
 * navigation.
 */

export interface StayRead {
  stay: GuestStay | null;
  ready: boolean;
  /** Force a re-read — the check-in buttons call it after writing. */
  refresh: () => void;
}

export function useGuestStay(): StayRead {
  const [stay, setStay] = useState<GuestStay | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setStay(readGuestStay());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    return subscribeGuestStay(refresh);
  }, [refresh]);

  return { stay, ready, refresh };
}

export interface OrdersRead {
  orders: RoomOrder[];
  ready: boolean;
  refresh: () => void;
}

/**
 * The orders placed from one property, newest first.
 *
 * Scoped by property rather than returning everything, because a presenter who
 * demoed the Lanternhouse this morning and the Amberhill this afternoon must not find
 * the Lanternhouse's brochettes listed under a Amberhill room number.
 *
 * A `null` slug means the stay has not been read yet, and answers empty — not
 * "every order in the browser".
 */
export function useRoomOrders(propertySlug: string | null): OrdersRead {
  const [orders, setOrders] = useState<RoomOrder[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setOrders(propertySlug === null ? [] : readOrders(propertySlug));
    setReady(true);
  }, [propertySlug]);

  useEffect(() => {
    refresh();
    return subscribeOrderStore(refresh);
  }, [refresh]);

  return { orders, ready, refresh };
}
