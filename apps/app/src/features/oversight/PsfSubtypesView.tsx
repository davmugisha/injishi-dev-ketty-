"use client";

import { Alert, Button, Input } from "@heroui/react";
import type { PsfSubsectorsView } from "@injishi/contracts";
import { EmptyBlock, PageContent, PageHeader, SectionCard, StatusChip } from "@injishi/ui";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PsfScope } from "@/server/sources/psf";
import { psfSetupCall } from "./psf-setup-actions";
import { createPsfSubtypeAction, updatePsfSubtypeAction } from "./psf-subtypes-actions";

type View = PsfSubsectorsView;
type Cluster = View["clusters"][number];
type Sub = Cluster["subsectors"][number];
type Association = View["associations"][number];
type Saved = (next: View, message: string) => void;

/**
 * Subtypes (2026-11-02, rebuilt on the console's own parts): the kinds of business inside each PSF
 * sector, and the associations each offers, as the public form shows them. PSF's national office keeps
 * the national list; a province or district officer adds subtypes for their districts.
 */
export function PsfSubtypesView({ scope, initial }: { scope: PsfScope; initial: View }) {
  const t = useTranslations("psfOperations.subtypes");
  const [view, setView] = useState(initial);
  const [note, setNote] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const saved: Saved = (next, message) => {
    setView(next);
    setNote({ tone: "success", text: message });
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${scope.title} · ${scope.label}`}
        title={t("title")}
        description={t("description")}
      />

      <Alert status="accent">
        <Alert.Content>
          <Alert.Title>How the form uses them</Alert.Title>
          <Alert.Description>
            A business picks its sector, then one of these subtypes, then an association the subtype offers. A business whose kind is on no list types
            its own.{" "}
            {view.places.some((p) => p.districtId === null)
              ? "You keep the national list."
              : "The national list is kept by PSF’s national office; you add subtypes for your districts."}
          </Alert.Description>
        </Alert.Content>
      </Alert>

      {note ? (
        <Alert status={note.tone}>
          <Alert.Content>
            <Alert.Description>{note.text}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {view.places.some((p) => p.districtId === null) ? <AddSector onSaved={saved} onFailed={(text) => setNote({ tone: "danger", text })} /> : null}

      {view.clusters.map((c) => (
        <ClusterCard key={c.code} cluster={c} view={view} onSaved={saved} onFailed={(text) => setNote({ tone: "danger", text })} />
      ))}
    </PageContent>
  );
}

/** The National Manager adds a sector (2026-11-06): it reaches the form at once, with an "Other" association. */
function AddSector({ onSaved, onFailed }: { onSaved: Saved; onFailed: (text: string) => void }) {
  const [name, setName] = useState("");
  return (
    <SectionCard title="Add a sector" description="A new sector on the public form, beside the ones below." contentClassName="gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Sector name" className="w-64" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          size="sm"
          variant="primary"
          isDisabled={name.trim().length < 2}
          onPress={async () => {
            const res = await psfSetupCall<View>("post", "clusters", { name: name.trim() });
            if (!res.ok) return onFailed(res.error);
            onSaved(res.value, `${name.trim()} added to the form.`);
            setName("");
          }}
        >
          Add sector
        </Button>
      </div>
    </SectionCard>
  );
}

/** A sector's name and associations, for the National Manager (2026-11-06). */
function SectorControls({ cluster, associations, onSaved, onFailed }: { cluster: Cluster; associations: Association[]; onSaved: Saved; onFailed: (text: string) => void }) {
  const [name, setName] = useState(cluster.nameEn);
  const [association, setAssociation] = useState("");
  const call = async (method: "post" | "patch", path: string, body: unknown, message: string): Promise<boolean> => {
    const res = await psfSetupCall<View>(method, path, body);
    if (!res.ok) {
      onFailed(res.error);
      return false;
    }
    onSaved(res.value, message);
    return true;
  };
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-secondary p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Sector name" className="w-56" value={name} onChange={(e) => setName(e.target.value)} />
        <Button size="sm" variant="secondary" isDisabled={name.trim().length < 2 || name.trim() === cluster.nameEn} onPress={() => void call("patch", `clusters/${cluster.code}`, { name: name.trim() }, `Renamed to ${name.trim()}.`)}>
          Rename sector
        </Button>
        <Button size="sm" variant="ghost" onPress={() => { if (window.confirm(`Take ${cluster.nameEn} off the form? Businesses already in it stay.`)) void call("patch", `clusters/${cluster.code}`, { active: false }, `${cluster.nameEn} is off the form.`); }}>
          Retire sector
        </Button>
      </div>
      <ul className="flex flex-wrap gap-2 text-sm">
        {associations.map((a) => (
          <li key={a.code} className="flex items-center gap-1 rounded-full border border-border px-3 py-1">
            {a.nameEn}
            <button type="button" aria-label={`Remove ${a.nameEn}`} className="text-muted hover:text-foreground" onClick={() => void call("patch", `associations/${a.code}`, { active: false }, `${a.nameEn} is off the form.`)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Association name" placeholder="New association" className="w-72" value={association} onChange={(e) => setAssociation(e.target.value)} />
        <Button
          size="sm"
          variant="secondary"
          isDisabled={association.trim().length < 2}
          onPress={async () => {
            if (await call("post", "associations", { clusterCode: cluster.code, name: association.trim() }, `${association.trim()} added to ${cluster.nameEn}.`)) setAssociation("");
          }}
        >
          Add association
        </Button>
      </div>
    </div>
  );
}

function ClusterCard({ cluster, view, onSaved, onFailed }: { cluster: Cluster; view: View; onSaved: Saved; onFailed: (text: string) => void }) {
  const t = useTranslations("psfOperations.subtypes");
  const [adding, setAdding] = useState(false);
  const associations = view.associations.filter((a) => a.clusterCode === cluster.code && !a.code.endsWith("_other"));
  const offered = cluster.subsectors.filter((s) => s.active).length;
  // Only a national post can add "National (every district)".
  const national = view.places.some((p) => p.districtId === null);
  return (
    <SectionCard
      title={cluster.nameEn}
      description={`${offered} ${offered === 1 ? "subtype" : "subtypes"} offered · ${associations.length} associations`}
      actions={
        view.places.length && !adding ? (
          <Button size="sm" variant="secondary" onPress={() => setAdding(true)}>
            {t("add")}
          </Button>
        ) : null
      }
      contentClassName="gap-3"
    >
      {national ? <SectorControls cluster={cluster} associations={associations} onSaved={onSaved} onFailed={onFailed} /> : null}
      {adding ? (
        <SubtypeForm
          associations={associations}
          places={view.places}
          submitLabel={t("add")}
          onCancel={() => setAdding(false)}
          onSubmit={async (v) => {
            const res = await createPsfSubtypeAction({ clusterCode: cluster.code, nameEn: v.nameEn, districtId: v.districtId, associationCodes: v.associationCodes });
            if (!res.ok) return res.error;
            setAdding(false);
            onSaved(res.value, `${v.nameEn} added to ${cluster.nameEn}.`);
            return null;
          }}
        />
      ) : null}
      {cluster.subsectors.length === 0 ? (
        <EmptyBlock size="sm" icon="Briefcase" title={t("empty")} description={t("description")} />
      ) : (
        <ul className="flex flex-col divide-y divide-separator">
          {cluster.subsectors.map((s) => (
            <SubtypeRow key={s.id} sub={s} associations={associations} view={view} onSaved={onSaved} onFailed={onFailed} />
          ))}
        </ul>
      )}
    </SectionCard>
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
  associations: Association[];
  view: View;
  onSaved: Saved;
  onFailed: (text: string) => void;
}) {
  const t = useTranslations("psfOperations.subtypes");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const names = sub.associationCodes.map((code) => associations.find((a) => a.code === code)?.nameEn).filter((n): n is string => Boolean(n));

  if (editing) {
    return (
      <li className="py-3">
        <SubtypeForm
          associations={associations}
          places={[]}
          initial={{ nameEn: sub.nameEn, districtId: sub.districtId, associationCodes: sub.associationCodes }}
          submitLabel={t("save")}
          onCancel={() => setEditing(false)}
          onSubmit={async (v) => {
            const res = await updatePsfSubtypeAction(sub.id, { nameEn: v.nameEn, associationCodes: v.associationCodes });
            if (!res.ok) return res.error;
            setEditing(false);
            onSaved(res.value, `${v.nameEn} saved.`);
            return null;
          }}
        />
      </li>
    );
  }

  return (
    <li className={["flex flex-col gap-2 py-3 sm:flex-row sm:items-center", sub.active ? "" : "opacity-60"].join(" ")}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{sub.nameEn}</span>
          <StatusChip tone={sub.districtId ? "info" : "default"}>{sub.districtName ?? "National"}</StatusChip>
          {!sub.active ? <StatusChip tone="warning">{t("inactive")}</StatusChip> : null}
        </p>
        <p className="mt-0.5 text-xs text-muted">{names.length ? names.join(" · ") : "No association linked: the form offers the whole sector's."}</p>
      </div>
      {sub.canEdit ? (
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => setEditing(true)}>
            {t("edit")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isPending={busy}
            onPress={async () => {
              setBusy(true);
              const res = await updatePsfSubtypeAction(sub.id, { active: !sub.active });
              setBusy(false);
              if (!res.ok) return onFailed(res.error);
              onSaved(res.value, sub.active ? `${sub.nameEn} is hidden from the form.` : `${sub.nameEn} is offered again.`);
            }}
          >
            {sub.active ? t("inactive") : t("active")}
          </Button>
        </div>
      ) : (
        <span className="shrink-0 text-xs text-muted">{view.places.length ? "Kept by the national office" : "Read only"}</span>
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
  associations: Association[];
  places: View["places"];
  initial?: { nameEn: string; districtId: number | null; associationCodes: string[] };
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (v: { nameEn: string; districtId: number | null; associationCodes: string[] }) => Promise<string | null>;
}) {
  const t = useTranslations("psfOperations.subtypes");
  const [nameEn, setName] = useState(initial?.nameEn ?? "");
  const [place, setPlace] = useState<string>(initial ? String(initial.districtId ?? "") : String(places[0]?.districtId ?? ""));
  const [codes, setCodes] = useState<string[]>(initial?.associationCodes ?? []);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const toggle = (code: string) => setCodes((c) => (c.includes(code) ? c.filter((x) => x !== code) : [...c, code]));

  return (
    <form
      className="flex flex-col gap-4 rounded-xl bg-default/40 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (nameEn.trim().length < 2) return setProblem(t("name"));
        setBusy(true);
        setProblem(await onSubmit({ nameEn: nameEn.trim(), districtId: place === "" ? null : Number(place), associationCodes: codes }));
        setBusy(false);
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("name")}
          <Input value={nameEn} onChange={(e) => setName(e.target.value)} placeholder="Like “Hospitality” or “Beekeeping”" />
        </label>
        {places.length ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Offered in
            <select
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              className="h-10 rounded-xl border border-border bg-field px-3 text-sm font-normal"
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
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("description")}</legend>
        <p className="text-xs text-muted">{t("search")}</p>
        <div className="flex flex-wrap gap-1.5">
          {associations.map((a) => {
            const on = codes.includes(a.code);
            return (
              <Button key={a.code} size="sm" variant={on ? "primary" : "ghost"} aria-pressed={on} onPress={() => toggle(a.code)}>
                {a.nameEn}
              </Button>
            );
          })}
        </div>
      </fieldset>
      {problem ? <p className="text-sm text-danger">{problem}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" isPending={busy}>
          {submitLabel}
        </Button>
        <Button variant="ghost" isDisabled={busy} onPress={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
