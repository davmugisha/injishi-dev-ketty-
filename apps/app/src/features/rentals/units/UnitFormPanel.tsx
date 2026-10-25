"use client";

import { Description, Label, toast } from "@heroui/react";
import { RadioButtonGroup, Segment } from "@heroui-pro/react";
import {
  type BlockView,
  MAX_BULK_UNITS,
  type RentalPropertyView,
  type RentalUnitView,
  type UnitKitchen,
} from "@injishi/contracts";
import { BoundedDatePicker, Icon, kigaliDay, MoneyInput, SectionHeader, SelectField, SidePanel } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { bulkAddUnits, createUnit, updateUnit } from "../actions";
import { CountInput, fieldErrorsOnly, SwitchRow, TextInput } from "../fields";
import { type MediaProgress, UnitMediaFields } from "./UnitMediaFields";

const NO_BLOCK = "none";

interface Facts {
  propertyId: string | null;
  blockId: string;
  bedrooms: number | null;
  bathrooms: number | null;
  kitchen: UnitKitchen | null;
  furnished: boolean;
  floor: number | null;
  sizeSqm: number | null;
  askingRentRwf: number | null;
  askingDepositRwf: number | null;
  availableFrom: string | null;
  note: string;
  offMarket: boolean;
}

const factsOf = (u: RentalUnitView | null, propertyId: string | null): Facts => ({
  propertyId: u?.propertyId ?? propertyId,
  blockId: u?.blockId ?? NO_BLOCK,
  bedrooms: u?.bedrooms ?? null,
  bathrooms: u?.bathrooms ?? null,
  kitchen: u?.kitchen ?? null,
  furnished: u?.furnished ?? false,
  floor: u?.floor ?? null,
  sizeSqm: u?.sizeSqm ?? null,
  askingRentRwf: u?.askingRentRwf ?? null,
  askingDepositRwf: u?.askingDepositRwf ?? null,
  availableFrom: u?.availableFrom ?? null,
  note: u?.note ?? "",
  offMarket: u?.state === "off_market",
});

