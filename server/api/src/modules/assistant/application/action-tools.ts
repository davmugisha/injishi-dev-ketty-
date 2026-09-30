import type { OperatorRoomType } from '@injishi/contracts';
import { z } from 'zod';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { redact } from '../domain/redaction';
import type { AssistantTool, ToolOutcome } from './tool-types';

/**
 * Preparing a change for the person to approve (ADR-061 D-k, slice E).
 *
 * THE ASSISTANT IS NOT AN OPERATOR OF INJISHI. This is the only tool that
 * writes, and all it writes is a proposal row: the current value it read,
 * the value the person asked for, and the request. Nothing on the property
 * changes until the person presses Approve on the card the surface draws
 * from that row, which sends their own request to a route that checks their
 * permission again, re-reads the value and executes through the screen's own
 * service. There is deliberately no approve tool.
 */
export interface ActionReads {
  roomTypes(ws: ScopedWorkspace): Promise<OperatorRoomType[]>;
  createProposal(proposal: {
    userId: string;
    workspaceId: string;
    kind: 'room_type.price';
    targetId: string;
    targetLabel: string;
    propertyId: string;
    currentValue: number | null;
    proposedValue: number;
    requestText: string;
    expiresAt: Date;
  }): Promise<{ id: string; expiresAt: Date }>;
}

/** How long a prepared change waits for approval (D-k). */
export const PROPOSAL_TTL_MS = 15 * 60 * 1000;
const MAX_PRICE_RWF = 100_000_000;

const ProposePriceInput = z
  .object({
    roomTypeId: z.string().uuid().optional(),
    roomTypeName: z.string().trim().min(1).max(200).optional(),
    newPriceRwf: z.number().int().min(1).max(MAX_PRICE_RWF),
  })
  .strict()
  .refine((v) => v.roomTypeId || v.roomTypeName, 'Name the room type.');

export function createActionTools(reads: ActionReads, clock: () => number = Date.now): AssistantTool[] {
  const proposeRoomPrice: AssistantTool = {
    // The Inventory screen's price field needs listing.manage, and so does
    // the approval route that would execute this.
    requires: { anyOf: ['listing.manage'] },
    spec: {
      name: 'propose_room_price',
      description:
        "PREPARE a change to a room type's price per night in RWF, for the person to approve. It changes nothing: it returns a proposal the person approves or rejects on a card, which shows the current and new price. Use when the person asks to change a price. Name the room type by roomTypeId or by its exact name.",
      inputSchema: {
        type: 'object',
        properties: {
          roomTypeId: { type: 'string', description: 'The room type id, if known.' },
          roomTypeName: { type: 'string', description: 'The room type name, e.g. "Double room".' },
          newPriceRwf: { type: 'integer', description: 'The new price per night in RWF, a whole number.' },
        },
        required: ['newPriceRwf'],
        additionalProperties: false,
      },
    },
    async run(input, caller) {
      const ws = caller.workspace as ScopedWorkspace;
      const parsed = ProposePriceInput.safeParse(input);
      if (!parsed.success) {
        return errorOutcome(`Give the room type and a whole newPriceRwf between 1 and ${MAX_PRICE_RWF.toLocaleString('en-US')}.`);
      }
      const { roomTypeId, roomTypeName, newPriceRwf } = parsed.data;
      const active = (await reads.roomTypes(ws)).filter((r) => r.status === 'active');
      const matches = roomTypeId
        ? active.filter((r) => r.id === roomTypeId)
        : active.filter((r) => r.name.trim().toLowerCase() === (roomTypeName as string).toLowerCase());
      if (matches.length === 0) {
        return errorOutcome(
          `No active room type by that ${roomTypeId ? 'id' : 'name'} in the branches you cover. The room types are: ${active.map((r) => r.name).join(', ') || 'none'}.`,
        );
      }
      if (matches.length > 1) {
        return errorOutcome(`More than one room type is called that. Ask which one: ${matches.map((r) => r.id).join(', ')}.`);
      }
      const target = matches[0];
      if (target.basePriceRwf === newPriceRwf) {
        return errorOutcome(`${target.name} already costs ${formatRwf(newPriceRwf)}. Nothing to change.`);
      }
      const proposal = await reads.createProposal({
        userId: caller.userId as string,
        workspaceId: ws.workspaceId,
        kind: 'room_type.price',
        targetId: target.id,
        targetLabel: target.name,
        propertyId: target.propertyId,
        currentValue: target.basePriceRwf,
        proposedValue: newPriceRwf,
        requestText: caller.requestText ?? `Change ${target.name} to ${newPriceRwf} RWF`,
        expiresAt: new Date(clock() + PROPOSAL_TTL_MS),
      });
      return {
        content: redact(
          JSON.stringify({
            proposalId: proposal.id,
            roomType: target.name,
            current: target.basePriceRwf === null ? 'no price' : formatRwf(target.basePriceRwf),
            proposed: formatRwf(newPriceRwf),
            expiresAt: proposal.expiresAt.toISOString(),
            note: 'NOTHING HAS CHANGED. Tell the person the change is ready and that they must press Approve on the card to make it, or Reject.',
          }),
        ),
        isError: false,
        sources: [],
        proposalIds: [proposal.id],
      };
    },
  };

  return [proposeRoomPrice];
}

export function formatRwf(amount: number): string {
  return `${amount.toLocaleString('en-US')} RWF`;
}

function errorOutcome(message: string): ToolOutcome {
  return { content: JSON.stringify({ error: message }), isError: true, sources: [] };
}
