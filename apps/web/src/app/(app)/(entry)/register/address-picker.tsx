"use client";

import {
  type Cell,
  type District,
  type Province,
  type Sector,
  type Village,
} from "@injishi/contracts";
import { useEffect, useState } from "react";

import {
  fetchCells,
  fetchDistricts,
  fetchProvinces,
  fetchSectors,
  fetchVillages,
} from "@/data/geography";

import { COUNTRY_OPTIONS } from "./country-options";
import { Field, SelectField, TextArea, TextInput } from "./wizard-ui";

/**
 * An address, discriminated by country (D24).
 *
 * Rwanda gets the administrative cascade Province → District → Sector, plus
 * Cell → Village where the caller asks for them, plus a street line; anywhere
 * else gets one free-form box, because address formats differ too much between
 * countries to split into fields that fit all of them.
 *
 * The draft holds STRINGS, including the ids. `SelectField` hands back a string
 * key, so keeping the draft in that shape means there is one place that
 * converts — at validation — rather than a cast on every change.
 *
 * Two of the five levels are stored server-side, and no more: a sector resolves
 * upward to its district and province, and a village to its cell, so province,
 * district and cell exist to drive the cascade rather than to be saved.
 */
export interface AddressDraft {
  country: string;
  provinceId: string;
  districtId: string;
  sectorId: string;
  cellId: string;
  villageId: string;
  street: string;
  addressText: string;
}

export const EMPTY_ADDRESS: AddressDraft = {
  country: "RW",
  provinceId: "",
  districtId: "",
  sectorId: "",
  cellId: "",
  villageId: "",
  street: "",
  addressText: "",
};

/** Turn the draft into the wire shape, or null when it is not answered yet. */
export function addressFromDraft(draft: AddressDraft): unknown {
  if (draft.country === "RW") {
    return {
      country: "RW",
      provinceId: Number(draft.provinceId),
      districtId: Number(draft.districtId),
      sectorId: Number(draft.sectorId),
      // Cell and village are OPTIONAL on `RwandanAddress`, so an unanswered one
      // is omitted rather than sent as 0. `Number("")` is 0, and 0 is not a
      // missing id — it is an id the contract refuses.
      ...(draft.cellId ? { cellId: Number(draft.cellId) } : {}),
      ...(draft.villageId ? { villageId: Number(draft.villageId) } : {}),
      ...(draft.street.trim() ? { street: draft.street.trim() } : {}),
    };
  }
  return { country: draft.country, addressText: draft.addressText };
}

