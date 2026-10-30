"use client";

import { Button, Card, Chip, Input, Label, Switch, TextField, Toast, toast } from "@heroui/react";
import { addDays, type RatesCalendar, type RatesDay, type RatesRoomType } from "@injishi/contracts";
import {
  ActionButton,
  EmptyBlock,
  FilterMenu,
  formatDay,
  formatMoney,
  formatNumber,
  Icon,
  PageContent,
  SectionCard,
} from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { saveRatesDays, saveRatesTerms } from "./rates-actions";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const compact = (n: number) => formatMoney(n, { compact: true, bare: true });

interface Selection {
  roomTypeId: string;
  from: string;
  to: string;
}

/** How a day reads in its cell: closed, full, or the rooms still free. */
function freeWords(t: RatesRoomType, d: RatesDay): { text: string; tone: "danger" | "warning" | "muted" } {
  if (d.closed) return { text: "Closed", tone: "danger" };
  const free = Math.max(0, t.rooms - d.sold);
  if (free === 0) return { text: "Full", tone: "warning" };
  return { text: `${free} free`, tone: "muted" };
}

/**
 * Prices and availability, by the day (2026-10-29): a row per room type and a column per day, each cell
 * the night's price and how many rooms are still free. Choose a day, then another in the same row, and set
 * the price, close the days, or ask for a shortest stay; each room type's own price, stay bounds and
 * weekly and monthly discounts are below. What is set here is what the guest is quoted and charged.
 */
