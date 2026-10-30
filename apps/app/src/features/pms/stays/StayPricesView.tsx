"use client";

import { Description, Input, Label, TextField, toast } from "@heroui/react";
import { RadioButtonGroup, Segment } from "@heroui-pro/react";
import type { RatesRoomType, RatesSpecialRange } from "@injishi/contracts";
import {
  ActionButton,
  BoundedDateRangePicker,
  type DataColumn,
  DataTable,
  type DayRange,
  EmptyBlock,
  formatMoney,
  formatNumber,
  formatRange,
  Icon,
  IconAction,
  Money,
  MoneyInput,
  PageContent,
  RowActions,
  Schedule,
  type ScheduleEvent,
  type ScheduleKind,
  SectionHeader,
  SelectField,
  SidePanel,
  StatusChip,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { saveRatesDays, saveRatesTerms } from "./rates-actions";

const KINDS: ScheduleKind[] = [
  { id: "price", label: "Own price", color: "var(--accent)" },
  { id: "closed", label: "Closed", color: "var(--danger)" },
  { id: "min", label: "Shortest stay", color: "var(--chart-other)" },
];

const perGuest = (t: RatesRoomType) => t.priceBasis === "per_person";
const rangeKey = (r: RatesSpecialRange) => `${r.roomTypeId}:${r.from}`;
const nightsWords = (n: number) => `${formatNumber(n)} ${n === 1 ? "night" : "nights"}`;

function stayWords(t: RatesRoomType): string {
  if (t.minStay && t.maxStay) return `${formatNumber(t.minStay)} to ${nightsWords(t.maxStay)}`;
  if (t.minStay) return `${nightsWords(t.minStay)} or more`;
  if (t.maxStay) return `Up to ${nightsWords(t.maxStay)}`;
  return "Any";
}

/** What a special run of days does, in a few words. */
function rangeWords(r: RatesSpecialRange): string {
  const parts: string[] = [];
  if (r.closed) parts.push("Closed");
  else if (r.priceRwf) parts.push(formatMoney(r.priceRwf));
  if (r.minNights) parts.push(`${nightsWords(r.minNights)} or more`);
  return parts.join(", ");
}

/**
 * Prices of a stay business (2026-10-30): one row per room type with its price a night (per room since
 * 0119, with a lower price for one guest), its stay bounds and long stay discounts, edited in a side
 * panel; then the special dates with their own price or closed, as a list or on the Agenda. How many
 * rooms are free each night is the booking calendar's, not this page's.
 */
export function StayPricesView({
  roomTypes,
  ranges,
  today,
  longStays,
}: {
  roomTypes: RatesRoomType[];
  ranges: RatesSpecialRange[];
  today: string;
  longStays: boolean;
}) {
  const [editing, setEditing] = useState<RatesRoomType | null>(null);
  const [special, setSpecial] = useState<RatesSpecialRange | "new" | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");

  if (roomTypes.length === 0) {
    return (
      <PageContent>
        <AreaHeader />
        <EmptyBlock icon="Tag" title="No rooms to price yet" description="Rooms get their prices here once added." />
      </PageContent>
    );
  }

  const columns: DataColumn<RatesRoomType>[] = [
    {
      id: "type",
      header: "Room type",
      isRowHeader: true,
      sortValue: (t) => t.name,
      cell: (t) => (
        <span className="flex flex-col">
          <span className="font-medium">{t.name}</span>
          <span className="text-xs text-muted">
            {formatNumber(t.rooms)} {t.rooms === 1 ? "room" : "rooms"}
          </span>
        </span>
      ),
    },
    {
      id: "price",
      header: "Price a night",
      align: "end",
      sortValue: (t) => t.basePriceRwf,
      cell: (t) => (
        <span className="flex flex-col items-end">
          <Money value={t.basePriceRwf} />
          {perGuest(t) ? <span className="text-xs text-muted">a guest</span> : null}
        </span>
      ),
    },
    {
      id: "single",
      header: "One guest",
      align: "end",
      sortValue: (t) => t.singleGuestPriceRwf ?? t.basePriceRwf,
      cell: (t) =>
        t.singleGuestPriceRwf ? <Money value={t.singleGuestPriceRwf} /> : <span className="text-muted">Same</span>,
    },
    { id: "stay", header: "Stay", hideBelow: "lg", cell: (t) => stayWords(t) },
    {
      id: "weekly",
      header: "Weekly",
      align: "end",
      hideBelow: "lg",
      cell: (t) => (t.weeklyDiscountPct ? `${t.weeklyDiscountPct}% off` : <span className="text-muted">None</span>),
    },
    {
      id: "monthly",
      header: "Monthly",
      align: "end",
      hideBelow: "lg",
      cell: (t) => (t.monthlyDiscountPct ? `${t.monthlyDiscountPct}% off` : <span className="text-muted">None</span>),
    },
  ];

  const specialColumns: DataColumn<RatesSpecialRange>[] = [
    {
      id: "dates",
      header: "Dates",
      isRowHeader: true,
      sortValue: (r) => r.from,
      cell: (r) => <span className="whitespace-nowrap tabular">{formatRange(r.from, r.to)}</span>,
    },
    { id: "type", header: "Room type", sortValue: (r) => r.roomTypeName, cell: (r) => r.roomTypeName },
    {
      id: "what",
      header: "Price",
      align: "end",
      cell: (r) =>
        r.closed ? (
          <StatusChip tone="danger">Closed</StatusChip>
        ) : r.priceRwf ? (
          <Money value={r.priceRwf} />
        ) : (
          <span className="text-muted">Usual</span>
        ),
    },
    {
      id: "min",
      header: "Shortest stay",
      hideBelow: "lg",
      cell: (r) => (r.minNights ? nightsWords(r.minNights) : <span className="text-muted">Usual</span>),
    },
  ];

  return (
    <PageContent>
      <AreaHeader
        actions={
          <ActionButton intent="primary" icon="Plus" onPress={() => setSpecial("new")}>
            Add special dates
          </ActionButton>
        }
      />

      <DataTable
        label="Room prices"
        noun={{ one: "room type", many: "room types" }}
        rows={roomTypes}
        rowKey={(t) => t.id}
        columns={columns}
        onRowAction={setEditing}
        rowActions={(t) => (
          <RowActions>
            <IconAction icon="Pencil" label={`Edit ${t.name}`} onPress={() => setEditing(t)} />
          </RowActions>
        )}
        mobile={{
          title: (t) => t.name,
          description: (t) =>
            `${formatMoney(t.basePriceRwf)} a night${perGuest(t) ? " a guest" : ""}${
              t.singleGuestPriceRwf ? `, one guest ${formatMoney(t.singleGuestPriceRwf)}` : ""
            }`,
        }}
      />

      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Special dates"
          action={
            <Segment
              aria-label="Show special dates as"
              size="sm"
              selectedKey={view}
              onSelectionChange={(k) => setView(k === "calendar" ? "calendar" : "list")}
            >
              <Segment.Item id="list">List</Segment.Item>
              <Segment.Item id="calendar">Calendar</Segment.Item>
            </Segment>
          }
        />
        {view === "list" ? (
          <DataTable
            label="Special dates"
            noun={{ one: "special date", many: "special dates" }}
            rows={ranges}
            rowKey={rangeKey}
            columns={specialColumns}
            defaultSort={{ column: "dates", direction: "ascending" }}
            onRowAction={setSpecial}
            rowActions={(r) => (
              <RowActions>
                <IconAction icon="Pencil" label={`Edit ${formatRange(r.from, r.to)}`} onPress={() => setSpecial(r)} />
              </RowActions>
            )}
            mobile={{
              title: (r) => formatRange(r.from, r.to),
              description: (r) => `${r.roomTypeName}, ${rangeWords(r)}`,
            }}
            empty={
              <EmptyBlock
                size="sm"
                icon="Calendar"
                title="No special dates"
                description="Give holidays their own price, or close days."
                action={
                  <ActionButton icon="Plus" onPress={() => setSpecial("new")}>
                    Add special dates
                  </ActionButton>
                }
              />
            }
          />
        ) : (
          <SpecialCalendar ranges={ranges} today={today} onEdit={setSpecial} />
        )}
      </section>

      {editing ? (
        <TermsPanel key={editing.id} type={editing} longStays={longStays} onClose={() => setEditing(null)} />
      ) : null}
      {special ? (
        <SpecialPanel
          key={special === "new" ? "new" : rangeKey(special)}
          range={special === "new" ? null : special}
          roomTypes={roomTypes}
          today={today}
          onClose={() => setSpecial(null)}
        />
      ) : null}
    </PageContent>
  );
}

/** Special dates on the Agenda: a bar per run, its room type and its price or Closed. */
function SpecialCalendar({
  ranges,
  today,
  onEdit,
}: {
  ranges: RatesSpecialRange[];
  today: string;
  onEdit: (r: RatesSpecialRange) => void;
}) {
  const events = useMemo<ScheduleEvent[]>(
    () =>
      ranges.map((r) => ({
        id: rangeKey(r),
        kind: r.closed ? "closed" : r.priceRwf ? "price" : "min",
        title: `${r.roomTypeName} · ${
          r.closed
            ? "Closed"
            : r.priceRwf
              ? formatMoney(r.priceRwf, { compact: true })
              : `${formatNumber(r.minNights ?? 1)}+ nights`
        }`,
        heading: r.roomTypeName,
        start: r.from,
        end: r.to,
        details: [
          { label: "Price", value: r.closed ? "Closed" : r.priceRwf ? formatMoney(r.priceRwf) : "Usual" },
          ...(r.minNights ? [{ label: "Shortest stay", value: nightsWords(r.minNights) }] : []),
        ],
        actions: (
          <ActionButton size="sm" icon="Pencil" onPress={() => onEdit(r)}>
            Edit
          </ActionButton>
        ),
      })),
    [ranges, onEdit],
  );
  return <Schedule label="Special dates" events={events} kinds={KINDS} today={today} />;
}

const num = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** A room type's price, one guest price, stay bounds and discounts. */
function TermsPanel({ type, longStays, onClose }: { type: RatesRoomType; longStays: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const [base, setBase] = useState<number | null>(type.basePriceRwf || null);
  const [single, setSingle] = useState<number | null>(type.singleGuestPriceRwf ?? null);
  const [min, setMin] = useState(type.minStay ? String(type.minStay) : "");
  const [max, setMax] = useState(type.maxStay ? String(type.maxStay) : "");
  const [weekly, setWeekly] = useState(type.weeklyDiscountPct ? String(type.weeklyDiscountPct) : "");
  const [monthly, setMonthly] = useState(type.monthlyDiscountPct ? String(type.monthlyDiscountPct) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const perRoom = !perGuest(type);

  const save = () => {
    const next: Record<string, string> = {};
    if (!base) next.base = "Set a price a night.";
    if (perRoom && single && base && single >= base)
      next.single = "Make it less than the room price, or leave it empty.";
    const lo = num(min);
    const hi = num(max);
    if (lo && hi && lo > hi) next.max = "The longest stay is shorter than the shortest.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    start(async () => {
      const r = await saveRatesTerms({
        roomTypeId: type.id,
        basePriceRwf: base ?? undefined,
        ...(perRoom ? { singleGuestPriceRwf: single || null } : {}),
        minStay: lo,
        maxStay: hi,
        weeklyDiscountPct: num(weekly),
        monthlyDiscountPct: num(monthly),
      });
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      toast.success(`${type.name} saved`);
      onClose();
      router.refresh();
    });
  };

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => (o ? undefined : onClose())}
      title={type.name}
      description={`${formatNumber(type.rooms)} ${type.rooms === 1 ? "room" : "rooms"}`}
      submitLabel="Save"
      isPending={saving}
      validationErrors={errors}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <MoneyInput
          label={perRoom ? "Price a night" : "Price a night, a guest"}
          value={base}
          onChange={setBase}
          minValue={1}
          isRequired
          errorMessage={errors.base}
        />
        {perRoom ? (
          <MoneyInput
            label="One guest"
            value={single}
            onChange={setSingle}
            minValue={1}
            placeholder="Same price"
            errorMessage={errors.single}
          />
        ) : null}
        <NumberText label="Shortest stay" value={min} onChange={setMin} placeholder="1" suffix="nights" />
        <NumberText
          label="Longest stay"
          value={max}
          onChange={setMax}
          placeholder={longStays ? "365" : "90"}
          suffix="nights"
          error={errors.max}
        />
        <NumberText
          label="Weekly discount"
          value={weekly}
          onChange={setWeekly}
          placeholder="0"
          suffix="%"
          hint="7 nights or more"
        />
        <NumberText
          label="Monthly discount"
          value={monthly}
          onChange={setMonthly}
          placeholder="0"
          suffix="%"
          hint="28 nights or more"
        />
      </div>
    </SidePanel>
  );
}

