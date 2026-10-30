"use client";

import { Calendar, Plus } from "@gravity-ui/icons";
import { Alert, Button, Chip, ProgressBar, Separator } from "@heroui/react";
import { ItemCard, ItemCardGroup } from "@heroui-pro/react";
import { Icon, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { type ReactNode, useState } from "react";
import type { GroupsBanner, GroupsBlock } from "../../model/commercial.ts";
import { useBoardHref } from "../mount.tsx";
import {
  GroupsContractCard,
  type GroupsNightView,
  GroupsOrganiserCard,
  GroupsPickupWidget,
  GroupsRoomingCard,
} from "./groups-panels.tsx";

/** Cutoff release of the selected block: rooms held → confirming the release → released once. */
type ReleaseStep = "held" | "confirm" | "released";

function pickupOf(block: GroupsBlock) {
  const held = block.nights.reduce((sum, n) => sum + n.held, 0);
  const picked = block.nights.reduce((sum, n) => sum + n.picked, 0);
  return { held, picked, pct: held ? Math.round((picked / held) * 100) : 0 };
}

/** 8, 6, 9 → "8, 6 and 9". */
const joinCounts = (counts: number[]) => counts.join(", ").replace(/, (\d+)$/, " and $1");

function BannerAlert({ banner, role, children }: { banner: GroupsBanner; role?: string; children?: ReactNode }) {
  return (
    <Alert status={toneColor(banner.tone)} role={role} className="flex-wrap">
      <Alert.Indicator>
        <Icon name={banner.icon} />
      </Alert.Indicator>
      <Alert.Content className="min-w-0 flex-[1_1_260px]">
        <Alert.Title>{banner.title}</Alert.Title>
        <Alert.Description>{banner.desc}</Alert.Description>
      </Alert.Content>
      {children}
    </Alert>
  );
}

export function GroupsView({ blocks }: { blocks: GroupsBlock[] }) {
  const screenHref = useBoardHref();
  const [selectedId, setSelectedId] = useState(blocks[0]?.id ?? "");
  const [step, setStep] = useState<ReleaseStep>("held");
  const [extended, setExtended] = useState(false);
  const [conflictFixed, setConflictFixed] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const block = blocks.find((b) => b.id === selectedId) ?? blocks[0];

  const header = (
    <PageHeader
      eyebrow="Isangano Lakeside Hotel · Commercial"
      title="Group Blocks"
      description="Rooms held for a group at a contracted rate. Unsold rooms return to general inventory at cutoff, exactly once."
      actions={
        <>
          <LinkButton href={screenHref("AvailabilityCalendar")} variant="secondary">
            <Calendar className="size-4" />
            Availability
          </LinkButton>
          <Button>
            <Plus className="size-4" />
            New block
          </Button>
        </>
      }
    />
  );

  if (!block) return <PageContent>{header}</PageContent>;

  // The release workflow and the overbooking fix only exist for a block still holding rooms before its cutoff.
  const flow = block.cutoffRelease;
  const conflict = block.conflict;
  const released = flow !== null && step === "released";
  const suiteFixed = conflict !== null && conflictFixed;
  const heldBefore = block.nights.map((n) => (suiteFixed && n.date === conflict?.night ? n.held - 1 : n.held));
  const nights: GroupsNightView[] = block.nights.map((n, i) => {
    const held = released ? n.picked : (heldBefore[i] ?? n.held);
    return { ...n, held, pct: held ? Math.round((n.picked / held) * 100) : 0 };
  });
  const roomTypes = block.roomTypes.map((t) => ({
    ...t,
    held: released ? t.picked : suiteFixed && t.name === conflict?.roomType ? t.held - 1 : t.held,
  }));

  let banner = block.banner;
  if (flow && released) {
    const counts = block.nights.map((n, i) => (heldBefore[i] ?? n.held) - n.picked);
    banner = {
      ...flow.released,
      title: `Released ${joinCounts(counts)} unsold rooms (${flow.released.nights}) at ${flow.released.at}`,
    };
  } else if (flow && extended) {
    banner = flow.extended;
  }

  const rooming = block.rooming;
  const matching = uploaded && rooming.upload !== null;
  const roomingFile = matching ? rooming.upload : rooming.file;

  return (
    <PageContent>
      {header}

      <div className="flex flex-wrap items-start gap-4">
        <section aria-labelledby="bl-h" className="min-w-0 max-w-[340px] flex-[1_1_290px]">
          <ItemCardGroup layout="list" className="overflow-hidden">
            <ItemCardGroup.Header>
              <ItemCardGroup.Title id="bl-h" aria-level={2}>
                Blocks
              </ItemCardGroup.Title>
              <ItemCardGroup.Description>Next 60 days and recently closed</ItemCardGroup.Description>
            </ItemCardGroup.Header>
            {blocks.map((b) => {
              const p = pickupOf(b);
              const selected = b.id === block.id;
              return [
                <Separator key={`${b.id}-sep`} />,
                <ItemCard<"button">
                  key={b.id}
                  // Selectable block row: HeroUI's documented pressable ItemCard (render as a button).
                  render={(props) => <button type="button" {...props} />} // heroui-ok
                  aria-pressed={selected}
                  onClick={() => setSelectedId(b.id)}
                  className={`w-full cursor-pointer text-left transition-colors ${
                    selected ? "bg-surface-secondary" : "hover:bg-default/40"
                  }`}
                >
                  <ItemCard.Content className="gap-1.5">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <ItemCard.Title>{b.name}</ItemCard.Title>
                      <Chip size="sm" variant="soft" color={toneColor(b.tone)}>
                        {b.status}
                      </Chip>
                    </span>
                    <ItemCard.Description className="mt-0 tabular">
                      {b.dates} · {b.rooms} rooms · {b.id}
                    </ItemCard.Description>
                    <ProgressBar value={p.pct} size="sm" aria-label={`${b.name}: ${p.pct}% picked up`}>
                      <ProgressBar.Track className="h-1.5">{p.pct > 0 ? <ProgressBar.Fill /> : null}</ProgressBar.Track>
                    </ProgressBar>
                    <span className="text-xs text-muted tabular">
                      {p.pct}% picked up · {p.picked} of {p.held} room nights
                    </span>
                  </ItemCard.Content>
                </ItemCard>,
              ];
            })}
          </ItemCardGroup>
        </section>

        <section aria-labelledby="gd-h" className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex min-w-[min(260px,100%)] flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="gd-h" className="text-xl leading-7 font-semibold">
                  {block.name}
                </h2>
                <Chip size="sm" variant="soft" color={toneColor(block.tone)}>
                  {block.status}
                </Chip>
              </div>
              <span className="text-[13px] text-muted tabular">
                {block.id} · {block.datesLong}
              </span>
            </div>
            <LinkButton href={screenHref("Reservations")} size="sm" variant="secondary">
              <Calendar className="size-4" />
              Bookings in block
            </LinkButton>
          </div>

          <BannerAlert banner={banner} role="status">
            {flow && step === "held" ? (
              <div className="flex flex-none flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onPress={() => setExtended(true)} isDisabled={extended}>
                  Extend to {flow.extendTo}
                </Button>
                <Button size="sm" onPress={() => setStep("confirm")}>
                  Release now
                </Button>
              </div>
            ) : null}
            {flow && step === "confirm" ? (
              <div className="flex flex-none flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" onPress={() => setStep("held")}>
                  Keep holding
                </Button>
                <Button size="sm" variant="danger" onPress={() => setStep("released")}>
                  Release unsold rooms
                </Button>
              </div>
            ) : null}
          </BannerAlert>

          {conflict ? (
            <BannerAlert banner={suiteFixed || released ? conflict.fixed : conflict.open}>
              {suiteFixed || released ? null : (
                <Button size="sm" variant="secondary" className="flex-none" onPress={() => setConflictFixed(true)}>
                  {conflict.fixLabel}
                </Button>
              )}
            </BannerAlert>
          ) : null}

          <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
            <GroupsOrganiserCard block={block} />
            <GroupsContractCard
              block={block}
              roomTypes={roomTypes}
              cutoff={flow && extended ? flow.extendedCutoff : block.cutoff}
            />
          </div>

          <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
            <GroupsPickupWidget nights={nights} asOf={block.pickupAsOf} />
            <GroupsRoomingCard
              due={rooming.due}
              status={matching && rooming.upload ? rooming.upload.status : rooming.status}
              tone={matching && rooming.upload ? rooming.upload.tone : rooming.tone}
              file={roomingFile}
              issues={matching ? [] : rooming.issues}
              matching={matching}
              onUpload={() => setUploaded(true)}
            />
          </div>
        </section>
      </div>
    </PageContent>
  );
}
