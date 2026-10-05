import type { GuestTrip, MyTrips, WorkspaceAccess } from '@injishi/contracts';
import { z } from 'zod';

import { redact } from '../domain/redaction';
import type { AssistantTool, ToolOutcome } from './tool-types';

/**
 * The signed in caller's own reads (ADR-061 slice C).
 *
 * WHOSE data is never an input. Both tools take the user id from the session
 * the controller resolved (`ToolCaller.userId`) and have no parameter that
 * could name anyone else, so no wording of a question can reach another
 * person's trips or access. They call the services `/api/v1/me/*` uses, and
 * copy an explicit allowlist of fields: no payment details, no contact
 * details, no internal ids beyond the workspace id a later tool needs.
 */
export interface AccountReads {
  trips(userId: string): Promise<MyTrips>;
  access(userId: string): Promise<WorkspaceAccess[]>;
}

const MAX_TRIPS = 10;
const STAGE_ORDER: Record<GuestTrip['stage'], number> = {
  in_progress: 0,
  upcoming: 1,
  past: 2,
  cancelled: 3,
};

const TripsInput = z
  .object({ stage: z.enum(['upcoming', 'in_progress', 'past', 'cancelled']).optional() })
  .strict();
const NoInput = z.object({}).strict();

export function createAccountTools(reads: AccountReads): AssistantTool[] {
  const myTrips: AssistantTool = {
    requires: 'signed_in',
    spec: {
      name: 'my_trips',
      description:
        "The signed in person's own stays booked on Injishi: property, room type, dates, guests, booking reference, stage (upcoming, in_progress, past, cancelled) and total. Use for questions about their bookings or trips. Optionally filter by stage.",
      inputSchema: {
        type: 'object',
        properties: {
          stage: {
            type: 'string',
            enum: ['upcoming', 'in_progress', 'past', 'cancelled'],
            description: 'Only trips at this stage.',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
    async run(input, caller) {
      if (!caller.userId) return errorOutcome('Sign in to see your trips.');
      const parsed = TripsInput.safeParse(input);
      if (!parsed.success) return errorOutcome('stage must be upcoming, in_progress, past or cancelled.');
      const { trips } = await reads.trips(caller.userId);
      const chosen = trips
        .filter((t) => !parsed.data.stage || t.stage === parsed.data.stage)
        .sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.checkIn.localeCompare(b.checkIn))
        .slice(0, MAX_TRIPS);
      const payload = {
        trips: chosen.map((t) => ({
          reference: t.reference,
          stage: t.stage,
          property: t.propertyName,
          district: t.districtName,
          roomType: t.roomTypeName,
          checkIn: t.checkIn,
          checkOut: t.checkOut,
          nights: t.nights,
          guests: t.guests,
          totalRwf: t.grossRwf,
          cancellationTier: t.cancellationTier,
          href: '/trips',
        })),
        total: trips.length,
      };
      return outcome(
        chosen.length > 0 ? payload : { ...payload, note: 'No trips match. Say so; do not guess a booking.' },
        chosen.map((t) => ({
          kind: 'record' as const,
          id: t.id,
          title: `${t.propertyName}, ${t.checkIn}`,
          href: '/trips',
        })),
      );
    },
  };

  const myAccess: AssistantTool = {
    requires: 'signed_in',
    spec: {
      name: 'my_access',
      description:
        "The businesses the signed in person works in on Injishi and exactly what each lets them do: business name, whether it is a hotel or a residence, their role, the registration stage, and the permissions they hold there. What they may do comes from the permissions, never from the role name. Use before explaining how to do a task in the operator app.",
      inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
    async run(input, caller) {
      if (!caller.userId) return errorOutcome('Sign in to see what you can do.');
      if (!NoInput.safeParse(input ?? {}).success) return errorOutcome('This tool takes no input.');
      const workspaces = (await reads.access(caller.userId)).filter((w) => w.kind === 'business');
      return outcome(
        {
          businesses: workspaces.map((w) => ({
            workspaceId: w.workspaceId,
            business: w.orgName,
            domain: w.domain,
            role: w.orgRole,
            registrationStage: w.registrationStatus,
            permissions: [...w.permissions].sort(),
          })),
          note:
            workspaces.length > 0
              ? 'Permissions decide what this person may do; a business can change what a role holds.'
              : 'This person works in no business on Injishi.',
        },
        [],
      );
    },
  };

  return [myTrips, myAccess];
}

function outcome(payload: unknown, sources: ToolOutcome['sources']): ToolOutcome {
  return { content: redact(JSON.stringify(payload)), isError: false, sources };
}

function errorOutcome(message: string): ToolOutcome {
  return { content: JSON.stringify({ error: message }), isError: true, sources: [] };
}