/** "A-01" … "A-12": names from a prefix and a number range, padded to the same width. */
export function bulkLabels(prefix: string, from: number | null, to: number | null, pad: boolean): string[] {
  if (from === null || to === null || to < from || to - from >= MAX_BULK_UNITS) return [];
  const width = pad ? Math.max(2, String(to).length) : 0;
  return Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(width, "0")}`);
}

export type UnitFormMode = { kind: "add" } | { kind: "bulk" } | { kind: "edit"; unit: RentalUnitView };

const NO_MEDIA: MediaProgress = { busy: false, failed: 0, held: 0, photos: 0, video: false };

const photoWords = (n: number) => (n === 1 ? "1 photo" : `${n} photos`);

/**
 * Add a unit, add several at once (named from a pattern, the same facts for all), or edit one. One form
 * for all three; the API checks every rule again (a name used twice in a building, a listed unit's rent).
 * Adding or editing one unit, its photos and video tour are in the same form: for a new unit they wait in
 * the browser and go up, each with its progress, right after the unit is saved. A photo that fails
 * leaves the unit saved and shows Try again.
 */
export function UnitFormPanel({
  mode,
  blocks,
  properties,
  onClose,
  onSaved,
}: {
  mode: UnitFormMode;
  blocks: BlockView[];
  properties: RentalPropertyView[];
  onClose: () => void;
  onSaved?: (unit: RentalUnitView | null) => void;
}) {
  const router = useRouter();
  // A new unit, once saved, is edited from then on (its photos are still going up).
  const [created, setCreated] = useState<RentalUnitView | null>(null);
  const editing = mode.kind === "edit" ? mode.unit : created;
  const [media, setMedia] = useState<MediaProgress>(NO_MEDIA);
  const onMedia = useCallback((next: MediaProgress) => setMedia(next), []);
  const [label, setLabel] = useState(editing?.label ?? "");
  const [prefix, setPrefix] = useState("A-");
  const [from, setFrom] = useState<number | null>(1);
  const [to, setTo] = useState<number | null>(6);
  const [facts, setFacts] = useState<Facts>(() =>
    factsOf(editing, properties.length === 1 ? (properties[0]?.id ?? null) : null),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Facts>(key: K, value: Facts[K]) => setFacts((f) => ({ ...f, [key]: value }));

  const labels = useMemo(() => bulkLabels(prefix.trim(), from, to, true), [prefix, from, to]);
  const blockOptions = useMemo(
    () => [
      { id: NO_BLOCK, label: "No block" },
      ...blocks
        .filter((b) => !facts.propertyId || b.propertyId === facts.propertyId)
        .map((b) => ({ id: b.id, label: b.code === b.name ? b.name : `${b.code} · ${b.name}` })),
    ],
    [blocks, facts.propertyId],
  );
  const today = kigaliDay();

  const body = () => ({
    ...(mode.kind !== "edit" && properties.length > 1 && facts.propertyId ? { propertyId: facts.propertyId } : {}),
    blockId: facts.blockId === NO_BLOCK ? null : facts.blockId,
    bedrooms: facts.bedrooms,
    bathrooms: facts.bathrooms,
    kitchen: facts.kitchen,
    furnished: facts.furnished,
    floor: facts.floor,
    sizeSqm: facts.sizeSqm,
    askingRentRwf: facts.askingRentRwf,
    askingDepositRwf: facts.askingDepositRwf,
    availableFrom: facts.availableFrom,
    note: facts.note.trim() || null,
    state: facts.offMarket ? "off_market" : "active",
  });

  /** Saved, with every photo and the video up: say so, open the unit, close. */
  const finish = useCallback(
    (unit: RentalUnitView, added: boolean, m: MediaProgress) => {
      const extra = [m.photos > 0 ? photoWords(m.photos) : null, m.video ? "a video" : null].filter(Boolean);
      toast.success(
        added
          ? `Unit ${unit.label} added${extra.length > 0 ? ` with ${extra.join(" and ")}` : ""}`
          : `Unit ${unit.label} saved`,
      );
      onSaved?.(unit);
      onClose();
      router.refresh();
    },
    [onSaved, onClose, router],
  );

  // A new unit's photos and video went up after it was saved: close once they are all done.
  const announced = useRef(false);
  useEffect(() => {
    if (!created || media.busy || media.held > 0 || media.failed > 0 || announced.current) return;
    announced.current = true;
    finish(created, true, media);
  }, [created, media, finish]);

  const submit = () =>
    start(async () => {
      if (mode.kind === "bulk" && labels.length === 0) {
        setErrors({ to: "Pick a range of up to 200 units." });
        return;
      }
      const result = editing
        ? await updateUnit(editing.id, { ...body(), label })
        : mode.kind === "add"
          ? await createUnit({ ...body(), label })
          : await bulkAddUnits({ ...body(), labels });
      if (!result.ok) {
        const fields = fieldErrorsOnly(result.fieldErrors);
        if (fields["labels.0"] || Object.keys(fields).some((k) => k.startsWith("labels."))) {
          fields.prefix = Object.entries(fields).find(([k]) => k.startsWith("labels."))?.[1] ?? "";
        }
        setErrors(fields);
        setFormError(result.fieldErrors ? null : result.error);
        return;
      }
      setFormError(null);
      if (mode.kind === "bulk") {
        const count = (result.value as { created: unknown[] }).created.length;
        toast.success(`${count} ${count === 1 ? "unit" : "units"} added`);
        onSaved?.(null);
        onClose();
        router.refresh();
        return;
      }
      const unit = result.value as RentalUnitView;
      // A new unit with photos or a video waiting: they go up now, and the panel closes when they are done.
      if (mode.kind === "add" && !created && media.held > 0) {
        setCreated(unit);
        return;
      }
      if (created) {
        announced.current = true;
        setCreated(unit);
      }
      finish(unit, mode.kind === "add", media);
    });

  const title =
    mode.kind === "add" ? "Add a unit" : mode.kind === "bulk" ? "Add several units" : `Edit unit ${mode.unit.label}`;
  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={title}
      description={
        mode.kind === "bulk"
          ? "Named from a pattern, with the same facts. You can change each one after."
          : mode.kind === "add"
            ? created
              ? `Unit ${created.label} is saved. Its photos are uploading.`
              : "Only the name is needed. Add the rest, photos and a video now or later."
            : "Change what you need. Photos and the video save as you add them."
      }
      submitLabel={
        mode.kind === "bulk"
          ? labels.length > 0
            ? `Add ${labels.length} units`
            : "Add units"
          : created
            ? "Done"
            : mode.kind === "add"
              ? "Add unit"
              : "Save"
      }
      size={mode.kind === "bulk" ? "md" : "lg"}
      isPending={pending || media.busy}
      validationErrors={errors}
      formError={
        formError ??
        (created && media.failed > 0 && !media.busy
          ? `Unit ${created.label} is saved. ${media.failed === 1 ? "One file" : `${media.failed} files`} didn't upload: try again or remove ${media.failed === 1 ? "it" : "them"}.`
          : null)
      }
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {mode.kind !== "edit" && properties.length > 1 ? (
        <SelectField
          label="Building"
          name="propertyId"
          options={properties.map((p) => ({ id: p.id, label: p.name }))}
          value={facts.propertyId}
          onChange={(v) => setFacts((f) => ({ ...f, propertyId: v, blockId: NO_BLOCK }))}
          errorMessage={errors.propertyId}
          isRequired
        />
      ) : null}

      {mode.kind === "bulk" ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-3">
            <TextInput
              label="Starts with"
              name="prefix"
              value={prefix}
              onChange={setPrefix}
              errorMessage={errors.prefix}
            />
            <CountInput label="From" name="from" value={from} onChange={setFrom} minValue={0} maxValue={9999} />
            <CountInput
              label="To"
              name="to"
              value={to}
              onChange={setTo}
              minValue={0}
              maxValue={9999}
              errorMessage={errors.to}
            />
          </div>
          <p className="text-xs text-muted" aria-live="polite">
            {labels.length > 0
              ? `${labels.length} ${labels.length === 1 ? "unit" : "units"}: ${labels.slice(0, 4).join(", ")}${
                  labels.length > 5 ? ` … ${labels.at(-1)}` : labels.length === 5 ? `, ${labels[4]}` : ""
                }`
              : "Pick a range of up to 200 units."}
          </p>
        </div>
      ) : (
        <TextInput
          label="Unit name"
          name="label"
          value={label}
          onChange={setLabel}
          placeholder="A-01"
          description="As it is on the door."
          isRequired
          autoFocus={mode.kind === "add"}
        />
      )}

      <SelectField
        label="Block"
        name="blockId"
        options={blockOptions}
        value={facts.blockId}
        onChange={(v) => set("blockId", v)}
        errorMessage={errors.blockId}
      />

      <div className="grid grid-cols-2 gap-3">
        <CountInput
          label="Bedrooms"
          name="bedrooms"
          value={facts.bedrooms}
          onChange={(v) => set("bedrooms", v)}
          minValue={0}
          maxValue={50}
          description="0 for a studio."
        />
        <CountInput
          label="Bathrooms"
          name="bathrooms"
          value={facts.bathrooms}
          onChange={(v) => set("bathrooms", v)}
          minValue={0}
          maxValue={50}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Kitchen</span>
        <Segment
          aria-label="Kitchen"
          selectedKey={facts.kitchen ?? "unset"}
          onSelectionChange={(k) => set("kitchen", k === "unset" ? null : (String(k) as UnitKitchen))}
          className="w-full"
        >
          <Segment.Item id="own">Its own</Segment.Item>
          <Segment.Item id="shared">Shared</Segment.Item>
          <Segment.Item id="none">None</Segment.Item>
        </Segment>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CountInput
          label="Floor"
          name="floor"
          value={facts.floor}
          onChange={(v) => set("floor", v)}
          minValue={-5}
          maxValue={200}
        />
        <CountInput
          label="Size"
          name="sizeSqm"
          value={facts.sizeSqm}
          onChange={(v) => set("sizeSqm", v)}
          minValue={1}
          maxValue={100000}
          unit="m²"
        />
      </div>

      <MoneyInput
        label="Asking rent a month"
        name="askingRentRwf"
        value={facts.askingRentRwf}
        onChange={(v) => set("askingRentRwf", v)}
        minValue={1}
        description="What you ask while it is vacant. Each lease sets its own rent."
        errorMessage={errors.askingRentRwf}
      />
      <MoneyInput
        label="Deposit"
        name="askingDepositRwf"
        value={facts.askingDepositRwf}
        onChange={(v) => set("askingDepositRwf", v)}
        errorMessage={errors.askingDepositRwf}
      />
      <BoundedDatePicker
        label="Available from"
        name="availableFrom"
        value={facts.availableFrom}
        onChange={(v) => set("availableFrom", v)}
        minValue={editing?.availableFrom && editing.availableFrom < today ? editing.availableFrom : today}
        description="Leave empty when it is free now."
        errorMessage={errors.availableFrom}
      />
      <SwitchRow label="Furnished" isSelected={facts.furnished} onChange={(on) => set("furnished", on)} />
      <RadioButtonGroup
        aria-label="Can it be let?"
        layout="grid"
        value={facts.offMarket ? "off_market" : "active"}
        onChange={(v) => set("offMarket", v === "off_market")}
        className="grid-cols-2 gap-2.5"
      >
        {(
          [
            ["active", "Can be let", "Shown as vacant when free."],
            ["off_market", "Off market", "Being fixed or kept back."],
          ] as const
        ).map(([value, title, hint]) => (
          <RadioButtonGroup.Item key={value} value={value} className="gap-1 px-3.5 py-3">
            <RadioButtonGroup.Indicator>
              <Icon name="CircleCheckFill" />
            </RadioButtonGroup.Indicator>
            <RadioButtonGroup.ItemContent>
              <Label className="font-semibold">{title}</Label>
              <Description className="text-xs">{hint}</Description>
            </RadioButtonGroup.ItemContent>
          </RadioButtonGroup.Item>
        ))}
      </RadioButtonGroup>
      <TextInput
        label="Note"
        name="note"
        value={facts.note}
        onChange={(v) => set("note", v)}
        multiline
        description="Only your team sees it."
      />

      {mode.kind === "bulk" ? null : (
        <section aria-labelledby="unit-media" className="flex flex-col gap-4 border-t border-border pt-4">
          <SectionHeader id="unit-media" title="Photos and video" />
          <UnitMediaFields
            unitId={editing?.id ?? null}
            load={mode.kind === "edit"}
            isDisabled={editing?.state === "retired"}
            onProgress={onMedia}
          />
        </section>
      )}
    </SidePanel>
  );
}
