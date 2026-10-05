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
export * from './org';
export * from './inventory';
export * from './hospitality';
export * from './residence';
export * from './messaging';
export * from './money';
export * from './events';
export * from './governance';
export * from './operations';
// Last: it is a leaf over hospitality, inventory, operations and org.
export * from './guest-relations';
export * from './platform';
export * from './waitlist';
export * from './training';
export * from './payroll';
export * from './hr';
export * from './hr-lifecycle';