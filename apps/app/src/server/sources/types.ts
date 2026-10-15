/**
 * A live source serves one interface collection ("<area>.<thing>") from the API, in the exact
 * document shape the screen's view already takes (the fixture interfaces in @injishi/data are the
 * contract). Loaders are plain async functions: no `next/*` import, so `scripts/verify-*.ts` run them.
 */

import type { Persona, PersonaId } from "@injishi/data";
import type { Doc } from "@injishi/data/types";
import type { ApiClient, RequestOptions } from "../api";
import type { Account, Workspace } from "../auth";

export type Domain = "hospitality" | "residence" | "broker";

/** A calendar day in Africa/Kigali, which is the day every operator screen means by "today". */
export interface KigaliDay {
  /** "2026-10-15" */
  iso: string;
  /** Noon UTC of that day: safe for date arithmetic that must not cross a day boundary. */
  noon: Date;
}

/** API calls already scoped to one business workspace (x-workspace-id). */
export interface ScopedApi {
  readonly workspace: Workspace;
  get<T>(path: string, options?: Omit<RequestOptions, "method" | "body" | "workspaceId">): Promise<T>;
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body" | "workspaceId">): Promise<T>;
  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body" | "workspaceId">): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body" | "workspaceId">): Promise<T>;
  delete<T>(path: string, options?: Omit<RequestOptions, "method" | "body" | "workspaceId">): Promise<T>;
}

export interface SourceContext {
  /** Calls carrying the signed-in session (or none, on a public screen). */
  readonly api: ApiClient;
  /** The signed-in person, or null on a public screen. */
  readonly account: Account | null;
  readonly persona: Persona | null;
  readonly today: KigaliDay;
  /** Calls scoped to the person's business workspace of that domain. Throws NoWorkspaceError when there is none. */
  ops(domain?: Domain): ScopedApi;
}

export class NoWorkspaceError extends Error {
  constructor(readonly domain: Domain) {
    super(`This account holds no ${domain} business workspace.`);
    this.name = "NoWorkspaceError";
  }
}

export interface LiveSource<T extends Doc = Doc> {
  /** Every document of the collection, in the order the screen shows them. */
  list(ctx: SourceContext): Promise<T[]>;
  /** One document by its id; defaults to a find over list(). */
  get?(ctx: SourceContext, id: string): Promise<T | undefined>;
  /**
   * The field that names the same document in the fixtures and in live data, for the parity check
   * (scripts/verify-data.ts) on a freshly seeded database. Ids differ (fixture slugs vs uuids), so it is
   * usually a human key: a room label, a person's name, a booking reference.
   */
  naturalKey?: string;
  /**
   * How the parity check compares this collection with its fixtures. "identity" (the default): the same
   * documents by `naturalKey`. "shape": the same number of documents with the same keys and kinds of value,
   * for collections keyed by real dates or times (a 14-day revenue series, a week of roster columns) that
   * cannot name the prototype's 12 October on any other day.
   */
  parity?: "identity" | "shape";
  /** Account data on public pages is empty anonymously. Verify that refusal, then compare this sample account. */
  accountParityPersona?: PersonaId;
}

/** Declare an area's live sources. Keys must be collection names the pages read. */
// biome-ignore lint/suspicious/noExplicitAny: each source keeps its own document type
export function defineSources<M extends Record<string, LiveSource<any>>>(sources: M): M {
  return sources;
}
