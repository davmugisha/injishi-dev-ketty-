"use client";

/**
 * Ephemeral shell UI state — which overlay is open, and the check-in draft in
 * flight. Kept apart from the data store: none of this survives a reload, and
 * none of it will ever be an API call.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CheckInDraft } from "./store";

/**
 * What a caller knows about the guest before the drawer opens.
 *
 * **It used to be the demo `Reservation` type, and that was the bug.**
 * `CheckInDrawer` has been on real commands since ADR-035 — it sends
 * `POST /ops/stays/:bookingId/checkin` and offers the rooms `GET /ops/rooms`
 * returns — but the only way to OPEN it was to hand it a fixture. So a
 * reservation read from the server had no route into a drawer that was
 * perfectly able to check it in, and `Reservations` disabled the button with
 * "that screen still reads demo data". The screen did not; the opener did.
 *
 * A narrow seed rather than a record from either source: the drawer needs four
 * facts, and taking a whole `Reservation` made the demo store a structural
 * dependency of the live path.
 */
export interface CheckInSeed {
  /**
   * The BOOKING to check in, or null for a walk-in.
   *
   * This is what picks the command: `POST /ops/stays/:bookingId/checkin` needs
   * a booking id in its path, and a walk-in has none, so it goes to
   * `POST /ops/stays/walk-in` instead.
   */
  reservationId: string | null;
  guestName: string;
  nights: number;
  /**
   * The room's UUID, never its label.
   *
   * The drawer matches this against `GET /ops/rooms`, whose ids are uuids, and
   * submits it as `roomId`. A label here would pass the form's "a room is
   * chosen" check and then be refused by the server with the guest standing at
   * the desk — which is why the demo callers deliberately send nothing and let
   * the receptionist pick from the live list.
   */
  roomId?: string;
  /** Nightly rate to prefill, in RWF. */
  rate?: number;
}

interface UiContextValue {
  checkIn: CheckInDraft | null;
  /**
   * Open the check-in drawer — with a seed, or bare (or null) for a walk-in
   * nobody booked.
   */
  openCheckIn: (seed?: CheckInSeed | null) => void;
  setCheckIn: (draft: CheckInDraft | null) => void;
  cmdkOpen: boolean;
  setCmdkOpen: (open: boolean) => void;
  /**
   * Whether the nav drawer is open. Only meaningful below 1024px, where the
   * sidebar leaves the flex row and becomes an overlay; above it the sidebar
   * is always up and this is ignored. It lives here rather than in the shell
   * because three components need the same answer — the topbar opens it, the
   * sidebar reads it, and the scrim closes it.
   */
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  /**
   * The record on screen, when the screen is one (ADR-044, D-e).
   *
   * A record names itself in the ONE `h1`, and that `h1` belongs to the topbar.
   * The route file only knows it is "a stay"; the record's name arrives with
   * its data, inside the screen. `ObjectPage` writes it here and the topbar
   * reads it, for the heading and for the browser tab. Null on every screen
   * that is not a record, where the route's own title stands.
   */
  record: RecordInView | null;
  setRecord: (record: RecordInView | null) => void;
}

export interface RecordInView {
  /** What two people would call it: the guest, the tenant. */
  name: string;
  /** The open lens, or undefined on the record's own overview. */
  lens?: string;
}

const UiContext = createContext<UiContextValue | null>(null);

export function PmsUiProvider({ children }: { children: ReactNode }) {
  const [checkIn, setCheckIn] = useState<CheckInDraft | null>(null);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [record, setRecord] = useState<RecordInView | null>(null);

  const openCheckIn = useCallback((seed?: CheckInSeed | null) => {
    setCmdkOpen(false);
    setCheckIn({
      resId: seed?.reservationId ?? null,
      // No booking behind them means the guest is at the desk right now, which
      // is a different command: the stay and its bill open together.
      walk: !seed?.reservationId,
      name: seed?.guestName ?? "",
      nid: "",
      phone: "",
      room: seed?.roomId ?? "",
      nights: seed?.nights ?? 1,
      rate: seed?.rate != null ? String(seed.rate) : "",
    });
  }, []);

  const value = useMemo(
    () => ({
      checkIn,
      openCheckIn,
      setCheckIn,
      cmdkOpen,
      setCmdkOpen,
      navOpen,
      setNavOpen,
      record,
      setRecord,
    }),
    [checkIn, openCheckIn, cmdkOpen, navOpen, record],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function usePmsUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("usePmsUi must be used inside <PmsUiProvider>");
  return ctx;
}