export function AddressPicker({
  draft,
  onChange,
  errors,
  /** A business address is always Rwandan (D24); a personal one need not be. */
  rwandaOnly = false,
  /**
   * Ask for the last two levels as well (D24).
   *
   * Off by default, and that is a storage fact rather than a style one: a
   * village is kept on `orgs.village_id` and `user_profiles.village_id`, and
   * nowhere else. A branch address becomes a `properties` row, which has no
   * village column, so offering the field there would collect an answer the
   * platform then drops on the floor.
   */
  collectVillage = false,
  idPrefix,
  errorPrefix = "address",
}: {
  draft: AddressDraft;
  onChange: (next: AddressDraft) => void;
  errors: Record<string, string>;
  rwandaOnly?: boolean;
  collectVillage?: boolean;
  idPrefix: string;
  /**
   * Where this address sits in the schema being validated. Step 1 validates a
   * `PersonalDetails`, so its paths start at `address`; step 2 validates a
   * `BusinessDetails` nested under `business`, so its paths start at
   * `business.address`. Passing the base keeps one component serving both.
   */
  errorPrefix?: string;
}) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [unavailable, setUnavailable] = useState(false);

  const isRwanda = draft.country === "RW";

  useEffect(() => {
    if (!isRwanda) return;
    let cancelled = false;
    void (async () => {
      const res = await fetchProvinces();
      if (cancelled) return;
      if (res.status === "ok") setProvinces(res.data);
      else setUnavailable(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isRwanda]);

  // Each level reloads from the one above and CLEARS the ones below. Leaving a
  // stale sector selected after changing district would submit an address whose
  // parts disagree, and the server would refuse it with a message about a field
  // the person cannot see.
  useEffect(() => {
    if (!isRwanda || !draft.provinceId) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchDistricts(Number(draft.provinceId));
      if (!cancelled && res.status === "ok") setDistricts(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [isRwanda, draft.provinceId]);

  useEffect(() => {
    if (!isRwanda || !draft.districtId) {
      setSectors([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchSectors(Number(draft.districtId));
      if (!cancelled && res.status === "ok") setSectors(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [isRwanda, draft.districtId]);

  // The last two levels are fetched only where they are asked for: an address
  // that never shows a cell picker has no reason to pull 2,148 rows' worth of
  // one sector's cells, and a branch address is exactly that case.
  useEffect(() => {
    if (!isRwanda || !collectVillage || !draft.sectorId) {
      setCells([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchCells(Number(draft.sectorId));
      if (!cancelled && res.status === "ok") setCells(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [isRwanda, collectVillage, draft.sectorId]);

  useEffect(() => {
    if (!isRwanda || !collectVillage || !draft.cellId) {
      setVillages([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchVillages(Number(draft.cellId));
      if (!cancelled && res.status === "ok") setVillages(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [isRwanda, collectVillage, draft.cellId]);

  return (
    <div className="space-y-4">
      {rwandaOnly ? null : (
        <Field label="Country" required error={errors[`${errorPrefix}.country`]}>
          <SelectField
            id={`${idPrefix}-country`}
            value={draft.country}
            options={COUNTRY_OPTIONS}
            placeholder="Choose a country"
            invalid={Boolean(errors[`${errorPrefix}.country`])}
            onChange={(country) =>
              onChange({
                ...EMPTY_ADDRESS,
                country,
                street: "",
                addressText: "",
              })
            }
          />
        </Field>
      )}

      {isRwanda ? (
        <>
          {unavailable ? (
            <p className="text-sm text-destructive">
              We couldn&apos;t load the province list. Check your connection and
              reload.
            </p>
          ) : null}

          <Field label="Province" required error={errors[`${errorPrefix}.provinceId`]}>
            <SelectField
              id={`${idPrefix}-province`}
              value={draft.provinceId}
              options={provinces.map((p) => ({
                value: String(p.id),
                label: p.name,
              }))}
              placeholder="Choose a province"
              invalid={Boolean(errors[`${errorPrefix}.provinceId`])}
              onChange={(provinceId) =>
                onChange({
                  ...draft,
                  provinceId,
                  districtId: "",
                  sectorId: "",
                  cellId: "",
                  villageId: "",
                })
              }
            />
          </Field>

          <Field label="District" required error={errors[`${errorPrefix}.districtId`]}>
            <SelectField
              id={`${idPrefix}-district`}
              value={draft.districtId}
              disabled={!draft.provinceId}
              options={districts.map((d) => ({
                value: String(d.id),
                label: d.name,
              }))}
              placeholder={
                draft.provinceId ? "Choose a district" : "Pick a province first"
              }
              invalid={Boolean(errors[`${errorPrefix}.districtId`])}
              onChange={(districtId) =>
                onChange({
                  ...draft,
                  districtId,
                  sectorId: "",
                  cellId: "",
                  villageId: "",
                })
              }
            />
          </Field>

          <Field label="Sector" required error={errors[`${errorPrefix}.sectorId`]}>
            <SelectField
              id={`${idPrefix}-sector`}
              value={draft.sectorId}
              disabled={!draft.districtId}
              options={sectors.map((sector) => ({
                value: String(sector.id),
                label: sector.name,
              }))}
              placeholder={
                draft.districtId ? "Choose a sector" : "Pick a district first"
              }
              invalid={Boolean(errors[`${errorPrefix}.sectorId`])}
              onChange={(sectorId) =>
                onChange({ ...draft, sectorId, cellId: "", villageId: "" })
              }
            />
          </Field>

          {collectVillage ? (
            <>
              <Field
                label="Cell"
                hint="Optional — it narrows the village list."
                error={errors[`${errorPrefix}.cellId`]}
              >
                <SelectField
                  id={`${idPrefix}-cell`}
                  value={draft.cellId}
                  disabled={!draft.sectorId}
                  options={cells.map((cell) => ({
                    value: String(cell.id),
                    label: cell.name,
                  }))}
                  placeholder={
                    draft.sectorId ? "Choose a cell" : "Pick a sector first"
                  }
                  invalid={Boolean(errors[`${errorPrefix}.cellId`])}
                  onChange={(cellId) =>
                    onChange({ ...draft, cellId, villageId: "" })
                  }
                />
              </Field>

              <Field
                label="Village"
                hint="Optional — but it is what gets someone to the door."
                error={errors[`${errorPrefix}.villageId`]}
              >
                <SelectField
                  id={`${idPrefix}-village`}
                  value={draft.villageId}
                  disabled={!draft.cellId}
                  options={villages.map((village) => ({
                    value: String(village.id),
                    label: village.name,
                  }))}
                  placeholder={
                    draft.cellId ? "Choose a village" : "Pick a cell first"
                  }
                  invalid={Boolean(errors[`${errorPrefix}.villageId`])}
                  onChange={(villageId) => onChange({ ...draft, villageId })}
                />
              </Field>
            </>
          ) : null}

          <Field
            label="Street address"
            hint="Optional — not every plot has one."
            error={errors[`${errorPrefix}.street`]}
          >
            <TextInput
              id={`${idPrefix}-street`}

              placeholder="KG 11 Ave"
              value={draft.street}
              onChange={(e) => onChange({ ...draft, street: e.target.value })}
            />
          </Field>
        </>
      ) : (
        <Field
          label="Address"
          required
          hint="Write it the way it is written where you live."
          error={errors[`${errorPrefix}.addressText`]}
        >
          <TextArea
            id={`${idPrefix}-text`}

            rows={3}
            value={draft.addressText}
            onChange={(e) => onChange({ ...draft, addressText: e.target.value })}
          />
        </Field>
      )}
    </div>
  );
}

/**
 * An address as a line a person can check: street, village, cell, sector,
 * district, province, in words (AC-9).
 *
 * The draft holds ids, because that is what the picker selects and what is sent,
 * so the names are read from the same geography the picker read them from. Each
 * list is small and the picker has usually just fetched it. An id that no longer
 * resolves reads as absent rather than as a number nobody can check.
 *
 * The last two levels are optional, so a draft that never collected them — a
 * branch address, or anyone who left them blank — simply produces the same
 * three-part line it always did.
 */
export function useAddressLine(address: AddressDraft): string | null {
  const [line, setLine] = useState<string | null>(null);
  const {
    country,
    provinceId,
    districtId,
    sectorId,
    cellId,
    villageId,
    street,
    addressText,
  } = address;

  useEffect(() => {
    let cancelled = false;
    if (country !== "RW") {
      setLine(addressText.trim() || null);
      return;
    }
    void (async () => {
      const [provinces, districts, sectors, cells, villages] = await Promise.all([
        fetchProvinces(),
        provinceId ? fetchDistricts(Number(provinceId)) : Promise.resolve(null),
        districtId ? fetchSectors(Number(districtId)) : Promise.resolve(null),
        sectorId && villageId ? fetchCells(Number(sectorId)) : Promise.resolve(null),
        cellId && villageId ? fetchVillages(Number(cellId)) : Promise.resolve(null),
      ]);
      const nameIn = (
        res: Awaited<ReturnType<typeof fetchProvinces>> | null,
        id: string,
      ): string | null =>
        res && res.status === "ok" ? (res.data.find((x) => String(x.id) === id)?.name ?? null) : null;
      const parts = [
        street.trim() || null,
        nameIn(villages, villageId),
        // The cell is named only when the village is, because a cell on its own
        // locates nothing a reader of this line can use.
        villageId ? nameIn(cells, cellId) : null,
        nameIn(sectors, sectorId),
        nameIn(districts, districtId),
        nameIn(provinces, provinceId),
      ].filter((p): p is string => Boolean(p));
      if (!cancelled) setLine(parts.length > 0 ? parts.join(", ") : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [country, provinceId, districtId, sectorId, cellId, villageId, street, addressText]);

  return line;
}
