import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import {
  bookings,
  guestStays,
  preArrivalIdentities,
  stayIdentities,
  storedObjects,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * A guest's own identity for a booking, sent before arrival (F-B09, ADR-060),
 * and the one moment it becomes the stay's: the desk check-in.
 */
@Injectable()
export class PreArrivalIdentityRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The facts self check-in decides on, or null for no such booking. */
  async bookingFacts(bookingId: string): Promise<{
    guestUserId: string | null;
    status: string;
    checkedIn: boolean;
  } | null> {
    const [booking] = await this.db
      .select({ guestUserId: bookings.guestUserId, status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    if (!booking) return null;
    const [stay] = await this.db
      .select({ id: guestStays.id })
      .from(guestStays)
      .where(eq(guestStays.bookingId, bookingId))
      .limit(1);
    return { ...booking, checkedIn: Boolean(stay) };
  }

  /** The stored object behind a key, for the ownership and kind check. */
  async storedObject(objectKey: string): Promise<{
    id: string;
    kind: string;
    uploadedByUserId: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        id: storedObjects.id,
        kind: storedObjects.kind,
        uploadedByUserId: storedObjects.uploadedByUserId,
      })
      .from(storedObjects)
      .where(eq(storedObjects.objectKey, objectKey))
      .limit(1);
    return row ?? null;
  }

  /** One per booking: sending again before arrival replaces what was sent. */
  async upsert(input: {
    bookingId: string;
    guestUserId: string;
    documentType: 'national_id' | 'passport';
    documentNumber: string;
    issuingCountry: string;
    idPhotoObjectId: string;
    addressText: string;
  }): Promise<{ submittedAt: Date }> {
    const now = new Date();
    const [row] = await this.db
      .insert(preArrivalIdentities)
      .values({ ...input, submittedAt: now })
      .onConflictDoUpdate({
        target: preArrivalIdentities.bookingId,
        set: {
          documentType: input.documentType,
          documentNumber: input.documentNumber,
          issuingCountry: input.issuingCountry,
          idPhotoObjectId: input.idPhotoObjectId,
          addressText: input.addressText,
          submittedAt: now,
          updatedAt: now,
        },
      })
      .returning({ submittedAt: preArrivalIdentities.submittedAt });
    return row!;
  }

  /**
   * Put what the guest sent onto the stay the desk just opened.
   *
   * What the DESK typed wins: it was typed looking at the document, so the
   * guest's answer only fills a field the desk left empty, and the photo,
   * which the desk card cannot capture at all. Returns whether anything was
   * carried.
   */
  async carryToStay(bookingId: string, stayId: string): Promise<boolean> {
    const [sent] = await this.db
      .select()
      .from(preArrivalIdentities)
      .where(eq(preArrivalIdentities.bookingId, bookingId))
      .limit(1);
    if (!sent) return false;
    await this.db
      .insert(stayIdentities)
      .values({
        guestStayId: stayId,
        idNumber: sent.documentNumber,
        documentType: sent.documentType,
        idPhotoObjectId: sent.idPhotoObjectId,
        addressText: sent.addressText,
      })
      .onConflictDoUpdate({
        target: stayIdentities.guestStayId,
        set: {
          idNumber: sql`coalesce(${stayIdentities.idNumber}, excluded.id_number)`,
          documentType: sql`coalesce(${stayIdentities.documentType}, excluded.document_type)`,
          idPhotoObjectId: sql`coalesce(${stayIdentities.idPhotoObjectId}, excluded.id_photo_object_id)`,
          addressText: sql`coalesce(${stayIdentities.addressText}, excluded.address_text)`,
        },
      });
    return true;
  }
}
