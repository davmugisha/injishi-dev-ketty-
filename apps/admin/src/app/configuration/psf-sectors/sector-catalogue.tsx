"use client";

/**
 * PSF's sector catalogue (the PSF path): the clusters, and the associations a
 * business names when it registers through the PSF tile.
 *
 * One editor for both kinds of row, opened from the row it changes. Only a
 * staffer whose server permissions include `admin.config.edit` gets it;
 * everyone else reads the catalogue, which is the same answer the API gives
 * them. A code is permanent once saved, because businesses name it; retiring
 * an entry takes it off the registration form and leaves every business filed
 * under it reading it.
 */
import {
  CreatePsfAssociationRequest,
  CreatePsfClusterRequest,
  type PsfAssociation,
  type PsfCatalogue,
  type PsfCluster,
} from "@injishi/contracts";
import { Badge, Button, Input, Textarea } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { useStaffPermissions } from "@/components/shell/staff-access-provider";
import {
  createPsfAssociation,
  createPsfCluster,
  updatePsfAssociation,
  updatePsfCluster,
} from "@/lib/actions/psf-catalogue";
import { useAdminUi } from "@/lib/store";

const subscribeNothing = () => () => {};
const selectClass = "mt-1 h-10 w-full rounded border border-border bg-field px-2 text-sm text-foreground";

type Editing =
  | { kind: "cluster"; code: string | null }
  | { kind: "association"; code: string | null; clusterCode: string }
  | null;

interface Draft {
  code: string;
  clusterCode: string;
  nameEn: string;
  nameRw: string;
  acronym: string;
  description: string;
  sortOrder: string;
  active: boolean;
  reason: string;
}

const EMPTY: Draft = {
  code: "",
  clusterCode: "",
  nameEn: "",
  nameRw: "",
  acronym: "",
  description: "",
  sortOrder: "100",
  active: true,
  reason: "",
};

function fromCluster(c: PsfCluster): Draft {
  return {
    ...EMPTY,
    code: c.code,
    nameEn: c.nameEn,
    nameRw: c.nameRw ?? "",
    description: c.description ?? "",
    sortOrder: String(c.sortOrder),
    active: c.active,
  };
}

function fromAssociation(a: PsfAssociation): Draft {
  return {
    ...EMPTY,
    code: a.code,
    clusterCode: a.clusterCode,
    nameEn: a.nameEn,
    acronym: a.acronym ?? "",
    sortOrder: String(a.sortOrder),
    active: a.active,
  };
}

