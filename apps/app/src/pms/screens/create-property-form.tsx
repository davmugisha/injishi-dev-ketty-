"use client";

/**
 * The first property on an approved business (ADR-009).
 *
 * Shown when Inventory is empty. Name + sector are the only required fields —
 * the wire derives district from the sector, matching the registration
 * address picker (D24).
 */

import { useEffect, useState } from "react";
import type { District, Province, Sector } from "@injishi/contracts";

import { ApiError, humanError } from "../data/api";
import { fetchDistricts, fetchProvinces, fetchSectors } from "../data/geography";
import { useCreateProperty } from "../data/ops";
import { ActionButton, EmptyState, surfaceClass } from "../components/ui";
import { cn } from "@/lib/utils";
import { usePms } from "../store";

export function CreatePropertyForm({ workspaceId }: { workspaceId: string }) {
  const { toast } = usePms();
  const create = useCreateProperty(workspaceId);
  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [sectorId, setSectorId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetchProvinces()
      .then((rows) => {
        if (live) setProvinces(rows);
      })
      .catch((err) => {
        if (live) {
          setGeoError(
            err instanceof ApiError ? err.message : humanError(err),
          );
        }
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (provinceId === null) {
      setDistricts([]);
      setDistrictId(null);
      return;
    }
    let live = true;
    void fetchDistricts(provinceId)
      .then((rows) => {
        if (live) {
          setDistricts(rows);
          setDistrictId(null);
          setSectorId(null);
          setSectors([]);
        }
      })
      .catch(() => {
        if (live) setGeoError("We couldn't load districts.");
      });
    return () => {
      live = false;
    };
  }, [provinceId]);

  useEffect(() => {
    if (districtId === null) {
      setSectors([]);
      setSectorId(null);
      return;
    }
    let live = true;
    void fetchSectors(districtId)
      .then((rows) => {
        if (live) {
          setSectors(rows);
          setSectorId(null);
        }
      })
      .catch(() => {
        if (live) setGeoError("We couldn't load sectors.");
      });
    return () => {
      live = false;
    };
  }, [districtId]);

  const submit = () => {
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Give the property a name guests will recognise.");
      return;
    }
    if (sectorId === null) {
      setError("Choose a sector for the address.");
      return;
    }
    create.mutate(
      {
        name: trimmed,
        sectorId,
        street: street.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
      },
      {
        // The form disappears when the list refetches, which reads as the
        // screen changing its mind rather than as a property being created.
        // Say what now exists, and what it needs next.
        onSuccess: () => toast(`${trimmed} is on your business. Add what you sell, and its rooms, next.`, "ok"),
        onError: (err) => setError(humanError(err)),
      },
    );
  };

  return (
    <EmptyState style={{ padding: 26, fontSize: 13.5, alignItems: "stretch" }}>
      <div className="mx-auto flex w-full max-w-form flex-col gap-4 text-left">
        <div className="text-center">
          <div className="text-base font-semibold text-ink">
            No property on this business yet
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything else — what you sell, the rooms or units, photos and your team — hangs on it.
          </p>
        </div>

        <div className={cn(surfaceClass, "flex flex-col gap-3 p-4")}>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Property name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded border border-line2 bg-field px-3 text-sm text-foreground"
              placeholder="e.g. Kigali Heights Hotel"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-ink">Street (optional)</span>
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="h-10 rounded border border-line2 bg-field px-3 text-sm text-foreground"
              placeholder="KG 11 Ave"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-ink">Front desk phone</span>
              <input
                aria-label="Front desk phone"
                inputMode="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="h-10 rounded border border-line2 bg-field px-3 text-sm text-foreground"
                placeholder="+250 788 123 456"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-ink">Contact email</span>
              <input
                aria-label="Contact email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="h-10 rounded border border-line2 bg-field px-3 text-sm text-foreground"
                placeholder="frontdesk@example.com"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-ink">Province</span>
              <select
                value={provinceId ?? ""}
                onChange={(e) =>
                  setProvinceId(e.target.value ? Number(e.target.value) : null)
                }
                className="h-10 rounded border border-line2 bg-field px-2 text-sm text-foreground"
              >
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
                onChange={(e) =>
                  setDistrictId(e.target.value ? Number(e.target.value) : null)
                }
                disabled={provinceId === null}
                className="h-10 rounded border border-line2 bg-field px-2 text-sm text-foreground disabled:opacity-50"
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
                onChange={(e) =>
                  setSectorId(e.target.value ? Number(e.target.value) : null)
                }
                disabled={districtId === null}
                className="h-10 rounded border border-line2 bg-field px-2 text-sm text-foreground disabled:opacity-50"
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

          {(error || geoError) && (
            <p className="text-sm text-danger">{error ?? geoError}</p>
          )}

          <div className="flex justify-end">
            <ActionButton onClick={submit} pending={create.isPending}>
              {create.isPending ? "Creating the property" : "Create property"}
            </ActionButton>
          </div>
        </div>
      </div>
    </EmptyState>
  );
}
