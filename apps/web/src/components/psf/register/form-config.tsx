"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { PSF_FORM_FIELDS, psfExtraAnswerProblem, psfFormDefaults, type PsfFormConfig, type PsfFormExtra, type PsfFormFieldName, type PsfFormStep } from "@injishi/contracts";
import { Checkbox } from "@injishi/web-ui";

import { Field, Fieldset, SelectField, TextArea, TextInput } from "@/app/(app)/(entry)/register/wizard-ui";
import { fetchPsfFormConfig } from "@/data/psf";

import type { Errors, PsfDraft } from "./draft";

const DEFAULTS: PsfFormConfig = { fields: psfFormDefaults(), extras: [] };
const ConfigContext = createContext<PsfFormConfig>(DEFAULTS);

/** PSF's form settings (2026-11-06). Until they arrive, or if they cannot, the form asks its usual fields. */
export function usePsfFormConfig(): PsfFormConfig {
  const [config, setConfig] = useState<PsfFormConfig>(DEFAULTS);
  useEffect(() => {
    void fetchPsfFormConfig().then((res) => {
      if (res.status === "ok") setConfig(res.data);
    });
  }, []);
  return config;
}

export function PsfFormConfigProvider({ config, children }: { config: PsfFormConfig; children: ReactNode }) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

/** One built-in field as PSF set it, with what the form says itself where PSF changed nothing. */
export function usePsfField(name: PsfFormFieldName, fallback: { label?: string; hint?: ReactNode; required?: boolean } = {}) {
  const config = useContext(ConfigContext);
  const setting = config.fields.find((f) => f.key === name);
  const own = PSF_FORM_FIELDS.find((f) => f.key === name);
  const relabelled = setting && own && setting.label !== own.label;
  const rehelped = setting && own && setting.help !== own.help;
  const required = setting ? setting.required : fallback.required;
  const baseLabel = relabelled ? setting.label : (own?.locked ? fallback.label : own?.label) ?? setting?.label ?? fallback.label ?? "";
  return {
    visible: setting?.visible ?? true,
    required,
    label: !own?.locked && !required && !/optional/i.test(baseLabel) ? `${baseLabel} (optional)` : baseLabel,
    hint: rehelped ? (setting.help ?? undefined) : fallback.hint,
    order: setting?.sortOrder ?? 0,
  };
}

/** The order a field sits at, for what goes beside it: a line of its own, or the answer that opens up under it. */
export function usePsfOrder(name: PsfFormFieldName): number {
  return useContext(ConfigContext).fields.find((f) => f.key === name)?.sortOrder ?? 0;
}

type FieldProps = Parameters<typeof Field>[0];

/**
 * A field of the public form. `name` is PSF's setting for it; `orderAs` keeps a follow-up next to the
 * field it follows. Without either it is a plain field.
 */
export function PsfField({ name, orderAs, ...props }: FieldProps & { name?: PsfFormFieldName; orderAs?: PsfFormFieldName }) {
  const field = usePsfField(name ?? "website", props);
  const followed = usePsfOrder(orderAs ?? "website");
  if (name && !field.visible) return null;
  return (
    <div style={{ order: name ? field.order : orderAs ? followed : undefined }} className="min-w-0">
      {name ? <Field {...props} label={field.label} hint={field.hint} required={Boolean(field.required)} /> : <Field {...props} />}
    </div>
  );
}

export function PsfFieldset({ name, ...props }: Parameters<typeof Fieldset>[0] & { name: PsfFormFieldName }) {
  const field = usePsfField(name, { label: props.legend, hint: props.hint, required: false });
  if (!field.visible) return null;
  return (
    <div style={{ order: field.order }} className="min-w-0">
      <Fieldset {...props} legend={field.label} hint={field.hint} />
    </div>
  );
}

/** The questions PSF added to this step (2026-11-06). */
export function PsfExtras({ step, draft, onChange, errors }: { step: PsfFormStep; draft: PsfDraft; onChange: (next: Partial<PsfDraft>) => void; errors: Errors }) {
  const { extras } = useContext(ConfigContext);
  const own = extras.filter((e) => e.step === step);
  if (own.length === 0) return null;
  const set = (key: string, value: string | number | boolean | undefined) => {
    const next = { ...draft.extras };
    if (value === undefined || value === "") delete next[key];
    else next[key] = value;
    onChange({ extras: next });
  };
  return (
    <div className="flex flex-col gap-5" style={{ order: 9999 }}>
      {own.map((e) => (
        <ExtraField key={e.key} extra={e} value={draft.extras[e.key]} error={errors[`extras.${e.key}`]} onChange={(v) => set(e.key, v)} />
      ))}
    </div>
  );
}

