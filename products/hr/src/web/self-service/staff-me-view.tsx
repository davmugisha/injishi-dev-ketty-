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
  Hourglass,
  LifeRing,
  Lock,
  Megaphone,
  PaperPlane,
  Plus,
  ShieldKeyhole,
  Star,
  Suitcase,
} from "@gravity-ui/icons";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Label,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  toast,
} from "@heroui/react";
import { ItemCard, ListView, Segment } from "@heroui-pro/react";
import { formatRwf, Icon, LinkButton, PhoneBody, PhoneTop, StatusDot, toneColor } from "@injishi/ui";
import { PhoneSheet, PhoneToasts, renderAsButton, renderSection, ToneTile } from "@injishi/ui/phone";
import NextLink from "next/link";
import { type ComponentPropsWithRef, Fragment, useRef, useState, useTransition } from "react";
import type { Persona } from "../../model/shared.ts";
import type {
  HelpTicket,
  HelpTopic,
  LeaveBalance,
  LeaveType,
  LoanedAsset,
  Payslip,
  RequestStatus,
  StaffAnnouncement,
  StaffClaim,
  StaffDocument,
  StaffLoan,
  StaffOwnReview,
  StaffProfile,
  StaffRequest,
  StaffTone,
} from "../../model/staff.ts";
import { useBoardHref, useHrActions, useHrFeature } from "../mount.tsx";
import { pressKey, reported } from "../reported.ts";

export interface StaffMeData {
  profile: StaffProfile;
  payslips: Payslip[];
  balance: LeaveBalance;
  requests: StaffRequest[];
  documents: StaffDocument[];
  assets: LoanedAsset[];
  tickets: HelpTicket[];
  topics: HelpTopic[];
  /** Money the person asked to be paid back. */
  claims: StaffClaim[];
  /** The person's loans and advances: read only, HR records them. */
  loans: StaffLoan[];
  /** The kinds of leave the person may ask more days of. */
  leaveTypes: LeaveType[];
  /** What HR posted that is for this person, newest first. */
  announcements: StaffAnnouncement[];
  /** The person's own reviews, the latest cycle first. */
  reviews: StaffOwnReview[];
}

/** What a new hire most often hands in; "Other" takes a title of one's own. */
const USUAL_DOCUMENTS = ["ID copy", "Certificate", "Driving licence", "Other"];

const COPY = {
  en: {
    me: "Me",
    payslips: "Payslips",
    leave: "Leave",
    clock: "Clock times",
    docs: "My documents",
    assets: "Assets on loan",
    help: "Help desk",
    news: "From HR",
    review: "My review",
    money: "Money back",
    loans: "Loans and advances",
    lang: "Language",
    signout: "Sign out",
  },
  rw: {
    me: "Njye",
    payslips: "Impapuro z’umushahara",
    leave: "Ikiruhuko",
    clock: "Amasaha yanjye",
    docs: "Inyandiko zanjye",
    assets: "Ibikoresho nahawe",
    help: "Ubufasha",
    news: "Amatangazo",
    review: "Isuzuma ryanjye",
    money: "Gusubizwa amafaranga",
    loans: "Inguzanyo na avansi",
    lang: "Ururimi",
    signout: "Sohoka",
  },
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "gap", "0", "del"] as const;

/** A request's answer, as a chip; whatever still waits can be taken back. */
const ASK_STATUS: Record<RequestStatus, { chip: string; tone: StaffTone; canCancel: boolean }> = {
  colleague: { chip: "With a colleague", tone: "default", canCancel: true },
  manager: { chip: "Waiting", tone: "warning", canCancel: true },
  approved: { chip: "Approved", tone: "success", canCancel: false },
  declined: { chip: "Declined", tone: "danger", canCancel: false },
  cancelled: { chip: "Cancelled", tone: "default", canCancel: false },
};

