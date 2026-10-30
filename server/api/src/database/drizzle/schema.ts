/**
 * Injishi database schema (PostgreSQL 16+, Drizzle ORM).
 *
 * Full translation of dox_context/architecture-schema.md (§4-§10) into Drizzle.
 * Conventions (§1):
 *   - snake_case columns, plural table names, `<referenced_singular>_id` FKs
 *   - UUID PKs everywhere EXCEPT geography (meaningful integer smart-codes).
 *     The design calls for app-generated UUIDv7; the DB default here is
 *     gen_random_uuid() (built-in, no extension) as a fallback - the app may
 *     supply a time-ordered v7 on insert. Better-Auth tables are defined here
 *     with uuid ids so every FK to users resolves. Better Auth IS wired now
 *     (AuthModule, mounted at /api/auth/*) and owns these tables at runtime.
 *   - money is integer RWF (`amount_rwf bigint`), never float; a `currency`
 *     column rides alongside money-bearing tables (v1 single-currency 'RWF').
 *   - timestamptz UTC for instants; `date` for calendar values.
 *   - email is case-insensitive via a unique lower() index (citext avoided to
 *     keep the first migration free of extension dependencies).
 *
 * Deliberately deferred to a later migration (documented in §11, not omitted by
 * oversight): Row-Level Security policies (need the app role + per-request
 * `SET LOCAL app.workspace_id` plumbing - enabling RLS now would lock out the
 * app), month range-partitioning of append-only tables, and the GiST daterange
 * exclusion constraint for last-unit double-booking. Cross-table domain checks
 * (e.g. a booking's room_type must be `hospitality`) are enforced in app code -
 * Postgres CHECK cannot subquery.
 */
/*
 * SPLIT NOTE (cleanup Phase 2).
 *
 * This file was 3,956 lines and 223 declarations in one module. It is now a
 * barrel over the domain modules beside it, carved along the section headers it
 * already carried. The path did not change, because `drizzle.config.ts` names
 * this file and every repository imports from it; re-exporting keeps all of
 * that true while making each domain readable on its own.
 *
 * `columns.ts` holds the shared column helpers and is NOT re-exported here:
 * they were private to this module before the split and stay private to the
 * schema, so this file's export surface is unchanged.
 */
export * from './enums';
export * from './auth';
export * from './geography';
// Before org: `orgs` references the associations, and this imports no org table.
export * from './psf-catalogue';
export * from './org';
export * from './inventory';
export * from './hospitality';
// The front desk's booking channel enum (interface real-data, frontdesk leaf).
export * from './interface-frontdesk';
// Desk reply templates per business (interface real-data, frontdesk leaf, stays area).
export * from './interface-stays';
export * from './residence';
export * from './messaging';
export * from './money';
export * from './events';
export * from './governance';
export * from './operations';
// Last: it is a leaf over hospitality, inventory, operations and org.
export * from './guest-relations';
export * from './platform';
export * from './training';
export * from './psf';
// A leaf over operations, inventory and org: nothing imports it back.
export * from './people';
export * from './people-file';
export * from './people-time';
export * from './people-leave';
export * from './people-pay';
export * from './people-checklists';
// The list framework (ADR-058 slice 2): saved views and the export log.
export * from './lists';
export * from './assistant';
// The new interface's operations floor (real-data 1.2.3): room blocks and history, housekeeping
// rules, allocations and escalations, assets, parts, condition signals, lost and found.
export * from './interface-operations';
// The new interface's HR screens (real-data, people): teams, minimum cover, checklists, dependants.
export * from './interface-people';
// The new interface's marketplace and guest account (real-data 1.3.2): marketplace cards for
// properties and room types, and the append-only consent history.
export * from './interface-market';
// Rentals (blueprint 1.1): the leaf over residence, inventory, money and org. Landlord settings,
// lease payments and their allocations, deposits, reminders, the lease timeline, and the legacy
// residence tables migration 0089 drops.
export * from './rentals';
// The new interface's staff phone (real-data 1.3.3): checklists and their results, minibar counts,
// time on a work order.
export * from './interface-staff';
// Guests and local leaders (P5): the reference lists, guest registrations, their routes to the
// leaders, and what the 12 month purge leaves as counts. A leaf over org, inventory and residence.
export * from './guests';
// Brokers (P5, 2026-10-25): plans and their payments, the registration fee, ratings. A leaf over
// residence, geography and auth.
export * from './brokers';
// The bar and restaurant point of sale (POS spec, phase 1): tables, orders, kitchen tickets,
// simulated payments, registers and cashier shifts. A leaf: nothing imports it back.
export * from './pos';
// The shared idempotency store for offline writes (mobile spec 0003, D-r). A leaf over auth.
export * from './idempotency';
