"use client";

import { ClockArrowRotateLeft, FolderHouse, Magnifier, PersonPlus } from "@gravity-ui/icons";
import { Button, Chip, Kbd, Table } from "@heroui/react";
import { Command, KPIGroup, Segment } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { type Persona, screenHref } from "@injishi/data";
import type { DeskArrival, DeskFigure, RecentSearch, SearchEntry, SearchGroup } from "@injishi/data/fixtures/shared";
import { formatRwf, Icon, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { Fragment, useEffect, useState } from "react";

interface SearchData {
  figures: DeskFigure[];
  arrivals: DeskArrival[];
  entries: SearchEntry[];
  recent: RecentSearch[];
}

const GROUPS: { id: SearchGroup; label: string }[] = [
  { id: "guests", label: "Guests" },
  { id: "bookings", label: "Bookings" },
  { id: "stays", label: "Stays" },
  { id: "folios", label: "Folios" },
  { id: "actions", label: "Actions" },
];

function splitHit(title: string, q: string) {
  const i = q ? title.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return { pre: title, hit: "", post: "" };
  return { pre: title.slice(0, i), hit: title.slice(i, i + q.length), post: title.slice(i + q.length) };
}

/** Front-desk search palette over Today (artifact: GlobalSearch.dc.html). Opens on “kimani”. */
export function GlobalSearchView({ data }: { persona: Persona; data: SearchData }) {
  const [open, setOpen] = useState(true);
  const [q, setQ] = useState("kimani");
  const [type, setType] = useState("all");
  const query = q.trim();
  const ql = query.toLowerCase();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matches = query
    ? [
        ...data.entries.filter(
          (d) => !d.always && !d.quick && `${d.title} ${d.meta} ${d.keywords}`.toLowerCase().includes(ql),
        ),
        ...data.entries.filter((d) => d.always),
      ]
    : [];
  const groups = query
    ? GROUPS.filter((g) => type === "all" || type === g.id)
        .map((g) => ({ ...g, items: matches.filter((m) => m.group === g.id) }))
        .filter((g) => g.items.length)
    : [{ id: "quick" as const, label: "Quick actions", items: data.entries.filter((d) => d.quick) }];
  let first = true;

  return (
    <PageContent>
      <PageHeader
        eyebrow="Monday 12 October 2026 · Isangano Lakeside Hotel · Morning shift"
        title="Today"
        description="Sarah Kimani is at the desk. 8 more guests arrive today and 3 of their rooms are still being cleaned."
        actions={
          <LinkButton href={screenHref("WalkIn")}>
            <PersonPlus className="size-4" />
            New walk-in
          </LinkButton>
        }
      />

      <section aria-label="Desk figures">
        <KPIGroup className="flex-wrap">
          {data.figures.map((k, i) => (
            <Fragment key={k.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="min-w-[180px] flex-1">
                <KPI.Header>
                  <KPI.Title>{k.label}</KPI.Title>
                </KPI.Header>
                <KPI.Content>
                  <KPI.Value value={k.value} formatOptions={{ maximumFractionDigits: 0 }} className="tabular" />
                </KPI.Content>
                <KPI.Footer>
                  <p className="text-xs text-muted">{k.foot}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Arriving guests">
            <Table.Header>
              <Table.Column isRowHeader>Arriving guest</Table.Column>
              <Table.Column>Room type</Table.Column>
              <Table.Column>Room</Table.Column>
              <Table.Column>Expected</Table.Column>
              <Table.Column className="text-right">Balance</Table.Column>
            </Table.Header>
            <Table.Body>
              {data.arrivals.map((a) => (
                <Table.Row key={a.id} id={a.id}>
                  <Table.Cell>
                    <span className="flex flex-col">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-xs text-muted">
                        {a.booking} · {a.nights}
                      </span>
                    </span>
                  </Table.Cell>
                  <Table.Cell>{a.roomType}</Table.Cell>
                  <Table.Cell className="tabular">{a.room ?? "—"}</Table.Cell>
                  <Table.Cell>{a.expected}</Table.Cell>
                  <Table.Cell className="text-right tabular">{formatRwf(a.balance)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <Command>
        <Command.Backdrop isOpen={open} onOpenChange={setOpen} isDismissable>
          <Command.Container size="lg">
            <Command.Dialog
              aria-labelledby="cmd-title"
              inputValue={q}
              onInputChange={setQ}
              filter={() => true}
              className="max-w-[700px]"
            >
              <h2 id="cmd-title" className="sr-only">
                Search Isangano Lakeside Hotel
              </h2>
              <Command.Header className="flex flex-wrap items-center gap-2 px-3 pt-2.5">
                <Chip variant="soft" color="accent">
                  <FolderHouse className="size-3.5" />
                  <Chip.Label>Isangano Lakeside Hotel</Chip.Label>
                </Chip>
                <span className="flex-1" />
                <Segment aria-label="Result type" selectedKey={type} onSelectionChange={(k) => setType(String(k))}>
                  <Segment.Item id="all">All</Segment.Item>
                  {GROUPS.map((g) => (
                    <Segment.Item key={g.id} id={g.id}>
                      {g.label}
                    </Segment.Item>
                  ))}
                </Segment>
              </Command.Header>
              <Command.InputGroup>
                <Command.InputGroup.Prefix>
                  <Magnifier className="size-4" aria-hidden="true" />
                </Command.InputGroup.Prefix>
                <Command.InputGroup.Input
                  placeholder="Search guests, bookings, stays, folios…"
                  aria-label="Search guests, bookings, stays and folios"
                />
                {query ? <Command.InputGroup.ClearButton aria-label="Clear search" /> : null}
                <Command.InputGroup.Suffix>
                  <Button variant="ghost" size="sm" aria-label="Close search" onPress={() => setOpen(false)}>
                    <Kbd>Esc</Kbd>
                  </Button>
                </Command.InputGroup.Suffix>
              </Command.InputGroup>
              <div className="flex flex-wrap items-center gap-1.5 px-3.5 pt-2.5">
                <span className="text-xs text-muted">Recent</span>
                {data.recent.map((r) => (
                  <Button
                    key={r.id}
                    size="sm"
                    variant="tertiary"
                    onPress={() => {
                      setQ(r.q);
                      setType("all");
                    }}
                  >
                    <ClockArrowRotateLeft className="size-3" />
                    {r.q}
                  </Button>
                ))}
              </div>
              <Command.List
                aria-label="Results"
                className="max-h-[560px]"
                renderEmptyState={() =>
                  query ? (
                    <div className="flex flex-col items-center gap-1 px-4 py-7 text-center">
                      <span className="font-semibold">No matches for “{query}”</span>
                      <span className="text-muted">
                        Try a booking number such as BK-20431, a guest’s phone number or a room number.
                      </span>
                    </div>
                  ) : null
                }
              >
                {groups.map((g) => (
                  <Command.Group
                    key={g.id}
                    heading={
                      <span className="flex items-center justify-between gap-3">
                        <span>{g.label}</span>
                        {query ? <span className="tabular">{g.items.length}</span> : null}
                      </span>
                    }
                  >
                    {g.items.map((it) => {
                      const parts = splitHit(it.title, query);
                      const focused = first;
                      first = false;
                      return (
                        <Command.Item
                          key={it.id}
                          id={it.id}
                          textValue={`${it.title} ${it.meta}`}
                          href={screenHref(it.board)}
                        >
                          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-surface-secondary">
                            <Icon name={it.icon} />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="font-medium">
                              {parts.pre}
                              {parts.hit ? (
                                <mark className="rounded-sm bg-accent-soft text-inherit">{parts.hit}</mark>
                              ) : null}
                              {parts.post}
                            </span>
                            <span className="text-xs leading-4 text-muted">{it.meta}</span>
                          </span>
                          {it.balance != null ? (
                            <span className="flex flex-col items-end">
                              <span className="text-[11px] text-muted">Balance</span>
                              <span className="font-semibold tabular">{formatRwf(it.balance)}</span>
                            </span>
                          ) : null}
                          {it.chip ? (
                            <Chip size="sm" variant="soft" color={toneColor(it.chipTone)}>
                              {it.chip}
                            </Chip>
                          ) : null}
                          {focused ? <Kbd>↵</Kbd> : null}
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                ))}
              </Command.List>
              <Command.Footer className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-3 py-2 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  Move
                </span>
                <span className="inline-flex items-center gap-1">
                  <Kbd>↵</Kbd>
                  Open
                </span>
                <span className="inline-flex items-center gap-1">
                  <Kbd>⌘↵</Kbd>
                  Run action
                </span>
                <span className="inline-flex items-center gap-1">
                  <Kbd>Tab</Kbd>
                  Type
                </span>
                <span className="inline-flex items-center gap-1">
                  <Kbd>Esc</Kbd>
                  Close
                </span>
                <span className="flex-1" />
                <span>Guests, bookings, stays, folio balances and desk actions</span>
              </Command.Footer>
            </Command.Dialog>
          </Command.Container>
        </Command.Backdrop>
      </Command>
    </PageContent>
  );
}
