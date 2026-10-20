"use client";

import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRightFromSquare,
  Camera,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  CircleQuestion,
  Comment,
  FileText,
  Fingerprint,
  Hourglass,
  LifeRing,
  Lock,
  PaperPlane,
  ShieldKeyhole,
  Suitcase,
} from "@gravity-ui/icons";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Label,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  toast,
} from "@heroui/react";
import { ItemCard, ListView, Segment } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  HelpTicket,
  HelpTopic,
  LeaveBalance,
  LoanedAsset,
  Payslip,
  StaffDocument,
  StaffProfile,
  StaffRequest,
} from "@injishi/data/fixtures/staff";
import { formatRwf, Icon, PhoneBody, PhoneTop, StatusDot, toneColor } from "@injishi/ui";
import NextLink from "next/link";
import { type ComponentPropsWithRef, Fragment, useState, useTransition } from "react";
import { signOut } from "@/lib/auth-actions";
import { PhoneSheet, PhoneToasts, renderAsButton, renderSection, ToneTile } from "./parts";

export interface StaffMeData {
  profile: StaffProfile;
  payslips: Payslip[];
  balance: LeaveBalance;
  requests: StaffRequest[];
  documents: StaffDocument[];
  assets: LoanedAsset[];
  tickets: HelpTicket[];
  topics: HelpTopic[];
  /** The caller's clock-in time today from their attendance record ("07:02"), or null when not clocked in. */
  clockedInAt: string | null;
}

const COPY = {
  en: {
    me: "Me",
    payslips: "Payslips",
    leave: "Leave",
    docs: "My documents",
    assets: "Assets on loan",
    help: "Help desk",
    lang: "Language",
    signout: "Sign out",
  },
  rw: {
    me: "Njye",
    payslips: "Impapuro z’umushahara",
    leave: "Ikiruhuko",
    docs: "Inyandiko zanjye",
    assets: "Ibikoresho nahawe",
    help: "Ubufasha",
    lang: "Ururimi",
    signout: "Sohoka",
  },
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "bio", "0", "del"] as const;

/**
 * Why the payslip lock does not open: no API checks a payslip PIN or a fingerprint for a person, so this phone
 * cannot tell whether a PIN is right. Rather than let any PIN through, the payslips stay locked.
 */
const PIN_UNAVAILABLE =
  "Checking a payslip PIN is not available yet, so payslips stay locked on the phone. Ask HR for your payslip.";

function renderLeaveLink(props: ComponentPropsWithRef<"a">) {
  const { href, ...rest } = props;
  return <NextLink href={href ?? screenHref("StaffSchedule")} {...rest} />;
}

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="text-[15px] leading-[22px] font-semibold">
      {children}
    </h2>
  );
}

