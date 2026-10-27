"use client";

import {
  type Cell,
  type District,
  type Province,
  type Sector,
  type Village,
} from "@injishi/contracts";
import { useEffect, useState } from "react";
import { Button } from "@injishi/web-ui";

import {
  fetchCells,
  fetchDistricts,
  fetchProvinces,
  fetchSectors,
  fetchVillages,
  type GeographyList,
} from "@/data/geography";
import { useOnline } from "@/hooks/use-online";

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

type OptionsPhase = "idle" | "loading" | "ready" | "empty" | "error";

/** Keep a response tied to the parent it was fetched for. A stale response must
 * never appear as options under a newly selected province, district or cell. */
function useAddressOptions<T>(
  parentId: string,
  load: (id: number) => Promise<GeographyList<T>>,
) {
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState<{
    parentId: string;
    options: T[];
    phase: OptionsPhase;
  }>({ parentId: "", options: [], phase: "idle" });

  useEffect(() => {
    if (!parentId) return;
    let current = true;
    setResponse({ parentId, options: [], phase: "loading" });
    void load(Number(parentId)).then((result) => {
      if (!current) return;
      setResponse(result.status === "ok"
        ? { parentId, options: result.data, phase: result.data.length ? "ready" : "empty" }
        : { parentId, options: [], phase: "error" });
    });
    return () => { current = false; };
  }, [parentId, load, attempt]);

  const current = response.parentId === parentId
    ? response
    : { parentId, options: [] as T[], phase: parentId ? "loading" as const : "idle" as const };
  return { ...current, retry: () => setAttempt((n) => n + 1) };
}

function LoadStatus({
  level,
  phase,
  retry,
}: {
  level: string;
  phase: OptionsPhase;
  retry: () => void;
}) {
  // Read before the early return: a hook runs on every render or none.
  const online = useOnline();
  if (phase !== "error" && phase !== "empty") return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert">
      <span>{phase === "error"
        ? online
          ? `We couldn't load the ${level} list.`
          : `You're offline. Connect to load the ${level} list.`
        : `No ${level} options were returned.`}</span>
      <Button variant="ghost" size="sm" onClick={retry}>Try again</Button>
    </div>
  );
}

function optionPlaceholder(
  phase: OptionsPhase,
  level: string,
  parent: string,
): string {
  if (phase === "idle") return `Pick a ${parent} first`;
  if (phase === "loading") return `Loading ${level} options…`;
  if (phase === "error") return `Could not load ${level}`;
  if (phase === "empty") return `No ${level} options`;
  return `Choose a ${level}`;
}

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
  requireVillage = false,
  streetLabel = "Street address",
  streetHint = "Optional — not every plot has one.",
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
  /**
   * Ask the cell and the village as required rather than optional: the
   * registration artboard's Location, which an officer walks to. Only with
   * `collectVillage`; the caller enforces it, this only says so.
   */
  requireVillage?: boolean;
  streetLabel?: string;
  streetHint?: string;
}) {
  const isRwanda = draft.country === "RW";
  const provinces = useAddressOptions<Province>(isRwanda ? "1" : "", fetchProvinces);
  const districts = useAddressOptions<District>(isRwanda ? draft.provinceId : "", fetchDistricts);
  const sectors = useAddressOptions<Sector>(isRwanda ? draft.districtId : "", fetchSectors);
  // Only locations which save a village need the last two levels.
  const cells = useAddressOptions<Cell>(isRwanda && collectVillage ? draft.sectorId : "", fetchCells);
  const villages = useAddressOptions<Village>(isRwanda && collectVillage ? draft.cellId : "", fetchVillages);

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
          <Field label="Province" required error={errors[`${errorPrefix}.provinceId`]}>
            <SelectField
              id={`${idPrefix}-province`}
              value={draft.provinceId}
              disabled={provinces.phase !== "ready"}
              options={provinces.options.map((p) => ({
                value: String(p.id),
                label: p.name,
              }))}
              placeholder={optionPlaceholder(provinces.phase, "province", "country")}
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
          <LoadStatus level="province" phase={provinces.phase} retry={provinces.retry} />

          <Field label="District" required error={errors[`${errorPrefix}.districtId`]}>
            <SelectField
              id={`${idPrefix}-district`}
              value={draft.districtId}
              disabled={districts.phase !== "ready"}
              options={districts.options.map((d) => ({
                value: String(d.id),
                label: d.name,
              }))}
              placeholder={optionPlaceholder(districts.phase, "district", "province")}
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
          <LoadStatus level="district" phase={districts.phase} retry={districts.retry} />

          <Field label="Sector" required error={errors[`${errorPrefix}.sectorId`]}>
            <SelectField
              id={`${idPrefix}-sector`}
              value={draft.sectorId}
              disabled={sectors.phase !== "ready"}
              options={sectors.options.map((sector) => ({
                value: String(sector.id),
                label: sector.name,
              }))}
              placeholder={optionPlaceholder(sectors.phase, "sector", "district")}
              invalid={Boolean(errors[`${errorPrefix}.sectorId`])}
              onChange={(sectorId) =>
                onChange({ ...draft, sectorId, cellId: "", villageId: "" })
              }
            />
          </Field>
          <LoadStatus level="sector" phase={sectors.phase} retry={sectors.retry} />

          {collectVillage ? (
            <>
              <Field
                label="Cell"
                required={requireVillage}
                hint={requireVillage ? "Follows the sector" : "Optional — it narrows the village list."}
                error={errors[`${errorPrefix}.cellId`]}
              >
                <SelectField
                  id={`${idPrefix}-cell`}
                  value={draft.cellId}
                  disabled={cells.phase !== "ready"}
                  options={cells.options.map((cell) => ({
                    value: String(cell.id),
                    label: cell.name,
                  }))}
                  placeholder={optionPlaceholder(cells.phase, "cell", "sector")}
                  invalid={Boolean(errors[`${errorPrefix}.cellId`])}
                  onChange={(cellId) =>
                    onChange({ ...draft, cellId, villageId: "" })
                  }
                />
              </Field>
              <LoadStatus level="cell" phase={cells.phase} retry={cells.retry} />

              <Field
                label="Village"
                required={requireVillage}
                hint={requireVillage ? "Follows the cell" : "Optional — but it is what gets someone to the door."}
                error={errors[`${errorPrefix}.villageId`]}
              >
                <SelectField
                  id={`${idPrefix}-village`}
                  value={draft.villageId}
                  disabled={villages.phase !== "ready"}
                  options={villages.options.map((village) => ({
                    value: String(village.id),
                    label: village.name,
                  }))}
                  placeholder={optionPlaceholder(villages.phase, "village", "cell")}
                  invalid={Boolean(errors[`${errorPrefix}.villageId`])}
                  onChange={(villageId) => onChange({ ...draft, villageId })}
                />
              </Field>
              <LoadStatus level="village" phase={villages.phase} retry={villages.retry} />
            </>
          ) : null}

          <Field
            label={streetLabel}
            hint={streetHint}
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
