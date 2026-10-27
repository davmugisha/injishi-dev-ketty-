/**
 * Fixture writes are the demo's alone (ADR-075 D-s).
 *
 * This store is the interface's sample data: a single file every visitor of a deployment shares. A screen that
 * still draws from it may let a demo visitor press Save, and on the demo that is the point. In production and on
 * staging the same press wrote `/data/injishi.db` for every visitor at once, so a "saved" change was a stranger's
 * edit to sample data that real people were reading. So every document write refuses unless the process is the
 * demo.
 *
 * The demo is named by `NEXT_PUBLIC_INJISHI_ENVIRONMENT=demo`, which only the demo compose file sets (production
 * and staging set `production`; it is baked into the image at build). A laptop's `next dev` writes too: AGENTS.md
 * counts every laptop as the demo, and its store is a file on that laptop alone. Building the store from the
 * fixtures (`seed`, the reseed on a changed fixture hash) is how it is read, not a write a screen asks for, and is
 * not covered here.
 */

export class FixtureWriteRefused extends Error {
  constructor() {
    super("This screen shows sample data, and sample data can only be changed on the demo.");
    this.name = "FixtureWriteRefused";
  }
}

/** Whether this process may write sample data: the demo build, or a development server. */
export function fixtureWritesAllowed(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  if (env.NEXT_PUBLIC_INJISHI_ENVIRONMENT === "demo") return true;
  return env.NODE_ENV !== "production";
}

/** Refuse a sample data write anywhere but the demo. Every document write calls it first. */
export function assertFixtureWrite(env: Readonly<Record<string, string | undefined>> = process.env): void {
  if (!fixtureWritesAllowed(env)) throw new FixtureWriteRefused();
}
