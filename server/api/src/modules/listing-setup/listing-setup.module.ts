import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';
import { InventoryService } from './application/inventory.service';
import { PropertyPhotosService } from './application/property-photos.service';
import { RatePlansService } from './application/rate-plans.service';
import { RoomTypesService } from './application/room-types.service';
import { RoomsService } from './application/rooms.service';
import { SetupProgressService } from './application/setup-progress.service';
import { InventoryRepository } from './infrastructure/inventory.repository';
import { PropertyPhotosRepository } from './infrastructure/property-photos.repository';
import { RatePlansRepository } from './infrastructure/rate-plans.repository';
import { RoomTypesRepository } from './infrastructure/room-types.repository';
import { RoomsRepository } from './infrastructure/rooms.repository';
import { SetupProgressRepository } from './infrastructure/setup-progress.repository';

/**
 * Inventory authoring (ADR-009, extended by ADR-053) — the operator write path
 * for properties, room types, rates, photographs and publishing.
 *
 * Named `listing-setup` because that is what the module map in
 * `architecture.md` already calls it. Kept apart from `ListingModule`, which
 * serves the PUBLIC read of a published property and needs no session at all;
 * folding an authenticated write surface into it would make that untrue of the
 * whole module.
 *
 * Layering matches every other module: domain/ (the containment rule, the slug
 * mint, the publish conditions) — application/ (use cases) — infrastructure/
 * (Drizzle). Only the SERVICES are exported, so nothing outside can reach a
 * repository and skip the containment check.
 *
 * `StorageModule` is imported for `StorageService`, because a photograph's signed
 * URL and the check that a key really is a property photograph both live there.
 * The AWS SDK stays inside `modules/storage/infrastructure/` and is not reachable
 * from here, which is the one wiring point ADR-053 leaves alone.
 */
@Module({
  imports: [StorageModule],
  // Rate plans sit here rather than in `operations`: a plan is inventory
  // SETUP — the terms a room type sells on — not something that happens at
  // the desk today.
  providers: [
    InventoryRepository,
    InventoryService,
    PropertyPhotosRepository,
    PropertyPhotosService,
    RatePlansRepository,
    RatePlansService,
    RoomTypesRepository,
    RoomTypesService,
    // The physical rooms and units, and the setup checklist's counts
    // (setup after approval, 2026-09-13).
    RoomsRepository,
    RoomsService,
    SetupProgressRepository,
    SetupProgressService,
  ],
  exports: [
    InventoryService,
    PropertyPhotosService,
    RatePlansService,
    RoomTypesService,
    RoomsService,
    SetupProgressService,
  ],
})
export class ListingSetupModule {}