/** Staff member's own page: profile, payslips behind a PIN, leave, documents, assets, help desk (artifact: StaffMe). */
export function StaffMeView({
  persona,
  data,
}: {
  persona: Persona;
  data: StaffMeData;
  /** Ignored: the payslips open only behind a PIN this phone can check, and none can be checked yet. */
  initialPayslips?: "locked" | "unlocked";
}) {
  const { profile, payslips, balance, requests, assets, topics } = data;
  const [unlocked, setUnlocked] = useState(false);
  const [sheet, setSheet] = useState<"" | "pin" | "help">("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [openSlip, setOpenSlip] = useState<string | null>("sep");
  const [lang, setLang] = useState<"en" | "rw">("en");
  const [topic, setTopic] = useState("uniform");
  const [signingOut, startSignOut] = useTransition();
  const t = COPY[lang];

  const pending = payslips.find((p) => p.status === "pending");
  const available = payslips.filter((p) => p.status === "available");
  const cur = available.find((p) => p.id === openSlip);
  const asked = requests.filter((q) => q.status === "manager").reduce((a, q) => a + q.days, 0);
  const topicDoc = topics.find((x) => x.id === topic) ?? topics[0];

  const documents: StaffDocument[] = data.documents;
  const tickets: HelpTicket[] = data.tickets;

  const press = (d: string) => {
    const next = (pin + d).slice(0, 4);
    if (next.length < 4) {
      setPin(next);
      setPinError(false);
      return;
    }
    // A full PIN cannot be checked against anything, so it opens nothing.
    setPin("");
    setPinError(true);
  };

  const closeSheet = () => {
    setSheet("");
    setPin("");
  };

  return (
    <>
      <PhoneTop>
        <h1 className="flex-1 text-[22px] leading-7 font-semibold">{t.me}</h1>
        {data.clockedInAt ? (
          <Chip color="success" variant="soft">
            <StatusDot tone="success" />
            <Chip.Label>In since {data.clockedInAt}</Chip.Label>
          </Chip>
        ) : (
          <Chip variant="soft">
            <StatusDot tone="default" />
            <Chip.Label>Not clocked in</Chip.Label>
          </Chip>
        )}
      </PhoneTop>

      <PhoneBody>
        <Card render={renderSection} aria-label="Profile" className="flex-row items-center gap-[12px] p-[16px]">
          <Avatar size="lg" variant="soft" color="accent">
            <Avatar.Fallback>{persona.initials}</Avatar.Fallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-base leading-[22px] font-semibold">{persona.name}</span>
            <span className="text-[13px] leading-[18px] text-muted">
              {persona.role} · {profile.workplace}
            </span>
            <span className="text-xs leading-4 text-muted tabular">
              Staff no. {profile.staffNo} · since {profile.since}
            </span>
          </div>
        </Card>

        <section className="flex flex-col gap-[8px]" aria-labelledby="pay-h">
          <div className="flex min-h-11 items-center justify-between">
            <SectionTitle id="pay-h">{t.payslips}</SectionTitle>
            {unlocked ? (
              <Button
                variant="ghost"
                className="min-h-11"
                onPress={() => {
                  setUnlocked(false);
                  setOpenSlip("sep");
                }}
              >
                <Lock className="size-4" />
                Lock
              </Button>
            ) : null}
          </div>
          {!unlocked ? (
            <ItemCard<"button">
              render={renderAsButton}
              onClick={() => {
                setSheet("pin");
                setPin("");
                setPinError(false);
              }}
              className="min-h-16 w-full cursor-pointer text-left"
            >
              <ItemCard.Icon>
                <Lock />
              </ItemCard.Icon>
              <ItemCard.Content>
                <ItemCard.Title>Payslips are locked</ItemCard.Title>
                <ItemCard.Description className="whitespace-normal">
                  Enter your PIN to see your pay. It locks again when you leave.
                </ItemCard.Description>
              </ItemCard.Content>
              <ItemCard.Action>
                <ChevronRight className="size-4 text-muted" />
              </ItemCard.Action>
            </ItemCard>
          ) : (
            <>
              <ListView
                aria-label="Payslips"
                className="shrink-0"
                onAction={(key) => {
                  const id = String(key);
                  if (id === pending?.id) return;
                  setOpenSlip((o) => (o === id ? null : id));
                }}
              >
                {pending ? (
                  <ListView.Item id={pending.id} textValue={pending.month} className="min-h-16 items-start">
                    <ListView.ItemContent className="items-start">
                      <Hourglass className="mt-[2px] size-4 shrink-0" aria-hidden="true" />
                      <div className="flex min-w-0 flex-col gap-[2px]">
                        <ListView.Title>{pending.month}</ListView.Title>
                        <span className="text-xs leading-4 whitespace-normal text-muted">{pending.note}</span>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                      <Chip size="sm" variant="soft">
                        Not released yet
                      </Chip>
                    </ListView.ItemAction>
                  </ListView.Item>
                ) : null}
                {available.map((p) => (
                  <ListView.Item key={p.id} id={p.id} textValue={p.month} className="min-h-[60px]">
                    <ListView.ItemContent>
                      <FileText className="size-4 shrink-0" aria-hidden="true" />
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>{p.month}</ListView.Title>
                        <ListView.Description className="tabular">
                          Net {formatRwf(p.net ?? 0)} · paid {p.paid}
                        </ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction className="flex items-center gap-[6px]">
                      <Chip size="sm" variant="soft" color="success">
                        Available
                      </Chip>
                      {openSlip === p.id ? (
                        <ChevronUp className="size-4 text-muted" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="size-4 text-muted" aria-hidden="true" />
                      )}
                    </ListView.ItemAction>
                  </ListView.Item>
                ))}
              </ListView>
              {cur ? (
                <Card render={renderSection} aria-labelledby="slip-h" className="gap-[10px] p-[16px]">
                  <div className="flex flex-col">
                    <h3 id="slip-h" className="text-[15px] leading-[22px] font-semibold">
                      {cur.month} payslip
                    </h3>
                    <span className="text-xs leading-4 text-muted">{cur.employer}</span>
                  </div>
                  <dl className="flex flex-col gap-[6px]">
                    {cur.lines.map((l) => {
                      const strong = l.kind === "total" || l.kind === "subtotal";
                      const muted = l.kind === "earning" || l.kind === "deduction";
                      return (
                        <div
                          key={l.label}
                          className={`flex items-center justify-between gap-[8px] leading-5 ${
                            l.kind === "total" ? "text-base" : "text-[13px]"
                          } ${strong ? "border-t border-separator pt-[6px] font-semibold" : ""} ${
                            muted ? "text-muted" : ""
                          }`}
                        >
                          <dt>{l.label}</dt>
                          <dd className="tabular">
                            {l.kind === "deduction" ? `− ${formatRwf(l.amount)}` : formatRwf(l.amount)}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  <p className="flex items-start gap-[8px] text-xs leading-4 text-muted">
                    <CircleCheck className="mt-[1px] size-4 shrink-0" aria-hidden="true" />
                    <span>
                      Paid {cur.paid} to {cur.payTo} · ref {cur.ref}
                    </span>
                  </p>
                  <p className="text-xs leading-4 text-muted">
                    {cur.rules}. Run confirmed by {cur.confirmedBy} on {cur.confirmed}.
                  </p>
                  <div className="grid grid-cols-2 gap-[8px]">
                    <Button
                      variant="secondary"
                      size="lg"
                      fullWidth
                      className="min-h-12"
                      onPress={() => toast.warning("Saving a payslip PDF on the phone is not available yet.")}
                    >
                      <ArrowDownToLine className="size-4" />
                      Save PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="lg"
                      fullWidth
                      className="min-h-12"
                      onPress={() => {
                        setTopic("pay");
                        setSheet("help");
                      }}
                    >
                      <CircleQuestion className="size-4" />
                      Ask about it
                    </Button>
                  </div>
                </Card>
              ) : null}
            </>
          )}
        </section>

        <section className="flex flex-col gap-[8px]" aria-labelledby="lv-h">
          <SectionTitle id="lv-h">{t.leave}</SectionTitle>
          <ItemCard<"a"> render={renderLeaveLink} href={screenHref("StaffSchedule")} className="min-h-16 no-underline">
            <ItemCard.Icon>
              <Suitcase />
            </ItemCard.Icon>
            <ItemCard.Content>
              <ItemCard.Title className="tabular">{balance.left} days of annual leave left</ItemCard.Title>
              <ItemCard.Description>
                {asked} days asked for · waiting for {balance.waitingFor}
              </ItemCard.Description>
            </ItemCard.Content>
            <ItemCard.Action>
              <ChevronRight className="size-4 text-muted" />
            </ItemCard.Action>
          </ItemCard>
        </section>

        <section className="flex flex-col gap-[8px]" aria-labelledby="doc-h">
          <div className="flex min-h-11 items-center justify-between">
            <SectionTitle id="doc-h">{t.docs}</SectionTitle>
            <Button
              variant="ghost"
              className="min-h-11"
              onPress={() => toast.warning("Documents cannot be sent from the phone yet. Hand the paper to HR.")}
            >
              <Camera className="size-4" />
              Add
            </Button>
          </div>
          <ListView aria-label={t.docs} items={documents} className="shrink-0">
            {(d) => (
              <ListView.Item id={d.id} textValue={d.name} className="min-h-14">
                <ListView.ItemContent>
                  <Icon name={d.icon} className="size-4 shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title>{d.name}</ListView.Title>
                    <ListView.Description>{d.meta}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <Chip size="sm" variant="soft" color={toneColor(d.tone)}>
                    {d.chip}
                  </Chip>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
          <p className="text-xs leading-4 text-muted">Only you and HR can see these.</p>
        </section>

        <section className="flex flex-col gap-[8px]" aria-labelledby="as-h">
          <SectionTitle id="as-h">{t.assets}</SectionTitle>
          <ListView aria-label={t.assets} items={assets} className="shrink-0">
            {(a) => (
              <ListView.Item id={a.id} textValue={a.name} className="min-h-14">
                <ListView.ItemContent>
                  <Icon name={a.icon} className="size-4 shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title>{a.name}</ListView.Title>
                    <ListView.Description>{a.meta}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <Chip size="sm" variant="soft" color={toneColor(a.tone)}>
                    {a.chip}
                  </Chip>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
        </section>

        <section className="flex flex-col gap-[8px]" aria-labelledby="hd-h">
          <SectionTitle id="hd-h">{t.help}</SectionTitle>
          <ListView aria-label={t.help} items={tickets} className="shrink-0">
            {(k) => (
              <ListView.Item id={k.id} textValue={k.title} className="min-h-14">
                <ListView.ItemContent>
                  <LifeRing className="size-4 shrink-0" aria-hidden="true" />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title>{k.title}</ListView.Title>
                    <ListView.Description className="tabular">{k.meta}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <Chip size="sm" variant="soft" color={toneColor(k.tone)}>
                    {k.chip}
                  </Chip>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
          <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setSheet("help")}>
            <Comment className="size-4" />
            Ask HR or IT
          </Button>
        </section>

        <section className="flex flex-col gap-[8px]" aria-labelledby="lang-h">
          <SectionTitle id="lang-h">{t.lang}</SectionTitle>
          <Segment
            aria-labelledby="lang-h"
            size="lg"
            selectedKey={lang}
            onSelectionChange={(k) => setLang(k === "rw" ? "rw" : "en")}
            className="w-full"
          >
            <Segment.Item id="en" className="h-11 flex-1">
              English
            </Segment.Item>
            <Segment.Item id="rw" className="h-11 flex-1">
              Kinyarwanda
            </Segment.Item>
          </Segment>
          {lang === "rw" ? <p className="text-xs leading-4 text-muted">Some screens are still in English.</p> : null}
        </section>

        <Button
          variant="danger-soft"
          size="lg"
          fullWidth
          className="min-h-14 shrink-0"
          isPending={signingOut}
          onPress={() => startSignOut(() => signOut())}
        >
          <ArrowRightFromSquare className="size-4" />
          {t.signout}
        </Button>
        <p className="text-center text-xs leading-4 text-muted">Shared phone? Sign out at the end of every shift.</p>
      </PhoneBody>

      <PhoneSheet
        isOpen={sheet === "pin"}
        onOpenChange={(o) => !o && closeSheet()}
        centered
        media={
          <ToneTile tone="accent">
            <ShieldKeyhole />
          </ToneTile>
        }
        heading="Enter your PIN"
        description="Payslips show your salary, so we check it is you."
      >
        <div
          role="img"
          aria-label={`${pin.length} of 4 digits entered`}
          className="flex items-center justify-center gap-[14px]"
        >
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`size-[14px] rounded-full shadow-[inset_0_0_0_1.5px_var(--border)] ${
                i < pin.length ? "bg-foreground" : ""
              }`}
            />
          ))}
        </div>
        {pinError ? (
          <p role="alert" className="text-center text-[13px] text-warning-soft-foreground">
            {PIN_UNAVAILABLE}
          </p>
        ) : null}
        <div className="grid w-full grid-cols-3 gap-[8px]">
          {KEYS.map((k) => (
            <Fragment key={k}>
              {k === "bio" ? (
                <Button
                  variant="ghost"
                  aria-label="Use fingerprint"
                  className="h-14 w-full"
                  onPress={() => {
                    setPin("");
                    setPinError(true);
                  }}
                >
                  <Fingerprint className="size-5" />
                </Button>
              ) : k === "del" ? (
                <Button
                  variant="ghost"
                  aria-label="Delete last digit"
                  className="h-14 w-full"
                  onPress={() => setPin((p) => p.slice(0, -1))}
                >
                  <ArrowLeft className="size-5" />
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  aria-label={k}
                  className="h-14 w-full text-xl font-semibold tabular"
                  onPress={() => press(k)}
                >
                  {k}
                </Button>
              )}
            </Fragment>
          ))}
        </div>
        <div className="flex w-full items-center justify-between">
          <Button variant="ghost" className="min-h-11" onPress={closeSheet}>
            Cancel
          </Button>
          <span className="text-xs text-muted">Forgot it? Ask HR.</span>
        </div>
      </PhoneSheet>

      <PhoneSheet
        isOpen={sheet === "help"}
        onOpenChange={(o) => !o && closeSheet()}
        heading="Ask HR or IT"
        description="Sending a question from the phone is not available yet. Ask HR in person."
      >
        <ToggleButtonGroup
          aria-label="Topic"
          selectionMode="single"
          disallowEmptySelection
          isDetached
          selectedKeys={[topic]}
          onSelectionChange={(keys) => {
            const k = [...keys][0];
            if (k) setTopic(String(k));
          }}
          className="flex-wrap justify-start gap-[6px]"
        >
          {topics.map((q) => (
            <ToggleButton key={q.id} id={q.id} className="h-11">
              {q.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField key={topic} defaultValue={topicDoc.draft} fullWidth className="flex flex-col gap-1">
          <Label>Your question</Label>
          <TextArea rows={3} />
        </TextField>
        <div className="grid grid-cols-[1fr_2fr] gap-[8px]">
          <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={closeSheet}>
            Cancel
          </Button>
          <Button
            size="lg"
            fullWidth
            className="min-h-14"
            onPress={() => {
              setSheet("");
              toast.warning("Questions cannot be sent to HR or IT from the phone yet. Ask HR in person.");
            }}
          >
            <PaperPlane className="size-4" />
            Send
          </Button>
        </div>
      </PhoneSheet>
      <PhoneToasts />
    </>
  );
}
