/**
 * The sample recipe's rentals rows, after the rentals rebuild (2026-10-24).
 *
 * Migrations 0073 to 0080 reshaped the residence tables: one unit record
 * (`rental_units`), tenants as records, leases with their full terms, one
 * charge table (`lease_charges`), one payment record with its allocations, one
 * deposit record. The old demo rows (leases from text, a rent roll of paid
 * amounts, caution holds) no longer fit them, and real rentals data now comes
 * through the app only (no rentals fixtures, revamp plan). So on a database
 * past those migrations the seeds skip their leases, rent, deposits, notices,
 * filings and placements, say so once, and keep everything else: the
 * residence businesses, buildings and units are still seeded, and
 * `syncRentalUnits` gives each residence room its unit.
 */

/** True on a database migrated past the rentals rebuild (0078 renamed rent_charges). */
export async function rentalsRebuilt(client) {
  const { rows } = await client.query(
    "select to_regclass('public.lease_charges') is not null as rebuilt",
  );
  return rows[0]?.rebuilt === true;
}

/** `lease_filings` on a database past migration 0082, which renamed `contract_filings`. */
export async function filingsTable(client) {
  const { rows } = await client.query("select to_regclass('public.lease_filings') is not null as renamed");
  return rows[0]?.renamed === true ? 'lease_filings' : 'contract_filings';
}

/** The one line every seed prints when it skips its rentals rows. */
export function skipRentalsNote(script, what) {
  return `${script}: ${what} skipped. The rentals tables were rebuilt (migrations 0073-0080); rentals data comes through the app, not from seeds.`;
}

/**
 * A `rental_units` row for every residence room that has none, with the room's
 * id, label, block and note, and the asking rent and deposit its unit record,
 * rate plan or room type names (the same rule as migration 0075). Idempotent.
 * Returns how many it wrote.
 */
export async function syncRentalUnits(client) {
  const { rowCount } = await client.query(`
    insert into rental_units (id, workspace_id, property_id, block_id, label, floor, asking_rent_rwf,
                              asking_deposit_rwf, state, note, created_at)
    select r.id, r.workspace_id, r.property_id, ru.block_id,
           coalesce(nullif(btrim(r.label), ''), 'Unit ' || left(r.id::text, 8)),
           r.floor,
           coalesce(
             case when ru.asking_rent_rwf > 0 then ru.asking_rent_rwf end,
             (select rp.base_price_rwf from rate_plans rp
               where rp.room_type_id = rt.id and rp.base_price_rwf > 0
               order by rp.is_default desc, rp.created_at, rp.id limit 1),
             case when rt.base_price_rwf > 0 then rt.base_price_rwf end),
           coalesce(
             (select rp.caution_rwf from rate_plans rp
               where rp.room_type_id = rt.id and rp.caution_rwf >= 0
               order by rp.is_default desc, rp.created_at, rp.id limit 1),
             case when rt.caution_rwf >= 0 then rt.caution_rwf end),
           case when r.status = 'available' then 'active' else 'off_market' end::rental_unit_state,
           ru.note,
           r.created_at
      from rooms r
      join room_types rt on rt.id = r.room_type_id
      left join residence_units ru on ru.room_id = r.id
     where rt.domain = 'residence'
       and not exists (select 1 from rental_units u where u.id = r.id)
       and not exists (select 1 from rental_units u
                        where u.property_id = r.property_id
                          and lower(u.label) = lower(coalesce(nullif(btrim(r.label), ''), 'Unit ' || left(r.id::text, 8))))
    on conflict do nothing
  `);
  return rowCount ?? 0;
}
