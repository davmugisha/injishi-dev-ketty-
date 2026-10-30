import type { SelfCheckInReceipt, SelfCheckInRequest } from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PreArrivalIdentityRepository } from '../infrastructure/pre-arrival-identity.repository';

/**
 * Self check-in before arrival (F-B09, ADR-038 child 5 AC-G8, ADR-060).
 *
 * The guest sends their document and a photo of it from the phone; the desk
 * finds both on the stay when it checks them in, and confirms rather than
 * retypes. It is capture, not KYC: a guest is never held to a verified
 * identity (FL03), and nothing here moves `kyc_status`.
 */
@Injectable()
export class SelfCheckInService {
  private readonly log = new Logger(SelfCheckInService.name);

  constructor(private readonly identities: PreArrivalIdentityRepository) {}

  async submit(
    userId: string,
    bookingId: string,
    request: SelfCheckInRequest,
  ): Promise<SelfCheckInReceipt> {
    const booking = await this.identities.bookingFacts(bookingId);
    // Another guest's booking is answered exactly like a missing one: whether a
    // booking exists is not a stranger's to learn.
    if (!booking || booking.guestUserId !== userId) {
      throw new NotFoundException('Booking not found.');
    }
    if (booking.status !== 'confirmed') {
      throw new ConflictException('Only a confirmed booking can be checked in ahead of arrival.');
    }
    if (booking.checkedIn) {
      throw new ConflictException('The desk has already checked you in for this booking.');
    }

    const photo = await this.identities.storedObject(request.idPhotoObjectKey);
    if (!photo || photo.kind !== 'id_photo' || photo.uploadedByUserId !== userId) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: ['idPhotoObjectKey'], message: 'Upload the photo of your ID again.' }],
      });
    }

    const saved = await this.identities.upsert({
      bookingId,
      guestUserId: userId,
      documentType: request.document.documentType,
      documentNumber: request.document.documentNumber,
      issuingCountry: request.document.issuingCountry,
      idPhotoObjectId: photo.id,
      addressText: request.addressText,
    });
    return { bookingId, submittedAt: saved.submittedAt.toISOString(), idPhotoStored: true };
  }

  /**
   * Carry what the guest sent onto the stay the desk just opened. NEVER
   * THROWS, for the reason `StayClaimService.registerAndInvite` never does: a
   * guest at the counter with a key in their hand must not have their check-in
   * fail because this copy did.
   */
  async carryToStay(bookingId: string, stayId: string): Promise<void> {
    try {
      await this.identities.carryToStay(bookingId, stayId);
    } catch (error) {
      this.log.error(
        `Stay ${stayId} was checked in, but the identity the guest sent ahead could not be attached: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}
