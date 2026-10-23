import type { PersonaId } from "@injishi/data";
import type { SourceContext } from "../../src/server/sources/types";

/** One end-to-end CRUD flow, run against a freshly seeded demo API by scripts/verify-flows.ts. */
export interface Flow {
  name: string;
  run(helpers: FlowHelpers): Promise<void>;
}

export interface FlowHelpers {
  /** The source context a page gets when this persona is signed in. */
  as(persona: PersonaId): Promise<SourceContext>;
  /** The same for a person who is not a persona: a seeded officer by email, or a brand new registrant. */
  asEmail(email: string): Promise<SourceContext>;
  check(condition: unknown, message: string): asserts condition;
  /** Expect the call to be refused with this HTTP status; fails when it succeeds or fails differently. */
  refused(status: number, call: () => Promise<unknown>, what: string): Promise<void>;
  step(message: string): void;
}
