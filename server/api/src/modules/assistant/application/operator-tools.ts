import {
  PUBLISH_BLOCKER_LABEL,
  type OperatorPropertySummary,
  type OperatorReservation,
  type OperatorRoom,
  type OperatorRoomAssignment,
  type PublishBlocker,
} from '@injishi/contracts';
import { HttpException } from '@nestjs/common';
import { z } from 'zod';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { redact } from '../domain/redaction';
import type { AssistantTool, ToolCaller, ToolOutcome } from './tool-types';

/**
 * Operator reads for the workspace in view (ADR-061 slice D).
 *
 * Each tool calls the application service its screen's route calls, with the
 * `ScopedWorkspace` the controller resolved through the same steps as
 * `WorkspaceGuard`, and declares the same permissions that route declares.
 * So the assistant sees exactly what the person could open, branch scope
 * included, and nothing a screen would refuse.
 *
 * Guest names never leave: the owner chose the minimum personal data (D-g),
 * and a booking reference answers every question these tools serve.
 */
export interface OperatorReads {
  rooms(ws: ScopedWorkspace): Promise<OperatorRoom[]>;
  assignments(ws: ScopedWorkspace, from: string, to: string): Promise<OperatorRoomAssignment[]>;
  reservations(ws: ScopedWorkspace): Promise<OperatorReservation[]>;
  properties(ws: ScopedWorkspace): Promise<OperatorPropertySummary[]>;
  publishBlockers(ws: ScopedWorkspace, propertyId: string): Promise<PublishBlocker[]>;
}

export const MAX_ROOM_NIGHTS = 31;
const MAX_RESERVATIONS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const RoomsInput = z.object({ from: IsoDate, to: IsoDate.optional() }).strict();
const ReservationsInput = z
  .object({
    state: z.string().max(40).optional(),
    from: IsoDate.optional(),
    to: IsoDate.optional(),
  })
  .strict();
const PublishInput = z.object({ propertyId: z.string().uuid().optional() }).strict();

