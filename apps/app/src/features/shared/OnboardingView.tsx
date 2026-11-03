"use client";

import {
  ArrowRight,
  ChevronRight,
  CircleCheck,
  GraduationCap,
  LifeRing,
  Person,
  PersonPlus,
  TriangleExclamation,
} from "@gravity-ui/icons";
import { Alert, Chip, ProgressBar } from "@heroui/react";
import { EmptyState, ItemCard, ItemCardGroup, Segment } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { GoLiveGate, SetupItem, SetupStatus } from "@injishi/data/fixtures/shared";
import { GateChip, Icon, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { useState } from "react";
import { CardHeading, IconTile, PressableCard, ProcessTimeline } from "./ui";

const STATUS: Record<
  Exclude<SetupStatus, "external">,
  { label: string; tone: "success" | "accent" | "default" | "warning" }
> = {
  done: { label: "Done", tone: "success" },
  review: { label: "In review", tone: "accent" },
  progress: { label: "In progress", tone: "accent" },
  todo: { label: "To do", tone: "default" },
  blocked: { label: "Blocked", tone: "warning" },
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "mine", label: "Yours to do" },
  { id: "waiting", label: "Waiting" },
  { id: "done", label: "Done" },
];

const GROUP: Record<SetupStatus, "done" | "waiting" | "mine"> = {
  done: "done",
  review: "waiting",
  external: "waiting",
  blocked: "waiting",
  progress: "mine",
  todo: "mine",
};