function ExtraField({ extra, value, error, onChange }: { extra: PsfFormExtra; value: string | number | boolean | undefined; error?: string; onChange: (v: string | number | boolean | undefined) => void }) {
  const id = `psf-extra-${extra.key}`;
  const label = extra.required ? extra.label : `${extra.label} (optional)`;
  if (extra.fieldType === "boolean") {
    return (
      <Field label={label} hint={extra.help ?? undefined} required={extra.required} error={error} composite>
        <Checkbox id={id} isSelected={value === true} onChange={(on: boolean) => onChange(on ? true : undefined)}>
          Yes
        </Checkbox>
      </Field>
    );
  }
  return (
    <Field label={label} hint={extra.help ?? undefined} required={extra.required} error={error}>
      {extra.fieldType === "select" ? (
        <SelectField value={typeof value === "string" ? value : ""} placeholder="Choose" onChange={(v: string) => onChange(v)} options={extra.options.map((o) => ({ value: o, label: o }))} />
      ) : extra.fieldType === "textarea" ? (
        <TextArea id={id} className="w-full" rows={3} value={typeof value === "string" ? value : ""} onChange={(ev) => onChange(ev.target.value)} />
      ) : (
        <TextInput
          id={id}
          className="w-full"
          inputMode={extra.fieldType === "number" ? "numeric" : undefined}
          value={value === undefined ? "" : String(value)}
          onChange={(ev) => {
            const raw = ev.target.value;
            if (extra.fieldType !== "number") return onChange(raw);
            const digits = raw.replace(/[^\d.]/g, "");
            onChange(digits === "" || Number.isNaN(Number(digits)) ? undefined : Number(digits));
          }}
        />
      )}
    </Field>
  );
}

/** The fields PSF can make optional or hide, and where each one's value and message live. */
const ADJUSTABLE: { name: PsfFormFieldName; error: string; filled: (d: PsfDraft) => boolean; step: PsfFormStep }[] = [
  { name: "website", error: "business.website", filled: (d) => Boolean(d.website.trim()), step: "business" },
  { name: "businessActivity", error: "business.businessActivity", filled: (d) => Boolean(d.businessActivity.trim()), step: "business" },
  { name: "ownerGroups", error: "business.ownerGroups", filled: (d) => d.ownerGroups.length > 0, step: "business" },
  { name: "cell", error: "business.address.cellId", filled: (d) => Boolean(d.cellId), step: "place" },
  { name: "village", error: "business.address.villageId", filled: (d) => Boolean(d.villageId), step: "place" },
  { name: "street", error: "business.address.street", filled: (d) => Boolean(d.street.trim()), step: "place" },
  { name: "photo", error: "contact.photoObjectKey", filled: (d) => Boolean(d.photoObjectKey), step: "you" },
  { name: "email", error: "contact.email", filled: (d) => Boolean(d.email.trim()), step: "you" },
  { name: "logo", error: "business.logoObjectKey", filled: (d) => Boolean(d.logoObjectKey), step: "membership" },
];

/** A step's messages with PSF's settings applied: optional and hidden fields go quiet, required ones ask. */
export function withFormRules(errors: Errors, draft: PsfDraft, config: PsfFormConfig, step: PsfFormStep): Errors {
  const out = { ...errors };
  for (const f of ADJUSTABLE) {
    if (f.step !== step) continue;
    const setting = config.fields.find((x) => x.key === f.name);
    const asked = (setting?.visible ?? true) && (setting?.required ?? false);
    if (!asked && !f.filled(draft)) delete out[f.error];
    if (asked && !f.filled(draft)) out[f.error] = `Fill in “${setting?.label}”.`;
  }
  for (const e of config.extras) {
    if (e.step !== step) continue;
    const problem = psfExtraAnswerProblem(e, draft.extras[e.key]);
    if (problem) out[`extras.${e.key}`] = problem;
  }
  return out;
}