export function SectorCatalogue({ catalogue: initial }: { catalogue: PsfCatalogue }) {
  const mayEdit = useStaffPermissions().includes("admin.config.edit");
  const toast = useAdminUi((s) => s.toast);
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [catalogue, setCatalogue] = useState(initial);
  const [editing, setEditing] = useState<Editing>(null);
  const [d, setD] = useState<Draft>(EMPTY);
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const open = (next: Editing, draft: Draft) => {
    setRefusal(null);
    setD(draft);
    setEditing(next);
  };

  const save = async () => {
    if (!editing) return;
    setRefusal(null);
    const isNew = editing.code === null;
    const common = {
      nameEn: d.nameEn.trim(),
      sortOrder: Number(d.sortOrder),
      active: d.active,
      reason: d.reason.trim(),
    };
    const request =
      editing.kind === "cluster"
        ? { ...common, code: d.code.trim(), nameRw: d.nameRw.trim() || null, description: d.description.trim() || null }
        : { ...common, code: d.code.trim(), clusterCode: d.clusterCode, acronym: d.acronym.trim() || null };
    // Checked with the contract the API validates with, so the reason is named here.
    const checked =
      editing.kind === "cluster" ? CreatePsfClusterRequest.safeParse(request) : CreatePsfAssociationRequest.safeParse(request);
    if (!checked.success) {
      setRefusal(checked.error.issues[0]?.message ?? "Check the details.");
      return;
    }
    setPending(true);
    try {
      const { code, ...rest } = request;
      const out =
        editing.kind === "cluster"
          ? isNew
            ? await createPsfCluster(request)
            : await updatePsfCluster(code, rest)
          : isNew
            ? await createPsfAssociation(request)
            : await updatePsfAssociation(code, rest);
      if (out.ok) {
        toast(out.message, out.tone);
        if (out.data) setCatalogue(out.data);
        setEditing(null);
        router.refresh();
      } else {
        setRefusal(out.message);
      }
    } finally {
      setPending(false);
    }
  };

  const total = catalogue.clusters.reduce((n, c) => n + c.associations.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {catalogue.clusters.length} clusters, {total} associations.
        </p>
        {mayEdit && editing === null && (
          <Button variant="secondary" disabled={!hydrated} onClick={() => open({ kind: "cluster", code: null }, EMPTY)}>
            Add a cluster
          </Button>
        )}
      </div>

      {mayEdit && editing !== null && (
        <section aria-label="Editor" className="rounded-card border border-border bg-field p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {editing.code === null
              ? editing.kind === "cluster"
                ? "Add a cluster"
                : "Add an association"
              : `Edit ${d.nameEn || editing.code}`}
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-semibold">
              Code {editing.code === null ? "(permanent)" : ""}
              <Input
                aria-label="Code"
                value={d.code}
                readOnly={editing.code !== null}
                placeholder={editing.kind === "cluster" ? "industry" : "apromet"}
                onChange={(e) => set("code", e.target.value)}
                className="mt-1 w-full"
              />
            </label>
            {editing.kind === "association" ? (
              <label className="block text-sm font-semibold">
                Cluster
                <select aria-label="Cluster" value={d.clusterCode} onChange={(e) => set("clusterCode", e.target.value)} className={selectClass}>
                  {catalogue.clusters.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.nameEn}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block text-sm font-semibold">
                Name in Kinyarwanda (optional)
                <Input aria-label="Name in Kinyarwanda" value={d.nameRw} onChange={(e) => set("nameRw", e.target.value)} className="mt-1 w-full" />
              </label>
            )}
            <label className="block text-sm font-semibold">
              Name in English
              <Input aria-label="Name in English" value={d.nameEn} onChange={(e) => set("nameEn", e.target.value)} className="mt-1 w-full" />
            </label>
            {editing.kind === "association" ? (
              <label className="block text-sm font-semibold">
                Acronym (optional)
                <Input aria-label="Acronym" value={d.acronym} onChange={(e) => set("acronym", e.target.value)} className="mt-1 w-full" />
              </label>
            ) : (
              <label className="block text-sm font-semibold">
                What kind of business belongs here
                <Input aria-label="Description" value={d.description} onChange={(e) => set("description", e.target.value)} className="mt-1 w-full" />
              </label>
            )}
            <label className="block text-sm font-semibold">
              Order on the form
              <Input aria-label="Order" inputMode="numeric" value={d.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} className="mt-1 w-full" />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
              <input type="checkbox" checked={d.active} onChange={(e) => set("active", e.target.checked)} />
              Offered on the registration form
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold">Reason, recorded on the audit trail with your name</span>
              <Textarea aria-label="Reason" value={d.reason} rows={2} onChange={(e) => set("reason", e.target.value)} className="mt-1" />
            </label>
          </div>
          {refusal && (
            <p role="alert" className="mt-3 rounded-card border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
              {refusal}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="primary" pending={pending} onClick={() => void save()}>
              {pending ? "Saving" : "Save"}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      {catalogue.clusters.map((c) => (
        <section key={c.code} aria-label={c.nameEn} className="overflow-hidden rounded-card border border-border">
          <header className="flex flex-wrap items-start justify-between gap-3 bg-field px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">{c.nameEn}</h2>
                {!c.active && <Badge variant="default">Retired</Badge>}
              </div>
              {c.description && <p className="mt-0.5 text-sm text-muted-foreground">{c.description}</p>}
            </div>
            {mayEdit && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!hydrated || editing !== null}
                  onClick={() => open({ kind: "association", code: null, clusterCode: c.code }, { ...EMPTY, clusterCode: c.code })}
                >
                  Add an association
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!hydrated || editing !== null}
                  onClick={() => open({ kind: "cluster", code: c.code }, fromCluster(c))}
                >
                  Edit cluster
                </Button>
              </div>
            )}
          </header>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-t border-border">
                <th className="px-4 py-2.5">Association</th>
                <th className="px-4 py-2.5">Acronym</th>
                <th className="px-4 py-2.5">State</th>
                {mayEdit && <th className="px-4 py-2.5" aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {c.associations.length === 0 ? (
                <tr className="border-t border-border">
                  <td colSpan={4} className="px-4 py-3 text-muted-foreground">
                    No associations yet.
                  </td>
                </tr>
              ) : (
                c.associations.map((a) => (
                  <tr key={a.code} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold">{a.nameEn}</p>
                      <p className="text-xs text-muted-foreground">{a.code}</p>
                    </td>
                    <td className="px-4 py-2.5">{a.acronym ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={a.active ? "success" : "default"}>{a.active ? "Offered" : "Retired"}</Badge>
                    </td>
                    {mayEdit && (
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!hydrated || editing !== null}
                          onClick={() => open({ kind: "association", code: a.code, clusterCode: a.clusterCode }, fromAssociation(a))}
                        >
                          Edit
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
