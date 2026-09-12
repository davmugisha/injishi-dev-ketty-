import { Injectable, Logger } from '@nestjs/common';

import { DepartmentsService } from './departments.service';
import {
  type ChargeDraft,
  FolioRepository,
} from '../infrastructure/folio.repository';
import { accountCodeFor } from '../infrastructure/ledger-posting';

/**
 * The night audit: post one room charge per night, per in-house stay (AC-15).
 *
 * A guest's room is not billed when they arrive, it accrues. A three night stay
 * owes three room charges, at the rate LOCKED on the booking (D8) rather than
 * whatever the room type costs today, because the price the guest agreed to is
 * a fact about the booking and not about the calendar.
 *
 * RUNNING IT TWICE FOR ONE NIGHT ADDS NOTHING, and that is enforced by a unique
 * index on `(folio_id, business_date)` for room charges rather than by the query
 * below. A job runs twice: on a retry, on two workers, on a manual rerun after
 * an outage. A guard that lives only in the query is a guard that a race walks
 * straight through, and the charge it would duplicate is the guest's room.
 *
 * The department is the property's Rooms department, which migration phase 1
 * created for every property. Nobody is asked, because a room charge earns for
 * Rooms by definition.
 */
@Injectable()
export class NightAuditService {
  private readonly logger = new Logger(NightAuditService.name);

  constructor(
    private readonly folios: FolioRepository,
    private readonly departments: DepartmentsService,
  ) {}

  /**
   * Post tonight's room charges.
   *
   * `businessDate` defaults to today in the property's own terms. It is a
   * parameter rather than always `new Date()` so a rerun after an outage can
   * name the night it missed instead of billing that night as tonight.
   */
  async postRoomCharges(businessDate?: string): Promise<number> {
    const night = businessDate ?? new Date().toISOString().slice(0, 10);
    const owed = await this.folios.staysOwedRoomCharge(night);

    let posted = 0;
    for (const stay of owed) {
      if (!stay.lockedNightlyRateRwf) {
        // No locked rate means no source for the amount, and inventing one
        // would put a number on a guest's bill that nobody agreed to. Left for
        // the desk to charge by hand.
        this.logger.warn(
          `Folio ${stay.folioId} has no locked nightly rate; skipping ${night}.`,
        );
        continue;
      }

      try {
        const department = await this.departments.roomsDepartmentFor(
          stay.propertyId,
        );
        const accountCode = accountCodeFor({
          chargeType: 'room',
          departmentCategory: department.departmentCategory,
        });
        if (!accountCode) continue;

        const draft: ChargeDraft = {
          chargeType: 'room',
          description: `Room charge for ${night}`,
          departmentId: department.id,
          quantity: 1,
          unitPriceRwf: stay.lockedNightlyRateRwf,
          amountRwf: stay.lockedNightlyRateRwf,
          taxCode: null,
          taxRate: null,
          taxAmountRwf: null,
          sourceRefType: 'night_audit',
          sourceRefId: null,
          // Null: the system posted this, not a person. That is what the column
          // means, so it is left null rather than given a service account.
          postedByUserId: null,
          businessDate: night,
          idempotencyKey: `${stay.workspaceId}:night:${stay.folioId}:${night}`,
          accountCode,
        };

        await this.folios.postCharges({
          folioId: stay.folioId,
          workspaceId: stay.workspaceId,
          drafts: [draft],
        });
        posted += 1;
      } catch (error) {
        // One folio's failure must not stop the rest of the property's night.
        // The unique index means a retry of this one tomorrow is safe.
        this.logger.error(
          `Night audit failed for folio ${stay.folioId} on ${night}: ${String(error)}`,
        );
      }
    }

    this.logger.log(`Night audit ${night}: posted ${posted} room charges.`);
    return posted;
  }
}