function NumberText({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix: string;
  hint?: string;
  error?: string;
}) {
  return (
    <TextField value={value} onChange={onChange} isInvalid={Boolean(error)} className="flex flex-col gap-1">
      <Label>
        {label} <span className="font-normal text-muted">({suffix})</span>
      </Label>
      <Input inputMode="decimal" className="tabular" placeholder={placeholder} />
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <Description className="text-xs">{hint}</Description>
      ) : null}
    </TextField>
  );
}

/** Add special dates, or change or remove a run: its own price or closed, and a shortest stay. */
function SpecialPanel({
  range,
  roomTypes,
  today,
  onClose,
}: {
  range: RatesSpecialRange | null;
  roomTypes: RatesRoomType[];
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const [typeId, setTypeId] = useState(range?.roomTypeId ?? "all");
  const [days, setDays] = useState<DayRange | null>(range ? { start: range.from, end: range.to } : null);
  const [mode, setMode] = useState<"price" | "closed">(range?.closed ? "closed" : "price");
  const [price, setPrice] = useState<number | null>(range?.priceRwf ?? null);
  const [min, setMin] = useState(range?.minNights ? String(range.minNights) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ids = typeId === "all" ? roomTypes.map((t) => t.id) : [typeId];

  const run = (work: () => Promise<string | null>, done: string) =>
    start(async () => {
      const problem = await work();
      if (problem) {
        toast.danger(problem);
        return;
      }
      toast.success(done);
      onClose();
      router.refresh();
    });

  // Clearing a run: its price, closing and shortest stay back to the room type's own.
  const clear = async (r: RatesSpecialRange) => {
    const res = await saveRatesDays({
      roomTypeId: r.roomTypeId,
      from: r.from,
      to: r.to,
      priceRwf: null,
      closed: false,
      minNights: null,
    });
    return res.ok ? null : res.error;
  };

  const save = () => {
    const next: Record<string, string> = {};
    if (!days) next.days = "Choose the first and the last day.";
    if (mode === "price" && !price && !num(min)) next.price = "Set a price, or a shortest stay.";
    setErrors(next);
    if (!days || Object.keys(next).length > 0) return;
    run(
      async () => {
        if (range) {
          const problem = await clear(range);
          if (problem) return problem;
        }
        for (const id of ids) {
          const res = await saveRatesDays({
            roomTypeId: id,
            from: days.start,
            to: days.end,
            priceRwf: mode === "closed" ? null : (price ?? null),
            closed: mode === "closed",
            minNights: num(min),
          });
          if (!res.ok) return res.error;
        }
        return null;
      },
      `${formatRange(days.start, days.end)} saved`,
    );
  };

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => (o ? undefined : onClose())}
      title={range ? "Special dates" : "Add special dates"}
      description={range ? `${range.roomTypeName}, ${formatRange(range.from, range.to)}` : undefined}
      footer={
        <>
          {range ? (
            <ActionButton
              intent="danger-soft"
              isDisabled={saving}
              className="mr-auto"
              onPress={() => run(() => clear(range), "Back to the usual price")}
            >
              Remove
            </ActionButton>
          ) : null}
          <ActionButton isDisabled={saving} onPress={onClose}>
            Cancel
          </ActionButton>
          <ActionButton intent="primary" isPending={saving} onPress={save}>
            Save
          </ActionButton>
        </>
      }
    >
      <SelectField
        label="Room type"
        value={typeId}
        onChange={setTypeId}
        isDisabled={Boolean(range)}
        options={[
          ...(range ? [] : [{ id: "all", label: "All room types" }]),
          ...roomTypes.map((t) => ({ id: t.id, label: t.name })),
        ]}
      />
      <BoundedDateRangePicker
        label="Dates"
        value={days}
        onChange={(v) => {
          setDays(v);
          setErrors((e) => ({ ...e, days: "" }));
        }}
        minValue={today}
        isRequired
        errorMessage={errors.days || null}
      />
      <RadioButtonGroup
        aria-label="These days"
        layout="grid"
        value={mode}
        onChange={(v) => setMode(v === "closed" ? "closed" : "price")}
        className="grid-cols-2 gap-2.5"
      >
        {(
          [
            { id: "price", title: "Own price" },
            { id: "closed", title: "Closed" },
          ] as const
        ).map((m) => (
          <RadioButtonGroup.Item key={m.id} value={m.id} className="px-3.5 py-3">
            <RadioButtonGroup.Indicator>
              <Icon name="CircleCheckFill" />
            </RadioButtonGroup.Indicator>
            <RadioButtonGroup.ItemContent>
              <Label className="font-semibold">{m.title}</Label>
            </RadioButtonGroup.ItemContent>
          </RadioButtonGroup.Item>
        ))}
      </RadioButtonGroup>
      {mode === "price" ? (
        <MoneyInput
          label="Price a night"
          value={price}
          onChange={(v) => {
            setPrice(v);
            setErrors((e) => ({ ...e, price: "" }));
          }}
          minValue={1}
          errorMessage={errors.price || null}
        />
      ) : null}
      <NumberText
        label="Shortest stay arriving then"
        value={min}
        onChange={setMin}
        placeholder="Usual"
        suffix="nights"
      />
    </SidePanel>
  );
}