export function createOperatorTools(reads: OperatorReads): AssistantTool[] {
  const roomsOnDates: AssistantTool = {
    // The rooms route takes stay.checkin, housekeeping.set, reservation.assign
    // or listing.manage; the room holds route takes reservation.assign,
    // reservation.approve or stay.checkin. This tool reads both, so it needs
    // a permission BOTH routes accept.
    requires: { anyOf: ['reservation.assign', 'stay.checkin'] },
    spec: {
      name: 'rooms_on_dates',
      description: `Which rooms in the property in view are held for a booking on each night from "from" up to (not including) "to", at most ${MAX_ROOM_NIGHTS} nights, and each room's status and housekeeping state. "to" defaults to the next day. Use for "is room 204 free tomorrow" or "which rooms are taken tonight". Dates are yyyy-mm-dd.`,
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'First night, yyyy-mm-dd.' },
          to: { type: 'string', description: 'Day after the last night, yyyy-mm-dd.' },
        },
        required: ['from'],
        additionalProperties: false,
      },
    },
    async run(input, caller) {
      const ws = caller.workspace as ScopedWorkspace;
      const parsed = RoomsInput.safeParse(input);
      if (!parsed.success) return errorOutcome('Give from (and optionally to) as yyyy-mm-dd.');
      const from = parsed.data.from;
      const to = parsed.data.to ?? nextDay(from);
      if (!isCalendarDate(from) || !isCalendarDate(to)) return errorOutcome('Both dates must be real calendar dates.');
      const nights = (Date.parse(to) - Date.parse(from)) / DAY_MS;
      if (nights < 1) return errorOutcome('"to" must be after "from".');
      if (nights > MAX_ROOM_NIGHTS) return errorOutcome(`I can check at most ${MAX_ROOM_NIGHTS} nights at a time.`);
      const [rooms, holds] = await Promise.all([reads.rooms(ws), guarded(() => reads.assignments(ws, from, to))]);
      if ('refused' in holds) return holds.refused;
      const held = new Map<string, OperatorRoomAssignment[]>();
      for (const a of holds.value) {
        if (a.status !== 'assigned' || a.releasedAt) continue;
        held.set(a.roomId, [...(held.get(a.roomId) ?? []), a]);
      }
      const payload = {
        from,
        to,
        rooms: rooms.map((r) => ({
          room: r.label,
          roomType: r.roomTypeName,
          status: r.status,
          housekeeping: r.housekeeping,
          occupiedNow: r.occupiedBy !== null,
          heldForDates: held.has(r.id),
          holds: (held.get(r.id) ?? []).map((a) => ({ from: a.from, to: a.to })),
        })),
        note: 'A room not held for the dates may still be unavailable if its status is out of order. Guest names are not shown.',
      };
      return outcome(payload);
    },
  };

  const listReservations: AssistantTool = {
    requires: { anyOf: ['reservation.approve', 'reservation.assign', 'stay.checkin'] },
    spec: {
      name: 'list_reservations',
      description: `Reservations at the property in view: booking reference, desk state, check in and out dates, nights, number of guests, room, and total in RWF. Optionally filter by desk state or by dates (reservations overlapping from..to). At most ${MAX_RESERVATIONS}, soonest check in first. Use for arrivals, departures and "what's pending approval".`,
      inputSchema: {
        type: 'object',
        properties: {
          state: { type: 'string', description: 'A desk state to filter by, as the tool reports it.' },
          from: { type: 'string', description: 'yyyy-mm-dd.' },
          to: { type: 'string', description: 'yyyy-mm-dd.' },
        },
        required: [],
        additionalProperties: false,
      },
    },
    async run(input, caller) {
      const ws = caller.workspace as ScopedWorkspace;
      const parsed = ReservationsInput.safeParse(input);
      if (!parsed.success) return errorOutcome('state, from and to are optional; dates are yyyy-mm-dd.');
      const { state, from, to } = parsed.data;
      const all = await guarded(() => reads.reservations(ws));
      if ('refused' in all) return all.refused;
      const chosen = all.value
        .filter((r) => !state || r.state === state)
        .filter((r) => !from || r.checkOut > from)
        .filter((r) => !to || r.checkIn < to)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
        .slice(0, MAX_RESERVATIONS);
      return outcome({
        reservations: chosen.map((r) => ({
          reference: r.reference,
          state: r.state,
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          nights: r.nights,
          guests: r.guestCount,
          room: r.room,
          totalRwf: r.totalRwf,
        })),
        states: [...new Set(all.value.map((r) => r.state))].sort(),
        note: chosen.length > 0 ? 'Guest names are not shown; use the reference.' : 'No reservation matches. Say so; do not guess.',
      });
    },
  };

  const publishBlockers: AssistantTool = {
    requires: { anyOf: ['listing.manage'] },
    spec: {
      name: 'publish_blockers',
      description:
        "What stops a property in the workspace from being published right now, exactly as pressing Publish would report it. Without propertyId it checks every property in view. Use for \"why can't I publish my property\".",
      inputSchema: {
        type: 'object',
        properties: { propertyId: { type: 'string', description: 'A property id, if the person named one.' } },
        required: [],
        additionalProperties: false,
      },
    },
    async run(input, caller) {
      const ws = caller.workspace as ScopedWorkspace;
      const parsed = PublishInput.safeParse(input);
      if (!parsed.success) return errorOutcome('propertyId must be a property id.');
      const listed = await guarded(() => reads.properties(ws));
      if ('refused' in listed) return listed.refused;
      const targets = listed.value.filter((p) => !p.archivedAt && (!parsed.data.propertyId || p.id === parsed.data.propertyId));
      if (targets.length === 0) return errorOutcome('No such property in the branches you cover.');
      const results = [];
      for (const p of targets.slice(0, 10)) {
        const blockers = await guarded(() => reads.publishBlockers(ws, p.id));
        if ('refused' in blockers) return blockers.refused;
        results.push({
          propertyId: p.id,
          property: p.name,
          listingStatus: p.listingStatus,
          readyToPublish: blockers.value.length === 0,
          blockers: blockers.value.map((code) => ({ code, fix: PUBLISH_BLOCKER_LABEL[code] })),
        });
      }
      return outcome({ properties: results });
    },
  };

  return [roomsOnDates, listReservations, publishBlockers];
}

/** Why an operator tool was refused, in words the person can act on. */
export function operatorRefusal(caller: ToolCaller, anyOf: readonly string[]): string {
  if (caller.stepUpNeeded) {
    return 'Finish signing in with the code emailed to you, then ask again. Operator information needs it, exactly as the operator screens do.';
  }
  if (!caller.workspace) {
    return 'This needs a business workspace. Open the assistant from the operator app in the business you work in.';
  }
  return `Your account in this business cannot see this. It needs one of: ${anyOf.join(', ')}.`;
}

type Guarded<T> = { value: T } | { refused: ToolOutcome };

/** A 4xx from a service becomes an explanation; anything else is rethrown. */
async function guarded<T>(read: () => Promise<T>): Promise<Guarded<T>> {
  try {
    return { value: await read() };
  } catch (error) {
    if (error instanceof HttpException && error.getStatus() < 500) {
      return { refused: errorOutcome(error.message || 'That is not available to you.') };
    }
    throw error;
  }
}

function isCalendarDate(value: string): boolean {
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function nextDay(date: string): string {
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(time) ? date : new Date(time + DAY_MS).toISOString().slice(0, 10);
}

function outcome(payload: unknown): ToolOutcome {
  return { content: redact(JSON.stringify(payload)), isError: false, sources: [] };
}

function errorOutcome(message: string): ToolOutcome {
  return { content: JSON.stringify({ error: message }), isError: true, sources: [] };
}
