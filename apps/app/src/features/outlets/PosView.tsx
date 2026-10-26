"use client";

import {
  Ban,
  Boxes3,
  Check,
  Cherry,
  CirclePause,
  CreditCard,
  Flame,
  Key,
  Lock,
  PaperPlane,
  Receipt,
  Sliders,
  TriangleExclamation,
  Wallet,
} from "@gravity-ui/icons";
import { Avatar, Button, Chip, ListBox, SearchField, Tabs, Toast, toast } from "@heroui/react";
import { EmptyState, Segment } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  LineDraft,
  MenuCategory,
  MenuItem,
  OutletTone,
  PosPlace,
  RoomChargeTarget,
  TicketLine,
  TicketLineStatus,
} from "@injishi/data/fixtures/outlets";
import { LinkButton, StatusDot, toneColor } from "@injishi/ui";
import { type ReactNode, useMemo, useState } from "react";
import { BrandMark } from "@/components/brand";
import { type OptionChoices, optionsSummary, optionsUnitPrice, PosOptionsDialog } from "./PosOptionsDialog";
import { PosRoomChargeDialog } from "./PosRoomChargeDialog";
import { firstKey, money, RegionOverlays } from "./shared";

interface PosData {
  places: PosPlace[];
  menuItems: MenuItem[];
  /** Categories of the dinner menu, in menu order. */
  categories: MenuCategory[];
  lines: TicketLine[];
  /** A dish being configured when the till opens (its options dialog is open). */
  draft: LineDraft | null;
  roomCharges: RoomChargeTarget[];
}

/** Till clock in the header. */
const CLOCK = "19:48";
/** Time stamped on lines sent to the kitchen from this screen. */
const NOW = "19:49";

const STATUS: Record<TicketLineStatus, { label: (l: TicketLine) => string; tone: OutletTone }> = {
  sent: { label: (l) => `Sent ${l.sentAt ?? NOW}`, tone: "default" },
  fired: { label: (l) => `Sent ${l.sentAt ?? NOW}`, tone: "default" },
  new: { label: () => "New · not sent", tone: "accent" },
  held: { label: () => "Held · fire later", tone: "warning" },
  voidreq: { label: () => "Void requested · supervisor", tone: "danger" },
};

const seatName = (k: string) => (k === "S" ? "Shared" : `Seat ${k}`);
const isOpenLine = (l: TicketLine) => l.status === "new" || l.status === "held";

/** Chips under a dish: stock running low, sold out, diet. */
function DishTags({ item }: { item: MenuItem }) {
  const tags: ReactNode[] = [];
  if (item.soldOut)
    tags.push(
      <Chip key="out" size="sm" variant="soft" color="danger">
        <Ban className="m-0 size-3" />
        <Chip.Label>Sold out</Chip.Label>
      </Chip>,
    );
  else if (item.portionsLeft)
    tags.push(
      <Chip key="left" size="sm" variant="soft" color="warning">
        <Boxes3 className="m-0 size-3" />
        <Chip.Label>{item.portionsLeft} left</Chip.Label>
      </Chip>,
    );
  if (item.diet)
    tags.push(
      <Chip key="diet" size="sm" variant="soft" color="success">
        <Cherry className="m-0 size-3" />
        <Chip.Label>{item.diet}</Chip.Label>
      </Chip>,
    );
  if (item.optionGroups?.length)
    tags.push(
      <Chip key="opts" size="sm" variant="soft">
        <Sliders className="m-0 size-3" />
        <Chip.Label>Options</Chip.Label>
      </Chip>,
    );
  return tags.length ? <span className="flex flex-wrap gap-[6px]">{tags}</span> : null;
}

