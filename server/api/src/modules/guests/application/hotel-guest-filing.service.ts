import { Injectable, Logger } from '@nestjs/common';

import { hotelGuestValues } from '../domain/hotel-guest-values';
import { GuestRegistryRepository } from '../infrastructure/guest-registry.repository';
import { GuestRegistryService } from './guest-registry.service';

/**
 * A hotel, motel or lodge check in, into the guest register (0114).
 *
 * The register reached local government only from residences, so a guest
 * checked in at a hotel was in no village leader's list, no DASSO's sector
 * and no district report. Every check in now files one registration for its
 * stay, at the property's own place, through the same filing a residence's
 * guest takes: routed up the local chain, and to DGIE for a guest from abroad.
 *
 * NEVER FAILS A CHECK IN. It runs after the stay exists, and anything that
 * goes wrong here is logged and left for the desk, the way the registration
 * card is: a guest is never turned away at the counter because a report could
 * not be filed. Filing is once per stay (`guest_registrations_stay_uk`).
 */
@Injectable()
export class HotelGuestFilingService {
  private readonly log = new Logger(HotelGuestFilingService.name);

  constructor(
    private readonly guests: GuestRegistryRepository,
    private readonly registry: GuestRegistryService,
  ) {}

  /** File the stay's guest; the registration's id, or null when nothing was filed. */
  async fileStay(stayId: string, deskUserId: string): Promise<string | null> {
    try {
      if (await this.guests.hasStayRegistration(stayId)) return null;
      const facts = await this.guests.hotelStayFacts(stayId);
      if (!facts) return null;
      const home = await this.guests.buildingHome(facts.workspaceId, facts.propertyId, null);
      if (!home) {
        this.log.warn(`Stay ${stayId}: its property was not found, so the guest was not filed for local government.`);
        return null;
      }
      const prepared = hotelGuestValues(facts);
      if (!prepared) {
        this.log.warn(`Stay ${stayId}: no guest name on the stay, so the guest was not filed for local government.`);
        return null;
      }
      if (!prepared.nationalityKnown) {
        this.log.warn(`Stay ${stayId}: no nationality given, so the guest was filed as Rwandan (local leaders only, not DGIE).`);
      }
      if (home.sectorId === null) {
        this.log.warn(`Stay ${stayId}: ${home.propertyName} has no sector on record, so its leaders' steps wait until it does.`);
      }
      return await this.registry.fileHotelStay(home, prepared.values, stayId, deskUserId);
    } catch (error) {
      this.log.error(
        `Stay ${stayId} was checked in, but its guest was not filed for local government: ` +
          (error instanceof Error ? error.message : String(error)),
      );
      return null;
    }
  }
}