/** Owner onboarding (artifact: Onboarding.dc.html). Select a step to see what it needs. */
export function OnboardingView({ items, gates }: { items: SetupItem[]; gates: GoLiveGate[] }) {
  const [filter, setFilter] = useState("all");
  const [selId, setSelId] = useState("listing");
  const doneCount = items.filter((it) => it.status === "done").length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const counts = [
    { label: "Done", value: doneCount },
    { label: "Yours to do", value: items.filter((it) => GROUP[it.status] === "mine").length },
    {
      label: "Waiting on others",
      value: items.filter((it) => it.status === "review" || it.status === "external").length,
    },
    { label: "Blocked", value: items.filter((it) => it.status === "blocked").length },
  ];
  const shown = items.filter((it) => filter === "all" || GROUP[it.status] === filter);
  const sel = items.find((it) => it.id === selId) ?? items[0];

  return (
    <PageContent>
      <PageHeader
        eyebrow="Isangano Lakeside Hotel · Setup and activation"
        title="Get Ready to Go Live"
        actions={
          <>
            <LinkButton href={screenHref("TeamRoles")} variant="secondary">
              <PersonPlus className="size-4" />
              Invite team
            </LinkButton>
            <LinkButton href={screenHref("RatesInventory")}>
              Continue with rate plans
              <ArrowRight className="size-4" />
            </LinkButton>
          </>
        }
      />

      <section aria-label="Setup progress" className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-surface">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <ProgressBar
            aria-label="Setup progress"
            value={pct}
            className="min-w-[min(360px,100%)] flex-1 gap-2"
            color="accent"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Setup progress</span>
              <span className="text-sm tabular">
                {doneCount} of {items.length} done
              </span>
            </div>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
          <dl className="m-0 flex flex-wrap gap-x-7 gap-y-2">
            {counts.map((c) => (
              <div key={c.label} className="flex flex-col">
                <dt className="text-xs text-muted">{c.label}</dt>
                <dd className="m-0 text-xl leading-7 font-semibold tabular">{c.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Alert status="warning">
          <Alert.Indicator>
            <TriangleExclamation />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Not live yet: 3 gates block go-live</Alert.Title>
            <Alert.Description>
              Business verification is with Injishi staff, the EBM/VSDC connection waits on RRA credentials, and your
              listing can’t publish until the business is active.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <ItemCardGroup layout="list" aria-labelledby="check-h" className="min-w-0 flex-[1.5_1_520px]">
          <ItemCardGroup.Header className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px] flex-1">
              <ItemCardGroup.Title id="check-h">Setup Checklist</ItemCardGroup.Title>
              <ItemCardGroup.Description>
                Select a step to see what it needs and what it unblocks.
              </ItemCardGroup.Description>
            </div>
            <Segment aria-label="Filter steps" selectedKey={filter} onSelectionChange={(k) => setFilter(String(k))}>
              {FILTERS.map((f) => (
                <Segment.Item key={f.id} id={f.id}>
                  {f.label}
                </Segment.Item>
              ))}
            </Segment>
          </ItemCardGroup.Header>
          {shown.map((it) => {
            const on = it.id === sel?.id;
            const chip = it.status === "external" ? null : STATUS[it.status];
            return (
              <ItemCard<"button">
                key={it.id}
                render={PressableCard}
                aria-pressed={on}
                onClick={() => setSelId(it.id)}
                className={`w-full cursor-pointer border-t border-separator text-left ${on ? "bg-surface-secondary" : ""}`}
              >
                <ItemCard.Icon>
                  <Icon name={it.icon} />
                </ItemCard.Icon>
                <ItemCard.Content>
                  <ItemCard.Title>{it.title}</ItemCard.Title>
                  <ItemCard.Description className="whitespace-normal">{it.desc}</ItemCard.Description>
                </ItemCard.Content>
                <ItemCard.Action className="flex items-center gap-2">
                  {it.gate ? (
                    <GateChip icon={<Icon name={it.gate.icon} className="size-3" />}>{it.gate.label}</GateChip>
                  ) : chip ? (
                    <Chip size="sm" variant="soft" color={toneColor(chip.tone)}>
                      {chip.label}
                    </Chip>
                  ) : null}
                  <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                </ItemCard.Action>
              </ItemCard>
            );
          })}
          {shown.length === 0 ? (
            <EmptyState size="sm" className="border-t border-separator">
              <EmptyState.Header>
                <EmptyState.Media variant="icon">
                  <CircleCheck />
                </EmptyState.Media>
                <EmptyState.Title>Nothing in this view</EmptyState.Title>
                <EmptyState.Description>Pick another filter to see the rest of setup.</EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          ) : null}
        </ItemCardGroup>

        <aside aria-label="Step details and gates" className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          {sel ? (
            <section
              aria-live="polite"
              aria-labelledby="insp-h"
              className="flex flex-col gap-3.5 rounded-2xl bg-surface p-5 shadow-surface"
            >
              <div className="flex items-start gap-3">
                <IconTile icon={<Icon name={sel.icon} />} size={40} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <h2 id="insp-h" className="text-[15px] leading-[22px] font-semibold">
                    {sel.title}
                  </h2>
                  <span className="text-[13px] leading-[18px] text-muted">{sel.desc}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {sel.gate ? (
                  <GateChip icon={<Icon name={sel.gate.icon} className="size-3" />}>{sel.gate.label}</GateChip>
                ) : (
                  <Chip
                    size="sm"
                    variant="soft"
                    color={toneColor(STATUS[sel.status as Exclude<SetupStatus, "external">].tone)}
                  >
                    {STATUS[sel.status as Exclude<SetupStatus, "external">].label}
                  </Chip>
                )}
                <Chip variant="soft">
                  <Person className="size-3.5" />
                  <Chip.Label>Who acts: {sel.who}</Chip.Label>
                </Chip>
              </div>
              <p className="text-sm leading-[21px]">{sel.why}</p>
              {sel.waitingOn.length ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Waiting on</span>
                  <div className="flex flex-wrap gap-1.5">
                    {sel.waitingOn.map((w) => (
                      <Chip key={w} size="sm" variant="soft" color="warning">
                        {w}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}
              {sel.unblocks.length ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Unblocks</span>
                  <div className="flex flex-wrap gap-1.5">
                    {sel.unblocks.map((u) => (
                      <Chip key={u} size="sm" variant="soft">
                        {u}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}
              {sel.note ? (
                <p className="flex flex-wrap items-center gap-2 text-xs">
                  <GateChip icon={<Icon name="ShieldExclamation" className="size-3" />}>Awaiting sign-off</GateChip>
                  <span className="text-muted">{sel.note}</span>
                </p>
              ) : null}
              <LinkButton href={screenHref(sel.board)} className="self-start">
                {sel.cta}
                <ArrowRight className="size-4" />
              </LinkButton>
            </section>
          ) : null}

          <section aria-labelledby="gates-h" className="flex flex-col gap-3 rounded-2xl bg-surface-secondary p-5">
            <div>
              <CardHeading id="gates-h">What Blocks Go-Live</CardHeading>
              <p className="text-[13px] text-muted">Nothing here turns green without the counterpart’s evidence</p>
            </div>
            <ProcessTimeline
              steps={gates.map((g) => ({
                ...g,
                detail: g.detail,
                extra: (
                  <Chip size="sm" variant="soft" color={toneColor(g.chipTone)}>
                    {g.chip}
                  </Chip>
                ),
              }))}
            />
          </section>

          <div className="flex flex-wrap gap-2">
            <LinkButton href={screenHref("Training")} variant="ghost" size="sm">
              <GraduationCap className="size-4" />
              Setup training
            </LinkButton>
            <LinkButton href={screenHref("PublicHelp")} variant="ghost" size="sm">
              <LifeRing className="size-4" />
              Ask support
            </LinkButton>
          </div>
        </aside>
      </div>
    </PageContent>
  );
}
