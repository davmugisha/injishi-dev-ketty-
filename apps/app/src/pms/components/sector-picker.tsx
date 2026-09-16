"use client";

/**
 * Province, then district, then sector: the address cascade a branch is placed
 * with (ADR-054). Only the sector is reported, because only the sector is sent;
 * the API derives the district from it (D24).
 */

import type { District, Province, Sector } from "@injishi/contracts";
import { useEffect, useState } from "react";

import { fetchDistricts, fetchProvinces, fetchSectors } from "../data/geography";

const selectClass =
  "h-10 rounded border border-line2 bg-field px-2 text-sm text-foreground disabled:opacity-50";

export function SectorPicker({ onSector }: { onSector: (sectorId: number | null) => void }) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [sectorId, setSectorId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetchProvinces()
      .then((rows) => live && setProvinces(rows))
      .catch(() => live && setError("We couldn't load provinces."));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    setDistricts([]);
    setDistrictId(null);
    if (provinceId === null) return;
    let live = true;
    void fetchDistricts(provinceId)
      .then((rows) => live && setDistricts(rows))
      .catch(() => live && setError("We couldn't load districts."));
    return () => {
      live = false;
    };
  }, [provinceId]);

  useEffect(() => {
    setSectors([]);
    setSectorId(null);
    if (districtId === null) return;
    let live = true;
    void fetchSectors(districtId)
      .then((rows) => live && setSectors(rows))
      .catch(() => live && setError("We couldn't load sectors."));
    return () => {
      live = false;
    };
  }, [districtId]);

  const numberOrNull = (v: string) => (v ? Number(v) : null);
  // A new province or district clears the sector, so the parent hears that too.
  const chooseSector = (id: number | null) => {
    setSectorId(id);
    onSector(id);
  };
  const chooseProvince = (id: number | null) => {
    setProvinceId(id);
    onSector(null);
  };
  const chooseDistrict = (id: number | null) => {
    setDistrictId(id);
    onSector(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">Province</span>
          <select value={provinceId ?? ""} onChange={(e) => chooseProvince(numberOrNull(e.target.value))} className={selectClass}>
            <option value="">Choose…</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">District</span>
          <select
            value={districtId ?? ""}
            onChange={(e) => chooseDistrict(numberOrNull(e.target.value))}
            disabled={provinceId === null}
            className={selectClass}
          >
            <option value="">Choose…</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">Sector</span>
          <select
            value={sectorId ?? ""}
            onChange={(e) => chooseSector(numberOrNull(e.target.value))}
            disabled={districtId === null}
            className={selectClass}
          >
            <option value="">Choose…</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
