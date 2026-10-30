/**
 * What the staff phone's Today draws.
 *
 * Declared here since ADR-074 stage 4: the product owns the shapes its views draw, copied verbatim from
 * `@injishi/data/fixtures/platform.ts` with every type they reference. The demo fixtures keep matching
 * declarations for their rows until stage 9, and every page that passes those rows into a view is where the
 * compiler checks the two still agree.
 */
import type { Tone } from "./shared.ts";

export interface HousekeepingTask {
  id: string;
  room: string;
  kind: string;
  kindTone: Tone;
  note: string;
  flag: string | null;
  status: "waiting" | "active" | "done";
}

export interface HousekeepingDone {
  id: string;
  room: string;
  kind: string;
  when: string;
  state: string;
  stateTone: Tone;
}
