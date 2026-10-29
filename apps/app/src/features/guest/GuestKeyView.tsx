"use client";

import { ArrowRightArrowLeft, ArrowsRotateRight, Ban, Comments, Key, Lock, LockOpen } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Spinner } from "@heroui/react";
import { EmptyState, ItemCard, ListView } from "@heroui-pro/react";
import type { GuestStayRecord, KeyAccessPoint, KeyEvent, KeyHelpNote } from "@injishi/product-pms";
import { useBoardHref } from "@injishi/product-pms/web";
import { Icon, LinkButton, PhoneBody, StatusDot } from "@injishi/ui";
import { useState } from "react";
import { CardHeading, GuestTimeline, GuestTop, IconRow, InitialsAvatar, ScreenHeading, useGuestLang } from "./parts";

export type KeyMode = "active" | "provisioning" | "revoked" | "unavailable";

const TITLES = { en: "Your key", rw: "Urufunguzo rwawe", fr: "Votre clé" } as const;

const SUBS: Record<KeyMode, string> = {
  active: "Hold your phone near the lock on room 204 and tap.",
  provisioning: "Almost there. Your key appears here as soon as it’s confirmed.",
  revoked: "Room moves change your key automatically.",
  unavailable: "This room uses a key card instead.",
};

interface GuestKeyData {
  stay: GuestStayRecord;
  events: KeyEvent[];
  access: KeyAccessPoint[];
  help: KeyHelpNote[];
}

