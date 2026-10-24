"use client";

/**
 * The PSF console's Subtypes (2026-10-20): the kinds of business inside each
 * sector (Services is Hospitality, Tourism, Transport…), and the associations
 * each one offers on the public form.
 *
 * A national officer keeps the national list, which every business is offered,
 * and may add to any district's. A province or district officer adds subtypes
 * for the districts they cover, offered only to businesses registering there;
 * the national ones they read but do not change.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Globe2, MapPin, Pencil, Plus, X } from "lucide-react";

import type { PsfSubsectorsView } from "@injishi/contracts";

import { humanError } from "../../data/api";
import { refusalField } from "../../data/psf";
import { LoadFailed } from "../../components/ui";
import type { QueuedToast } from "../../lib/toast-queue";
import { createPsfSubsector, fetchPsfSubsectors, updatePsfSubsector } from "../data/psf-console";
import { PsfConsoleShell, usePsfConsole } from "../components/psf-console-shell";

type View = PsfSubsectorsView;
type Cluster = View["clusters"][number];
type Sub = Cluster["subsectors"][number];

export function PsfSubtypes() {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const toast = useCallback((txt: string, intent: QueuedToast["intent"] = "ok") => {
    setToasts((t) => [...t, { id: Date.now() + Math.random(), txt, intent }]);
  }, []);
  return (
    <PsfConsoleShell title="Subtypes" lede="The kinds of business inside each sector" toasts={toasts}>
      <Body toast={toast} />
    </PsfConsoleShell>
  );
}

function Body({ toast }: { toast: (txt: string, intent?: QueuedToast["intent"]) => void }) {
  const { area } = usePsfConsole();
  const [view, setView] = useState<View | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const r = await fetchPsfSubsectors(area);
    if (r.outcome === "ok") setView(r.data);
    else setFailed(true);
  }, [area]);
  useEffect(() => {
    void load();
  }, [load]);

  if (failed) return <LoadFailed onRetry={() => void load()}>We couldn&apos;t load the subtypes.</LoadFailed>;
  if (!view) return <div className="h-96 animate-pulse rounded bg-hover" />;

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-[72ch] text-sm text-muted-foreground">
        On the public form a business picks its sector, then one of these subtypes, then an association the subtype offers. A business
        whose kind is on no list types its own. {view.places.some((p) => p.districtId === null) ? "You keep the national list." : "The national list is kept by PSF’s national office; you add subtypes for your districts."}
      </p>
      {view.clusters.map((c) => (
        <ClusterCard
          key={c.code}
          cluster={c}
          view={view}
          onSaved={(next, message) => {
            setView(next);
            toast(message);
          }}
          onFailed={(message) => toast(message, "bad")}
        />
      ))}
    </div>
  );
}

function ClusterCard({
  cluster,
  view,
  onSaved,
  onFailed,
}: {
  cluster: Cluster;
  view: View;
  onSaved: (next: View, message: string) => void;
  onFailed: (message: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const associations = view.associations.filter((a) => a.clusterCode === cluster.code && !a.code.endsWith("_other"));
  return (
    <section className="rounded border border-line bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-base font-bold">{cluster.nameEn}</h2>
          <p className="text-xs text-muted-foreground">
            {cluster.subsectors.filter((s) => s.active).length} subtypes · {associations.length} associations
          </p>
        </div>
        {view.places.length ? (
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            className="inline-flex h-9 items-center gap-1.5 rounded border border-input bg-card px-3 text-sm font-medium shadow-sm hover:bg-hover"
          >
            {adding ? <X size={15} aria-hidden /> : <Plus size={15} aria-hidden />} {adding ? "Cancel" : "Add a subtype"}
          </button>
        ) : null}
      </div>

      {adding ? (
        <div className="border-b border-line bg-hover/40 px-5 py-4">
          <SubtypeForm
            associations={associations}
            places={view.places}
            submitLabel="Add subtype"
            onCancel={() => setAdding(false)}
            onSubmit={async (v) => {
              try {
                const next = await createPsfSubsector({ clusterCode: cluster.code, nameEn: v.nameEn, districtId: v.districtId, associationCodes: v.associationCodes });
                setAdding(false);
                onSaved(next, `${v.nameEn} added to ${cluster.nameEn}.`);
                return null;
              } catch (error) {
                return refusalField(error)?.message ?? humanError(error);
              }
            }}
          />
        </div>
      ) : null}

      <ul className="list-none divide-y divide-line p-0">
        {cluster.subsectors.length === 0 ? <li className="px-5 py-6 text-sm text-muted-foreground">No subtypes yet.</li> : null}
        {cluster.subsectors.map((s) => (
          <SubtypeRow key={s.id} sub={s} associations={associations} view={view} onSaved={onSaved} onFailed={onFailed} />
        ))}
      </ul>
    </section>
  );
}

function SubtypeRow({
  sub,
  associations,
  view,
  onSaved,
  onFailed,
}: {
  sub: Sub;
  associations: View["associations"];
  view: View;
  onSaved: (next: View, message: string) => void;
  onFailed: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const names = sub.associationCodes.map((code) => associations.find((a) => a.code === code)?.nameEn).filter((n): n is string => Boolean(n));
  if (editing) {
    return (
      <li className="bg-hover/40 px-5 py-4">
        <SubtypeForm
          associations={associations}
          places={[]}
          initial={{ nameEn: sub.nameEn, districtId: sub.districtId, associationCodes: sub.associationCodes }}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSubmit={async (v) => {
            try {
              const next = await updatePsfSubsector(sub.id, { nameEn: v.nameEn, associationCodes: v.associationCodes });
              setEditing(false);
              onSaved(next, `${v.nameEn} saved.`);
              return null;
            } catch (error) {
              return refusalField(error)?.message ?? humanError(error);
            }
          }}
        />
      </li>
    );
  }
  return (
    <li className={["flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center", sub.active ? "" : "opacity-60"].join(" ")}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{sub.nameEn}</span>
          {sub.districtId ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2 py-0.5 text-2xs font-semibold text-info">
              <MapPin size={11} aria-hidden /> {sub.districtName} only
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-hover px-2 py-0.5 text-2xs font-semibold text-muted-foreground">
              <Globe2 size={11} aria-hidden /> National
            </span>
          )}
          {!sub.active ? <span className="rounded-full bg-warn-bg px-2 py-0.5 text-2xs font-semibold text-warn">Hidden from the form</span> : null}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{names.length ? names.join(" · ") : "No association linked: the form offers the whole sector's."}</p>
      </div>
      {sub.canEdit ? (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-8 items-center gap-1 rounded border border-input bg-card px-2.5 text-xs font-medium hover:bg-hover"
          >
            <Pencil size={13} aria-hidden /> Edit
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const next = await updatePsfSubsector(sub.id, { active: !sub.active });
                onSaved(next, sub.active ? `${sub.nameEn} is hidden from the form.` : `${sub.nameEn} is offered again.`);
              } catch (error) {
                onFailed(humanError(error));
              }
            }}
            className="inline-flex h-8 items-center rounded border border-input bg-card px-2.5 text-xs font-medium hover:bg-hover"
          >
            {sub.active ? "Hide" : "Offer again"}
          </button>
        </div>
      ) : (
        <span className="shrink-0 text-2xs text-faint">{view.places.length ? "Kept by the national office" : "Read only"}</span>
      )}
    </li>
  );
}

function SubtypeForm({
  associations,
  places,
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  associations: View["associations"];
  places: View["places"];
  initial?: { nameEn: string; districtId: number | null; associationCodes: string[] };
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (v: { nameEn: string; districtId: number | null; associationCodes: string[] }) => Promise<string | null>;
}) {
  const [nameEn, setName] = useState(initial?.nameEn ?? "");
  const [place, setPlace] = useState<string>(initial ? String(initial.districtId ?? "") : String(places[0]?.districtId ?? ""));
  const [codes, setCodes] = useState<string[]>(initial?.associationCodes ?? []);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const toggle = (code: string) => setCodes((c) => (c.includes(code) ? c.filter((x) => x !== code) : [...c, code]));
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (nameEn.trim().length < 2) return setProblem("Give the subtype a name.");
        setBusy(true);
        setProblem(await onSubmit({ nameEn: nameEn.trim(), districtId: place === "" ? null : Number(place), associationCodes: codes }));
        setBusy(false);
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Name
          <input
            autoFocus
            value={nameEn}
            onChange={(e) => setName(e.target.value)}
            placeholder="Like “Hospitality” or “Beekeeping”"
            className="mt-1 h-10 w-full rounded border border-input bg-field px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        {places.length ? (
          <label className="text-sm font-semibold">
            Offered in
            <select
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              className="mt-1 h-10 w-full rounded border border-input bg-field px-2 text-sm font-normal"
            >
              {places.map((p) => (
                <option key={String(p.districtId)} value={p.districtId === null ? "" : String(p.districtId)}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Associations it offers</legend>
        <p className="text-xs text-muted-foreground">None picked: the form offers every association of the sector.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {associations.map((a) => {
            const on = codes.includes(a.code);
            return (
              <button
                key={a.code}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(a.code)}
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-hover",
                ].join(" ")}
              >
                {on ? <Check size={12} aria-hidden /> : null}
                {a.nameEn}
              </button>
            );
          })}
        </div>
      </fieldset>
      {problem ? <p className="text-sm text-bad">{problem}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="inline-flex h-9 items-center rounded bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Saving" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="inline-flex h-9 items-center rounded border border-input bg-card px-4 text-sm font-medium hover:bg-hover">
          Cancel
        </button>
      </div>
    </form>
  );
}
