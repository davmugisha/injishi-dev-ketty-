"use client";

/**
 * Province, district, sector, cell, then village: a home address in Rwanda as
 * the geography tables hold it (058-people-file AC-PF1). Only the village is
 * reported, because only the village is stored; the file reads the cell,
 * sector and district back from it.
 *
 * The same cascade as `SectorPicker`, two steps deeper. It starts empty rather
 * than at the file's current village: the current address is shown beside it,
 * and choosing nothing leaves it as it is.
 */

import { useEffect, useState } from "react";

import { fetchCells, fetchDistricts, fetchProvinces, fetchSectors, fetchVillages } from "../data/geography";

const selectClass =
  "h-10 rounded border border-line2 bg-field px-2 text-sm text-foreground disabled:opacity-50";

type Step = "province" | "district" | "sector" | "cell" | "village";
const ORDER: readonly Step[] = ["province", "district", "sector", "cell", "village"];
const LABEL: Record<Step, string> = {
  province: "Province",
  district: "District",
  sector: "Sector",
  cell: "Cell",
  village: "Village",
};

interface Place {
  id: number;
  name: string;
}

/** Provinces hang off nothing; `0` stands for "the country". */
const loadProvinces = (): Promise<Place[]> => fetchProvinces();

/**
 * One level of the cascade: its places once the level above is chosen, and
 * whether loading them failed. A stale answer is dropped.
 */
function useLevel(parent: number | null, load: (id: number) => Promise<Place[]>): { places: Place[]; failed: boolean } {
  const [places, setPlaces] = useState<Place[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setPlaces([]);
    setFailed(false);
    if (parent === null) return;
    let live = true;
    load(parent)
      .then((rows) => {
        if (live) setPlaces(rows);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [parent, load]);
  return { places, failed };
}

export function VillagePicker({ onVillage }: { onVillage: (villageId: number | null) => void }) {
  const [chosen, setChosen] = useState<Record<Step, number | null>>({
    province: null,
    district: null,
    sector: null,
    cell: null,
    village: null,
  });
  const levels: Record<Step, { places: Place[]; failed: boolean }> = {
    province: useLevel(0, loadProvinces),
    district: useLevel(chosen.province, fetchDistricts),
    sector: useLevel(chosen.district, fetchSectors),
    cell: useLevel(chosen.sector, fetchCells),
    village: useLevel(chosen.cell, fetchVillages),
  };

  const choose = (step: Step, value: string) => {
    const next = { ...chosen, [step]: value ? Number(value) : null };
    // Choosing a level clears every level below it, and the parent hears that.
    for (const below of ORDER.slice(ORDER.indexOf(step) + 1)) next[below] = null;
    setChosen(next);
    onVillage(next.village);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ORDER.map((step, i) => (
          <label key={step} className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">{LABEL[step]}</span>
            <select
              value={chosen[step] ?? ""}
              onChange={(e) => choose(step, e.target.value)}
              disabled={i > 0 && chosen[ORDER[i - 1]] === null}
              className={selectClass}
            >
              <option value="">Choose…</option>
              {levels[step].places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {ORDER.some((step) => levels[step].failed) && (
        <p className="text-sm text-danger">We couldn&apos;t load that list of places. Choose the level above again to retry.</p>
      )}
    </div>
  );
}
