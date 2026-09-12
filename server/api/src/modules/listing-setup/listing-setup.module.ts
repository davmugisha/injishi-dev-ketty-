import { Module } from '@nestjs/common';

import { InventoryService } from './application/inventory.service';
import { RatePlansService } from './application/rate-plans.service';
import { InventoryRepository } from './infrastructure/inventory.repository';
import { RatePlansRepository } from './infrastructure/rate-plans.repository';

/**
 * Inventory authoring (ADR-009) — the operator write path for properties, room
 * types, rooms, rates and publishing.
 *
 * Named `listing-setup` because that is what the module map in
 * `architecture.md` already calls it. Kept apart from `ListingModule`, which
 * serves the PUBLIC read of a published property and needs no session at all;
 * folding an authenticated write surface into it would make that untrue of the
 * whole module.
 *
 * Layering matches every other module: domain/ (the containment rule, later the
 * publish rules and the label generator) — application/ (use cases) —
 * infrastructure/ (Drizzle). `InventoryService` is the only export, so nothing
 * outside can reach the repository and skip the containment check.
 */
@Module({
  // Rate plans sit here rather than in `operations`: a plan is inventory
  // SETUP — the terms a room type sells on — not something that happens at
  // the desk today.
  providers: [
    InventoryRepository,
    InventoryService,
    RatePlansRepository,
    RatePlansService,
  ],
  exports: [InventoryService, RatePlansService],
})
export class ListingSetupModule {}
