/**
 * The reads and writes behind Account's sheets and screens.
 *
 * Decision D9: every local write goes through `useFixtureMutation`, so the swap
 * to TanStack Query later is a hook change per screen rather than a rewrite of
 * the surface. Each hook here is one key, and the `apply` functions are pure
 * because they are the only description of the change — a later `useMutation`
 * calls the same function to build its optimistic update.
 *
 * `useFixture` (the cold read with a status) is used where the screen has a
 * list to draw and therefore owes four states; `useFixtureValue` (the warm read
 * with no status) is used where the value is a toggle the screen already has on
 * the page, because a switch that spends 220ms in a skeleton is a switch that
 * looks broken.
 */
import { useFixture, type FixtureResult } from '@/data/use-fixture';
import { useFixtureMutation, useFixtureValue, type FixtureMutation } from '@/data/use-fixture-mutation';
import { ME } from '@/data/personas';
import {
  PERSONAL_KEY,
  SESSIONS,
  SESSIONS_KEY,
  STAFF,
  STAFF_KEY,
  TWO_FACTOR_KEY,
  TWO_FACTOR_SEED,
  type DeviceSession,
  type PersonalDetails,
  type StaffMember,
} from './account-fixtures';

/* ------------------------------------------------------------ two-factor -- */

/** F-S12 §8: off or on, and nothing else. Warm, because it is a switch. */
export function useTwoFactor(): { on: boolean; toggle: FixtureMutation<boolean> } {
  const on = useFixtureValue<boolean>(TWO_FACTOR_KEY, () => TWO_FACTOR_SEED);
  const toggle = useFixtureMutation<boolean, boolean>(
    TWO_FACTOR_KEY,
    (_current, next) => next,
    () => TWO_FACTOR_SEED,
  );
  return { on, toggle };
}

/* -------------------------------------------------------------- sessions -- */

export type SessionChange =
  | { kind: 'revoke'; id: string }
  /** F-S12 §6 "sign out everywhere": every session but the one asking. */
  | { kind: 'revoke_others' };

export function applySessionChange(
  current: DeviceSession[],
  change: SessionChange,
): DeviceSession[] {
  if (change.kind === 'revoke_others') return current.filter((s) => s.current);
  // The current device is never revocable from this list. Signing the phone in
  // your hand out from a row labelled "this device" is a control that looks
  // like a mistake even when it is not one; `Sign out` is where that lives.
  return current.filter((s) => s.id !== change.id || s.current);
}

export function useSessions(): FixtureResult<DeviceSession[]> {
  return useFixture<DeviceSession[]>(SESSIONS_KEY, () => SESSIONS);
}

export function useSessionMutation(): FixtureMutation<SessionChange> {
  return useFixtureMutation<DeviceSession[], SessionChange>(
    SESSIONS_KEY,
    applySessionChange,
    () => SESSIONS,
  );
}

/* ----------------------------------------------------------------- staff -- */

export type StaffChange =
  | { kind: 'resend'; id: string }
  | { kind: 'revoke'; id: string }
  | { kind: 'restore'; id: string }
  | { kind: 'invite'; name: string; phone: string };

/**
 * Resending an invitation does not change the row, and that is deliberate
 * rather than an omission: the state is still `invited`, the person still has
 * not accepted, and a row that moved would be telling the reader something had
 * happened at the other end. The toast is what says the message went.
 */
export function applyStaffChange(current: StaffMember[], change: StaffChange): StaffMember[] {
  switch (change.kind) {
    case 'resend':
      return current;
    case 'revoke':
      return current.map((m) => (m.id === change.id ? { ...m, state: 'suspended' } : m));
    case 'restore':
      return current.map((m) => (m.id === change.id ? { ...m, state: 'active' } : m));
    case 'invite':
      return [
        ...current,
        {
          id: `st-${current.length + 1}-${change.phone.slice(-4)}`,
          name: change.name,
          roleKey: 'staff.roleCaretaker',
          state: 'invited',
          since: new Date().toISOString().slice(0, 10),
          phone: change.phone,
        },
      ];
  }
}

export function useStaff(): FixtureResult<StaffMember[]> {
  return useFixture<StaffMember[]>(STAFF_KEY, () => STAFF);
}

export function useStaffMutation(): FixtureMutation<StaffChange> {
  return useFixtureMutation<StaffMember[], StaffChange>(STAFF_KEY, applyStaffChange, () => STAFF);
}

/* ------------------------------------------------------- personal details -- */

/**
 * Seeded from `ME` rather than from a literal, so the one identity decision D7
 * makes has exactly one home. `publicName` is F-S12 §6's rule made visible:
 * first name plus last initial is what a review shows, and printing it beside
 * the private name is the only way a reader can check that the rule holds.
 *
 * `identity` overrides the placeholder once `GET /api/v1/me/profile` has
 * answered — `personal-details.tsx` is the one caller that passes it, and it
 * does so only when the store has never been written. The EMAIL is deliberately
 * not defaulted from `ME` in that case: `/me/profile` serves a name, a phone, a
 * document and an address and no address of the electronic kind, so printing
 * the placeholder's email beside a real person's real name would be inventing a
 * fact about them. An empty string is what the screen draws a dash for.
 */
export function seedPersonal(identity?: {
  name: string;
  phone: string;
}): PersonalDetails {
  const name = identity?.name ?? ME.name;
  return {
    displayName: name,
    phone: identity?.phone ?? ME.phone,
    email: identity ? '' : ME.email,
    methods: [
      { id: 'phone', linked: true },
      { id: 'google', linked: false },
    ],
    publicName: publicForm(name),
  };
}

/**
 * `Samuel Kayitare` → `Samuel K.` — F-S12 §6's rule as one function.
 *
 * One name gets no initial and no full stop. Session 11's own test caught that:
 * the first version appended `${last?.[0] ?? ''}.` and trimmed, which turns
 * "Eric" into "Eric ." — a stray full stop standing in for a surname somebody
 * does not have. Mononyms are ordinary here, so this is a case rather than an
 * edge case.
 */
export function publicForm(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export type PersonalChange =
  | { kind: 'name'; value: string }
  | { kind: 'email'; value: string }
  | { kind: 'link'; id: 'google'; linked: boolean };

export function applyPersonalChange(
  current: PersonalDetails,
  change: PersonalChange,
): PersonalDetails {
  switch (change.kind) {
    case 'name':
      return {
        ...current,
        displayName: change.value.trim(),
        // The public form follows the private one, because the rule is derived
        // rather than stored — otherwise a rename leaves a stale public name.
        publicName: publicForm(change.value),
      };
    case 'email':
      return { ...current, email: change.value.trim() };
    case 'link':
      return {
        ...current,
        methods: current.methods.map((m) =>
          m.id === change.id ? { ...m, linked: change.linked } : m,
        ),
      };
  }
}

export function usePersonalDetails(): PersonalDetails {
  return useFixtureValue<PersonalDetails>(PERSONAL_KEY, seedPersonal);
}

export function usePersonalMutation(): FixtureMutation<PersonalChange> {
  return useFixtureMutation<PersonalDetails, PersonalChange>(
    PERSONAL_KEY,
    applyPersonalChange,
    seedPersonal,
  );
}
