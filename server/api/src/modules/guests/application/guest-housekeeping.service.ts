import { Injectable, Logger } from '@nestjs/common';
import { GUEST_RETENTION_MONTHS, addMonths, kigaliToday } from '@injishi/contracts';

import { GuestRegistryRepository } from '../infrastructure/guest-registry.repository';

/** The first day still kept: guests who left before it are purged. */
export function retentionCutoff(today: string): string {
  return addMonths(today, -GUEST_RETENTION_MONTHS);
}

/**
 * Guest records are kept 12 months after the guest leaves (P5), then deleted
 * with their routes. What is kept is counts: one `guest_purge_tallies` row per
 * arrival month, place and from-abroad, with how many were registered and
 * flagged, so a report over an old period still adds up. Audit rows carry no
 * personal data and stay. Safe to repeat.
 */
@Injectable()
export class GuestHousekeepingService {
  private readonly log = new Logger(GuestHousekeepingService.name);

  constructor(private readonly guests: GuestRegistryRepository) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  async purge(): Promise<{ cutoff: string; purged: number; tallies: number }> {
    const cutoff = retentionCutoff(kigaliToday(this.now()));
    const { purged, tallies } = await this.guests.purge(cutoff);
    if (purged) this.log.log(`Guest retention: ${purged} registration(s) from before ${cutoff} purged, ${tallies} count row(s) kept.`);
    return { cutoff, purged, tallies };
  }
}
