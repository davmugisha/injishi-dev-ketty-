import type { Allowance, AllowanceInput, TurnUsage, UsageSink } from '../application/usage-ledger';

/** The ledger as a list, so a test can read what a turn recorded. */
export class FakeUsage implements UsageSink {
  readonly turns: TurnUsage[] = [];
  readonly asked: AllowanceInput[] = [];
  /** What every allowance check answers; a test sets it to refuse. */
  allow: Allowance = { allowed: true };
  /** Answered turns per route, as the suggestions read them; a test may set it. */
  counts = new Map<string, number>();

  recordTurn(turn: TurnUsage): Promise<void> {
    this.turns.push(turn);
    return Promise.resolve();
  }

  popularity(): Promise<Map<string, number>> {
    return Promise.resolve(this.counts);
  }

  allowance(input: AllowanceInput): Promise<Allowance> {
    this.asked.push(input);
    return Promise.resolve(this.allow);
  }
}
