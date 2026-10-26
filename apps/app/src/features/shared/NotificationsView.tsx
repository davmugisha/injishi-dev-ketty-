"use client";

import { Bell, CheckDouble, Gear, Sliders } from "@gravity-ui/icons";
import { Button, Chip, Drawer, Switch, Tabs } from "@heroui/react";
import { EmptyState, ItemCard, ItemCardGroup, KPIGroup } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { type Persona, screenHref } from "@injishi/data";
import type { InboxFigure, InboxNotification, InboxTask, NotificationCategoryId } from "@injishi/data/fixtures/shared";
import { GateChip, Icon, LinkButton, PageContent, PageHeader, StatusDot, toneColor } from "@injishi/ui";
import { Fragment, useState } from "react";

interface InboxData {
  figures: InboxFigure[];
  tasks: InboxTask[];
  notes: InboxNotification[];
}

const TABS: { id: "all" | NotificationCategoryId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "action", label: "Needs action" },
  { id: "mention", label: "Mentions" },
  { id: "system", label: "System" },
];

const TONE_BG: Record<string, string> = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-accent-soft text-accent",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  default: "bg-surface-secondary text-foreground",
};

/** Notification inbox over the manager’s Today (artifact: Notifications.dc.html). */
export function NotificationsView({ persona, data }: { persona: Persona; data: InboxData }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [read, setRead] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.notes.filter((n) => n.read).map((n) => [n.id, true])),
  );
  const [ev, setEv] = useState<Record<string, boolean>>({ bounce: true });

  const isRead = (n: InboxNotification) => !!read[n.id];
  const unread = data.notes.filter((n) => !isRead(n)).length;
  const inTab = (n: InboxNotification, t: string) => t === "all" || n.cats.includes(t as NotificationCategoryId);
  const items = data.notes.filter((n) => inTab(n, tab) && (!unreadOnly || !isRead(n)));

  return (
    <PageContent>
      <PageHeader
        size="hello"
        eyebrow="Monday 12 October 2026 · 10:45 · Isangano Lakeside Hotel"
        title={`Good morning, ${persona.firstName}`}
        description="7 exceptions open. Housekeeping is 5 rooms short for arrivals before 14:00."
      />

      <section aria-label="Today">
        <KPIGroup className="flex-wrap">
          {data.figures.map((k, i) => (
            <Fragment key={k.id}>
              {i > 0 ? <KPIGroup.Separator /> : null}
              <KPI className="min-w-[180px] flex-1">
                <KPI.Header>
                  <KPI.Title>{k.label}</KPI.Title>
                </KPI.Header>
                <KPI.Content>
                  <KPI.Value
                    value={k.value}
                    formatOptions={
                      k.percent ? { style: "percent", maximumFractionDigits: 0 } : { maximumFractionDigits: 0 }
                    }
                    className="tabular"
                  />
                </KPI.Content>
                <KPI.Footer>
                  <p className="text-xs text-muted">{k.foot}</p>
                </KPI.Footer>
              </KPI>
            </Fragment>
          ))}
        </KPIGroup>
      </section>

      <ItemCardGroup layout="list" aria-label="Needs you now">
        <ItemCardGroup.Header>
          <ItemCardGroup.Title>Needs You Now</ItemCardGroup.Title>
        </ItemCardGroup.Header>
        {data.tasks.map((w) => (
          <ItemCard key={w.id} className="border-t border-separator">
            <ItemCard.Icon>
              <Icon name={w.icon} />
            </ItemCard.Icon>
            <ItemCard.Content>
              <ItemCard.Title>{w.title}</ItemCard.Title>
              <ItemCard.Description>{w.desc}</ItemCard.Description>
            </ItemCard.Content>
          </ItemCard>
        ))}
      </ItemCardGroup>

      <Drawer.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="nt-h" className="w-full max-w-[500px]">
            <Drawer.Header className="flex flex-row items-start gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Drawer.Heading id="nt-h" className="text-[17px] leading-6 font-semibold">
                  Notifications
                </Drawer.Heading>
                <span className="text-[13px] text-muted">Isangano Lakeside Hotel · {unread} unread</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                isDisabled={unread === 0}
                onPress={() => setRead(Object.fromEntries(data.notes.map((n) => [n.id, true])))}
              >
                <CheckDouble className="size-4" />
                Mark all read
              </Button>
              <LinkButton
                href={screenHref("Account")}
                size="sm"
                variant="ghost"
                isIconOnly
                aria-label="Notification preferences"
              >
                <Gear className="size-4" />
              </LinkButton>
              <Drawer.CloseTrigger aria-label="Close notifications" />
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-2">
              <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
                <Tabs.ListContainer>
                  <Tabs.List aria-label="Notification type" className="w-full">
                    {TABS.map((t) => (
                      <Tabs.Tab key={t.id} id={t.id} className="flex-1 gap-1.5">
                        {t.label}
                        <span className="text-xs text-muted tabular">
                          {data.notes.filter((n) => inTab(n, t.id)).length}
                        </span>
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Switch isSelected={unreadOnly} onChange={setUnreadOnly}>
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    Unread only
                  </Switch.Content>
                </Switch>
                <span className="text-xs text-muted">Last 7 days · this property</span>
              </div>
              {items.length === 0 ? (
                <EmptyState size="sm">
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                      <Bell />
                    </EmptyState.Media>
                    <EmptyState.Title>You’re up to date</EmptyState.Title>
                    <EmptyState.Description>Nothing unread here. Read items stay for 7 days.</EmptyState.Description>
                  </EmptyState.Header>
                </EmptyState>
              ) : (
                items.map((n) => {
                  const un = !isRead(n);
                  const showEv = n.evidence.length > 0 && !!ev[n.id];
                  return (
                    <article
                      key={n.id}
                      aria-labelledby={`n-${n.id}`}
                      className={`flex gap-3 rounded-2xl p-3 ${un ? "bg-surface-secondary" : ""}`}
                    >
                      <span
                        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-xl ${TONE_BG[n.tone] ?? TONE_BG.default}`}
                      >
                        <Icon name={n.icon} />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex items-start gap-2">
                          <h3
                            id={`n-${n.id}`}
                            className={`flex-1 text-sm leading-5 ${un ? "font-semibold" : "font-medium"}`}
                          >
                            {n.title}
                          </h3>
                          <span className="text-xs leading-5 whitespace-nowrap text-muted tabular">{n.time}</span>
                          {un ? (
                            <>
                              <StatusDot tone="accent" className="mt-1.5" />
                              <span className="sr-only">Unread</span>
                            </>
                          ) : null}
                        </div>
                        <p className="text-[13px] leading-[19px] text-muted">{n.body}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {n.chip ? (
                            <Chip size="sm" variant="soft" color={toneColor(n.chipTone)}>
                              {n.chip}
                            </Chip>
                          ) : null}
                          {n.refs.map((r) => (
                            <GateChip key={r} className="font-normal tabular">
                              {r}
                            </GateChip>
                          ))}
                        </div>
                        {showEv ? (
                          <ol
                            aria-label="Delivery evidence"
                            className="flex list-none flex-col gap-1 rounded-xl bg-surface px-3 py-2.5 text-xs leading-[17px]"
                          >
                            {n.evidence.map((e) => (
                              <li key={e} className="tabular">
                                {e}
                              </li>
                            ))}
                          </ol>
                        ) : null}
                        <div className="flex flex-wrap gap-1.5">
                          {n.actions.map((a) => (
                            <LinkButton
                              key={a.label}
                              href={screenHref(a.board)}
                              size="sm"
                              variant={a.primary ? "secondary" : "ghost"}
                            >
                              {a.label}
                            </LinkButton>
                          ))}
                          {n.evidence.length ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-expanded={showEv}
                              onPress={() => setEv((p) => ({ ...p, [n.id]: !p[n.id] }))}
                            >
                              {showEv ? "Hide delivery evidence" : "Show delivery evidence"}
                            </Button>
                          ) : null}
                          {un ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Mark “${n.title}” as read`}
                              onPress={() => setRead((p) => ({ ...p, [n.id]: true }))}
                            >
                              Mark read
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </Drawer.Body>
            <Drawer.Footer className="flex items-center justify-between border-t border-separator">
              <span className="text-xs text-muted">Delivered in-app and by email</span>
              <LinkButton href={screenHref("Account")} size="sm" variant="ghost">
                <Sliders className="size-4" />
                Notification preferences
              </LinkButton>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </PageContent>
  );
}
