import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { WorkspaceService } from '../../../shared/auth/workspace.service';
import { AvailabilityService } from '../../booking/application/availability.service';
import { GuestTripsService } from '../../booking/application/guest-trips.service';
import { OperatorReservationsService } from '../../booking/application/operator-reservations.service';
import { InventoryService } from '../../listing-setup/application/inventory.service';
import { FrontDeskService } from '../../operations/application/front-desk.service';
import { RoomAssignmentService } from '../../operations/application/room-assignment.service';
import { RoomTypesService } from '../../listing-setup/application/room-types.service';
import { ProposalRepository } from '../infrastructure/proposal.repository';
import { ListingService } from '../../listing/application/listing.service';
import type { ModelToolSpec } from '../domain/model-port';
import { redact } from '../domain/redaction';
import { type AccountReads, createAccountTools } from './account-tools';
import { type ActionReads, createActionTools } from './action-tools';
import { createGuideTools } from './guide-tools';
import { searchKnowledge } from './knowledge-search';
import { createListingTools, type ListingReads } from './listing-tools';
import { createOperatorTools, type OperatorReads, operatorRefusal } from './operator-tools';
import { createSupportTools } from './support-tools';
import type { AssistantTool, ToolCaller, ToolOutcome } from './tool-types';

export type { AssistantTool, ToolCaller, ToolOutcome, ToolRequirement } from './tool-types';

/**
 * The tools the assistant may call (ADR-061 D-f).
 *
 * Every tool declares what it needs, and the set OFFERED on a turn is computed
 * from the caller. The set is checked again when a tool RUNS, because a model
 * can name a tool it was never offered. Every data tool calls an existing
 * application service and nothing else: the assistant has no query of its own.
 *
 * A tool's result is shaped by an explicit field allowlist and passed through
 * `redact` before it leaves (D-g). It is data for the model, never
 * instructions: the system prompt says so, and nothing here executes text a
 * result carries.
 */
const SearchHelpInput = z.object({ query: z.string().trim().min(1).max(200) }).strict();

export const searchHelp: AssistantTool = {
  requires: 'public',
  spec: {
    name: 'search_help',
    description:
      "Search Injishi's verified help articles. Call this before answering any question about how Injishi works, what it offers, its fees, payouts, listing, verification, support or privacy. Returns up to three articles; answer only from what they say.",
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: "The person's question or its key words, in English.",
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  run(input) {
    const parsed = SearchHelpInput.safeParse(input);
    if (!parsed.success) {
      return Promise.resolve(errorOutcome('The query must be a non empty string of at most 200 characters.'));
    }
    const hits = searchKnowledge(parsed.data.query);
    const results = hits.map(({ article }) => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      body: article.body,
      href: article.href,
      lastVerified: article.lastVerified,
    }));
    const payload =
      results.length > 0
        ? { results }
        : { results, note: 'No verified article matches. Do not answer from memory.' };
    return Promise.resolve({
      content: redact(JSON.stringify(payload)),
      isError: false,
      sources: hits.map(({ article }) => ({
        kind: 'article' as const,
        id: article.id,
        title: article.title,
        href: article.href,
      })),
    });
  },
};

/** Every read the tools make, each through an existing application service. */
export type AssistantReads = ListingReads & AccountReads & OperatorReads & ActionReads;

/** The full tool set for a given set of reads. Exported for tests. */
export class ToolSet {
  readonly tools: readonly AssistantTool[];

  constructor(reads: AssistantReads) {
    this.tools = [
      searchHelp,
      ...createGuideTools(),
      ...createListingTools(reads),
      ...createAccountTools(reads),
      ...createOperatorTools(reads),
      ...createActionTools(reads),
      ...createSupportTools(),
    ];
  }

  /** The tools offered to this caller, as specs for the model. */
  offered(caller: ToolCaller): ModelToolSpec[] {
    return this.tools.filter((t) => allows(t, caller)).map((t) => t.spec);
  }

  /**
   * Run a tool the model asked for, after checking again that this caller
   * may. A tool that throws becomes an error result the model can explain,
   * never a failed turn: one bad lookup must not lose the person's question.
   */
  async run(name: string, input: unknown, caller: ToolCaller): Promise<ToolOutcome> {
    const tool = this.tools.find((t) => t.spec.name === name);
    if (!tool || !allows(tool, caller)) {
      return errorOutcome(refusalFor(name, tool, caller));
    }
    try {
      return await tool.run(input, caller);
    } catch {
      return errorOutcome('The lookup failed. Tell the person you could not check this right now.');
    }
  }
}

/** The tool set wired to the services the public, `/me/*` and operator routes use. */
@Injectable()
export class AssistantToolbox extends ToolSet {
  constructor(
    listings: ListingService,
    availability: AvailabilityService,
    trips: GuestTripsService,
    workspaces: WorkspaceService,
    frontDesk: FrontDeskService,
    roomAssignments: RoomAssignmentService,
    reservations: OperatorReservationsService,
    inventory: InventoryService,
    roomTypes: RoomTypesService,
    proposals: ProposalRepository,
  ) {
    super({
      listPublished: () => listings.listPublishedProperties(),
      getById: (id) => listings.getPublishedProperty(id),
      getBySlug: (slug) => listings.getPublishedPropertyBySlug(slug),
      availability: (roomTypeId, from, to) => availability.forRoomType(roomTypeId, from, to),
      trips: (userId) => trips.forGuest(userId),
      access: (userId) => workspaces.listForUser(userId),
      rooms: (ws) => frontDesk.listRooms(ws),
      assignments: (ws, from, to) => roomAssignments.listForWindow(ws, { from, to }),
      reservations: (ws) => reservations.list(ws),
      properties: (ws) => inventory.listProperties(ws),
      publishBlockers: (ws, propertyId) => inventory.publishBlockers(ws, propertyId),
      // Room types are listed per property; the properties are already the
      // ones this member covers.
      roomTypes: async (ws) => {
        const properties = await inventory.listProperties(ws);
        const lists = await Promise.all(properties.map((p) => roomTypes.list(ws, p.id)));
        return lists.flat();
      },
      createProposal: (p) => proposals.create(p),
    });
  }
}

function allows(tool: AssistantTool, caller: ToolCaller): boolean {
  const needs = tool.requires;
  if (typeof needs === 'object') {
    const held = caller.workspace?.permissions ?? [];
    return needs.anyOf.some((p) => held.includes(p));
  }
  switch (needs) {
    case 'public':
      return true;
    case 'signed_in':
      return caller.userId !== null;
  }
}

/** Why a tool was refused, in words the model can pass on. */
function refusalFor(name: string, tool: AssistantTool | undefined, caller: ToolCaller): string {
  if (!tool) return `The tool ${name} is not available in this conversation.`;
  const needs = tool.requires;
  if (typeof needs === 'object') return operatorRefusal(caller, needs.anyOf);
  return 'Sign in to use this.';
}

function errorOutcome(message: string): ToolOutcome {
  return { content: JSON.stringify({ error: message }), isError: true, sources: [] };
}
