"use client";

import {
  ArrowRightFromSquare,
  CircleCheck,
  CircleCheckFill,
  Clock,
  Eye,
  EyeSlash,
  Hourglass,
  Key,
} from "@gravity-ui/icons";
import { Button, Card, Chip } from "@heroui/react";
import { ItemCard, ListView, RadioButtonGroup, Segment } from "@heroui-pro/react";
import type { Persona } from "@injishi/data";
import { screenHref } from "@injishi/data";
import type { GuestStayRecord, HotelInfoRow, LateCheckoutOption, StayShortcut } from "@injishi/data/fixtures/guest";
import { formatRwf, Icon, KeyValueList, LinkButton, PhoneBody, StatusDot, toneColor } from "@injishi/ui";
import { useState } from "react";
import { PhoneSheet } from "@/components/phone/PhoneSheet";
import { GuestTop, Hint, InitialsAvatar, renderAnchor, ScreenHeading, useGuestLang } from "./parts";

export type LateCheckout = "none" | "requested" | "approved";

const COPY = {
  en: { hello: "Good evening, Sarah", sub: "Thursday 15 October · night 2 of 2" },
  rw: { hello: "Mwiriwe, Sarah", sub: "Murakaza neza mu cyumba 204." },
  fr: { hello: "Bonsoir, Sarah", sub: "Mercredi 15 octobre · nuit 2 sur 2" },
} as const;

interface GuestStayData {
  stay: GuestStayRecord;
  shortcuts: StayShortcut[];
  lateOptions: LateCheckoutOption[];
  info: HotelInfoRow[];
}

