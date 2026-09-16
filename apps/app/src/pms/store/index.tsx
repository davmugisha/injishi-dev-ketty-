"use client";

/**
 * The PMS store — Phase 1's source of truth (docs/pms-implementation-plan.md).
 *
 * Every operator action lands here as a reducer case that mutates state and
 * returns the toast that echoes it. That pairing is the point: an action keeps
 * its name through the flow (button "Approve" → toast "Approved"), and the demo
 * feels live because the list really did change.
 *
 * Phase 5 replaces the reducers' bodies with API calls. The action names, their
 * payloads and the toasts are already the contract, so the screens don't move.
 *
 * The transitions themselves live in ./store/*.reducer.ts, one file per domain;
 * `reducer` below offers the action to each in turn and the first owner answers.
 * Nothing about a transition changed in the move. This file owns the provider,
 * the context and the hooks — and stays the only module screens import from.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type {
  HospitalityProperty,
  Intent,
  OrgRole,
  Person,
  ResidenceProperty,
} from "../data/types";
import { humanError, isUnconfirmed } from "../data/api";
import { useMyWorkspaces, usePlatform } from "../data/queries";
import { useMyProfile } from "../data/profile";
import { initials } from "../lib/format";
import { useToastExpiry } from "../lib/toast-queue";
import { hostProperty, initialState } from "./helpers";
import { frontDeskReducer } from "./front-desk.reducer";
import { messagingReducer } from "./messaging.reducer";
import { offerReducer } from "./offer.reducer";
import { residenceReducer } from "./residence.reducer";
import { sessionReducer } from "./session.reducer";
import type { Action, State } from "./types";

export type { Action, CheckInDraft, Deductions, DragMode, Theme, ThreadScope, Toast } from "./types";

/**
 * Every domain slice, in the order the original switch listed them.
 *
 * Order is not load-bearing — the action union is partitioned, so exactly one
 * slice ever answers — but it is kept faithful to the original so the file
 * reads as the same sequence of cases it replaced.
 */
const SLICES = [
  sessionReducer,
  frontDeskReducer,
  residenceReducer,
  messagingReducer,
  offerReducer,
];

function reducer(s: State, a: Action): State {
  for (const slice of SLICES) {
    const next = slice(s, a);
    if (next) return next;
  }
  // Matches the switch's old `default:` — an unhandled action is a no-op.
  return s;
}


interface PmsContextValue {
  state: State;
  dispatch: (a: Action) => void;
  /** The hospitality property in view (null outside a hospitality workspace). */
  host: HospitalityProperty | null;
  residence: ResidenceProperty;
  /** The person whose eyes we're looking through. */
  me: Person;
  toast: (txt: string, intent?: Intent) => void;
  /**
   * Say that a command failed, in words a person can act on.
   *
   * Every screen used to write `toast(error.message, "bad")`, which put
   * whatever the wire carried on the front desk — "Forbidden resource", a
   * joined array of validator fragments, "Internal server error". `humanError`
   * owns the wording (see `data/api.ts`) and the intent follows the OUTCOME: a
   * request that never got an answer is a warning, because the work may well
   * have gone through, and telling somebody it failed would have them do it
   * twice.
   */
  toastError: (error: unknown) => void;
}

/**
 * What to call a person's standing in the workspace they are looking at.
 *
 * The ROLE, which is a fact of the grant, rather than a job title, which is
 * not on any row this app reads. The fixture used to supply a title
 * ("General Manager", "Front desk · Front Office") alongside a fixture name,
 * and both were invented. A role is what the server actually said.
 */
const ROLE_TITLE: Record<OrgRole, string> = {
  owner: "Owner",
  manager: "Manager",
  receptionist: "Front desk",
  housekeeper: "Housekeeping",
};

/**
 * The person, before their profile has arrived, and when it carries no name.
 *
 * NOT a guess. An account with no `fullName` has genuinely not completed Step 1
 * of registration, and deriving "j.doe" from an email address would put a
 * fabricated name on screen next to real money.
 */
const UNKNOWN_PERSON: Person = { name: "Your account", title: "", ini: "—" };

const PmsContext = createContext<PmsContextValue | null>(null);

export function PmsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // Toasts expire on their own; the reducer never has to schedule. Each one
  // gets its own timer, sized to its words, and they leave in the order they
  // arrived (`lib/toast-queue.ts`).
  const dismissToast = useCallback((id: number) => dispatch({ type: "dismissToast", id }), []);
  useToastExpiry(state.toasts, dismissToast);

  // Ask the API who this person is (Spec 0004, AC-6). Until it answers, the
  // demo defaults stand, so the app is never blank waiting on a request.
  //
  // The query owns the fetch and the three freshness triggers (ADR-012,
  // AC-15); the store owns the rendered copy. A refetch lands here, so a
  // permission revoked mid session stops enabling its control on the next
  // 403, the next focus, or within 60 seconds — whichever comes first.
  const { data: resolvedGrants } = useMyWorkspaces();

  useEffect(() => {
    if (resolvedGrants) dispatch({ type: "grantsResolved", me: resolvedGrants });
  }, [resolvedGrants]);

  // Which platform the API is (ADR-043). It decides whether a fixture money
  // action may make up a `DEMO-` reference and whether the mock banner shows;
  // `null`, including an unreachable API, refuses and hides.
  const { data: platform } = usePlatform();

  useEffect(() => {
    if (platform !== undefined) dispatch({ type: "platformResolved", platform });
  }, [platform]);

  const host = useMemo(() => hostProperty(state), [state]);

  /*
   * WHO IS SIGNED IN (ADR-035, D-f wave 2).
   *
   * The name comes from `/api/v1/me/profile` and the standing from the grant.
   * It used to come from `people[state.role]`, a fixture keyed by role, so the
   * app greeted every receptionist as the same invented person and the name
   * changed when the role changed rather than when the human did.
   *
   * The two halves are deliberately from two different places, because they
   * are two different facts: WHO you are does not vary by workspace, and WHAT
   * you are varies by nothing else.
   */
  const { data: profile } = useMyProfile();

  const me: Person = useMemo(() => {
    const fullName = profile?.fullName?.trim();
    if (!fullName) return UNKNOWN_PERSON;
    return {
      name: fullName,
      // Broker holds no org role, so it says what the workspace is instead.
      title: state.ws === "broker" ? "Broker" : (ROLE_TITLE[state.role] ?? ""),
      ini: initials(fullName),
    };
  }, [profile?.fullName, state.ws, state.role]);

  const toast = useCallback((txt: string, intent: Intent = "ok") => dispatch({ type: "toast", txt, intent }), []);

  const toastError = useCallback(
    (error: unknown) =>
      dispatch({ type: "toast", txt: humanError(error), intent: isUnconfirmed(error) ? "warn" : "bad" }),
    [],
  );

  const value = useMemo(
    () => ({
      state,
      dispatch,
      host,
      residence: state.db.residence,
      me,
      toast,
      toastError,
    }),
    [state, host, me, toast, toastError],
  );

  return <PmsContext.Provider value={value}>{children}</PmsContext.Provider>;
}

export function usePms(): PmsContextValue {
  const ctx = useContext(PmsContext);
  if (!ctx) throw new Error("usePms must be used inside <PmsProvider>");
  return ctx;
}

/** The hospitality property in view. Throws in the landlord workspace. */
export function useHost(): HospitalityProperty {
  const { host } = usePms();
  if (!host) throw new Error("useHost called outside a hospitality workspace");
  return host;
}