/** Waiter's POS: tables and rooms, the dinner menu and the open ticket split by seat (artifact: POS). */
export function PosView({ persona, data }: { persona: Persona; data: PosData }) {
  const itemsById = useMemo(() => new Map(data.menuItems.map((m) => [m.id, m])), [data.menuItems]);
  const draftItem = data.draft ? itemsById.get(data.draft.item) : undefined;

  const [rail, setRail] = useState<PosPlace["rail"]>(
    () => data.places.find((p) => p.id === data.draft?.place)?.rail ?? "tables",
  );
  const [placeId, setPlaceId] = useState(data.draft?.place ?? data.places[0]?.id ?? "");
  const [cat, setCat] = useState(
    () => data.categories.find((c) => c.id === "mains")?.id ?? data.categories[0]?.id ?? "",
  );
  const [query, setQuery] = useState("");
  const [seat, setSeat] = useState(data.draft?.seat ?? "1");
  const [lines, setLines] = useState(data.lines);
  const [nextId, setNextId] = useState(1);

  const [optionsItem, setOptionsItem] = useState<MenuItem | undefined>(draftItem);
  const [optionsOpen, setOptionsOpen] = useState(Boolean(draftItem));
  const [choices, setChoices] = useState<OptionChoices>({
    side: data.draft?.side ?? "",
    spice: data.draft?.spice ?? "",
    extras: data.draft?.extras ?? [],
    note: data.draft?.note ?? "",
    allergy: data.draft?.allergy ?? false,
    qty: data.draft?.qty ?? 1,
  });
  const [roomOpen, setRoomOpen] = useState(false);

  const place = data.places.find((p) => p.id === placeId) ?? data.places[0];
  if (!place) return null;
  const isRoom = place.rail === "rooms";
  const seats = [...Array.from({ length: Math.max(1, place.seats) }, (_, i) => String(i + 1)), "S"];
  const seatKey = seats.includes(seat) ? seat : (seats[0] ?? "S");

  // Menu: the chosen category, or every dish matching the search.
  const q = query.trim().toLowerCase();
  const category = data.categories.find((c) => c.id === cat);
  const dishIds = q ? [...new Set(data.categories.flatMap((c) => c.items))] : (category?.items ?? []);
  const dishes = dishIds
    .map((id) => itemsById.get(id))
    .filter((m): m is MenuItem => Boolean(m) && (!q || (m?.name.toLowerCase().includes(q) ?? false)));

  // Ticket for the selected table or room.
  const ticket = lines.filter((l) => l.place === place.id);
  const live = ticket.filter((l) => l.status !== "voidreq");
  const total = live.reduce((a, l) => a + l.qty * l.price, 0);
  const count = live.reduce((a, l) => a + l.qty, 0);
  const openCount = ticket.filter(isOpenLine).length;
  const groups = seats
    .map((k) => {
      const ls = ticket.filter((l) => l.seat === k);
      const sum = ls.filter((l) => l.status !== "voidreq").reduce((a, l) => a + l.qty * l.price, 0);
      return { key: k, label: seatName(k), lines: ls, sum };
    })
    .filter((g) => g.lines.length > 0);

  const title = isRoom
    ? `Room service · ${place.no}`
    : `Table ${place.no.slice(1)}${place.order ? ` · order ${place.order}` : ""}`;
  const meta = isRoom ? `${place.status} · ${place.meta}` : place.meta;
  const short = isRoom ? `room ${place.no}` : `table ${place.no.slice(1)}`;
  const tillRole = persona.id === "waiter" ? "Waiter" : persona.role;

  const update = (next: TicketLine[]) => setLines(next);
  const addLine = (line: Omit<TicketLine, "id" | "place">) => {
    setLines((ls) => [...ls, { ...line, id: `new-${nextId}`, place: place.id }]);
    setNextId((n) => n + 1);
  };

  const tapDish = (m: MenuItem) => {
    if (m.optionGroups?.length) {
      if (m.id !== optionsItem?.id) {
        const first = (g: "side" | "spice") => m.optionGroups?.find((x) => x.id === g)?.options[0]?.id ?? "";
        setChoices({ side: first("side"), spice: first("spice"), extras: [], note: "", allergy: false, qty: 1 });
      } else setChoices((c) => ({ ...c, qty: 1 }));
      setOptionsItem(m);
      setOptionsOpen(true);
      return;
    }
    addLine({ seat: seatKey, item: m.id, name: m.name, qty: 1, price: m.price, mods: "", status: "new" });
  };

  const addFromOptions = () => {
    if (!optionsItem) return;
    const note = choices.allergy && choices.note ? `Allergy · ${choices.note}` : choices.note;
    addLine({
      seat: seatKey,
      item: optionsItem.id,
      name: optionsItem.name,
      qty: choices.qty,
      price: optionsUnitPrice(optionsItem, choices),
      mods: optionsSummary(optionsItem, choices),
      note: note || undefined,
      status: "new",
    });
    setOptionsOpen(false);
  };

  const hold = () => {
    update(lines.map((l) => (l.place === place.id && l.status === "new" ? { ...l, status: "held" } : l)));
    toast("New items held · send when the table is ready", { indicator: <Check /> });
  };
  const send = () => {
    update(lines.map((l) => (l.place === place.id && isOpenLine(l) ? { ...l, status: "sent", sentAt: NOW } : l)));
    toast(`${openCount} item${openCount === 1 ? "" : "s"} sent · Grill and Cold stations acknowledged`, {
      indicator: <Check />,
    });
  };
  const lineAction = (l: TicketLine) => {
    if (isOpenLine(l)) update(lines.filter((x) => x.id !== l.id));
    else update(lines.map((x) => (x.id === l.id ? { ...x, status: "voidreq" } : x)));
  };

  return (
    <div className="@container relative flex h-full min-h-0 w-full flex-1 flex-col bg-background text-[14px] text-foreground">
      <header className="flex flex-none items-center gap-[12px] bg-surface px-[16px] py-[10px] shadow-[0_1px_0_var(--separator)]">
        <BrandMark size={28} />
        <div className="flex min-w-0 flex-col">
          <span className="text-[15px] leading-5 font-semibold">Isangano Terrace · POS</span>
          <span className="truncate text-[12px] leading-4 text-muted">
            Merchant Amahoro Hospitality Ltd · TIN 102 345 678 · EBM device SDC-ISG-02
          </span>
        </div>
        <span className="flex-1" />
        <Chip size="sm" variant="soft" color="success" className="shrink-0">
          <StatusDot tone="success" />
          <Chip.Label>Online · VSDC connected</Chip.Label>
        </Chip>
        <Chip size="sm" variant="soft" className="shrink-0">
          <Wallet className="size-3" />
          <Chip.Label>Shift open · Till 2</Chip.Label>
        </Chip>
        <LinkButton href={screenHref("KitchenDisplay")} variant="ghost" size="sm" className="shrink-0">
          <Flame className="size-4" />
          Kitchen
        </LinkButton>
        <span className="flex shrink-0 items-center gap-[8px]">
          <Avatar size="sm" variant="soft" color="accent">
            <Avatar.Fallback>{persona.initials}</Avatar.Fallback>
          </Avatar>
          <span className="flex flex-col">
            <span className="text-[13px] leading-[18px] font-semibold">{persona.name}</span>
            <span className="text-[12px] leading-4 text-muted">
              {tillRole} · {CLOCK}
            </span>
          </span>
        </span>
        <Button variant="ghost" size="sm" isIconOnly aria-label="Lock the till">
          <Lock className="size-4" />
        </Button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside
          aria-label="Tables and rooms"
          className="flex w-[232px] flex-none flex-col gap-[10px] bg-background p-[12px] @max-[1099.98px]:w-[188px] @max-[899.98px]:w-[156px] @max-[899.98px]:px-[8px]"
        >
          <Segment
            aria-label="Show"
            selectedKey={rail}
            onSelectionChange={(k) => setRail(k === "rooms" ? "rooms" : "tables")}
            className="w-full"
          >
            <Segment.Item id="tables" className="flex-1">
              Tables
            </Segment.Item>
            <Segment.Item id="rooms" className="flex-1">
              Rooms
            </Segment.Item>
          </Segment>
          <ListBox
            aria-label={rail === "tables" ? "Tables" : "Rooms"}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([place.id])}
            onSelectionChange={(keys) => {
              const k = firstKey(keys);
              if (k) setPlaceId(k);
            }}
            className="min-h-0 overflow-y-auto p-0"
          >
            {data.places
              .filter((p) => p.rail === rail)
              .map((p) => (
                <ListBox.Item
                  key={p.id}
                  id={p.id}
                  textValue={`${p.no} ${p.status}`}
                  className="min-h-[54px] gap-[10px] rounded-[12px] px-[10px] py-[6px] data-[selected=true]:bg-default"
                >
                  <span className="min-w-[34px] text-[15px] font-semibold tabular">{p.no}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px] leading-[18px] font-medium">{p.status}</span>
                    <span className="truncate text-[12px] leading-4 text-muted">{p.meta}</span>
                  </span>
                  <StatusDot tone={p.tone} />
                </ListBox.Item>
              ))}
          </ListBox>
          <p className="mt-auto text-[12px] leading-4 text-muted @max-[899.98px]:hidden">
            Dot and label both show status. Rooms list only guests with an active stay.
          </p>
        </aside>

        <section
          aria-labelledby="menu-h"
          className="flex min-w-0 flex-1 flex-col gap-[12px] bg-surface-secondary px-[16px] py-[12px]"
        >
          <div className="flex items-center gap-[10px]">
            <h2 id="menu-h" className="sr-only">
              Menu
            </h2>
            <SearchField aria-label="Search the menu" value={query} onChange={setQuery} className="flex-1">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search dishes or codes" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <Chip size="sm" variant="soft" className="shrink-0">
              Dinner menu · v14
            </Chip>
          </div>
          <Tabs variant="secondary" selectedKey={cat} onSelectionChange={(k) => setCat(String(k))}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Menu categories">
                {data.categories.map((c) => (
                  <Tabs.Tab key={c.id} id={c.id} className="h-[44px] w-auto whitespace-nowrap">
                    {c.label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          <div className="grid min-h-0 grid-cols-4 content-start gap-[10px] overflow-y-auto p-[2px] @max-[899.98px]:grid-cols-3">
            {dishes.map((m) => (
              <Button
                key={m.id}
                variant="tertiary"
                isDisabled={m.soldOut}
                aria-label={`${m.name}, ${money(m.price)}${m.soldOut ? ", sold out" : ""}${m.optionGroups?.length ? ", has options" : ""}`}
                onPress={() => tapDish(m)}
                className="h-auto min-h-[108px] w-full flex-col items-start justify-start gap-[4px] rounded-[18px] p-[14px] text-left whitespace-normal shadow-[var(--surface-shadow)] [--button-bg-hover:var(--surface-hover)] [--button-bg-pressed:var(--surface-hover)] [--button-bg:var(--surface)] [--button-fg:var(--foreground)]"
              >
                <span className="text-[14px] leading-[19px] font-semibold">{m.name}</span>
                <span className="text-[13px] font-normal text-muted tabular">{money(m.price)}</span>
                <span className="flex-1" />
                <DishTags item={m} />
              </Button>
            ))}
            {dishes.length === 0 ? (
              <p className="col-span-full py-[24px] text-center text-[13px] text-muted">
                No dish matches “{query.trim()}”.
              </p>
            ) : null}
          </div>
          <p className="mt-auto text-[12px] leading-4 text-muted">
            Stock counts come from the store ledger. Coffee is sold by Ikawa Corner, a separate merchant, and is not on
            this till.
          </p>
        </section>

        <aside
          aria-labelledby="ticket-h"
          className="flex w-[372px] flex-none flex-col bg-surface shadow-[-1px_0_0_var(--separator)] @max-[1099.98px]:w-[320px] @max-[899.98px]:w-[290px]"
        >
          <div className="flex flex-col gap-[8px] px-[16px] pt-[14px] pb-[10px]">
            <div className="flex items-start justify-between gap-[8px]">
              <div className="flex min-w-0 flex-col">
                <h2 id="ticket-h" className="text-[17px] leading-6 font-semibold tabular">
                  {title}
                </h2>
                <span className="text-[12px] leading-4 text-muted">{meta}</span>
              </div>
              <Chip variant="soft" color={openCount ? "accent" : "default"} className="shrink-0">
                {!ticket.length ? "Empty" : openCount ? `${openCount} not sent` : "All sent"}
              </Chip>
            </div>
            <div className="flex items-center gap-[8px]">
              <span className="text-[12px] text-muted">Add to</span>
              <Segment
                size="sm"
                aria-label="Seat for new items"
                selectedKey={seatKey}
                onSelectionChange={(k) => setSeat(String(k))}
              >
                {seats.map((k) => (
                  <Segment.Item key={k} id={k} className="px-[10px]">
                    {k === "S" ? "Shared" : k}
                  </Segment.Item>
                ))}
              </Segment>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-[6px] overflow-y-auto px-[12px] pb-[8px]">
            {!ticket.length ? (
              <EmptyState size="sm" className="mt-[40px]">
                <EmptyState.Header>
                  <EmptyState.Media variant="icon">
                    <Receipt />
                  </EmptyState.Media>
                  <EmptyState.Title>No open ticket</EmptyState.Title>
                  <EmptyState.Description>Tap a dish to start a ticket for {short}.</EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            ) : null}
            {groups.map((g) => (
              <section key={g.key} aria-label={g.label} className="flex flex-col gap-[4px]">
                <div className="flex items-center justify-between px-[4px] pt-[6px]">
                  <span className="text-[12px] font-semibold text-muted">{g.label}</span>
                  <span className="text-[12px] text-muted tabular">{money(g.sum)}</span>
                </div>
                {g.lines.map((l) => {
                  const st = STATUS[l.status];
                  const open = isOpenLine(l);
                  const voidable = l.status === "sent" || l.status === "fired";
                  return (
                    <div
                      key={l.id}
                      className="flex items-start gap-[10px] rounded-[12px] bg-surface-secondary px-[10px] py-[8px]"
                    >
                      <span className="min-w-[22px] font-semibold tabular">{l.qty}×</span>
                      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                        <span className="leading-[18px] font-medium">{l.name}</span>
                        {l.mods ? <span className="text-[12px] leading-4 text-muted">{l.mods}</span> : null}
                        {l.note ? (
                          <span className="flex items-start gap-[4px] text-[12px] leading-4 font-semibold text-danger-soft-foreground">
                            <TriangleExclamation className="mt-[2px] size-3 shrink-0" aria-hidden="true" />
                            {l.note}
                          </span>
                        ) : null}
                        <span>
                          <Chip size="sm" variant="soft" color={toneColor(st.tone)}>
                            {st.label(l)}
                          </Chip>
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-[2px]">
                        <span className="font-medium tabular">{money(l.qty * l.price)}</span>
                        {open || voidable ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`${open ? "Remove" : "Request void of"} ${l.name}`}
                            onPress={() => lineAction(l)}
                          >
                            {open ? "Remove" : "Void"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>

          <div className="flex flex-col gap-[8px] px-[16px] pt-[10px] pb-[14px] shadow-[0_-1px_0_var(--separator)]">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted">Subtotal · {count} items</span>
              <span className="tabular">{money(total)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted">VAT 18% included · tax class B</span>
              <span className="text-muted tabular">{money((total * 18) / 118)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold">Total</span>
              <span className="text-[20px] leading-[26px] font-semibold tabular">{money(total)}</span>
            </div>
            <p className="text-[11px] leading-[14px] text-muted">
              Tax from the item class set in the menu (rule v2026.3, from 1 Jul 2026). Prices include VAT.
            </p>
            <div className="grid grid-cols-2 gap-[8px]">
              <Button variant="secondary" size="lg" fullWidth isDisabled={openCount === 0} onPress={hold}>
                <CirclePause className="size-4" />
                Hold
              </Button>
              <Button size="lg" fullWidth isDisabled={openCount === 0} onPress={send}>
                <PaperPlane className="size-4" />
                {openCount ? `Send ${openCount} to kitchen` : "Send to kitchen"}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                isDisabled={!ticket.length}
                onPress={() => setRoomOpen(true)}
              >
                <Key className="size-4" />
                Charge to room
              </Button>
              <LinkButton href={screenHref("POSPayment")} size="lg" fullWidth>
                <CreditCard className="size-4" />
                Pay {money(total)}
              </LinkButton>
            </div>
          </div>
        </aside>

        <RegionOverlays>
          {optionsItem ? (
            <PosOptionsDialog
              item={optionsItem}
              isOpen={optionsOpen}
              onOpenChange={setOptionsOpen}
              choices={choices}
              onChange={(patch) => setChoices((c) => ({ ...c, ...patch }))}
              seatLabel={seatName(seatKey)}
              onAdd={addFromOptions}
            />
          ) : null}
          <PosRoomChargeDialog
            isOpen={roomOpen}
            onOpenChange={setRoomOpen}
            total={money(total)}
            targets={data.roomCharges}
          />
          <Toast.Provider placement="bottom" />
        </RegionOverlays>
      </div>
    </div>
  );
}