export function RatesCalendarView({ data, longStays }: { data: RatesCalendar; longStays: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [saving, start] = useTransition();
  const [sel, setSel] = useState<Selection | null>(null);
  const [anchor, setAnchor] = useState<{ roomTypeId: string; day: string } | null>(null);
  const [price, setPrice] = useState("");
  const [closed, setClosed] = useState(false);
  const [minNights, setMinNights] = useState("");
  const days = data.roomTypes[0]?.days.map((d) => d.day) ?? [];

  const move = (by: number) => {
    const from = addDays(data.from, by);
    router.push(`${pathname}?from=${from}`, { scroll: false });
  };

  const pick = (t: RatesRoomType, d: RatesDay) => {
    if (d.day < data.today) return;
    if (anchor && anchor.roomTypeId === t.id && !sel) {
      const [from, to] = anchor.day <= d.day ? [anchor.day, d.day] : [d.day, anchor.day];
      open({ roomTypeId: t.id, from, to }, t);
      setAnchor(null);
      return;
    }
    setAnchor({ roomTypeId: t.id, day: d.day });
    open({ roomTypeId: t.id, from: d.day, to: d.day }, t);
  };

  const open = (s: Selection, t: RatesRoomType) => {
    setSel(s);
    const first = t.days.find((d) => d.day === s.from);
    setPrice(first?.custom ? String(first.priceRwf) : "");
    setClosed(first?.closed ?? false);
    setMinNights(first?.minNights ? String(first.minNights) : "");
  };

  const chosen = sel ? data.roomTypes.find((t) => t.id === sel.roomTypeId) : null;
  const inSel = (t: RatesRoomType, day: string) => sel?.roomTypeId === t.id && day >= sel.from && day <= sel.to;

  const save = (clearPrice = false) => {
    if (!sel) return;
    const typed = Number(price.replace(/[^\d]/g, ""));
    const min = Number(minNights.replace(/[^\d]/g, ""));
    start(async () => {
      const result = await saveRatesDays({
        roomTypeId: sel.roomTypeId,
        from: sel.from,
        to: sel.to,
        priceRwf: clearPrice ? null : typed > 0 ? typed : undefined,
        closed,
        minNights: min > 0 ? min : null,
      });
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      toast.success(
        `${chosen?.name ?? "Room"}: ${sel.from === sel.to ? formatDay(sel.from, "long") : `${formatDay(sel.from, "short")} to ${formatDay(sel.to, "short")}`} saved`,
      );
      setSel(null);
      router.refresh();
    });
  };

  if (data.roomTypes.length === 0) {
    return (
      <PageContent>
        <AreaHeader />
        <EmptyBlock icon="Calendar" title="No rooms to price yet" />
      </PageContent>
    );
  }

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <AreaHeader
        actions={
          <span className="flex items-center gap-1.5">
            <Button isIconOnly size="sm" variant="secondary" aria-label="Two weeks earlier" onPress={() => move(-14)}>
              <Icon name="ChevronLeft" className="size-4" />
            </Button>
            <Button size="sm" variant="secondary" onPress={() => router.push(pathname, { scroll: false })}>
              Today
            </Button>
            <Button isIconOnly size="sm" variant="secondary" aria-label="Two weeks later" onPress={() => move(14)}>
              <Icon name="ChevronRight" className="size-4" />
            </Button>
          </span>
        }
      />

      <Card className="min-w-0 gap-0 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-44 bg-surface px-3 py-2 text-left text-xs font-medium text-muted">
                  {formatDay(data.from, "short")} to {formatDay(days.at(-1) ?? data.to, "short")}
                </th>
                {days.map((d) => (
                  <th
                    key={d}
                    className={cx(
                      "min-w-14 px-1 py-2 text-center text-[11px] font-medium",
                      d === data.today ? "text-accent" : "text-muted",
                    )}
                  >
                    <span className="block">{WEEKDAY.format(new Date(`${d}T12:00:00Z`))}</span>
                    <span className={cx("block text-sm tabular", d === data.today && "font-semibold")}>
                      {Number(d.slice(8))}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.roomTypes.map((t) => (
                <tr key={t.id} className="border-t border-separator">
                  <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left align-middle">
                    <span className="block truncate font-medium">{t.name}</span>
                    <span className="block text-xs font-normal text-muted">
                      {formatNumber(t.rooms)} {t.rooms === 1 ? "room" : "rooms"} · {formatMoney(t.basePriceRwf)}
                    </span>
                  </th>
                  {t.days.map((d) => {
                    const free = freeWords(t, d);
                    const past = d.day < data.today;
                    return (
                      <td key={d.day} className="p-0.5">
                        <button
                          type="button"
                          disabled={past}
                          onClick={() => pick(t, d)}
                          aria-label={`${t.name}, ${formatDay(d.day, "long")}: ${formatMoney(d.priceRwf)}, ${free.text}`}
                          aria-pressed={inSel(t, d.day)}
                          className={cx(
                            "flex h-14 w-full flex-col items-center justify-center rounded-lg border text-center transition-colors",
                            past && "cursor-default opacity-40",
                            !past && "hover:border-accent/60",
                            inSel(t, d.day)
                              ? "border-accent bg-accent-soft"
                              : d.closed
                                ? "border-danger/30 bg-danger-soft/50"
                                : d.custom
                                  ? "border-accent/30 bg-accent-soft/30"
                                  : "border-transparent bg-default/40",
                          )}
                        >
                          <span className={cx("text-[13px] font-semibold tabular", d.custom && "text-accent")}>
                            {compact(d.priceRwf)}
                          </span>
                          <span
                            className={cx(
                              "text-[10px] tabular",
                              free.tone === "danger"
                                ? "text-danger"
                                : free.tone === "warning"
                                  ? "text-warning"
                                  : "text-muted",
                            )}
                          >
                            {free.text}
                          </span>
                          {d.minNights ? <span className="text-[9px] text-muted">{d.minNights}+ nights</span> : null}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-separator px-3 py-2 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-accent-soft ring-1 ring-accent/30" /> Its own price
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-danger-soft ring-1 ring-danger/30" /> Closed
          </span>
          <span>Prices in RWF a night, per guest</span>
        </div>
      </Card>

      {sel && chosen ? (
        <SectionCard
          title={`${chosen.name}, ${
            sel.from === sel.to
              ? formatDay(sel.from, "long")
              : `${formatDay(sel.from, "short")} to ${formatDay(sel.to, "short")}`
          }`}
          description={anchor ? "Choose another day in the row to make it a run of days." : undefined}
          actions={
            <Button isIconOnly size="sm" variant="ghost" aria-label="Close" onPress={() => setSel(null)}>
              <Icon name="Xmark" className="size-4" />
            </Button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField value={price} onChange={setPrice} className="flex flex-col gap-1">
              <Label>Price a night (RWF)</Label>
              <Input inputMode="numeric" className="tabular" placeholder={String(chosen.basePriceRwf)} />
            </TextField>
            <TextField value={minNights} onChange={setMinNights} className="flex flex-col gap-1">
              <Label>Shortest stay arriving then</Label>
              <Input inputMode="numeric" className="tabular" placeholder="Nights" />
            </TextField>
            <div className="flex items-end">
              <Switch isSelected={closed} onChange={setClosed}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <span className="text-sm">Closed to new bookings</span>
                </Switch.Content>
              </Switch>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton intent="primary" icon="CircleCheck" isPending={saving} onPress={() => save(false)}>
              Save
            </ActionButton>
            <ActionButton icon="ArrowRotateLeft" isDisabled={saving} onPress={() => save(true)}>
              Back to {formatMoney(chosen.basePriceRwf)}
            </ActionButton>
          </div>
        </SectionCard>
      ) : null}

      <TermsCard roomTypes={data.roomTypes} longStays={longStays} />
    </PageContent>
  );
}

/** A room type's own price, its stay bounds and its weekly and monthly discounts. */
function TermsCard({ roomTypes, longStays }: { roomTypes: RatesRoomType[]; longStays: boolean }) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const [id, setId] = useState(roomTypes[0]?.id ?? "");
  const t = useMemo(() => roomTypes.find((r) => r.id === id) ?? roomTypes[0], [roomTypes, id]);
  const [base, setBase] = useState(String(t?.basePriceRwf ?? ""));
  const [min, setMin] = useState(String(t?.minStay ?? ""));
  const [max, setMax] = useState(String(t?.maxStay ?? ""));
  const [weekly, setWeekly] = useState(String(t?.weeklyDiscountPct ?? ""));
  const [monthly, setMonthly] = useState(String(t?.monthlyDiscountPct ?? ""));
  if (!t) return null;

  const choose = (next: string) => {
    const r = roomTypes.find((x) => x.id === next);
    setId(next);
    setBase(String(r?.basePriceRwf ?? ""));
    setMin(String(r?.minStay ?? ""));
    setMax(String(r?.maxStay ?? ""));
    setWeekly(String(r?.weeklyDiscountPct ?? ""));
    setMonthly(String(r?.monthlyDiscountPct ?? ""));
  };
  const num = (v: string) => {
    const n = Number(v.replace(/[^\d.]/g, ""));
    return v.trim() === "" ? null : Number.isFinite(n) ? n : null;
  };
  const save = () =>
    start(async () => {
      const result = await saveRatesTerms({
        roomTypeId: t.id,
        basePriceRwf: num(base) ?? undefined,
        minStay: num(min),
        maxStay: num(max),
        weeklyDiscountPct: num(weekly),
        monthlyDiscountPct: num(monthly),
      });
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      toast.success(`${t.name} saved`);
      router.refresh();
    });

  return (
    <SectionCard
      title="Room prices and stays"
      actions={
        roomTypes.length > 1 ? (
          <FilterMenu
            label="Room type"
            name="Room type"
            icon="House"
            options={roomTypes.map((r) => ({ id: r.id, label: r.name }))}
            value={t.id}
            onChange={choose}
          />
        ) : (
          <Chip size="sm">{t.name}</Chip>
        )
      }
    >
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <TextField value={base} onChange={setBase} className="flex flex-col gap-1">
          <Label>Price a night (RWF)</Label>
          <Input inputMode="numeric" className="tabular" />
        </TextField>
        <TextField value={min} onChange={setMin} className="flex flex-col gap-1">
          <Label>Shortest stay (nights)</Label>
          <Input inputMode="numeric" className="tabular" placeholder="1" />
        </TextField>
        <TextField value={max} onChange={setMax} className="flex flex-col gap-1">
          <Label>Longest stay (nights)</Label>
          <Input inputMode="numeric" className="tabular" placeholder={longStays ? "365" : "90"} />
        </TextField>
        <TextField value={weekly} onChange={setWeekly} className="flex flex-col gap-1">
          <Label>Weekly discount (%)</Label>
          <Input inputMode="decimal" className="tabular" placeholder="7 nights or more" />
        </TextField>
        <TextField value={monthly} onChange={setMonthly} className="flex flex-col gap-1">
          <Label>Monthly discount (%)</Label>
          <Input inputMode="decimal" className="tabular" placeholder="28 nights or more" />
        </TextField>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ActionButton intent="primary" icon="CircleCheck" isPending={saving} onPress={save}>
          Save {t.name}
        </ActionButton>
        {num(weekly) || num(monthly) ? (
          <span className="text-xs text-muted">
            A week costs {formatMoney(Math.round((num(base) ?? t.basePriceRwf) * 7 * (1 - (num(weekly) ?? 0) / 100)))},
            a month (30 nights){" "}
            {formatMoney(Math.round((num(base) ?? t.basePriceRwf) * 30 * (1 - (num(monthly) ?? 0) / 100)))}, per guest.
          </span>
        ) : null}
      </div>
    </SectionCard>
  );
}
