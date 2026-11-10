"use client";

import {
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  CircleCheck,
  FileText,
  PersonPlus,
  Persons,
  ShieldCheck,
  Star,
  Xmark,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  Chip,
  Drawer,
  Input,
  Label,
  Modal,
  Popover,
  Tabs,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { EmptyState, Kanban, KPIGroup, NativeSelect, Rating, Segment, Stepper } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { formatRwf, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { type DropItem, isTextDropItem, useDragAndDrop } from "react-aria-components";
import type { Done } from "../../model/commands.ts";
import type {
  CandidateStage,
  Onboarding,
  TalentBoardView,
  TalentCandidate,
  TalentReviewCycle,
  TalentVacancy,
} from "../../model/talent.ts";
import { DOCUMENT_CHOICES } from "../../model/talent.ts";
import { useBoardHref, useHrActions, useHrFeature } from "../mount.tsx";
import { avatarColor, Hint, initials, PanelCard, Person, Ring, TAB_CLASS, Tip } from "../people/parts";
import { ReviewsPanel } from "./reviews-panel";

const STAGES: { id: Exclude<CandidateStage, "rejected">; title: string; color: string }[] = [
  { id: "applied", title: "Applied", color: "var(--chart-5)" },
  { id: "screening", title: "Screening", color: "var(--chart-4)" },
  { id: "interview", title: "Interview", color: "var(--chart-2)" },
  { id: "offer", title: "Offer", color: "var(--warning)" },
  { id: "hired", title: "Hired", color: "var(--chart-1)" },
];
const SOURCES = ["Walk-in", "Referral", "Job board", "Social media", "Talent pool", "Other"];
const KPI_CLASS = "min-w-[min(140px,100%)] flex-[1_1_140px]";

type Part = "pipeline" | "roles" | "interviews" | "joining" | "reviews";

const NO_SCORE = { what: "Interview", score: 4, note: "" };

/**
 * Selected and hovered card styles. React Aria wraps GridList item content in a `gridcell`, so the kit's
 * `.kanban__card[data-selected] > .kanban__card-content` rule no longer reaches the content box.
 */
const CARD_STATES =
  "data-[selected=true]:[&_[data-slot=kanban-card-content]]:bg-accent-soft data-[hovered=true]:[&_[data-slot=kanban-card-content]]:shadow-sm";

const stageIndex = (stage: CandidateStage) => STAGES.findIndex((s) => s.id === stage);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "28 Oct" for "2026-10-28". */
const dm = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const kigali = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kigali", ...o }).format(new Date(iso));

/** What a dragged card carries: the candidate's id. */
const DRAG = "application/x-injishi-candidate";

/** One stage of the pipeline. Its cards drag to another stage; a drop asks the board to move that person. */
function StageColumn({
  stage,
  cards,
  selected,
  onSelect,
  onDrop,
}: {
  stage: (typeof STAGES)[number];
  cards: TalentCandidate[];
  selected: string | undefined;
  onSelect: (id: string) => void;
  onDrop: (id: string, to: CandidateStage) => void;
}) {
  const take = async (items: DropItem[]) => {
    for (const item of items) if (isTextDropItem(item)) onDrop(await item.getText(DRAG), stage.id);
  };
  const { dragAndDropHooks } = useDragAndDrop<TalentCandidate>({
    getItems: (keys) =>
      [...keys].map((k) => ({ [DRAG]: String(k), "text/plain": cards.find((c) => c.id === k)?.fullName ?? "" })),
    acceptedDragTypes: [DRAG],
    getDropOperation: () => "move",
    onRootDrop: (e) => take(e.items),
    onInsert: (e) => take(e.items),
    onItemDrop: (e) => take(e.items),
  });
  return (
    <Kanban.Column>
      <Kanban.ColumnHeader>
        <Kanban.ColumnIndicator style={{ backgroundColor: stage.color }} />
        <Kanban.ColumnTitle>{stage.title}</Kanban.ColumnTitle>
        <Kanban.ColumnCount>{cards.length}</Kanban.ColumnCount>
      </Kanban.ColumnHeader>
      <Kanban.ColumnBody>
        <Kanban.CardList
          aria-label={`${stage.title} candidates`}
          items={cards}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={selected ? new Set([selected]) : new Set()}
          onSelectionChange={(keys) => {
            if (keys !== "all") {
              const [first] = keys;
              if (first !== undefined) onSelect(String(first));
            }
          }}
          dragAndDropHooks={dragAndDropHooks}
          renderEmptyState={() => <span className="block px-1 py-3 text-center text-xs text-muted">Nobody</span>}
        >
          {(c) => (
            <Kanban.Card id={c.id} textValue={c.fullName} className={CARD_STATES}>
              <Kanban.DragHandle aria-label={`Move ${c.fullName}`} />
              <Person name={c.fullName} sub={c.vacancyTitle} className="text-[13px]" />
              {c.stage === "offer" && c.offerWageRwf ? (
                <Chip size="sm" variant="soft" color="warning" className="self-start tabular">
                  {formatRwf(c.offerWageRwf)}
                </Chip>
              ) : null}
            </Kanban.Card>
          )}
        </Kanban.CardList>
      </Kanban.ColumnBody>
    </Kanban.Column>
  );
}

/** A small form in a popover: its fields, and one button that sends them. `close` shuts it once they are saved. */
function PopForm({
  label,
  trigger,
  submit,
  disabled,
  pending,
  onSubmit,
  children,
}: {
  label: string;
  trigger: ReactNode;
  submit: string;
  disabled?: boolean;
  pending: boolean;
  onSubmit: (close: () => void) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      {trigger}
      <Popover.Content placement="bottom start" className="w-[300px] p-3">
        <Popover.Dialog aria-label={label} className="flex flex-col gap-2.5">
          {children}
          <Button size="sm" isPending={pending} isDisabled={disabled} onPress={() => onSubmit(() => setOpen(false))}>
            {submit}
          </Button>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </span>
  );
}

/** Which documents a role asks for: the usual list to tick, and room for one the list lacks. */
function DocumentPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [extra, setExtra] = useState("");
  const choices = [...DOCUMENT_CHOICES, ...value.filter((d) => !(DOCUMENT_CHOICES as readonly string[]).includes(d))];
  const toggle = (d: string, on: boolean) => onChange(on ? [...value, d] : value.filter((x) => x !== d));
  const add = () => {
    const d = extra.trim();
    if (d.length >= 2 && !value.includes(d)) onChange([...value, d]);
    setExtra("");
  };
  return (
    <div className="flex flex-col gap-2">
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {choices.map((d) => (
          <li key={d}>
            <Checkbox isSelected={value.includes(d)} onChange={(on) => toggle(d, on)}>
              <Checkbox.Content className="gap-2 text-[13px]">
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                {d}
              </Checkbox.Content>
            </Checkbox>
          </li>
        ))}
      </ul>
      <div className="flex items-end gap-2">
        <TextField value={extra} onChange={setExtra} aria-label="Another document" className="flex-1">
          <Input placeholder="Another document" />
        </TextField>
        <Button size="sm" variant="secondary" isDisabled={extra.trim().length < 2} onPress={add}>
          Add
        </Button>
      </div>
    </div>
  );
}

/** The role's documents on its card: how many it asks for, and a popover to change them. */
function VacancyDocuments({
  v,
  pending,
  run,
}: {
  v: TalentVacancy;
  pending: boolean;
  run: (task: () => Promise<Done>, done: string, after?: () => void) => void;
}) {
  const { setVacancyDocumentsAction } = useHrActions();
  const [draft, setDraft] = useState(v.documents);
  const [open, setOpen] = useState(false);
  return (
    <Popover
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(v.documents);
      }}
    >
      <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
        <FileText className="size-3.5" aria-hidden="true" />
        {v.documents.length ? `${v.documents.length} documents` : "Documents"}
      </Button>
      <Popover.Content placement="bottom start" className="w-[min(420px,92vw)] p-3">
        <Popover.Dialog aria-label={`Documents for ${v.title}`} className="flex flex-col gap-3">
          <span className="text-sm font-semibold">Ask applicants to send</span>
          <DocumentPicker value={draft} onChange={setDraft} />
          <Button
            size="sm"
            isPending={pending}
            onPress={() =>
              run(
                () => setVacancyDocumentsAction(v.id, draft),
                "Documents saved.",
                () => setOpen(false),
              )
            }
          >
            Save
          </Button>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/** What an applicant sent against what the role asks, and their progress page to share. */
function ApplicantFiles({ c, asks }: { c: TalentCandidate; asks: string[] }) {
  if (!asks.length && !c.applicationLink) return null;
  return (
    <Card variant="secondary" className="gap-2 p-3">
      {asks.length ? (
        <>
          <span className="text-[13px] font-semibold">
            Documents · {c.documents.filter((d) => asks.includes(d.name)).length} of {asks.length}
          </span>
          <ul className="flex flex-col gap-1">
            {asks.map((name) => {
              const d = c.documents.find((x) => x.name === name);
              return (
                <li key={name} className="flex items-center gap-2 text-[13px]">
                  {d ? (
                    <CircleCheck className="size-4 shrink-0 text-accent" aria-label="Sent" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="size-4 shrink-0 rounded-full border-[1.5px] border-dashed border-muted"
                    />
                  )}
                  <span className="flex-1">{name}</span>
                  {d ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs font-medium text-accent-soft-foreground"
                    >
                      {d.filename}
                    </a>
                  ) : (
                    <span className="text-xs text-muted">Not sent yet</span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {c.applicationLink ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-separator pt-2 text-xs">
          <span className="flex-1 text-muted">
            {c.email ? "Their page is in every email." : "No email on file. Share their page another way."}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onPress={() => {
              const link = c.applicationLink ?? "";
              void navigator.clipboard.writeText(link).then(() => toast.success("Link copied."));
            }}
          >
            Copy their link
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

const SIDE = {
  business: { said: "We offered", color: "var(--accent)" },
  candidate: { said: "They asked", color: "var(--warning)" },
} as const;

/**
 * The salary talk on an open offer: where each figure sits in the role's range, every round so far
 * and who put it, then the next move: offer again, note what they ask back, or agree on the last
 * figure. Agreeing above the range is the owner's to do; the API says so.
 */
function OfferTalk({
  c,
  vacancy,
  pending,
  run,
}: {
  c: TalentCandidate;
  vacancy: TalentVacancy | undefined;
  pending: boolean;
  run: (task: () => Promise<Done>, done: string, after?: () => void) => void;
}) {
  const { addOfferRoundAction, agreeOfferAction } = useHrActions();
  const [form, setForm] = useState({ wage: "", note: "" });
  const reset = () => setForm({ wage: "", note: "" });
  const latest = (side: "business" | "candidate") => [...c.rounds].reverse().find((r) => r.side === side);
  const ours = latest("business");
  const theirs = latest("candidate");
  const last = c.rounds.at(-1);
  const onTable = last?.amountRwf ?? c.offerWageRwf;
  const agreed = c.agreedWageRwf;
  const lo = vacancy?.wageFromRwf ?? null;
  const hi = vacancy?.wageToRwf ?? null;
  const aboveRange = (n: number | null | undefined) => hi !== null && n != null && n > hi;

  const marks = [
    c.expectedWageRwf !== null
      ? { label: "Asked when applying", value: c.expectedWageRwf, color: "var(--chart-5)" }
      : null,
    ours && agreed === null ? { label: "Our offer", value: ours.amountRwf, color: SIDE.business.color } : null,
    theirs && agreed === null ? { label: "Their ask", value: theirs.amountRwf, color: SIDE.candidate.color } : null,
    agreed !== null ? { label: "Agreed", value: agreed, color: "var(--success)" } : null,
  ].filter((m): m is { label: string; value: number; color: string } => m !== null);
  const values = [...marks.map((m) => m.value), lo, hi].filter((n): n is number => n !== null);
  const min = Math.min(...values) * 0.94;
  const max = Math.max(...values) * 1.06;
  const at = (n: number) => `${((n - min) / (max - min || 1)) * 100}%`;

  const fields = (
    <>
      <Field label="Monthly wage (RWF)">
        <TextField value={form.wage} onChange={(v) => setForm((f) => ({ ...f, wage: v }))} aria-label="Monthly wage">
          <Input inputMode="numeric" placeholder="350,000" />
        </TextField>
      </Field>
      <Field label="Note (optional)">
        <TextField value={form.note} onChange={(v) => setForm((f) => ({ ...f, note: v }))} aria-label="Note">
          <Input placeholder="Includes transport" />
        </TextField>
      </Field>
    </>
  );

  return (
    <Card variant="secondary" className="gap-3 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">{agreed !== null ? "Wage agreed" : "Salary talk"}</span>
        {lo !== null || hi !== null ? (
          <span className="text-xs text-muted tabular">
            Range {lo !== null ? formatRwf(lo) : "…"} – {hi !== null ? formatRwf(hi) : "…"}
          </span>
        ) : null}
      </div>

      {marks.length ? (
        <div className="flex flex-col gap-2">
          <div
            role="img"
            aria-label={marks.map((m) => `${m.label} ${formatRwf(m.value)}`).join(", ")}
            className="relative h-3 rounded-full bg-default"
          >
            {lo !== null && hi !== null ? (
              <span
                className="absolute inset-y-0 rounded-full bg-accent-soft"
                style={{ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` }}
              />
            ) : null}
            {marks.map((m) => (
              <span
                key={m.label}
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
                style={{ left: at(m.value), background: m.color }}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {marks.map((m) => (
              <li key={m.label} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full" style={{ background: m.color }} />
                <span className="text-muted">{m.label}</span>
                <span className="font-semibold tabular">{formatRwf(m.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {c.rounds.length ? (
        <ol aria-label="Rounds so far" className="flex flex-col gap-1.5">
          {c.rounds.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-[13px]">
              <span
                aria-hidden="true"
                className="mt-1.5 size-2 shrink-0 rounded-full"
                style={{ background: SIDE[r.side].color }}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span>
                  {SIDE[r.side].said} <span className="font-semibold tabular">{formatRwf(r.amountRwf)}</span>
                  {r.startsOn ? <span className="text-muted"> · starts {dm(r.startsOn)}</span> : null}
                </span>
                {r.note ? <span className="text-xs text-muted">{r.note}</span> : null}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {kigali(r.createdAt, { day: "numeric", month: "short" })}
                {r.byName ? ` · ${r.byName.split(" ")[0]}` : ""}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {agreed === null ? (
        <div className="flex flex-wrap items-center gap-2">
          <PopForm
            label={`Offer ${c.fullName} again`}
            trigger={
              <Button size="sm" variant="secondary">
                Offer again
              </Button>
            }
            submit="Record our offer"
            pending={pending}
            disabled={!form.wage.replace(/\D/g, "")}
            onSubmit={(close) =>
              run(
                () => addOfferRoundAction(c.id, "business", form.wage, form.note),
                "Offer recorded.",
                () => {
                  reset();
                  close();
                },
              )
            }
          >
            {fields}
          </PopForm>
          <PopForm
            label={`What ${c.fullName} asks`}
            trigger={
              <Button size="sm" variant="secondary">
                They ask…
              </Button>
            }
            submit="Record their ask"
            pending={pending}
            disabled={!form.wage.replace(/\D/g, "")}
            onSubmit={(close) =>
              run(
                () => addOfferRoundAction(c.id, "candidate", form.wage, form.note),
                "Their ask recorded.",
                () => {
                  reset();
                  close();
                },
              )
            }
          >
            {fields}
          </PopForm>
          {onTable ? (
            <Button
              size="sm"
              className="ml-auto"
              isPending={pending}
              onPress={() =>
                run(() => agreeOfferAction(c.id, onTable), `Agreed at ${formatRwf(onTable)} with ${c.fullName}.`)
              }
            >
              <Check className="size-4" aria-hidden="true" />
              Agree at {formatRwf(onTable)}
            </Button>
          ) : null}
          {aboveRange(onTable) ? (
            <span className="basis-full text-xs text-warning-soft-foreground">
              Above the range: the owner agrees to it.
            </span>
          ) : null}
        </div>
      ) : (
        <span className="text-xs text-muted">
          {formatRwf(agreed)}
          {c.offerStartsOn ? ` from ${dm(c.offerStartsOn)}` : ""}. Hire them to open their staff file.
        </span>
      )}
    </Card>
  );
}

/**
 * Talent: the roles being filled and the people applying, moved stage by stage to a hire; the
 * interviews booked; the joining checklist of each new starter; and the review cycle of the people
 * on staff. Everything reads and writes the business's own records.
 */
export function TalentView({
  board,
  cycle,
  onboarding,
  branches,
  people,
  today,
}: {
  board: TalentBoardView;
  cycle: TalentReviewCycle | null;
  onboarding: Onboarding[];
  branches: { id: string; name: string }[];
  people: { id: string; name: string; title: string }[];
  today: string;
}) {
  const {
    addCandidateAction,
    bookInterviewAction,
    closeVacancyAction,
    interviewStatusAction,
    moveCandidateAction,
    openVacancyAction,
    scoreCandidateAction,
    tickOnboardingAction,
  } = useHrActions();
  const screenHref = useBoardHref();
  // Hiring (`talent`) and reviews are features Injishi may switch off; new starters' joining lists always stay.
  const hiringOn = useHrFeature("talent");
  const reviewsOn = useHrFeature("reviews");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [chosenPart, setPart] = useState<Part>("pipeline");
  const [vacancy, setVacancy] = useState("all");
  const [selectedId, setSelectedId] = useState(() => board.candidates.find((c) => c.stage === "offer")?.id ?? "");
  const [starter, setStarter] = useState(onboarding[0]?.id ?? "");
  // The drawers' and popovers' fields.
  const [vacOpen, setVacOpen] = useState(false);
  const [vac, setVac] = useState({
    title: "",
    branchId: "",
    openings: "1",
    wageFrom: "",
    wageTo: "",
    closesOn: "",
    managerEmployeeId: "",
    note: "",
    documents: [] as string[],
  });
  const [candOpen, setCandOpen] = useState(false);
  const [cand, setCand] = useState({
    vacancyId: "",
    fullName: "",
    phone: "",
    email: "",
    source: "Walk-in",
    note: "",
    talentPool: false,
    expectedWage: "",
  });
  const [reason, setReason] = useState("");
  const [offer, setOffer] = useState({ wage: "", startsOn: plusDays(today, 7) });
  const [score, setScore] = useState(NO_SCORE);
  const [iv, setIv] = useState({ when: `${plusDays(today, 1)}T10:00`, place: "", interviewer: "" });

  const run = (task: () => Promise<Done>, done: string, after?: () => void) =>
    start(async () => {
      const r = await task();
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      toast.success(done);
      after?.();
    });

  const open = board.vacancies.filter((v) => v.status === "open");
  const live = board.candidates.filter((c) => c.stage !== "rejected");
  const shown = live.filter((c) => vacancy === "all" || c.vacancyId === vacancy);
  const turnedDown = board.candidates.filter(
    (c) => c.stage === "rejected" && (vacancy === "all" || c.vacancyId === vacancy),
  ).length;
  const cur = shown.find((c) => c.id === selectedId) ?? shown.find((c) => c.stage === "offer") ?? shown[0];
  const curId = cur?.id;
  const curIdx = cur ? stageIndex(cur.stage) : 0;
  const inPipeline = live.filter((c) => c.stage !== "hired").length;
  const offers = live.filter((c) => c.stage === "offer").length;
  const coming = board.interviews.filter((i) => i.status === "scheduled");
  const starterNow = onboarding.find((o) => o.id === starter) ?? onboarding[0];
  const starterDone = starterNow ? starterNow.tasks.filter((t) => t.doneAt).length : 0;
  const reviewsLeft = cycle?.status === "open" ? cycle.reviews.filter((r) => r.rating === null).length : 0;
  const parts = (
    [
      ["pipeline", "Pipeline", shown.length],
      ["roles", "Roles", open.length],
      ["interviews", "Interviews", coming.length],
      ["joining", "Joining", onboarding.length],
      ["reviews", "Reviews", reviewsLeft],
    ] as const
  ).filter(([id]) => id === "joining" || (id === "reviews" ? reviewsOn : hiringOn));
  // A tab whose feature went off falls back to the first one left (Joining is always there).
  const part: Part = parts.some(([id]) => id === chosenPart) ? chosenPart : (parts[0]?.[0] ?? "joining");

  // What was typed for one candidate never carries over to the next.
  useEffect(() => {
    if (curId === undefined) return;
    setReason("");
    setOffer({ wage: "", startsOn: plusDays(today, 7) });
    setScore(NO_SCORE);
    setIv({ when: `${plusDays(today, 1)}T10:00`, place: "", interviewer: "" });
  }, [curId, today]);

  const prefill = (c: TalentCandidate) =>
    `${screenHref("Employees")}/new?${new URLSearchParams({
      candidate: c.id,
      name: c.fullName,
      ...(c.phone ? { phone: c.phone } : {}),
      ...(c.email ? { email: c.email } : {}),
      ...(c.offerWageRwf ? { wage: String(c.offerWageRwf) } : {}),
      ...(c.offerStartsOn ? { start: c.offerStartsOn } : {}),
    }).toString()}`;

  // A card dropped on another stage: forward one or more steps, an offer with its terms, or the hire.
  const [dropped, setDropped] = useState<{ id: string; to: "offer" | "hired" } | null>(null);
  const droppedOne = dropped ? live.find((c) => c.id === dropped.id) : undefined;
  const dropOn = (id: string, to: CandidateStage) => {
    const c = live.find((x) => x.id === id);
    if (!c || c.stage === to) return;
    setSelectedId(id);
    if (c.stage === "hired") {
      toast.warning(`${c.fullName} is already hired.`);
    } else if (stageIndex(to) < stageIndex(c.stage)) {
      toast.warning("Candidates only move forward. To stop, turn them down.");
    } else if (to === "offer") {
      setDropped({ id, to });
    } else if (to === "hired") {
      if (c.stage === "offer" && c.agreedWageRwf !== null) setDropped({ id, to });
      else if (c.stage === "offer") toast.warning(`Agree on the wage with ${c.fullName} first.`);
      else toast.warning(`Make ${c.fullName} an offer first.`);
    } else {
      run(() => moveCandidateAction(id, to), `${c.fullName} moved to ${STAGES[stageIndex(to)].title}.`);
    }
  };

  const turnDown = (c: TalentCandidate) => (
    <PopForm
      label={`Turn down ${c.fullName}`}
      trigger={
        <Button size="sm" variant="ghost" className="text-danger">
          <Xmark className="size-4" aria-hidden="true" />
          Turn down
        </Button>
      }
      submit="Turn down"
      pending={pending}
      disabled={reason.trim().length < 3}
      onSubmit={(close) =>
        run(
          () => moveCandidateAction(c.id, "rejected", { reason }),
          `${c.fullName} turned down.`,
          () => {
            setReason("");
            close();
          },
        )
      }
    >
      <TextField value={reason} onChange={setReason} className="flex flex-col gap-1">
        <Label className="text-xs">Why</Label>
        <TextArea rows={2} placeholder="Took another job" />
      </TextField>
    </PopForm>
  );

  const scoreIt = (c: TalentCandidate) => (
    <PopForm
      label={`Score ${c.fullName}`}
      trigger={
        <Button size="sm" variant="ghost">
          <Star className="size-4" aria-hidden="true" />
          Score
        </Button>
      }
      submit="Save the score"
      pending={pending}
      disabled={score.what.trim().length < 2}
      onSubmit={(close) =>
        run(
          () => scoreCandidateAction(c.id, score.what, score.score, score.note),
          "Score saved.",
          () => {
            setScore(NO_SCORE);
            close();
          },
        )
      }
    >
      <Field label="For">
        <TextField value={score.what} onChange={(v) => setScore((s) => ({ ...s, what: v }))} aria-label="Scored for">
          <Input placeholder="Interview" />
        </TextField>
      </Field>
      <Rating value={score.score} onValueChange={(v) => setScore((s) => ({ ...s, score: v }))} aria-label="Score">
        {[1, 2, 3, 4, 5].map((n) => (
          <Rating.Item key={n} value={n} />
        ))}
      </Rating>
      <TextField value={score.note} onChange={(v) => setScore((s) => ({ ...s, note: v }))} aria-label="Note">
        <TextArea rows={2} placeholder="Strong on hygiene, slow on the line" />
      </TextField>
    </PopForm>
  );

  // Each new starter's joining list: always on, in its tab or, with nothing else left, by itself.
  const joining = (
    <PanelCard
      id="onb-h"
      title={starterNow ? `Joining · ${starterNow.employee.displayName.split(" ")[0]}` : "Joining"}
      leading={
        starterNow ? (
          <Avatar variant="soft" color={avatarColor(starterNow.employee.displayName)}>
            <Avatar.Fallback>{initials(starterNow.employee.displayName)}</Avatar.Fallback>
          </Avatar>
        ) : undefined
      }
      description={
        starterNow
          ? `${starterNow.employee.jobPositionTitle ?? "New starter"} · first day ${dm(starterNow.anchorOn)}`
          : undefined
      }
      action={
        starterNow ? (
          <Ring
            value={starterDone}
            max={starterNow.tasks.length}
            label={`${starterDone} of ${starterNow.tasks.length} done`}
            color={starterDone === starterNow.tasks.length ? "success" : "accent"}
            size="size-11"
          >
            <span className="text-xs">
              {starterDone}/{starterNow.tasks.length}
            </span>
          </Ring>
        ) : undefined
      }
      className="gap-3"
    >
      {onboarding.length > 1 ? (
        <Segment
          aria-label="New starter"
          size="sm"
          selectedKey={starterNow?.id}
          onSelectionChange={(k) => setStarter(String(k))}
          className="max-w-full overflow-x-auto"
        >
          {onboarding.map((o, n) => (
            <Segment.Item key={o.id} id={o.id}>
              {n > 0 ? <Segment.Separator /> : null}
              {o.employee.displayName.split(" ")[0]}
            </Segment.Item>
          ))}
        </Segment>
      ) : null}
      {!starterNow ? (
        <p className="text-[13px] text-muted">Nobody is joining right now.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {starterNow.tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-1">
              <Checkbox
                isSelected={!!t.doneAt}
                isDisabled={pending}
                onChange={(v) => run(() => tickOnboardingAction(t.id, v), v ? "Done." : "Not done.")}
              >
                <Checkbox.Content
                  className={`items-center gap-[10px] text-[13px] font-medium ${t.doneAt ? "text-muted line-through" : ""}`}
                >
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  {t.label}
                </Checkbox.Content>
              </Checkbox>
              <Hint label={`About ${t.label}`}>
                {t.detail ? `${t.detail} · ` : ""}
                {t.doneAt ? `done by ${t.doneByName ?? "HR"}` : `due ${dm(t.dueOn)}`}
              </Hint>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );

  return (
    <PageContent>
      <PageHeader
        eyebrow={hiringOn ? `${open.length} open ${open.length === 1 ? "role" : "roles"}` : undefined}
        title="Talent"
        actions={
          hiringOn ? (
            <>
              <Button variant="secondary" onPress={() => setVacOpen(true)}>
                <Briefcase className="size-4" aria-hidden="true" />
                Open a vacancy
              </Button>
              <Button
                isDisabled={open.length === 0}
                onPress={() => {
                  // A closed role in the filter takes no candidates, so the form starts on an open one.
                  setCand((x) => ({
                    ...x,
                    vacancyId: open.some((v) => v.id === vacancy) ? vacancy : (open[0]?.id ?? ""),
                  }));
                  setCandOpen(true);
                }}
              >
                <PersonPlus className="size-4" aria-hidden="true" />
                Add a candidate
              </Button>
            </>
          ) : undefined
        }
      />

      {/* The figures are hiring's; with it off, the joining count is on the tab and the list. */}
      {hiringOn ? (
        <section aria-label="Hiring at a glance">
          <KPIGroup className="flex-wrap">
            <KPI className={KPI_CLASS}>
              <KPI.Header>
                <KPI.Icon status="success">
                  <Briefcase />
                </KPI.Icon>
                <KPI.Title>Open roles</KPI.Title>
              </KPI.Header>
              <KPI.Content>
                <KPI.Value value={open.length} className="tabular" />
              </KPI.Content>
            </KPI>
            <KPIGroup.Separator />
            <KPI className={KPI_CLASS}>
              <KPI.Header>
                <KPI.Icon status="success">
                  <Persons />
                </KPI.Icon>
                <KPI.Title>In the pipeline</KPI.Title>
              </KPI.Header>
              <KPI.Content>
                <KPI.Value value={inPipeline} className="tabular" />
              </KPI.Content>
            </KPI>
            <KPIGroup.Separator />
            <KPI className={KPI_CLASS}>
              <KPI.Header>
                <KPI.Icon status="success">
                  <Calendar />
                </KPI.Icon>
                <KPI.Title>Interviews booked</KPI.Title>
              </KPI.Header>
              <KPI.Content>
                <KPI.Value value={coming.length} className="tabular" />
              </KPI.Content>
            </KPI>
            <KPIGroup.Separator />
            <KPI className={KPI_CLASS}>
              <KPI.Header>
                <KPI.Icon status={offers ? "warning" : "success"}>
                  <FileText />
                </KPI.Icon>
                <KPI.Title>Offers out</KPI.Title>
              </KPI.Header>
              <KPI.Content>
                <KPI.Value value={offers} className="tabular" />
              </KPI.Content>
            </KPI>
            <KPIGroup.Separator />
            <KPI className={KPI_CLASS}>
              <KPI.Header>
                <KPI.Icon status="success">
                  <PersonPlus />
                </KPI.Icon>
                <KPI.Title>Joining</KPI.Title>
              </KPI.Header>
              <KPI.Content>
                <KPI.Value value={onboarding.length} className="tabular" />
              </KPI.Content>
            </KPI>
          </KPIGroup>
        </section>
      ) : null}

      {/* Joining alone needs no tabs: the list shows by itself. */}
      {parts.length > 1 ? (
        <Tabs variant="secondary" selectedKey={part} onSelectionChange={(k) => setPart(String(k) as Part)}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Talent" className="justify-start gap-1">
              {parts.map(([id, label, n]) => (
                <Tabs.Tab key={id} id={id} className={TAB_CLASS}>
                  {label}
                  {n ? (
                    <Chip size="sm" variant="soft">
                      {n}
                    </Chip>
                  ) : null}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>

          {hiringOn ? (
            <Tabs.Panel id="pipeline" className="flex flex-col gap-4 pt-4">
              {/* Pipeline */}
              <section className="flex flex-col gap-2.5" aria-labelledby="pipe-h">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="pipe-h" className="flex items-center gap-2 text-[15px] leading-[22px] font-semibold">
                    Pipeline
                    <Chip size="sm" variant="soft">
                      {shown.length}
                    </Chip>
                    {turnedDown ? (
                      <span className="text-xs font-normal text-muted">{turnedDown} turned down</span>
                    ) : null}
                  </h2>
                  {board.vacancies.length > 1 ? (
                    <Segment
                      aria-label="Vacancy"
                      size="sm"
                      selectedKey={vacancy}
                      onSelectionChange={(k) => setVacancy(String(k))}
                    >
                      <Segment.Item id="all">All</Segment.Item>
                      {board.vacancies.map((v) => (
                        <Segment.Item key={v.id} id={v.id}>
                          <Segment.Separator />
                          {v.title}
                        </Segment.Item>
                      ))}
                    </Segment>
                  ) : null}
                </div>
                <Kanban size="sm" className="[--kanban-column-gap:12px] [--kanban-column-min-width:200px]">
                  {STAGES.map((stage) => (
                    <StageColumn
                      key={stage.id}
                      stage={stage}
                      cards={shown.filter((c) => c.stage === stage.id)}
                      selected={cur?.id}
                      onSelect={setSelectedId}
                      onDrop={dropOn}
                    />
                  ))}
                </Kanban>
              </section>

              {/* The candidate */}
              {cur ? (
                <Card aria-labelledby="cand-h" className="gap-4 p-[18px]">
                  <div className="flex items-center gap-3">
                    <Avatar size="lg" variant="soft" color={avatarColor(cur.fullName)}>
                      <Avatar.Fallback>{initials(cur.fullName)}</Avatar.Fallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <h2 id="cand-h" className="text-[17px] leading-6 font-semibold">
                        {cur.fullName}
                      </h2>
                      <span className="truncate text-[13px] text-muted">
                        {cur.vacancyTitle}
                        {cur.phone ? ` · ${cur.phone}` : ""}
                      </span>
                    </div>
                    <Tip
                      tip={
                        cur.stage === "hired"
                          ? "Hired: kept under staff file rules"
                          : `${cur.talentPool ? "This role and the talent pool" : "This role only"} · deleted after ${dm(cur.keepUntil)}`
                      }
                    >
                      <ShieldCheck className="size-4 text-muted" aria-label="Data consent" />
                    </Tip>
                  </div>

                  <Stepper size="sm" currentStep={Math.max(0, curIdx)} aria-label="Hiring stage">
                    {STAGES.map((s) => (
                      <Stepper.Step key={s.id}>
                        <Stepper.Indicator />
                        <Stepper.Content>
                          <Stepper.Title className="text-xs">{s.title}</Stepper.Title>
                        </Stepper.Content>
                        <Stepper.Separator />
                      </Stepper.Step>
                    ))}
                  </Stepper>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip size="sm" variant="soft">
                      <Calendar className="size-3" aria-hidden="true" />
                      <Chip.Label>Applied {dm(cur.appliedOn)}</Chip.Label>
                    </Chip>
                    <Chip size="sm" variant="soft">
                      {cur.source}
                    </Chip>
                    {cur.expectedWageRwf !== null && cur.stage !== "offer" ? (
                      <Chip size="sm" variant="soft">
                        <Chip.Label className="tabular">Asks {formatRwf(cur.expectedWageRwf)}</Chip.Label>
                      </Chip>
                    ) : null}
                    {cur.email ? (
                      <Chip size="sm" variant="soft">
                        {cur.email}
                      </Chip>
                    ) : null}
                  </div>

                  <ApplicantFiles c={cur} asks={board.vacancies.find((v) => v.id === cur.vacancyId)?.documents ?? []} />

                  {cur.note ? (
                    <p className="rounded-xl bg-surface-secondary px-3 py-2 text-[13px] leading-[18px]">{cur.note}</p>
                  ) : null}

                  {cur.scores.length ? (
                    <ul className="flex flex-col gap-2" aria-label={`Scores for ${cur.fullName}`}>
                      {cur.scores.map((s) => (
                        <li key={s.id} className="flex items-center gap-3">
                          <span className="flex min-w-0 flex-1 items-center gap-1 text-[13px] font-medium">
                            {s.what}
                            <Hint label="Scored by">
                              {s.byName ?? "HR"}
                              {s.note ? ` · ${s.note}` : ""}
                            </Hint>
                          </span>
                          <Rating value={s.score} isReadOnly size="sm" aria-label={`${s.what}: ${s.score} of 5`}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Rating.Item key={n} value={n} />
                            ))}
                          </Rating>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {cur.stage === "offer" ? (
                    <>
                      <OfferTalk
                        key={cur.id}
                        c={cur}
                        vacancy={board.vacancies.find((v) => v.id === cur.vacancyId)}
                        pending={pending}
                        run={run}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        {cur.agreedWageRwf !== null ? (
                          <Button
                            className="flex-1"
                            isPending={pending}
                            onPress={() =>
                              run(
                                () => moveCandidateAction(cur.id, "hired"),
                                `${cur.fullName} hired. Finish their staff file.`,
                                () => router.push(prefill(cur)),
                              )
                            }
                          >
                            <PersonPlus className="size-4" aria-hidden="true" />
                            Hire · create their file
                          </Button>
                        ) : null}
                        {turnDown(cur)}
                      </div>
                    </>
                  ) : null}

                  {cur.stage === "hired" ? (
                    <Alert status="success" className="items-center">
                      <Alert.Indicator>
                        <CircleCheck />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>Hired</Alert.Title>
                        <Alert.Description>
                          {cur.offerStartsOn ? `Starts ${dm(cur.offerStartsOn)}` : "Welcome them aboard"}
                        </Alert.Description>
                      </Alert.Content>
                      {cur.hiredEmployeeId ? (
                        <LinkButton
                          href={`${screenHref("Employees")}?employee=${encodeURIComponent(cur.hiredEmployeeId)}`}
                          size="sm"
                          variant="secondary"
                        >
                          Open file
                        </LinkButton>
                      ) : (
                        <LinkButton href={prefill(cur)} size="sm" variant="secondary">
                          Create their file
                        </LinkButton>
                      )}
                    </Alert>
                  ) : null}

                  {curIdx >= 0 && curIdx < stageIndex("offer") ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {curIdx < stageIndex("interview") ? (
                        <Button
                          className="flex-1"
                          isPending={pending}
                          onPress={() =>
                            run(
                              () => moveCandidateAction(cur.id, STAGES[curIdx + 1].id),
                              `${cur.fullName} moved to ${STAGES[curIdx + 1].title}.`,
                            )
                          }
                        >
                          Move to {STAGES[curIdx + 1]?.title}
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </Button>
                      ) : (
                        <PopForm
                          label={`Offer to ${cur.fullName}`}
                          trigger={
                            <Button className="flex-1">
                              <FileText className="size-4" aria-hidden="true" />
                              Make an offer
                            </Button>
                          }
                          submit="Send the offer"
                          pending={pending}
                          disabled={!offer.wage.replace(/\D/g, "") || !offer.startsOn}
                          onSubmit={(close) =>
                            run(
                              () =>
                                moveCandidateAction(cur.id, "offer", {
                                  offerWage: offer.wage,
                                  offerStartsOn: offer.startsOn,
                                }),
                              `Offer recorded for ${cur.fullName}.`,
                              () => {
                                setOffer({ wage: "", startsOn: plusDays(today, 7) });
                                close();
                              },
                            )
                          }
                        >
                          <Field label="Gross a month (RWF)">
                            <TextField
                              value={offer.wage}
                              onChange={(v) => setOffer((o) => ({ ...o, wage: v }))}
                              aria-label="Offered wage"
                            >
                              <Input inputMode="numeric" placeholder="320,000" />
                            </TextField>
                          </Field>
                          <Field label="First day">
                            <TextField
                              value={offer.startsOn}
                              onChange={(v) => setOffer((o) => ({ ...o, startsOn: v }))}
                              aria-label="First day"
                            >
                              <Input type="date" min={today} />
                            </TextField>
                          </Field>
                        </PopForm>
                      )}
                      <PopForm
                        label={`Book an interview with ${cur.fullName}`}
                        trigger={
                          <Button variant="secondary">
                            <Calendar className="size-4" aria-hidden="true" />
                            Interview
                          </Button>
                        }
                        submit="Book it"
                        pending={pending}
                        disabled={!iv.when}
                        onSubmit={(close) =>
                          run(
                            () => bookInterviewAction({ candidateId: cur.id, ...iv }),
                            `Interview booked with ${cur.fullName}.`,
                            () => {
                              setIv({ when: `${plusDays(today, 1)}T10:00`, place: "", interviewer: "" });
                              close();
                            },
                          )
                        }
                      >
                        <Field label="When">
                          <TextField
                            value={iv.when}
                            onChange={(v) => setIv((x) => ({ ...x, when: v }))}
                            aria-label="When"
                          >
                            <Input type="datetime-local" />
                          </TextField>
                        </Field>
                        <Field label="Where">
                          <TextField
                            value={iv.place}
                            onChange={(v) => setIv((x) => ({ ...x, place: v }))}
                            aria-label="Where"
                          >
                            <Input placeholder="Terrace kitchen" />
                          </TextField>
                        </Field>
                        <Field label="With">
                          <TextField
                            value={iv.interviewer}
                            onChange={(v) => setIv((x) => ({ ...x, interviewer: v }))}
                            aria-label="Interviewer"
                          >
                            <Input placeholder="Who meets them" />
                          </TextField>
                        </Field>
                      </PopForm>
                      {scoreIt(cur)}
                      {turnDown(cur)}
                    </div>
                  ) : null}
                </Card>
              ) : (
                <Card className="p-4">
                  <EmptyState size="sm" className="py-6">
                    <EmptyState.Header>
                      <EmptyState.Media variant="icon">
                        <Persons />
                      </EmptyState.Media>
                      <EmptyState.Title>No candidates yet</EmptyState.Title>
                    </EmptyState.Header>
                  </EmptyState>
                </Card>
              )}
            </Tabs.Panel>
          ) : null}

          {hiringOn ? (
            <Tabs.Panel id="roles" className="flex flex-col gap-4 pt-4">
              {/* Vacancies */}
              {board.vacancies.length === 0 ? (
                <Card className="p-4">
                  <EmptyState size="sm" className="py-6">
                    <EmptyState.Header>
                      <EmptyState.Media variant="icon">
                        <Briefcase />
                      </EmptyState.Media>
                      <EmptyState.Title>No vacancies yet</EmptyState.Title>
                    </EmptyState.Header>
                  </EmptyState>
                </Card>
              ) : (
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
                  {board.vacancies.map((v) => {
                    const pct = (n: number) => `${v.counts.applied ? (n / v.counts.applied) * 100 : 0}%`;
                    return (
                      <Card key={v.id} aria-labelledby={`vac-${v.id}`} className="gap-3 p-4">
                        <div className="flex items-start gap-3">
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                            <Briefcase className="size-5" aria-hidden="true" />
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <h2 id={`vac-${v.id}`} className="text-[16px] leading-[22px] font-semibold">
                              {v.title}
                              {v.openings > 1 ? <span className="font-normal text-muted"> × {v.openings}</span> : null}
                            </h2>
                            <span className="truncate text-[13px] text-muted">{v.branchName ?? "Any branch"}</span>
                          </div>
                          <Chip
                            size="sm"
                            variant="soft"
                            color={v.status === "open" ? "success" : v.status === "filled" ? "accent" : "default"}
                            className="shrink-0"
                          >
                            {v.status === "open"
                              ? v.closesOn
                                ? `Closes ${dm(v.closesOn)}`
                                : "Open"
                              : v.status === "filled"
                                ? "Filled"
                                : "Closed"}
                          </Chip>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">
                              {v.counts.applied} applied ·{" "}
                              <span className="text-accent-soft-foreground">{v.counts.active} active</span>
                              {v.counts.hired ? ` · ${v.counts.hired} hired` : ""}
                            </span>
                            <span className="text-muted">{v.counts.declined} turned down</span>
                          </div>
                          <div
                            role="img"
                            aria-label={`${v.counts.applied} applied, ${v.counts.active} active, ${v.counts.declined} turned down`}
                            className="flex h-2 overflow-hidden rounded-full bg-default"
                          >
                            <span className="h-full bg-[var(--chart-1)]" style={{ width: pct(v.counts.hired) }} />
                            <span className="h-full bg-accent" style={{ width: pct(v.counts.active) }} />
                            <span
                              className="h-full bg-[var(--chart-other)]"
                              style={{ width: pct(v.counts.declined) }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {v.wageFromRwf || v.wageToRwf ? (
                            <Chip size="sm" variant="soft">
                              <Chip.Label className="tabular">
                                {v.wageFromRwf && v.wageToRwf
                                  ? `${formatRwf(v.wageFromRwf)}–${formatRwf(v.wageToRwf).replace("RWF ", "")}`
                                  : formatRwf(v.wageFromRwf ?? v.wageToRwf ?? 0)}
                              </Chip.Label>
                            </Chip>
                          ) : null}
                          {v.managerName ? (
                            <Tip tip={`Reports to ${v.managerName}`}>
                              <span className="flex items-center gap-1.5 text-xs text-muted">
                                <Avatar size="sm" variant="soft" color={avatarColor(v.managerName)} className="size-6">
                                  <Avatar.Fallback className="text-xs">{initials(v.managerName)}</Avatar.Fallback>
                                </Avatar>
                                {v.managerName.split(" ")[0]}
                              </span>
                            </Tip>
                          ) : null}
                          <VacancyDocuments v={v} pending={pending} run={run} />
                          {v.status === "open" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-auto"
                              isPending={pending}
                              onPress={() => run(() => closeVacancyAction(v.id, "closed"), `${v.title} closed.`)}
                            >
                              Close
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-auto"
                              isPending={pending}
                              onPress={() => run(() => closeVacancyAction(v.id, "open"), `${v.title} open again.`)}
                            >
                              Open again
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </Tabs.Panel>
          ) : null}

          {hiringOn ? (
            <Tabs.Panel id="interviews" className="flex flex-col gap-4 pt-4">
              {/* Interviews */}
              <PanelCard id="int-h" title="Interviews" className="gap-2.5">
                {coming.length === 0 ? <p className="px-1 text-[13px] text-muted">None booked.</p> : null}
                {coming.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 rounded-xl p-2">
                    <span className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-surface-secondary py-1 leading-tight">
                      <span className="text-xs font-semibold text-muted">
                        {kigali(i.startsAt, { weekday: "short" })}
                      </span>
                      <span className="text-[17px] font-semibold tabular">
                        {kigali(i.startsAt, { day: "numeric" })}
                      </span>
                      <span className="text-xs text-muted">{kigali(i.startsAt, { month: "short" })}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-semibold">{i.candidateName}</span>
                      <span className="truncate text-xs text-muted">
                        {i.vacancyTitle}
                        {i.place ? ` · ${i.place}` : ""}
                        {i.interviewerName ? ` · with ${i.interviewerName}` : ""}
                      </span>
                    </span>
                    <Chip size="sm" variant="soft" className="tabular">
                      {kigali(i.startsAt, { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </Chip>
                    <Tip tip="Held">
                      <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        aria-label={`Interview with ${i.candidateName} held`}
                        onPress={() => run(() => interviewStatusAction(i.id, "done"), "Marked held.")}
                      >
                        <CircleCheck className="size-4" />
                      </Button>
                    </Tip>
                    <Tip tip="Cancel">
                      <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        aria-label={`Cancel the interview with ${i.candidateName}`}
                        onPress={() => run(() => interviewStatusAction(i.id, "cancelled"), "Interview cancelled.")}
                      >
                        <Xmark className="size-4" />
                      </Button>
                    </Tip>
                  </div>
                ))}
              </PanelCard>
            </Tabs.Panel>
          ) : null}

          <Tabs.Panel id="joining" className="flex flex-col gap-4 pt-4">
            {joining}
          </Tabs.Panel>

          {reviewsOn ? (
            <Tabs.Panel id="reviews" className="flex flex-col gap-4 pt-4">
              <ReviewsPanel cycle={cycle} today={today} pending={pending} run={run} />
            </Tabs.Panel>
          ) : null}
        </Tabs>
      ) : (
        joining
      )}

      {/* Open a vacancy */}
      <Drawer.Backdrop isOpen={vacOpen} onOpenChange={setVacOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="vac-new-h" className="w-full max-w-[460px]">
            <Drawer.CloseTrigger aria-label="Close" />
            <Drawer.Header>
              <Drawer.Heading id="vac-new-h" className="text-[18px] leading-6 font-semibold">
                Open a vacancy
              </Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-3">
              <Field label="Role">
                <TextField value={vac.title} onChange={(v) => setVac((x) => ({ ...x, title: v }))} aria-label="Role">
                  <Input placeholder="Sous chef" />
                </TextField>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <NativeSelect fullWidth className="flex flex-col gap-1">
                  <Label htmlFor="vac-branch" className="text-xs">
                    Branch
                  </Label>
                  <NativeSelect.Trigger
                    id="vac-branch"
                    value={vac.branchId}
                    onChange={(e) => setVac((x) => ({ ...x, branchId: e.target.value }))}
                  >
                    <NativeSelect.Option value="">Any</NativeSelect.Option>
                    {branches.map((b) => (
                      <NativeSelect.Option key={b.id} value={b.id}>
                        {b.name}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
                <Field label="People to hire">
                  <TextField
                    value={vac.openings}
                    onChange={(v) => setVac((x) => ({ ...x, openings: v }))}
                    aria-label="Openings"
                  >
                    <Input inputMode="numeric" />
                  </TextField>
                </Field>
                <Field label="Wage from (RWF)">
                  <TextField
                    value={vac.wageFrom}
                    onChange={(v) => setVac((x) => ({ ...x, wageFrom: v }))}
                    aria-label="Wage from"
                  >
                    <Input inputMode="numeric" placeholder="280,000" />
                  </TextField>
                </Field>
                <Field label="Wage to (RWF)">
                  <TextField
                    value={vac.wageTo}
                    onChange={(v) => setVac((x) => ({ ...x, wageTo: v }))}
                    aria-label="Wage to"
                  >
                    <Input inputMode="numeric" placeholder="360,000" />
                  </TextField>
                </Field>
                <Field label="Closes on">
                  <TextField
                    value={vac.closesOn}
                    onChange={(v) => setVac((x) => ({ ...x, closesOn: v }))}
                    aria-label="Closes on"
                  >
                    <Input type="date" min={today} />
                  </TextField>
                </Field>
                <NativeSelect fullWidth className="flex flex-col gap-1">
                  <Label htmlFor="vac-mgr" className="text-xs">
                    Reports to
                  </Label>
                  <NativeSelect.Trigger
                    id="vac-mgr"
                    value={vac.managerEmployeeId}
                    onChange={(e) => setVac((x) => ({ ...x, managerEmployeeId: e.target.value }))}
                  >
                    <NativeSelect.Option value="">Nobody yet</NativeSelect.Option>
                    {people.map((p) => (
                      <NativeSelect.Option key={p.id} value={p.id}>
                        {p.name}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <Field label="Note (optional)">
                <TextField value={vac.note} onChange={(v) => setVac((x) => ({ ...x, note: v }))} aria-label="Note">
                  <TextArea rows={3} placeholder="Two years on a hotel line, food hygiene certificate" />
                </TextField>
              </Field>
              <Field label="Ask applicants to send">
                <DocumentPicker value={vac.documents} onChange={(d) => setVac((x) => ({ ...x, documents: d }))} />
              </Field>
            </Drawer.Body>
            <Drawer.Footer className="border-t border-separator">
              <Button variant="ghost" onPress={() => setVacOpen(false)}>
                Cancel
              </Button>
              <Button
                isPending={pending}
                isDisabled={vac.title.trim().length < 2}
                onPress={() =>
                  run(
                    () => openVacancyAction(vac),
                    `${vac.title.trim()} is open.`,
                    () => {
                      setVacOpen(false);
                      setVac({
                        title: "",
                        branchId: "",
                        openings: "1",
                        wageFrom: "",
                        wageTo: "",
                        closesOn: "",
                        managerEmployeeId: "",
                        note: "",
                        documents: [],
                      });
                    },
                  )
                }
              >
                Open it
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      {/* Add a candidate */}
      <Drawer.Backdrop isOpen={candOpen} onOpenChange={setCandOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="cand-new-h" className="w-full max-w-[460px]">
            <Drawer.CloseTrigger aria-label="Close" />
            <Drawer.Header>
              <Drawer.Heading id="cand-new-h" className="text-[18px] leading-6 font-semibold">
                Add a candidate
              </Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-3">
              <NativeSelect fullWidth className="flex flex-col gap-1">
                <Label htmlFor="cand-vac" className="text-xs">
                  For
                </Label>
                <NativeSelect.Trigger
                  id="cand-vac"
                  value={cand.vacancyId}
                  onChange={(e) => setCand((x) => ({ ...x, vacancyId: e.target.value }))}
                >
                  {open.map((v) => (
                    <NativeSelect.Option key={v.id} value={v.id}>
                      {v.title}
                      {v.branchName ? ` · ${v.branchName}` : ""}
                    </NativeSelect.Option>
                  ))}
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
              <Field label="Full name">
                <TextField
                  value={cand.fullName}
                  onChange={(v) => setCand((x) => ({ ...x, fullName: v }))}
                  aria-label="Full name"
                >
                  <Input placeholder="As on their ID" />
                </TextField>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <TextField
                    value={cand.phone}
                    onChange={(v) => setCand((x) => ({ ...x, phone: v }))}
                    aria-label="Phone"
                  >
                    <Input type="tel" placeholder="0788 123 456" />
                  </TextField>
                </Field>
                <Field label="Email">
                  <TextField
                    value={cand.email}
                    onChange={(v) => setCand((x) => ({ ...x, email: v }))}
                    aria-label="Email"
                  >
                    <Input type="email" placeholder="name@example.com" />
                  </TextField>
                </Field>
              </div>
              <Field label="Salary they ask (optional)">
                <TextField
                  value={cand.expectedWage}
                  onChange={(v) => setCand((x) => ({ ...x, expectedWage: v }))}
                  aria-label="Salary they ask"
                >
                  <Input inputMode="numeric" placeholder="350,000" />
                </TextField>
              </Field>
              <NativeSelect fullWidth className="flex flex-col gap-1">
                <Label htmlFor="cand-src" className="text-xs">
                  Found through
                </Label>
                <NativeSelect.Trigger
                  id="cand-src"
                  value={cand.source}
                  onChange={(e) => setCand((x) => ({ ...x, source: e.target.value }))}
                >
                  {SOURCES.map((s) => (
                    <NativeSelect.Option key={s} value={s}>
                      {s}
                    </NativeSelect.Option>
                  ))}
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
              <Field label="Note (optional)">
                <TextField value={cand.note} onChange={(v) => setCand((x) => ({ ...x, note: v }))} aria-label="Note">
                  <TextArea rows={2} placeholder="Three years at a lodge in Musanze" />
                </TextField>
              </Field>
              <Checkbox isSelected={cand.talentPool} onChange={(v) => setCand((x) => ({ ...x, talentPool: v }))}>
                <Checkbox.Content className="items-start gap-2.5 text-[13px]">
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  They agree to be kept for other roles (a year instead of six months)
                </Checkbox.Content>
              </Checkbox>
            </Drawer.Body>
            <Drawer.Footer className="border-t border-separator">
              <Button variant="ghost" onPress={() => setCandOpen(false)}>
                Cancel
              </Button>
              <Button
                isPending={pending}
                isDisabled={!cand.vacancyId || cand.fullName.trim().length < 2}
                onPress={() =>
                  run(
                    () => addCandidateAction(cand),
                    `${cand.fullName.trim()} added.`,
                    () => {
                      setCandOpen(false);
                      setCand((x) => ({
                        ...x,
                        fullName: "",
                        phone: "",
                        email: "",
                        note: "",
                        talentPool: false,
                        expectedWage: "",
                      }));
                    },
                  )
                }
              >
                Add
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
      <Modal.Backdrop isOpen={dropped !== null} onOpenChange={(o) => (o ? undefined : setDropped(null))}>
        <Modal.Container size="sm">
          <Modal.Dialog aria-labelledby="drop-h">
            <Modal.Header>
              <Modal.Heading id="drop-h" className="text-lg font-semibold">
                {dropped?.to === "offer" ? `Offer to ${droppedOne?.fullName}` : `Hire ${droppedOne?.fullName}?`}
              </Modal.Heading>
              <p className="mt-1 text-sm text-muted">
                {dropped?.to === "offer"
                  ? "Their monthly wage and first day."
                  : `${droppedOne?.offerWageRwf ? formatRwf(droppedOne.offerWageRwf) : "Their offer"}${
                      droppedOne?.offerStartsOn ? `, starting ${dm(droppedOne.offerStartsOn)}` : ""
                    }. Their staff file opens next.`}
              </p>
            </Modal.Header>
            {dropped?.to === "offer" ? (
              <Modal.Body className="flex flex-col gap-3">
                <Field label="Gross a month (RWF)">
                  <TextField
                    value={offer.wage}
                    onChange={(v) => setOffer((o) => ({ ...o, wage: v }))}
                    aria-label="Offered wage"
                  >
                    <Input inputMode="numeric" placeholder="320,000" />
                  </TextField>
                </Field>
                <Field label="First day">
                  <TextField
                    value={offer.startsOn}
                    onChange={(v) => setOffer((o) => ({ ...o, startsOn: v }))}
                    aria-label="First day"
                  >
                    <Input type="date" />
                  </TextField>
                </Field>
              </Modal.Body>
            ) : null}
            <Modal.Footer>
              <Button variant="ghost" onPress={() => setDropped(null)}>
                Cancel
              </Button>
              <Button
                isPending={pending}
                isDisabled={dropped?.to === "offer" && (!offer.wage.replace(/\D/g, "") || !offer.startsOn)}
                onPress={() => {
                  const c = droppedOne;
                  if (!c || !dropped) return;
                  if (dropped.to === "offer") {
                    run(
                      () =>
                        moveCandidateAction(c.id, "offer", { offerWage: offer.wage, offerStartsOn: offer.startsOn }),
                      `Offer recorded for ${c.fullName}.`,
                      () => {
                        setDropped(null);
                        setOffer({ wage: "", startsOn: plusDays(today, 7) });
                      },
                    );
                  } else {
                    run(
                      () => moveCandidateAction(c.id, "hired"),
                      `${c.fullName} hired. Finish their staff file.`,
                      () => {
                        setDropped(null);
                        router.push(prefill(c));
                      },
                    );
                  }
                }}
              >
                {dropped?.to === "offer" ? "Send the offer" : "Yes, hire"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