/** Guest · in-stay home: room, shortcuts, Wi-Fi, checkout and hotel information. */
export function GuestStayView({
  persona,
  data,
  late: initialLate,
}: {
  persona: Persona;
  data: GuestStayData;
  late: LateCheckout;
}) {
  const { stay, shortcuts, lateOptions, info } = data;
  const [lang, setLang] = useGuestLang();
  const [late, setLate] = useState<LateCheckout | null>(null);
  const [sheet, setSheet] = useState(false);
  const [opt, setOpt] = useState(lateOptions.find((o) => o.id === "15")?.id ?? lateOptions[0]?.id ?? "");
  const [pwShown, setPwShown] = useState(false);
  const [infoTab, setInfoTab] = useState<"today" | "info">("today");

  const mode = late ?? initialLate;
  const chosen = lateOptions.find((o) => o.id === opt) ?? lateOptions[0];
  const approved = mode === "approved";
  const keyUntil = approved ? stay.lateApproval.keyUntil : stay.keyUntil;
  const checkoutTime = approved ? stay.lateApproval.until : stay.checkoutTime;
  const rows = info.filter((r) => r.tab === infoTab);
  const t = COPY[lang];
  const first = persona.firstName;

  return (
    <>
      <GuestTop
        lead={<InitialsAvatar initials={stay.initials} />}
        title={stay.property}
        sub={`Room ${stay.room} · stay ${stay.id}`}
        lang={lang}
        onLang={setLang}
      />
      <PhoneBody>
        <ScreenHeading title={t.hello.replace("Sarah", first)} sub={t.sub} />

        <Card aria-label="Your room" className="shrink-0 gap-[14px] p-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[12px] leading-4 text-muted">Your room</span>
              <span className="text-[40px] leading-[44px] font-semibold tracking-[-0.02em] tabular">{stay.room}</span>
              <span className="text-[13px] leading-[18px] text-muted">
                {stay.roomType} · {stay.floor}
              </span>
            </div>
            <LinkButton href={screenHref("GuestKey")} size="lg" className="min-w-32">
              <Key className="size-4" />
              Unlock
            </LinkButton>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip size="sm" variant="soft" color="success">
              <StatusDot tone="success" />
              <Chip.Label>Digital key active until {keyUntil}</Chip.Label>
            </Chip>
            <Chip size="sm" variant="soft">
              Checked in {stay.checkedIn}
            </Chip>
          </div>
        </Card>

        <nav aria-label="Stay shortcuts" className="grid shrink-0 grid-cols-2 gap-2.5">
          {shortcuts.map((q) => (
            <ItemCard<"a">
              key={q.id}
              className="flex-col items-start gap-2.5 p-3.5"
              render={renderAnchor(screenHref(q.board))}
            >
              <ItemCard.Icon>
                <Icon name={q.icon} />
              </ItemCard.Icon>
              <ItemCard.Content>
                <ItemCard.Title>{q.title}</ItemCard.Title>
                <ItemCard.Description className="whitespace-normal">{q.desc}</ItemCard.Description>
              </ItemCard.Content>
            </ItemCard>
          ))}
        </nav>

        <Card aria-labelledby="wifi-h" className="shrink-0 gap-2.5 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="wifi-h" className="flex items-center gap-2 text-[15px] leading-[22px] font-semibold">
              <Icon name="BroadcastSignal" className="size-4 text-muted" />
              Wi-Fi
            </h2>
            <span className="text-[12px] text-muted">{stay.wifi.where}</span>
          </div>
          <KeyValueList
            className="grid-cols-[84px_minmax(0,1fr)]! items-center"
            items={[
              { label: "Network", value: stay.wifi.network },
              {
                label: "Password",
                value: (
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono tracking-[0.02em] tabular">
                      {pwShown ? stay.wifi.password : "••••••••••••"}
                    </span>
                    <Button variant="ghost" size="sm" aria-pressed={pwShown} onPress={() => setPwShown((v) => !v)}>
                      {pwShown ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
                      {pwShown ? "Hide" : "Show"}
                    </Button>
                  </span>
                ),
              },
            ]}
          />
          <p className="text-[12px] leading-4 text-muted">
            Changes for each stay. If it drops, message the front desk and we’ll reset your access.
          </p>
        </Card>

        <Card aria-labelledby="co-h" className="shrink-0 gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 id="co-h" className="text-[15px] leading-[22px] font-semibold">
                Checkout
              </h2>
              <span className="text-[14px] leading-5">
                Tomorrow, {stay.checkoutDay}, by <span className="font-semibold tabular">{checkoutTime}</span>
              </span>
            </div>
            <ArrowRightFromSquare className="size-5 text-muted" />
          </div>
          {mode === "none" ? (
            <>
              <p className="text-[13px] leading-[18px] text-muted">
                Need more time? Late checkout depends on tomorrow’s arrivals and has a fee under the hotel’s policy.
                Nothing is charged unless the front desk approves.
              </p>
              <Button variant="secondary" className="self-start" onPress={() => setSheet(true)}>
                <Clock className="size-4" />
                Request late checkout
              </Button>
            </>
          ) : null}
          {mode === "requested" && chosen ? (
            <>
              <ItemCard variant="secondary" className="items-start">
                <ItemCard.Icon>
                  <Hourglass />
                </ItemCard.Icon>
                <ItemCard.Content>
                  <ItemCard.Title>Late checkout until {chosen.time}</ItemCard.Title>
                  <ItemCard.Description className="whitespace-normal tabular">
                    {formatRwf(chosen.fee)} if approved. The front desk replies by 09:00 tomorrow. Until then, plan for
                    11:00.
                  </ItemCard.Description>
                </ItemCard.Content>
                <ItemCard.Action>
                  <Chip size="sm" variant="soft" color="warning">
                    Pending approval
                  </Chip>
                </ItemCard.Action>
              </ItemCard>
              <Button variant="ghost" size="sm" className="self-start" onPress={() => setLate("none")}>
                Withdraw request
              </Button>
            </>
          ) : null}
          {approved ? (
            <ItemCard variant="secondary" className="items-start">
              <ItemCard.Icon>
                <CircleCheck />
              </ItemCard.Icon>
              <ItemCard.Content>
                <ItemCard.Title>
                  Approved until {stay.lateApproval.until} by {stay.lateApproval.by}
                </ItemCard.Title>
                <ItemCard.Description className="whitespace-normal tabular">
                  {formatRwf(stay.lateApproval.fee)} is added to your bill. Your digital key now works until{" "}
                  {stay.lateApproval.until}.
                </ItemCard.Description>
              </ItemCard.Content>
              <ItemCard.Action>
                <Chip size="sm" variant="soft" color="success">
                  Approved
                </Chip>
              </ItemCard.Action>
            </ItemCard>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <LinkButton href={screenHref("GuestFolio")} variant="tertiary" size="sm">
              <Icon name="Receipt" className="size-4" />
              Review your bill
            </LinkButton>
            <span className="min-w-40 flex-1 text-[12px] leading-4 text-muted">
              Your key stops working at checkout time.
            </span>
          </div>
        </Card>

        <section aria-labelledby="info-h" className="flex shrink-0 flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="info-h" className="text-[15px] leading-[22px] font-semibold">
              At the Hotel
            </h2>
            <Segment
              size="sm"
              aria-label="Hotel information"
              selectedKey={infoTab}
              onSelectionChange={(k) => setInfoTab(k === "info" ? "info" : "today")}
            >
              <Segment.Item id="today">
                <Segment.Separator />
                Today
              </Segment.Item>
              <Segment.Item id="info">
                <Segment.Separator />
                Info
              </Segment.Item>
            </Segment>
          </div>
          <ListView aria-label="At the hotel" items={rows}>
            {(r) => (
              <ListView.Item id={r.id} textValue={r.title} className="items-start">
                <ListView.ItemContent className="items-start">
                  <Icon name={r.icon} className="mt-0.5 size-4 shrink-0 text-muted" />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title className="whitespace-normal">{r.title}</ListView.Title>
                    <ListView.Description className="leading-4 whitespace-normal tabular">
                      {r.text}
                    </ListView.Description>
                  </div>
                </ListView.ItemContent>
                {r.chip ? (
                  <ListView.ItemAction>
                    <Chip size="sm" variant="soft" color={toneColor(r.tone)}>
                      {r.chip}
                    </Chip>
                  </ListView.ItemAction>
                ) : null}
              </ListView.Item>
            )}
          </ListView>
        </section>
      </PhoneBody>

      <PhoneSheet
        isOpen={sheet}
        onOpenChange={setSheet}
        heading="Request late checkout"
        description={`${stay.checkoutDay} · room ${stay.room}. Fees follow the hotel’s policy and are added to your bill only if approved.`}
      >
        <RadioButtonGroup
          aria-label="Late checkout time"
          value={opt}
          onChange={(v) => {
            if (v) setOpt(String(v));
          }}
          className="flex flex-col gap-2"
        >
          {lateOptions.map((o) => (
            <RadioButtonGroup.Item key={o.id} value={o.id} className="items-start px-4 py-3 text-left">
              <RadioButtonGroup.Indicator>
                <CircleCheckFill className="size-4" />
              </RadioButtonGroup.Indicator>
              <RadioButtonGroup.ItemContent className="flex flex-col gap-0.5">
                <span className="font-semibold">Until {o.time}</span>
                <span className="text-[12px] leading-4 text-muted tabular">
                  {formatRwf(o.fee)} if approved · {o.note}
                </span>
              </RadioButtonGroup.ItemContent>
            </RadioButtonGroup.Item>
          ))}
        </RadioButtonGroup>
        <Hint icon="CircleInfo">Subject to availability. Your key is extended only after approval.</Hint>
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onPress={() => setSheet(false)}>
            Cancel
          </Button>
          <Button
            size="lg"
            className="flex-[2]"
            onPress={() => {
              setSheet(false);
              setLate("requested");
            }}
          >
            Send request
          </Button>
        </div>
      </PhoneSheet>
    </>
  );
}