/** Guest · digital key: unlock, issuing, a room move, or a key card. */
export function GuestKeyView({ data, state }: { data: GuestKeyData; state: KeyMode }) {
  const screenHref = useBoardHref();
  const { stay, events, access, help } = data;
  const [lang, setLang] = useGuestLang();
  const [opened, setOpened] = useState(false);
  const [checks, setChecks] = useState(0);

  const revoked = state === "revoked";
  const room = revoked ? stay.move.to : stay.room;
  const roomType = revoked ? stay.move.toType : `${stay.roomType} · ${stay.floor}`;
  const showKey = state === "active" || revoked;
  const showExtras = showKey;
  const scenario = state === "provisioning" ? "issuing" : revoked ? "revoked" : "active";
  const base = events.filter((e) => e.scenario === scenario);
  const activity = opened
    ? [
        {
          id: "just-opened",
          status: "success" as const,
          icon: "LockOpen",
          title: `Room ${room} opened`,
          detail: "Thu 15 Oct, 19:42 · confirmed by the lock",
        },
        ...base,
      ]
    : base;
  const notes = help.filter((h) => h.mode === state);

  return (
    <>
      <GuestTop
        lead={<InitialsAvatar initials={stay.initials} />}
        title={stay.property}
        sub={`Room ${room} · stay ${stay.id}`}
        lang={lang}
        onLang={setLang}
      />
      <PhoneBody>
        <ScreenHeading title={TITLES[lang]} sub={SUBS[state]} />

        {revoked ? (
          <Alert status="warning" role="status" className="shrink-0">
            <Alert.Indicator>
              <ArrowRightArrowLeft />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Your old key stopped working; your new key for {stay.move.to} is ready</Alert.Title>
              <Alert.Description>
                You moved from room {stay.move.from} to {stay.move.to} at {stay.move.at}. The lock system confirmed the{" "}
                {stay.move.from} key was cancelled at {stay.move.cancelledAt}. Your bill and requests moved with you.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        {showKey ? (
          <Card aria-labelledby="key-h" className="shrink-0 items-center gap-4 px-4 py-5 text-center">
            <div className="flex w-full items-start justify-between gap-3 text-left">
              <div className="flex flex-col">
                <h2 id="key-h" className="text-[22px] leading-7 font-semibold tabular">
                  Room {room}
                </h2>
                <span className="text-[13px] leading-[18px] text-muted">{roomType}</span>
              </div>
              <Chip variant="soft" color="success">
                <StatusDot tone="success" />
                <Chip.Label>{revoked ? "Ready" : "Active"}</Chip.Label>
              </Chip>
            </div>
            <Button
              variant={opened ? "secondary" : "primary"}
              aria-label={opened ? `Room ${room} unlocked. Tap to unlock again` : `Unlock room ${room}`}
              onPress={() => setOpened((v) => !v)}
              className="size-44 min-h-44 min-w-44 flex-col gap-2.5 rounded-full text-base font-semibold"
            >
              {opened ? <LockOpen className="size-11" /> : <Key className="size-11" />}
              {opened ? "Unlocked" : "Tap to unlock"}
            </Button>
            <p role="status" className="max-w-[280px] text-[13px] leading-[18px] tabular">
              {opened
                ? "Door unlocked, confirmed by the lock at 19:42. It locks again after 5 seconds."
                : "Hold your phone within 10 cm of the lock with Bluetooth on."}
            </p>
            <p className="flex items-center justify-center gap-1.5 text-[12px] text-muted tabular">
              <Icon name="Clock" className="size-3.5" />
              Valid until {stay.keyValidUntil} · uses Bluetooth, no data needed
            </p>
          </Card>
        ) : null}

        {revoked ? (
          <ItemCard variant="outline" className="shrink-0 opacity-80">
            <ItemCard.Icon>
              <Lock />
            </ItemCard.Icon>
            <ItemCard.Content>
              <ItemCard.Title className="tabular">Room {stay.move.from} key</ItemCard.Title>
              <ItemCard.Description className="whitespace-normal">
                Cancelled {stay.move.cancelledAt} after your room move · confirmed by the lock system
              </ItemCard.Description>
            </ItemCard.Content>
            <ItemCard.Action>
              <Chip size="sm" variant="soft">
                <Ban className="size-3" />
                <Chip.Label>Cancelled</Chip.Label>
              </Chip>
            </ItemCard.Action>
          </ItemCard>
        ) : null}

        {state === "provisioning" ? (
          <>
            <Card aria-labelledby="prov-h" className="shrink-0 items-center gap-3.5 px-4 py-5 text-center">
              <Spinner size="lg" color="accent" aria-label="Waiting for the lock system" />
              <div className="flex max-w-[290px] flex-col items-center gap-1">
                <h2 id="prov-h" className="text-[18px] leading-6 font-semibold">
                  Your key is being issued
                </h2>
                <p className="text-[13px] leading-[18px] text-muted">
                  You checked in at {stay.keyRequestedAt}. We’ve asked the lock system for a key to room {stay.room} and
                  are waiting for it to confirm. This usually takes under a minute.
                </p>
              </div>
              <Button
                variant="secondary"
                isDisabled
                className="size-44 min-h-44 min-w-44 flex-col gap-2.5 rounded-full"
              >
                <Lock className="size-10" />
                Not ready yet
              </Button>
              <span className="text-[12px] text-muted tabular">
                {checks > 0
                  ? `Checked again at 15:1${3 + checks} · still waiting for the lock system`
                  : `Requested at ${stay.keyRequestedAt}`}
              </span>
              <div className="flex w-full gap-2">
                <Button variant="secondary" className="flex-1" onPress={() => setChecks((n) => Math.min(n + 1, 6))}>
                  <ArrowsRotateRight className="size-4" />
                  Check again
                </Button>
                <LinkButton href={screenHref("GuestRequests")} variant="ghost" className="flex-1">
                  Ask the desk
                </LinkButton>
              </div>
            </Card>
            <GuestTimeline label="Key progress" items={events.filter((e) => e.scenario === "issuing")} />
          </>
        ) : null}

        {state === "unavailable" ? (
          <>
            <Card className="shrink-0 p-2" aria-label="Key card">
              <EmptyState size="md">
                <EmptyState.Header>
                  <EmptyState.Media variant="icon">
                    <Key />
                  </EmptyState.Media>
                  <EmptyState.Title>Collect your key card at the front desk</EmptyState.Title>
                  <EmptyState.Description>
                    Room {stay.room} doesn’t have a digital lock, so there’s no phone key for this stay. Your key card
                    is ready at reception.
                  </EmptyState.Description>
                </EmptyState.Header>
                <EmptyState.Content className="flex w-full flex-col gap-2">
                  <LinkButton href={screenHref("GuestRequests")} variant="secondary">
                    <Comments className="size-4" />
                    Message the front desk
                  </LinkButton>
                </EmptyState.Content>
              </EmptyState>
            </Card>
            <ItemCard variant="secondary" className="shrink-0 items-start">
              <ItemCard.Icon>
                <Icon name="Handset" />
              </ItemCard.Icon>
              <ItemCard.Content>
                <ItemCard.Title>Lost your card?</ItemCard.Title>
                <ItemCard.Description className="whitespace-normal">
                  Call +250 788 300 420 any time. We cancel the lost card at the desk and make you a new one.
                </ItemCard.Description>
              </ItemCard.Content>
            </ItemCard>
          </>
        ) : null}

        {showExtras ? (
          <>
            <section aria-labelledby="also-h" className="flex shrink-0 flex-col gap-2">
              <h2 id="also-h" className="text-[15px] leading-[22px] font-semibold">
                Also Opens
              </h2>
              <ListView aria-label="Also opens" items={access}>
                {(a) => (
                  <ListView.Item id={a.id} textValue={a.title}>
                    <ListView.ItemContent>
                      <Icon name={a.icon} className="size-4 shrink-0 text-muted" />
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>{a.title}</ListView.Title>
                        <ListView.Description>{a.text}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                  </ListView.Item>
                )}
              </ListView>
            </section>
            <Card aria-labelledby="act-h" className="shrink-0 gap-2.5 p-4">
              <CardHeading id="act-h">Key Activity</CardHeading>
              <GuestTimeline items={activity} />
            </Card>
          </>
        ) : null}

        <Card variant="secondary" aria-labelledby="help-h" className="shrink-0 gap-2.5 px-4 py-3.5">
          <h2 id="help-h" className="text-[14px] leading-5 font-semibold">
            Good to Know
          </h2>
          {notes.map((h) => (
            <IconRow key={h.id} icon={h.icon} text={h.text} />
          ))}
        </Card>
      </PhoneBody>
    </>
  );
}