/** The leave card's link: the card always passes the schedule's address as `href`. */
function renderLeaveLink(props: ComponentPropsWithRef<"a">) {
  const { href, ...rest } = props;
  return <NextLink href={href ?? ""} {...rest} />;
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
  initialPayslips = "locked",
}: {
  persona: Persona;
  data: StaffMeData;
  initialPayslips?: "locked" | "unlocked";
}) {
  const {
    checkPayslipPinAction,
    signOut,
    askClaimAction,
    askExtraDaysAction,
    askFixAction,
    askHelpAction,
    cancelClaimAction,
    cancelRequestAction,
    handInDocumentAction,
    replyHelpAction,
    sendSelfReviewAction,
  } = useHrActions();
  const screenHref = useBoardHref();
  // Features Injishi may switch off for the business: their sections, and the buttons opening them, go.
  const claimsOn = useHrFeature("claims");
  const loansOn = useHrFeature("loans");
  const deskOn = useHrFeature("helpDesk");
  const newsOn = useHrFeature("announcements");
  const reviewsOn = useHrFeature("reviews");
  const assetsOn = useHrFeature("assets");
  const { profile, payslips, balance, requests, assets, topics, claims, loans, leaveTypes, announcements, reviews } =
    data;
  const [unlocked, setUnlocked] = useState(initialPayslips === "unlocked");
  const [sheet, setSheet] = useState<
    "" | "pin" | "help" | "reply" | "news" | "review" | "doc" | "claim" | "extra" | "fix"
  >("");
  // The announcement being read, the question being answered, the review being written.
  const [reading, setReading] = useState<StaffAnnouncement | null>(null);
  const [replyTo, setReplyTo] = useState<HelpTicket | null>(null);
  const [reviewing, setReviewing] = useState<StaffOwnReview | null>(null);
  const [words, setWords] = useState("");
  // Handing in a document: the one HR asked for, or a new one under a title.
  const [docFor, setDocFor] = useState<StaffDocument | null>(null);
  const [docTitle, setDocTitle] = useState(USUAL_DOCUMENTS[0] as string);
  const [otherTitle, setOtherTitle] = useState("");
  const [picked, setPicked] = useState<File | null>(null);
  const filePick = useRef<HTMLInputElement>(null);
  // Money back and extra days.
  const [amount, setAmount] = useState("");
  const [what, setWhat] = useState("");
  const [extraType, setExtraType] = useState(leaveTypes.find((l) => l.usesBalance)?.id ?? leaveTypes[0]?.id ?? "");
  const [extraDays, setExtraDays] = useState("1");
  const [extraWhy, setExtraWhy] = useState("");
  // Asking for a day's clock times to be put right.
  const [fixDay, setFixDay] = useState("");
  const [fixIn, setFixIn] = useState("");
  const [fixOut, setFixOut] = useState("");
  const [fixWhy, setFixWhy] = useState("");
  const [sending, startSending] = useTransition();
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [openSlip, setOpenSlip] = useState<string | null>("sep");
  const [pdfSaved, setPdfSaved] = useState(false);
  const [lang, setLang] = useState<"en" | "rw">("en");
  const [topic, setTopic] = useState(topics[0]?.id ?? "pay");
  const [question, setQuestion] = useState("");
  const [asking, startAsking] = useTransition();
  const [signingOut, startSignOut] = useTransition();
  const t = COPY[lang];

  /** Open the document sheet: for one HR asked for, or (null) a new one. */
  const openDoc = (d: StaffDocument | null) => {
    setDocFor(d);
    setDocTitle(USUAL_DOCUMENTS[0] as string);
    setOtherTitle("");
    setPicked(null);
    setSheet("doc");
  };
  const sendDoc = () => {
    const title = docTitle === "Other" ? otherTitle.trim() : docTitle;
    const form = new FormData();
    if (picked) form.append("file", picked);
    if (docFor) form.append("documentId", docFor.id);
    else form.append("title", title);
    startSending(async () => {
      if (!reported(await handInDocumentAction(form))) return;
      setSheet("");
      toast.success(`${docFor?.name ?? title} sent to HR.`);
    });
  };
  const sendClaim = () => {
    const form = new FormData();
    form.append("amount", amount);
    form.append("reason", what);
    form.append("key", pressKey());
    if (picked) form.append("receipt", picked);
    startSending(async () => {
      if (!reported(await askClaimAction(form))) return;
      setSheet("");
      toast.success("Sent for approval. Once approved it comes with your pay.");
    });
  };
  const sendExtra = () =>
    startSending(async () => {
      const days = Number(extraDays.replace(",", "."));
      if (!reported(await askExtraDaysAction({ leaveTypeId: extraType, days, reason: extraWhy }))) return;
      setSheet("");
      toast.success("Sent. Nothing is added until approved.");
    });
  const sendFix = () =>
    startSending(async () => {
      if (!reported(await askFixAction({ workDate: fixDay, inAt: fixIn, outAt: fixOut, reason: fixWhy }))) return;
      setSheet("");
      toast.success("Sent. Your hours change only when it is approved.");
    });
  /** What the person asked for and the answer: extra days under leave, corrections under clock times. */
  const askList = (label: string, asks: StaffRequest[]) => (
    <ListView aria-label={label} items={asks} className="shrink-0">
      {(q) => {
        const s = ASK_STATUS[q.status];
        return (
          <ListView.Item id={q.id} textValue={q.title} className="min-h-14">
            <ListView.ItemContent>
              <div className="flex min-w-0 flex-col">
                <ListView.Title className="whitespace-normal">{q.title}</ListView.Title>
                <ListView.Description className="whitespace-normal">
                  {[q.sub, q.steps].filter(Boolean).join(" · ")}
                </ListView.Description>
              </div>
            </ListView.ItemContent>
            <ListView.ItemAction>
              {s.canCancel ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-11"
                  isDisabled={sending}
                  onPress={() =>
                    startSending(async () => {
                      if (reported(await cancelRequestAction(q.id))) toast.success("Taken back.");
                    })
                  }
                >
                  Take back
                </Button>
              ) : null}
              <Chip size="sm" variant="soft" color={toneColor(s.tone)}>
                {s.chip}
              </Chip>
            </ListView.ItemAction>
          </ListView.Item>
        );
      }}
    </ListView>
  );
  /** The phone's own file picker: a photo from the camera, or a file already on the phone. */
  const photoField = (label: string) => (
    <>
      <input
        ref={filePick}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          setPicked(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => filePick.current?.click()}>
        <Camera className="size-4" />
        {picked ? `${picked.name} · change` : label}
      </Button>
    </>
  );

  const pending = payslips.find((p) => p.status === "pending");
  const available = payslips.filter((p) => p.status === "available");
  const cur = available.find((p) => p.id === openSlip);
  const asked = requests.filter((q) => q.status === "manager").reduce((a, q) => a + q.days, 0);
  const extraAsks = requests.filter((q) => q.id.startsWith("extra:"));
  const clockFixes = requests.filter((q) => q.id.startsWith("fix:"));

  const documents: StaffDocument[] = data.documents;
  const tickets: HelpTicket[] = data.tickets;

  const press = (d: string) => {
    const next = (pin + d).slice(0, 4);
    if (next.length < 4) {
      setPin(next);
      setPinError("");
      return;
    }
    setPin("");
    startSending(async () => {
      const result = await checkPayslipPinAction(next);
      if (result.ok) {
        setPinError("");
        setUnlocked(true);
        setSheet("");
      } else setPinError(result.error);
    });
  };

  const closeSheet = () => {
    setSheet("");
    setPin("");
    setReplyTo(null);
  };

  return (
    <>
      <PhoneToasts />
      <PhoneTop>
        <h1 className="flex-1 text-[22px] leading-7 font-semibold">{t.me}</h1>
        {profile.clockedInAt ? (
          <Chip color="success" variant="soft">
            <StatusDot tone="success" />
            <Chip.Label>In since {profile.clockedInAt}</Chip.Label>
          </Chip>
        ) : null}
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
              Staff no. {profile.staffNo}
              {profile.since ? ` · since ${profile.since}` : ""}
            </span>
          </div>
        </Card>

        {newsOn && announcements.length > 0 ? (
          <section className="flex flex-col gap-[8px]" aria-labelledby="news-h">
            <SectionTitle id="news-h">{t.news}</SectionTitle>
            <ListView
              aria-label={t.news}
              items={announcements.slice(0, 5)}
              className="shrink-0"
              onAction={(key) => {
                setReading(announcements.find((a) => a.id === String(key)) ?? null);
                setSheet("news");
              }}
            >
              {(a) => (
                <ListView.Item id={a.id} textValue={a.title} className="min-h-14">
                  <ListView.ItemContent>
                    <Megaphone className="size-4 shrink-0" aria-hidden="true" />
                    <div className="flex min-w-0 flex-col">
                      <ListView.Title className="whitespace-normal">{a.title}</ListView.Title>
                      <ListView.Description>{a.meta}</ListView.Description>
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction>
                    <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                  </ListView.ItemAction>
                </ListView.Item>
              )}
            </ListView>
          </section>
        ) : null}

        <div className="grid grid-cols-2 gap-[8px]">
          <LinkButton href="/clock" variant="secondary" className="min-h-12 w-full">
            Clock in or out
          </LinkButton>
          <LinkButton href="/me" variant="secondary" className="min-h-12 w-full">
            All my HR
          </LinkButton>
        </div>

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
                setPinError("");
              }}
              className="min-h-16 w-full cursor-pointer text-left"
            >
              <ItemCard.Icon>
                <Lock />
              </ItemCard.Icon>
              <ItemCard.Content>
                <ItemCard.Title>Payslips are locked</ItemCard.Title>
                <ItemCard.Description className="whitespace-normal">
                  Enter your PIN to see your pay.
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
                          Net {formatRwf(p.net ?? 0)}
                          {p.paid ? ` · paid ${p.paid}` : " · payment on its way"}
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
                    {cur.employer ? <span className="text-xs leading-4 text-muted">{cur.employer}</span> : null}
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
                  {cur.paid ? (
                    <p className="flex items-start gap-[8px] text-xs leading-4 text-muted">
                      <CircleCheck className="mt-[1px] size-4 shrink-0" aria-hidden="true" />
                      <span>
                        Paid {cur.paid}
                        {cur.payTo ? ` to ${cur.payTo}` : ""}
                        {cur.ref ? ` · ref ${cur.ref}` : ""}
                      </span>
                    </p>
                  ) : null}
                  {cur.confirmedBy ? (
                    <p className="text-xs leading-4 text-muted">
                      {cur.rules}. Run confirmed by {cur.confirmedBy} on {cur.confirmed}.
                    </p>
                  ) : null}
                  <div className={deskOn ? "grid grid-cols-2 gap-[8px]" : "grid gap-[8px]"}>
                    <Button
                      variant="secondary"
                      size="lg"
                      fullWidth
                      className="min-h-12"
                      onPress={() => {
                        // A payslip from the person's own file downloads the PDF the API drew.
                        if (cur.pdfHref) window.location.assign(cur.pdfHref);
                        else setPdfSaved(true);
                      }}
                    >
                      <ArrowDownToLine className="size-4" />
                      Save PDF
                    </Button>
                    {deskOn ? (
                      <Button
                        variant="ghost"
                        size="lg"
                        fullWidth
                        className="min-h-12"
                        onPress={() => {
                          setTopic("pay");
                          setQuestion("");
                          setSheet("help");
                        }}
                      >
                        <CircleQuestion className="size-4" />
                        Ask about it
                      </Button>
                    ) : null}
                  </div>
                  {pdfSaved ? (
                    <p role="status" className="text-xs leading-4 text-muted">
                      Saved to this phone. Opens with your PIN.
                    </p>
                  ) : null}
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
          {leaveTypes.length > 0 ? (
            <Button
              variant="ghost"
              className="min-h-11 self-start"
              onPress={() => {
                setExtraDays("1");
                setExtraWhy("");
                setSheet("extra");
              }}
            >
              <Plus className="size-4" />
              Ask for extra days
            </Button>
          ) : null}
          {extraAsks.length > 0 ? askList("Extra days asked for", extraAsks) : null}
        </section>

        <section className="flex flex-col gap-[8px]" aria-labelledby="ck-h">
          <div className="flex min-h-11 items-center justify-between">
            <SectionTitle id="ck-h">{t.clock}</SectionTitle>
            <Button
              variant="ghost"
              className="min-h-11"
              onPress={() => {
                setFixDay("");
                setFixIn("");
                setFixOut("");
                setFixWhy("");
                setSheet("fix");
              }}
            >
              <Plus className="size-4" />
              Ask
            </Button>
          </div>
          {clockFixes.length === 0 ? (
            <p className="text-xs leading-4 text-muted">Forgot to clock, or a time is wrong? Ask HR to put it right.</p>
          ) : (
            askList(t.clock, clockFixes)
          )}
        </section>

        <section className="flex flex-col gap-[8px]" aria-labelledby="doc-h">
          <div className="flex min-h-11 items-center justify-between">
            <SectionTitle id="doc-h">{t.docs}</SectionTitle>
            <Button variant="ghost" className="min-h-11" onPress={() => openDoc(null)}>
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
                  {d.canSend ? (
                    <Button size="sm" variant="secondary" className="min-h-11" onPress={() => openDoc(d)}>
                      <Camera className="size-4" />
                      Send
                    </Button>
                  ) : null}
                  <Chip size="sm" variant="soft" color={toneColor(d.tone)}>
                    {d.chip}
                  </Chip>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
          <p className="text-xs leading-4 text-muted">Only you and HR can see these.</p>
        </section>

        {claimsOn ? (
          <section className="flex flex-col gap-[8px]" aria-labelledby="mb-h">
            <div className="flex min-h-11 items-center justify-between">
              <SectionTitle id="mb-h">{t.money}</SectionTitle>
              <Button
                variant="ghost"
                className="min-h-11"
                onPress={() => {
                  setAmount("");
                  setWhat("");
                  setPicked(null);
                  setSheet("claim");
                }}
              >
                <Plus className="size-4" />
                Ask
              </Button>
            </div>
            {claims.length === 0 ? (
              <p className="text-xs leading-4 text-muted">
                Paid for something at work? Ask for it back. It comes with your pay.
              </p>
            ) : (
              <ListView aria-label={t.money} items={claims} className="shrink-0">
                {(c) => (
                  <ListView.Item id={c.id} textValue={c.title} className="min-h-14">
                    <ListView.ItemContent>
                      <Icon name="Receipt" className="size-4 shrink-0" />
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>{c.title}</ListView.Title>
                        <ListView.Description>{c.meta}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                      {c.canCancel ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="min-h-11"
                          isDisabled={sending}
                          onPress={() =>
                            startSending(async () => {
                              if (reported(await cancelClaimAction(c.id))) toast.success("Taken back.");
                            })
                          }
                        >
                          Take back
                        </Button>
                      ) : null}
                      <Chip size="sm" variant="soft" color={toneColor(c.tone)}>
                        {c.chip}
                      </Chip>
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
            )}
          </section>
        ) : null}

        {loansOn ? (
          <section className="flex flex-col gap-[8px]" aria-labelledby="ln-h">
            <div className="flex min-h-11 items-center justify-between">
              <SectionTitle id="ln-h">{t.loans}</SectionTitle>
              {deskOn ? (
                <Button
                  variant="ghost"
                  className="min-h-11"
                  onPress={() => {
                    // An advance is asked through the help desk: HR reads it under Pay and records it if it is agreed.
                    setTopic("pay");
                    setQuestion("I would like a salary advance of RWF ");
                    setSheet("help");
                  }}
                >
                  <Plus className="size-4" />
                  Ask for an advance
                </Button>
              ) : null}
            </div>
            {loans.length === 0 ? (
              <p className="text-xs leading-4 text-muted">You have no loan or advance.</p>
            ) : (
              <ListView aria-label={t.loans} items={loans} className="shrink-0">
                {(l) => (
                  <ListView.Item id={l.id} textValue={l.title} className="min-h-14">
                    <ListView.ItemContent>
                      <Icon name="Wallet" className="size-4 shrink-0" />
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>{l.title}</ListView.Title>
                        <ListView.Description>{l.meta}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                      <Chip size="sm" variant="soft" color={toneColor(l.tone)}>
                        {l.chip}
                      </Chip>
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
            )}
          </section>
        ) : null}

        {assetsOn ? (
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
        ) : null}

        {deskOn ? (
          <section className="flex flex-col gap-[8px]" aria-labelledby="hd-h">
            <SectionTitle id="hd-h">{t.help}</SectionTitle>
            <ListView aria-label={t.help} items={tickets} className="shrink-0">
              {(k) => (
                <ListView.Item id={k.id} textValue={k.title} className="min-h-14">
                  <ListView.ItemContent>
                    <LifeRing className="size-4 shrink-0" aria-hidden="true" />
                    <div className="flex min-w-0 flex-col">
                      <ListView.Title>{k.title}</ListView.Title>
                      {k.answer ? (
                        <span className="mt-1 rounded-lg bg-surface-secondary px-2.5 py-1.5 text-[13px] leading-[18px] whitespace-normal">
                          {k.answer}
                        </span>
                      ) : null}
                      <ListView.Description className="tabular">{k.meta}</ListView.Description>
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction className="flex flex-col items-end gap-1">
                    <Chip size="sm" variant="soft" color={toneColor(k.tone)}>
                      {k.chip}
                    </Chip>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-11"
                      onPress={() => {
                        setReplyTo(k);
                        setWords("");
                        setSheet("reply");
                      }}
                    >
                      Reply
                    </Button>
                  </ListView.ItemAction>
                </ListView.Item>
              )}
            </ListView>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              className="min-h-14"
              onPress={() => {
                setQuestion("");
                setSheet("help");
              }}
            >
              <Comment className="size-4" />
              Ask HR or IT
            </Button>
          </section>
        ) : null}

        {reviewsOn && reviews.length > 0 ? (
          <section className="flex flex-col gap-[8px]" aria-labelledby="rv-h">
            <SectionTitle id="rv-h">{t.review}</SectionTitle>
            <ListView aria-label={t.review} items={reviews.slice(0, 3)} className="shrink-0">
              {(r) => (
                <ListView.Item id={r.id} textValue={r.title} className="min-h-14">
                  <ListView.ItemContent>
                    <Star className="size-4 shrink-0" aria-hidden="true" />
                    <div className="flex min-w-0 flex-col">
                      <ListView.Title className="whitespace-normal">{r.title}</ListView.Title>
                      {r.note ? (
                        <span className="mt-1 rounded-lg bg-surface-secondary px-2.5 py-1.5 text-[13px] leading-[18px] whitespace-normal">
                          {r.note}
                        </span>
                      ) : null}
                      <ListView.Description>{r.meta}</ListView.Description>
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction className="flex flex-col items-end gap-1">
                    <Chip size="sm" variant="soft" color={toneColor(r.tone)}>
                      {r.chip}
                    </Chip>
                    {r.canWrite ? (
                      <Button
                        size="sm"
                        variant={r.note ? "ghost" : "secondary"}
                        className="min-h-11"
                        onPress={() => {
                          setReviewing(r);
                          setWords(r.note ?? "");
                          setSheet("review");
                        }}
                      >
                        {r.note ? "Change" : "Write"}
                      </Button>
                    ) : null}
                  </ListView.ItemAction>
                </ListView.Item>
              )}
            </ListView>
          </section>
        ) : null}

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
        <p className="text-center text-xs leading-4 text-muted">Shared phone? Sign out after every shift.</p>
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
        description="To see your payslips."
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
          <p role="alert" className="text-[13px] text-danger-soft-foreground">
            {pinError}
          </p>
        ) : null}
        <div className="grid w-full grid-cols-3 gap-[8px]">
          {KEYS.map((k) => (
            <Fragment key={k}>
              {k === "gap" ? (
                <span aria-hidden="true" />
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
        description="HR answers here, usually within a day."
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
        <TextField value={question} onChange={setQuestion} fullWidth className="flex flex-col gap-1">
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
            isPending={asking}
            isDisabled={!question.trim()}
            onPress={() =>
              startAsking(async () => {
                const r = await askHelpAction(topic, question);
                if (!r.ok) {
                  toast.danger(r.error);
                  return;
                }
                setSheet("");
                setQuestion("");
                toast.success("Sent to HR. The answer shows here.");
              })
            }
          >
            <PaperPlane className="size-4" />
            Send
          </Button>
        </div>
      </PhoneSheet>

      <PhoneSheet
        isOpen={sheet === "reply"}
        onOpenChange={(o) => !o && setSheet("")}
        heading="Reply to HR"
        description={replyTo?.title ?? ""}
      >
        {replyTo?.answer ? (
          <p className="rounded-lg bg-surface-secondary px-2.5 py-1.5 text-[13px] leading-[18px]">{replyTo.answer}</p>
        ) : null}
        <TextField value={words} onChange={setWords} fullWidth className="flex flex-col gap-1">
          <Label>Your reply</Label>
          <TextArea rows={3} />
        </TextField>
        <div className="grid grid-cols-[1fr_2fr] gap-[8px]">
          <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setSheet("")}>
            Cancel
          </Button>
          <Button
            size="lg"
            fullWidth
            className="min-h-14"
            isPending={sending}
            isDisabled={words.trim().length < 2}
            onPress={() =>
              startSending(async () => {
                if (!replyTo || !reported(await replyHelpAction(replyTo.id, words))) return;
                setSheet("");
                toast.success("Sent to HR.");
              })
            }
          >
            <PaperPlane className="size-4" />
            Send
          </Button>
        </div>
      </PhoneSheet>

      <PhoneSheet
        isOpen={sheet === "news"}
        onOpenChange={(o) => !o && setSheet("")}
        heading={reading?.title ?? ""}
        description={reading?.meta ?? ""}
      >
        <p className="text-sm leading-5 whitespace-pre-line">{reading?.body}</p>
        <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setSheet("")}>
          Close
        </Button>
      </PhoneSheet>

      <PhoneSheet
        isOpen={sheet === "review"}
        onOpenChange={(o) => !o && setSheet("")}
        heading="My review"
        description="HR and your manager read this."
      >
        <TextField value={words} onChange={setWords} fullWidth className="flex flex-col gap-1">
          <Label>What went well, and what you would change</Label>
          <TextArea rows={4} />
        </TextField>
        <div className="grid grid-cols-[1fr_2fr] gap-[8px]">
          <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setSheet("")}>
            Cancel
          </Button>
          <Button
            size="lg"
            fullWidth
            className="min-h-14"
            isPending={sending}
            isDisabled={words.trim().length < 3}
            onPress={() =>
              startSending(async () => {
                if (!reviewing || !reported(await sendSelfReviewAction(reviewing.id, words))) return;
                setSheet("");
                toast.success("Your review is sent.");
              })
            }
          >
            <PaperPlane className="size-4" />
            Send
          </Button>
        </div>
      </PhoneSheet>

      <PhoneSheet
        isOpen={sheet === "doc"}
        onOpenChange={(o) => !o && setSheet("")}
        heading={docFor ? `Send ${docFor.name}` : "Hand in a document"}
        description="Clear photo or PDF, up to 10 MB. HR checks it first."
      >
        {docFor ? null : (
          <ToggleButtonGroup
            aria-label="What it is"
            selectionMode="single"
            disallowEmptySelection
            isDetached
            selectedKeys={[docTitle]}
            onSelectionChange={(keys) => {
              const k = [...keys][0];
              if (k) setDocTitle(String(k));
            }}
            className="flex-wrap justify-start gap-[6px]"
          >
            {USUAL_DOCUMENTS.map((name) => (
              <ToggleButton key={name} id={name} className="h-11">
                {name}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
        {!docFor && docTitle === "Other" ? (
          <TextField value={otherTitle} onChange={setOtherTitle} fullWidth className="flex flex-col gap-1">
            <Label>What it is</Label>
            <Input placeholder="Food handler's certificate" />
          </TextField>
        ) : null}
        {photoField("Take a photo or choose a file")}
        <div className="grid grid-cols-[1fr_2fr] gap-[8px]">
          <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setSheet("")}>
            Cancel
          </Button>
          <Button
            size="lg"
            fullWidth
            className="min-h-14"
            isPending={sending}
            isDisabled={!picked || (!docFor && docTitle === "Other" && otherTitle.trim().length < 2)}
            onPress={sendDoc}
          >
            <PaperPlane className="size-4" />
            Send
          </Button>
        </div>
      </PhoneSheet>

      <PhoneSheet
        isOpen={sheet === "claim"}
        onOpenChange={(o) => !o && setSheet("")}
        heading="Ask for money back"
        description="Once approved, it comes with your pay."
      >
        <TextField value={amount} onChange={setAmount} fullWidth className="flex flex-col gap-1">
          <Label>Amount in RWF</Label>
          <Input inputMode="numeric" placeholder="12000" />
        </TextField>
        <TextField value={what} onChange={setWhat} fullWidth className="flex flex-col gap-1">
          <Label>What it was for</Label>
          <TextArea rows={2} placeholder="Taxi to the supplier for the laundry order" />
        </TextField>
        {photoField("Photo of the receipt (optional)")}
        <div className="grid grid-cols-[1fr_2fr] gap-[8px]">
          <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setSheet("")}>
            Cancel
          </Button>
          <Button
            size="lg"
            fullWidth
            className="min-h-14"
            isPending={sending}
            isDisabled={!amount.trim() || what.trim().length < 3}
            onPress={sendClaim}
          >
            <PaperPlane className="size-4" />
            Send for approval
          </Button>
        </div>
      </PhoneSheet>

      <PhoneSheet
        isOpen={sheet === "fix"}
        onOpenChange={(o) => !o && setSheet("")}
        heading="Ask to fix a clock time"
        description="For a wrong time, or a day with no record."
      >
        <TextField value={fixDay} onChange={setFixDay} fullWidth className="flex flex-col gap-1">
          <Label>Which day</Label>
          <Input type="date" />
        </TextField>
        <div className="grid grid-cols-2 gap-[8px]">
          <TextField value={fixIn} onChange={setFixIn} fullWidth className="flex flex-col gap-1">
            <Label>Clock in</Label>
            <Input type="time" />
          </TextField>
          <TextField value={fixOut} onChange={setFixOut} fullWidth className="flex flex-col gap-1">
            <Label>Clock out</Label>
            <Input type="time" />
          </TextField>
        </div>
        <TextField value={fixWhy} onChange={setFixWhy} fullWidth className="flex flex-col gap-1">
          <Label>What happened</Label>
          <TextArea rows={2} placeholder="I forgot to clock out after my shift" />
        </TextField>
        <div className="grid grid-cols-[1fr_2fr] gap-[8px]">
          <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setSheet("")}>
            Cancel
          </Button>
          <Button
            size="lg"
            fullWidth
            className="min-h-14"
            isPending={sending}
            isDisabled={!fixDay || !fixIn || !fixOut || fixWhy.trim().length < 3}
            onPress={sendFix}
          >
            <PaperPlane className="size-4" />
            Ask
          </Button>
        </div>
      </PhoneSheet>

      <PhoneSheet
        isOpen={sheet === "extra"}
        onOpenChange={(o) => !o && setSheet("")}
        heading="Ask for extra days"
        description="Days on top of your leave. Nothing is added until approved."
      >
        <ToggleButtonGroup
          aria-label="Kind of leave"
          selectionMode="single"
          disallowEmptySelection
          isDetached
          selectedKeys={[extraType]}
          onSelectionChange={(keys) => {
            const k = [...keys][0];
            if (k) setExtraType(String(k));
          }}
          className="flex-wrap justify-start gap-[6px]"
        >
          {leaveTypes.map((l) => (
            <ToggleButton key={l.id} id={l.id} className="h-11">
              {l.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField value={extraDays} onChange={setExtraDays} fullWidth className="flex flex-col gap-1">
          <Label>How many days</Label>
          <Input inputMode="decimal" />
        </TextField>
        <TextField value={extraWhy} onChange={setExtraWhy} fullWidth className="flex flex-col gap-1">
          <Label>Why</Label>
          <TextArea rows={2} placeholder="I worked the Easter weekend for the wedding" />
        </TextField>
        <div className="grid grid-cols-[1fr_2fr] gap-[8px]">
          <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setSheet("")}>
            Cancel
          </Button>
          <Button
            size="lg"
            fullWidth
            className="min-h-14"
            isPending={sending}
            isDisabled={!extraType || !extraDays.trim() || extraWhy.trim().length < 3}
            onPress={sendExtra}
          >
            <PaperPlane className="size-4" />
            Ask
          </Button>
        </div>
      </PhoneSheet>
    </>
  );
}
