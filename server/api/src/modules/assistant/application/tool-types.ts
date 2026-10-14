import type { AssistantSource, Permission, SupportTopic } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { ModelToolSpec } from '../domain/model-port';

/**
 * What a tool needs before it may be offered or run (ADR-061 D-f):
 *
 * - `public`: anyone, signed in or not.
 * - `catalogue`: anyone, but only while the public catalogue is open, which
 *   it is not on the production pre launch host (D-j, ADR-048).
 * - `signed_in`: a session.
 * - `{ anyOf }`: a workspace resolved for this turn exactly as
 *   `WorkspaceGuard` resolves it, holding at least one of these permissions.
 *   The list is the one the matching route declares, so the assistant can
 *   never read what the screen would refuse.
 */
export type ToolRequirement = 'public' | 'catalogue' | 'signed_in' | { anyOf: readonly Permission[] };

/** Who is calling, as far as the tools are concerned. */
export interface ToolCaller {
  userId: string | null;
  /** False on the production pre launch host; fails closed when unknown. */
  catalogueOpen: boolean;
  /**
   * The operator workspace in view, resolved through the step up, the
   * membership, and the branch scope, or null when there is none (a guest,
   * the web surface, or a refusal at any of those steps).
   */
  workspace?: ScopedWorkspace | null;
  /** True when the only thing missing is this session's emailed step up code. */
  stepUpNeeded?: boolean;
  /** The person's question this turn, redacted, recorded on any proposal. */
  requestText?: string;
}

export interface ToolOutcome {
  /** What the model reads: JSON text, already redacted. */
  content: string;
  isError: boolean;
  /** What the answer may cite from this call. */
  sources: AssistantSource[];
  /** Proposals this call prepared, for the surface to draw approval cards. */
  proposalIds?: string[];
  /** Set when this call offered human support; the person sends it. */
  escalation?: { topic: SupportTopic };
}

export interface AssistantTool {
  spec: ModelToolSpec;
  requires: ToolRequirement;
  run(input: unknown, caller: ToolCaller): Promise<ToolOutcome>;
}
