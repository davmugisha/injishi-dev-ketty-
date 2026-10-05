"use client";

/**
 * Staff · Configuration (058-people-file AC-PF11, AC-PF12).
 *
 * The business's own HR lists: job positions, employee types, tags and the
 * kinds of disciplinary action, and the employee number prefix. Nothing here is
 * deleted. An archived row stays on every file that carries it and is not
 * offered for new ones; it can be brought back while its name is free.
 *
 * `people.manage`'s lens. A disciplinary type's kind is fixed once something
 * has been recorded under it, because a record says "suspension" because its
 * type did.
 */

import type { DisciplinaryKind, HrCatalogItem, HrCatalogKind, TagTone } from "@injishi/contracts";
import { Input } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading, SelectField, Skeleton } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useAddCatalogItem, useChangeCatalogItem, useHrCatalog, useHrSettings, useUpdateHrSettings } from "../../data/people-file";
import { usePms } from "../../store";
import { DISCIPLINE_KIND } from "./employee-records";
import { Field, FormError, RowList, inputClass, rowClass, toneIntent } from "./staff-ui";

const TONES: readonly { value: TagTone; label: string }[] = [
  { value: "neutral", label: "Plain" },
  { value: "info", label: "Blue" },
  { value: "ok", label: "Green" },
  { value: "warn", label: "Amber" },
  { value: "bad", label: "Red" },
];

const CATALOGS: readonly { kind: HrCatalogKind; title: string; hint: string; placeholder: string }[] = [
  { kind: "job-positions", title: "Job positions", hint: "What people are hired as.", placeholder: "Line cook" },
  { kind: "employee-types", title: "Employee types", hint: "How people are engaged.", placeholder: "Casual" },
  { kind: "tags", title: "Tags", hint: "Anything worth finding people by.", placeholder: "First aid" },
  { kind: "disciplinary-types", title: "Disciplinary types", hint: "The actions your house rules allow.", placeholder: "Written warning" },
];

export function Configuration() {
  return (
    <div className="pms-enter flex max-w-page flex-col gap-8">
      <NumberPrefix />
      {CATALOGS.map((c) => (
        <Catalog key={c.kind} {...c} />
      ))}
    </div>
  );
}

function NumberPrefix() {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const settings = useHrSettings(workspaceId);
  const update = useUpdateHrSettings(workspaceId);
  const [draft, setDraft] = useState<string | null>(null);
  const current = settings.data?.employeeNumberPrefix ?? "";
  const value = draft ?? current;

  return (
    <section>
      <SectionHeading>Employee numbers</SectionHeading>
      {settings.isPending ? (
        <Skeleton height={60} />
      ) : settings.isError ? (
        <LoadFailed onRetry={() => void settings.refetch()} retrying={settings.isFetching}>
          We couldn&apos;t load the HR settings. Nothing has changed — this is on our side.
        </LoadFailed>
      ) : (
        <form
          className="mt-2.5 flex flex-wrap items-end gap-3 rounded-card border border-card-bd bg-card p-5"
          onSubmit={(ev) => {
            ev.preventDefault();
            update.mutate(
              { employeeNumberPrefix: value.trim() ? value.trim() : null },
              {
                onSuccess: () => {
                  toast("Number prefix saved", "ok");
                  setDraft(null);
                },
              },
            );
          }}
        >
          <div className="w-48">
            <Field label="Prefix" hint="Up to 8 capitals, digits or dashes." htmlFor="hr-prefix">
              <Input id="hr-prefix" maxLength={8} placeholder="None" value={value} onChange={(ev) => setDraft(ev.target.value.toUpperCase())} className={inputClass} />
            </Field>
          </div>
          <span className="flex-1 text-sm text-muted-foreground">
            The next file is numbered {value.trim() ? `${value.trim()}0001` : "0001"}, counting on from the last one. Numbers
            already given never change.
          </span>
          <ActionButton variant="primary" type="submit" pending={update.isPending} deniedReason={value === current ? "Nothing to save." : undefined}>
            Save prefix
          </ActionButton>
          <div className="basis-full">
            <FormError error={update.error} />
          </div>
        </form>
      )}
    </section>
  );
}

