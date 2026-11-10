"use client";

import { Alert, Button, Input } from "@heroui/react";
import {
  PSF_FORM_STEP_LABEL,
  PSF_FORM_STEPS,
  type PsfBand,
  type PsfBandsView,
  type PsfFormExtra,
  type PsfFormFieldSetting,
  type PsfFormSetupView,
  type PsfFormStep,
  type PsfLevel,
  type PsfSplitRateView,
} from "@injishi/contracts";
import { PageContent, PageHeader, SectionCard, StatusChip } from "@injishi/ui";
import { useState } from "react";
import { rwf } from "@/server/format";
import { psfSetupCall } from "./psf-setup-actions";

type Note = { tone: "success" | "danger"; text: string } | null;
const digits = (v: string): number | null => (v.replace(/\D/g, "") === "" ? null : Number(v.replace(/\D/g, "")));
const SELECT = "h-9 rounded-lg border border-border bg-field px-2 text-sm";

/**
 * PSF setup (2026-11-06, the owner): the split, the levels and bands, and the public form's fields. The
 * National Manager changes them without a release; other managers read them here.
 */
export function PsfSetupScreen(props: { split: PsfSplitRateView; bands: PsfBandsView; form: PsfFormSetupView }) {
  const [note, setNote] = useState<Note>(null);
  const [tab, setTab] = useState<"split" | "bands" | "form">("split");
  const readOnly = !props.split.canEdit;
  const tabs = [
    { id: "split", label: "Split" },
    { id: "bands", label: "Levels and bands" },
    { id: "form", label: "Form fields" },
  ] as const;
  return (
    <PageContent>
      <PageHeader title="PSF setup" description={readOnly ? "Only the PSF National Manager changes these. You can read them here." : "Changes apply to the public form and to new payments straight away."} />
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button key={t.id} size="sm" variant={tab === t.id ? "primary" : "secondary"} onPress={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>
      {note ? <Alert status={note.tone}><Alert.Content><Alert.Description>{note.text}</Alert.Description></Alert.Content></Alert> : null}
      {tab === "split" ? <SplitPanel initial={props.split} onNote={setNote} /> : null}
      {tab === "bands" ? <BandsPanel initial={props.bands} onNote={setNote} /> : null}
      {tab === "form" ? <FormPanel initial={props.form} onNote={setNote} /> : null}
    </PageContent>
  );
}

// --- The split ------------------------------------------------------------------

function SplitPanel({ initial, onNote }: { initial: PsfSplitRateView; onNote: (n: Note) => void }) {
  const [view, setView] = useState(initial);
  const [value, setValue] = useState(String(initial.districtPercent));
  const parsed = digits(value);
  const valid = parsed !== null && parsed <= 100;
  const save = async () => {
    if (!valid) return;
    const res = await psfSetupCall<PsfSplitRateView>("put", "split", { districtPercent: parsed });
    if (!res.ok) return onNote({ tone: "danger", text: res.error });
    setView(res.value);
    onNote({ tone: "success", text: `New payments now split ${res.value.districtPercent}% to the district and ${res.value.headquartersPercent}% to headquarters.` });
  };
  return (
    <SectionCard title="The split" description="What each fee is recorded as. A change applies to new payments only: what was already paid keeps its rate." contentClassName="gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          District's share, %
          <Input aria-label="District's share in percent" className="w-28" value={value} disabled={!view.canEdit} inputMode="numeric" onChange={(e) => setValue(e.target.value)} />
        </label>
        <p className="pb-2 text-sm text-muted">Headquarters gets {valid ? 100 - parsed : "—"}%, with any rounding.</p>
        {view.canEdit ? (
          <Button size="sm" variant="primary" isDisabled={!valid || parsed === view.districtPercent} onPress={() => void save()}>
            Save
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-col divide-y divide-separator text-sm">
        {view.history.map((h) => (
          <li key={h.at} className="flex flex-wrap justify-between gap-3 py-2">
            <span className="font-medium">
              {h.districtPercent}% / {100 - h.districtPercent}%
            </span>
            <span className="text-muted">
              {h.setByName ?? "Starting rate"} · {new Date(h.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

// --- Levels and bands -----------------------------------------------------------

function BandsPanel({ initial, onNote }: { initial: PsfBandsView; onNote: (n: Note) => void }) {
  const [view, setView] = useState(initial);
  const [newLevel, setNewLevel] = useState("");
  const apply = (res: Awaited<ReturnType<typeof psfSetupCall<PsfBandsView>>>, message: string): boolean => {
    if (!res.ok) {
      onNote({ tone: "danger", text: res.error });
      return false;
    }
    setView(res.value);
    onNote({ tone: "success", text: res.value.note ? `${message} ${res.value.note}` : message });
    return true;
  };
  const addLevel = async () => {
    if (apply(await psfSetupCall<PsfBandsView>("post", "levels", { name: newLevel }), `${newLevel} added. Add a band so businesses can pick it.`)) setNewLevel("");
  };
  const shown = view.levels.filter((l) => l.active || view.bands.some((b) => b.level === l.code && b.members > 0));
  return (
    <div className="flex flex-col gap-4">
      {shown.map((level, i) => (
        <LevelCard
          key={level.code}
          level={level}
          view={view}
          apply={apply}
          onMove={
            view.canEdit
              ? async (by) => {
                  const other = shown[i + by];
                  if (!other) return;
                  const first = await psfSetupCall<PsfBandsView>("patch", `levels/${level.code}`, { sortOrder: other.sortOrder });
                  if (!first.ok) return void apply(first, "");
                  apply(await psfSetupCall<PsfBandsView>("patch", `levels/${other.code}`, { sortOrder: level.sortOrder }), `${level.name} moved.`);
                }
              : null
          }
          first={i === 0}
          last={i === shown.length - 1}
        />
      ))}
      {view.canEdit ? (
        <SectionCard title="Add a level" description="A new level beside the ones above. It reaches the form once it has a band." contentClassName="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="Level name" placeholder="Silver Circle" className="w-64" value={newLevel} onChange={(e) => setNewLevel(e.target.value)} />
            <Button size="sm" variant="primary" isDisabled={newLevel.trim().length < 2} onPress={() => void addLevel()}>
              Add level
            </Button>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

type Apply = (res: Awaited<ReturnType<typeof psfSetupCall<PsfBandsView>>>, message: string) => boolean;

function LevelCard({ level, view, apply, onMove, first, last }: { level: PsfLevel; view: PsfBandsView; apply: Apply; onMove: ((by: number) => Promise<void>) | null; first: boolean; last: boolean }) {
  const bands = view.bands.filter((b) => b.level === level.code && (b.active || b.members > 0));
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(level.name);
  const [blurb, setBlurb] = useState(level.blurb ?? "");
  const saveName = async () => {
    if (apply(await psfSetupCall<PsfBandsView>("patch", `levels/${level.code}`, { name, blurb: blurb || null }), `${name} saved.`)) setRenaming(false);
  };
  return (
    <SectionCard
      title={level.name}
      description={level.active ? (level.blurb ?? undefined) : "Retired: not offered on the form."}
      actions={
        view.canEdit ? (
          <span className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" isIconOnly aria-label={`Move ${level.name} up`} isDisabled={first} onPress={() => void onMove?.(-1)}>
              ↑
            </Button>
            <Button size="sm" variant="ghost" isIconOnly aria-label={`Move ${level.name} down`} isDisabled={last} onPress={() => void onMove?.(1)}>
              ↓
            </Button>
            <Button size="sm" variant="secondary" onPress={() => setRenaming(!renaming)}>
              Rename
            </Button>
            <Button size="sm" variant="secondary" onPress={() => setAdding(!adding)}>
              Add a band
            </Button>
            {level.active ? (
              <Button
                size="sm"
                variant="ghost"
                onPress={async () => {
                  if (window.confirm(`Retire ${level.name} and its bands? Members on them keep them until they renew.`)) {
                    apply(await psfSetupCall<PsfBandsView>("patch", `levels/${level.code}`, { active: false }), `${level.name} retired.`);
                  }
                }}
              >
                Retire
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onPress={async () => apply(await psfSetupCall<PsfBandsView>("patch", `levels/${level.code}`, { active: true }), `${level.name} is offered again. Bring back its bands below.`)}>
                Bring back
              </Button>
            )}
          </span>
        ) : null
      }
      contentClassName="gap-3"
    >
      {renaming ? (
        <div className="flex flex-wrap items-end gap-2">
          <Input aria-label="Level name" className="w-56" value={name} onChange={(e) => setName(e.target.value)} />
          <Input aria-label="Who it is for" placeholder="Who it is for" className="min-w-64 flex-1" value={blurb} onChange={(e) => setBlurb(e.target.value)} />
          <Button size="sm" variant="primary" onPress={() => void saveName()}>
            Save
          </Button>
        </div>
      ) : null}
      {adding ? (
        <BandEditor
          submit="Add band"
          onCancel={() => setAdding(false)}
          onSave={async (v) => {
            const ok = apply(await psfSetupCall<PsfBandsView>("post", "bands", { level: level.code, ...v }), "Band added to the form.");
            if (ok) setAdding(false);
          }}
        />
      ) : null}
      {bands.length === 0 ? <p className="text-sm text-muted">No bands yet.</p> : null}
      <ul className="flex flex-col divide-y divide-separator">
        {bands.map((b) => (
          <BandRow key={b.code} band={b} canEdit={view.canEdit} apply={apply} />
        ))}
      </ul>
    </SectionCard>
  );
}

function rangeText(b: PsfBand): string {
  if (b.minRwf === null) return "PSF names the price";
  return b.maxRwf === null ? `From ${rwf(b.minRwf)}` : `${rwf(b.minRwf)} to ${rwf(b.maxRwf)}`;
}

function BandRow({ band, canEdit, apply }: { band: PsfBand; canEdit: boolean; apply: Apply }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{band.name}</span>
          <span className="text-xs text-muted">
            {rangeText(band)}
            {band.cardBadge ? ` · ${band.cardBadge} ribbon` : ""} · {band.members} {band.members === 1 ? "member" : "members"}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {band.active ? null : <StatusChip tone="default">Retired</StatusChip>}
          {canEdit ? (
            <>
              <Button size="sm" variant="secondary" onPress={() => setEditing(!editing)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onPress={async () => apply(await psfSetupCall<PsfBandsView>("patch", `bands/${band.code}`, { active: !band.active }), band.active ? `${band.name} retired. Its members keep it until they renew.` : `${band.name} is offered again.`)}
              >
                {band.active ? "Retire" : "Bring back"}
              </Button>
            </>
          ) : null}
        </span>
      </div>
      {editing ? (
        <BandEditor
          submit="Save band"
          band={band}
          onCancel={() => setEditing(false)}
          onSave={async (v) => {
            if (apply(await psfSetupCall<PsfBandsView>("patch", `bands/${band.code}`, v), "Band saved. Members already on it keep it until they renew or upgrade.")) setEditing(false);
          }}
        />
      ) : null}
    </li>
  );
}

function BandEditor({ band, submit, onSave, onCancel }: { band?: PsfBand; submit: string; onSave: (v: { name?: string; cardBadge: string | null; minRwf: number; maxRwf: number | null }) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(band?.name ?? "");
  const [min, setMin] = useState(band?.minRwf != null ? String(band.minRwf) : "");
  const [max, setMax] = useState(band?.maxRwf != null ? String(band.maxRwf) : "");
  const [badge, setBadge] = useState(band?.cardBadge ?? "");
  const minRwf = digits(min);
  const maxRwf = digits(max);
  const problem = minRwf === null ? "Give the least a member pays." : maxRwf !== null && maxRwf <= minRwf ? "The most must be above the least." : null;
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-surface-secondary p-3">
      <label className="flex flex-col gap-1 text-xs font-medium">
        Name (empty is the usual one)
        <Input aria-label="Band name" className="w-64" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Least, RWF
        <Input aria-label="Least in RWF" className="w-32" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Most, RWF (empty is no limit)
        <Input aria-label="Most in RWF" className="w-40" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Card ribbon (like Bronze)
        <Input aria-label="Card ribbon" className="w-36" value={badge} onChange={(e) => setBadge(e.target.value)} />
      </label>
      <Button size="sm" variant="primary" isDisabled={problem !== null} onPress={() => (minRwf === null ? undefined : void onSave({ ...(name.trim() ? { name: name.trim() } : {}), cardBadge: badge.trim() || null, minRwf, maxRwf }))}>
        {submit}
      </Button>
      <Button size="sm" variant="ghost" onPress={onCancel}>
        Cancel
      </Button>
      {problem && (min || max) ? <p className="w-full text-xs text-danger">{problem}</p> : null}
    </div>
  );
}

// --- The form -------------------------------------------------------------------

function FormPanel({ initial, onNote }: { initial: PsfFormSetupView; onNote: (n: Note) => void }) {
  const [view, setView] = useState(initial);
  const apply = (res: Awaited<ReturnType<typeof psfSetupCall<PsfFormSetupView>>>, message: string): boolean => {
    if (!res.ok) {
      onNote({ tone: "danger", text: res.error });
      return false;
    }
    setView(res.value);
    onNote({ tone: "success", text: message });
    return true;
  };
  return (
    <div className="flex flex-col gap-4">
      {PSF_FORM_STEPS.map((step) => (
        <FormStep key={step} step={step} view={view} apply={apply} />
      ))}
    </div>
  );
}

type ApplyForm = (res: Awaited<ReturnType<typeof psfSetupCall<PsfFormSetupView>>>, message: string) => boolean;

function FormStep({ step, view, apply }: { step: PsfFormStep; view: PsfFormSetupView; apply: ApplyForm }) {
  const fields = view.fields.filter((f) => f.step === step);
  const extras = view.extras.filter((e) => e.step === step && e.active);
  const [adding, setAdding] = useState(false);
  const move = async (index: number, by: number) => {
    const other = fields[index + by];
    const field = fields[index];
    if (!other || !field) return;
    const first = await psfSetupCall<PsfFormSetupView>("patch", `form/fields/${field.key}`, { sortOrder: other.sortOrder });
    if (!first.ok) return apply(first, "");
    apply(await psfSetupCall<PsfFormSetupView>("patch", `form/fields/${other.key}`, { sortOrder: field.sortOrder }), `${field.label} moved.`);
  };
  return (
    <SectionCard
      title={PSF_FORM_STEP_LABEL[step]}
      actions={
        view.canEdit ? (
          <Button size="sm" variant="secondary" onPress={() => setAdding(!adding)}>
            Add a question
          </Button>
        ) : null
      }
      contentClassName="gap-3"
    >
      {adding ? <ExtraEditor step={step} apply={apply} onDone={() => setAdding(false)} /> : null}
      <ul className="flex flex-col divide-y divide-separator">
        {fields.map((f, i) => (
          <FieldRow key={f.key} field={f} canEdit={view.canEdit} apply={apply} onUp={i > 0 ? () => void move(i, -1) : null} onDown={i < fields.length - 1 ? () => void move(i, 1) : null} />
        ))}
        {extras.map((e) => (
          <ExtraRow key={e.id} extra={e} canEdit={view.canEdit} apply={apply} />
        ))}
      </ul>
    </SectionCard>
  );
}

function FieldRow({ field, canEdit, apply, onUp, onDown }: { field: PsfFormFieldSetting; canEdit: boolean; apply: ApplyForm; onUp: (() => void) | null; onDown: (() => void) | null }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(field.label);
  const [help, setHelp] = useState(field.help ?? "");
  const patch = async (body: Record<string, unknown>, message: string): Promise<boolean> => apply(await psfSetupCall<PsfFormSetupView>("patch", `form/fields/${field.key}`, body), message);
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={field.visible ? "font-medium text-foreground" : "font-medium text-muted line-through"}>{field.label}</span>
          {field.help ? <span className="text-xs text-muted">{field.help}</span> : null}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {field.locked ? <StatusChip tone="info">Always asked</StatusChip> : null}
          {!field.locked && field.visible ? <StatusChip tone={field.required ? "success" : "default"}>{field.required ? "Required" : "Optional"}</StatusChip> : null}
          {!field.visible ? <StatusChip tone="default">Hidden</StatusChip> : null}
          {canEdit ? (
            <>
              <Button size="sm" variant="ghost" isIconOnly aria-label={`Move ${field.label} up`} isDisabled={!onUp} onPress={() => onUp?.()}>
                ↑
              </Button>
              <Button size="sm" variant="ghost" isIconOnly aria-label={`Move ${field.label} down`} isDisabled={!onDown} onPress={() => onDown?.()}>
                ↓
              </Button>
              <Button size="sm" variant="secondary" onPress={() => setEditing(!editing)}>
                Edit
              </Button>
              {field.locked ? null : (
                <>
                  <Button size="sm" variant="ghost" onPress={() => void patch({ required: !field.required }, `${field.label} is now ${field.required ? "optional" : "required"}.`)}>
                    {field.required ? "Make optional" : "Make required"}
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => void patch({ visible: !field.visible }, `${field.label} is ${field.visible ? "hidden from" : "back on"} the form.`)}>
                    {field.visible ? "Hide" : "Show"}
                  </Button>
                </>
              )}
            </>
          ) : null}
        </span>
      </div>
      {editing ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-surface-secondary p-3">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Label
            <Input aria-label="Label" className="w-64" value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs font-medium">
            Help text
            <Input aria-label="Help text" value={help} onChange={(e) => setHelp(e.target.value)} />
          </label>
          <Button
            size="sm"
            variant="primary"
            isDisabled={!label.trim()}
            onPress={async () => {
              if (await patch({ label: label.trim(), help: help.trim() || null }, `${label.trim()} saved.`)) setEditing(false);
            }}
          >
            Save
          </Button>
        </div>
      ) : null}
    </li>
  );
}

const TYPE_LABEL: Record<PsfFormExtra["fieldType"], string> = { text: "Short answer", textarea: "Long answer", number: "Number", boolean: "Yes or no", select: "Pick from a list" };

function ExtraRow({ extra, canEdit, apply }: { extra: PsfFormExtra; canEdit: boolean; apply: ApplyForm }) {
  const patch = async (body: Record<string, unknown>, message: string): Promise<boolean> => apply(await psfSetupCall<PsfFormSetupView>("patch", `form/extras/${extra.id}`, body), message);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-foreground">{extra.label}</span>
        <span className="text-xs text-muted">
          {TYPE_LABEL[extra.fieldType]}
          {extra.options.length ? `: ${extra.options.join(", ")}` : ""}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <StatusChip tone="info">Added by PSF</StatusChip>
        <StatusChip tone={extra.required ? "success" : "default"}>{extra.required ? "Required" : "Optional"}</StatusChip>
        {canEdit ? (
          <>
            <Button size="sm" variant="ghost" onPress={() => void patch({ required: !extra.required }, `${extra.label} is now ${extra.required ? "optional" : "required"}.`)}>
              {extra.required ? "Make optional" : "Make required"}
            </Button>
            <Button size="sm" variant="ghost" onPress={() => void patch({ active: false }, `${extra.label} is off the form. Answers already given stay on their applications.`)}>
              Remove
            </Button>
          </>
        ) : null}
      </span>
    </li>
  );
}

function ExtraEditor({ step, apply, onDone }: { step: PsfFormStep; apply: ApplyForm; onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [help, setHelp] = useState("");
  const [fieldType, setFieldType] = useState<PsfFormExtra["fieldType"]>("text");
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState("");
  const list = options.split(",").map((o) => o.trim()).filter(Boolean);
  const ready = label.trim().length >= 2 && (fieldType !== "select" || list.length >= 2);
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-surface-secondary p-3">
      <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs font-medium">
        The question
        <Input aria-label="The question" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium">
        Help text (optional)
        <Input aria-label="Help text" value={help} onChange={(e) => setHelp(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Kind of answer
        <select aria-label="Kind of answer" className={SELECT} value={fieldType} onChange={(e) => setFieldType(e.target.value as PsfFormExtra["fieldType"])}>
          {Object.entries(TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {fieldType === "select" ? (
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs font-medium">
          Answers, separated by commas
          <Input aria-label="Answers" value={options} onChange={(e) => setOptions(e.target.value)} />
        </label>
      ) : null}
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required
      </label>
      <Button
        size="sm"
        variant="primary"
        isDisabled={!ready}
        onPress={async () => {
          const res = await psfSetupCall<PsfFormSetupView>("post", "form/extras", { step, label: label.trim(), help: help.trim() || null, fieldType, required, options: fieldType === "select" ? list : [] });
          if (apply(res, `“${label.trim()}” added to the form.`)) onDone();
        }}
      >
        Add question
      </Button>
      <Button size="sm" variant="ghost" onPress={onDone}>
        Cancel
      </Button>
    </div>
  );
}
