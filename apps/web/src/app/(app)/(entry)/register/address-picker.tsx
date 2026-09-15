"use client";

import { type District, type Province, type Sector } from "@injishi/contracts";
import { useEffect, useState } from "react";

import { fetchDistricts, fetchProvinces, fetchSectors } from "@/data/geography";

import { COUNTRY_OPTIONS } from "./country-options";
import { Field, SelectField, TextArea, TextInput } from "./wizard-ui";

/**
 * An address, discriminated by country (D24).
 *
 * Rwanda gets the administrative cascade Province → District → Sector plus a
 * street line; anywhere else gets one free-form box, because address formats
 * differ too much between countries to split into fields that fit all of them.
 *
 * The draft holds STRINGS, including the ids. `SelectField` hands back a string
 * key, so keeping the draft in that shape means there is one place that
 * converts — at validation — rather than a cast on every change.
 *
 * Only the sector id is ever stored server-side: a sector resolves upward to its
 * district and province, so the first two pickers exist to drive the cascade,
 * not to be saved.
 */
export interface AddressDraft {
  country: string;
  provinceId: string;
  districtId: string;
  sectorId: string;
  street: string;
  addressText: string;
}

export const EMPTY_ADDRESS: AddressDraft = {
  country: "RW",
  provinceId: "",
  districtId: "",
  sectorId: "",
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
  idPrefix,
  errorPrefix = "address",
}: {
  draft: AddressDraft;
  onChange: (next: AddressDraft) => void;
  errors: Record<string, string>;
  rwandaOnly?: boolean;
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
                onChange({ ...draft, provinceId, districtId: "", sectorId: "" })
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
                onChange({ ...draft, districtId, sectorId: "" })
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
              onChange={(sectorId) => onChange({ ...draft, sectorId })}
            />
          </Field>

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
 * An address as a line a person can check: street, sector, district,
 * province, in words (AC-9).
 *
 * The draft holds ids, because that is what the picker selects and what is sent,
 * so the names are read from the same geography the picker read them from. Each
 * list is small and the picker has usually just fetched it. An id that no longer
 * resolves reads as absent rather than as a number nobody can check.
 */
export function useAddressLine(address: AddressDraft): string | null {
  const [line, setLine] = useState<string | null>(null);
  const { country, provinceId, districtId, sectorId, street, addressText } = address;

  useEffect(() => {
    let cancelled = false;
    if (country !== "RW") {
      setLine(addressText.trim() || null);
      return;
    }
    void (async () => {
      const [provinces, districts, sectors] = await Promise.all([
        fetchProvinces(),
        provinceId ? fetchDistricts(Number(provinceId)) : Promise.resolve(null),
        districtId ? fetchSectors(Number(districtId)) : Promise.resolve(null),
      ]);
      const nameIn = (
        res: Awaited<ReturnType<typeof fetchProvinces>> | null,
        id: string,
      ): string | null =>
        res && res.status === "ok" ? (res.data.find((x) => String(x.id) === id)?.name ?? null) : null;
      const parts = [
        street.trim() || null,
        nameIn(sectors, sectorId),
        nameIn(districts, districtId),
        nameIn(provinces, provinceId),
      ].filter((p): p is string => Boolean(p));
      if (!cancelled) setLine(parts.length > 0 ? parts.join(", ") : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [country, provinceId, districtId, sectorId, street, addressText]);

  return line;
}