function Catalog({ kind, title, hint, placeholder }: { kind: HrCatalogKind; title: string; hint: string; placeholder: string }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const items = useHrCatalog(workspaceId, kind);
  const add = useAddCatalogItem(workspaceId);
  const [name, setName] = useState("");
  const [tone, setTone] = useState<TagTone>("neutral");
  const [dkind, setDkind] = useState<DisciplinaryKind | "">("");

  return (
    <section>
      <SectionHeading n={items.data?.items.filter((i) => i.status === "active").length}>{title}</SectionHeading>
      <p className="mt-1 text-2xs text-muted-foreground">{hint}</p>
      <form
        className="mt-2.5 flex flex-wrap items-end gap-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (kind === "disciplinary-types" && !dkind) return;
          add.mutate(
            {
              kind,
              body: {
                title: name,
                ...(kind === "tags" ? { tone } : {}),
                ...(kind === "disciplinary-types" && dkind ? { kind: dkind } : {}),
              },
            },
            {
              onSuccess: () => {
                toast(`${name} added`, "ok");
                setName("");
              },
            },
          );
        }}
      >
        <div className="w-64">
          <Field label="New" htmlFor={`catalog-${kind}`}>
            <Input id={`catalog-${kind}`} required placeholder={placeholder} value={name} onChange={(ev) => setName(ev.target.value)} className={inputClass} />
          </Field>
        </div>
        {kind === "tags" && (
          <div className="w-36">
            <Field label="Colour">
              <SelectField label="Colour" value={tone} onChange={(v) => setTone(v as TagTone)} options={TONES} />
            </Field>
          </div>
        )}
        {kind === "disciplinary-types" && (
          <div className="w-44">
            <Field label="Kind">
              <SelectField
                label="Kind"
                value={dkind}
                onChange={(v) => setDkind(v as DisciplinaryKind)}
                placeholder="Choose"
                options={(Object.keys(DISCIPLINE_KIND) as DisciplinaryKind[]).map((k) => ({ value: k, label: DISCIPLINE_KIND[k].label }))}
              />
            </Field>
          </div>
        )}
        <ActionButton type="submit" pending={add.isPending} deniedReason={kind === "disciplinary-types" && !dkind ? "Choose its kind." : undefined}>
          Add
        </ActionButton>
      </form>
      <FormError error={add.error} />
      {items.isPending ? (
        <Skeleton height={60} />
      ) : items.isError ? (
        <LoadFailed onRetry={() => void items.refetch()} retrying={items.isFetching}>
          We couldn&apos;t load this list. Nothing on it has changed — this is on our side.
        </LoadFailed>
      ) : items.data.items.length === 0 ? (
        <EmptyState className="mt-2.5 p-5">None yet.</EmptyState>
      ) : (
        <RowList>
          {items.data.items.map((item, i) => (
            <CatalogRow key={item.id} kind={kind} item={item} index={i} />
          ))}
        </RowList>
      )}
    </section>
  );
}

function CatalogRow({ kind, item, index }: { kind: HrCatalogKind; item: HrCatalogItem; index: number }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const change = useChangeCatalogItem(workspaceId);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(item.title);
  const archived = item.status === "archived";

  return (
    <div className={`${rowClass(index)} flex flex-col gap-2`}>
      <div className="flex flex-wrap items-center gap-3">
        {renaming ? (
          <form
            className="flex flex-1 flex-wrap items-center gap-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              change.mutate(
                { kind, id: item.id, body: { title: name } },
                {
                  onSuccess: () => {
                    toast("Renamed on every file that carries it", "ok");
                    setRenaming(false);
                  },
                },
              );
            }}
          >
            <Input aria-label={`New name for ${item.title}`} required value={name} onChange={(ev) => setName(ev.target.value)} className={`${inputClass} w-64`} />
            <ActionButton type="submit" variant="primary" pending={change.isPending}>
              Save
            </ActionButton>
            <ActionButton type="button" onClick={() => setRenaming(false)}>
              Cancel
            </ActionButton>
          </form>
        ) : (
          <span className={`flex-1 text-sm ${archived ? "text-muted-foreground" : "text-ink"}`}>{item.title}</span>
        )}
        {item.tone && <Badge intent={toneIntent(item.tone)}>{TONES.find((t) => t.value === item.tone)?.label}</Badge>}
        {item.kind && <Badge intent={DISCIPLINE_KIND[item.kind].intent}>{DISCIPLINE_KIND[item.kind].label}</Badge>}
        {archived && <Badge>Archived</Badge>}
        {!renaming && !archived && <ActionButton onClick={() => setRenaming(true)}>Rename</ActionButton>}
        {!renaming && (
          <ActionButton
            pending={change.isPending}
            onClick={() =>
              change.mutate(
                { kind, id: item.id, body: { status: archived ? "active" : "archived" } },
                { onSuccess: () => toast(archived ? `${item.title} is back` : `${item.title} archived`, "ok") },
              )
            }
          >
            {archived ? "Bring back" : "Archive"}
          </ActionButton>
        )}
      </div>
      <FormError error={change.error} />
    </div>
  );
}
