"use client";

import { Calendar, CircleCheck, LinkSlash, PersonPlus, ShieldCheck, Star } from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Checkbox, Chip, Description, Label, ProgressBar, Table } from "@heroui/react";
import { Kanban, ListView, Segment, Timeline } from "@heroui-pro/react";
import { Icon, KeyValueList, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { useState } from "react";
import type {
  Candidate,
  Interview,
  OnboardingTask,
  PipelineStage,
  ReviewCycleMetric,
  ReviewDepartment,
  Vacancy,
} from "../../model/payroll.ts";
import { useBoardHref } from "../mount.tsx";

interface TalentData {
  vacancies: Vacancy[];
  candidates: Candidate[];
  interviews: Interview[];
  onboarding: OnboardingTask[];
  cycle: ReviewCycleMetric[];
  departments: ReviewDepartment[];
}

const STAGES: { id: PipelineStage; title: string; color: string }[] = [
  { id: "applied", title: "Applied", color: "var(--chart-5)" },
  { id: "screening", title: "Screening", color: "var(--chart-4)" },
  { id: "interview", title: "Interview", color: "var(--chart-2)" },
  { id: "offer", title: "Offer", color: "var(--warning)" },
  { id: "hired", title: "Hired", color: "var(--success)" },
];

/**
 * Selected and hovered card styles. React Aria wraps GridList item content in a `gridcell`, so the kit’s
 * `.kanban__card[data-selected] > .kanban__card-content` rule no longer reaches the content box.
 */
const CARD_STATES =
  "data-[selected=true]:[&_[data-slot=kanban-card-content]]:bg-accent-soft data-[hovered=true]:[&_[data-slot=kanban-card-content]]:shadow-sm";

/** Employee record created when the offer being shown is accepted here. */
const NEW_EMPLOYEE_ID = "EMP-0149";

const stageIndex = (stage: PipelineStage) => STAGES.findIndex((s) => s.id === stage);
const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

export function TalentView({ data }: { data: TalentData }) {
  const screenHref = useBoardHref();
  const { candidates } = data;
  const [vacancy, setVacancy] = useState("all");
  const [selectedId, setSelectedId] = useState(
    () => candidates.find((c) => c.stage === "offer")?.id ?? candidates[0]?.id ?? "",
  );
  const [stageOf, setStageOf] = useState<Record<string, PipelineStage>>({});
  /** Candidates hired from this screen (the record is created here, so the next step changes). */
  const [hiredHere, setHiredHere] = useState<Record<string, boolean>>({});
  const [rejected, setRejected] = useState<Record<string, boolean>>({});
  const [lastRejected, setLastRejected] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.onboarding.map((o) => [o.id, o.done])),
  );

  const live = candidates.filter((c) => !rejected[c.id]).map((c) => ({ ...c, stage: stageOf[c.id] ?? c.stage }));
  const shown = live.filter((c) => vacancy === "all" || c.vacancy === vacancy);
  const cur = live.find((c) => c.id === selectedId) ?? live.find((c) => c.stage === "offer") ?? live[0];
  const curIdx = cur ? stageIndex(cur.stage) : 0;
  const hiredNow = !!cur && !!hiredHere[cur.id];
  const onboardingDone = data.onboarding.filter((o) => done[o.id]).length;

  const advance = () => {
    if (!cur) return;
    const next = STAGES[Math.min(curIdx + 1, stageIndex("offer"))];
    if (next) setStageOf((s) => ({ ...s, [cur.id]: next.id }));
  };
  const accept = () => {
    if (!cur) return;
    setStageOf((s) => ({ ...s, [cur.id]: "hired" }));
    setHiredHere((h) => ({ ...h, [cur.id]: true }));
  };
  const reject = () => {
    if (!cur) return;
    setRejected((r) => ({ ...r, [cur.id]: true }));
    setLastRejected(cur.name);
    setSelectedId(candidates.find((c) => c.stage === "offer" && c.id !== cur.id)?.id ?? "");
  };

  const consentText = (c: Candidate) => {
    if (c.stage === "hired") return "Candidate consent ended at hire; the file now follows employee records rules";
    return c.talentPool
      ? `For this vacancy and the talent pool · deleted after ${c.consentUntil}`
      : `For this vacancy only · deleted after ${c.consentUntil}`;
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow={`People › Talent · ${data.vacancies.length} open vacancies · H2 2026 review cycle`}
        title="Talent"
        description="Candidates never get an Injishi login or a pay line. An accepted, approved offer creates an employee record; access stays a separate owner decision."
        actions={
          <Segment aria-label="Vacancy" selectedKey={vacancy} onSelectionChange={(k) => setVacancy(String(k))}>
            <Segment.Item id="all">All vacancies</Segment.Item>
            {data.vacancies.map((v) => (
              <Segment.Item key={v.id} id={v.id}>
                {v.title}
              </Segment.Item>
            ))}
          </Segment>
        }
      />

      <div className="grid gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">
        {data.vacancies.map((v) => (
          <Card key={v.id} aria-labelledby={`vac-${v.id}`} className="gap-2 p-[16px]">
            <div className="flex items-start gap-[12px]">
              <Avatar variant="soft" color="accent">
                <Avatar.Fallback>
                  <Icon name={v.icon} />
                </Avatar.Fallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h2 id={`vac-${v.id}`} className="text-[15px] leading-[22px] font-semibold">
                  {v.title}
                </h2>
                <span className="text-[13px] text-muted">{v.where}</span>
              </div>
              <Chip size="sm" variant="soft" color={toneColor(v.stateTone)} className="shrink-0">
                {v.state}
              </Chip>
            </div>
            <KeyValueList
              items={[
                { label: "Approved", value: v.approved },
                { label: "Pay band", value: <span className="tabular">{v.band}</span> },
                { label: "Pipeline", value: v.funnel },
              ]}
            />
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-[10px]" aria-labelledby="pipe-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="pipe-h" className="text-[15px] leading-[22px] font-semibold">
            Recruitment Pipeline
          </h2>
          <span className="text-xs text-muted">Select a candidate to see consent, scores and next step</span>
        </div>
        <Kanban size="sm" className="[--kanban-column-gap:12px] [--kanban-column-min-width:200px]">
          {STAGES.map((stage) => {
            const cards = shown.filter((c) => c.stage === stage.id);
            return (
              <Kanban.Column key={stage.id}>
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
                    selectedKeys={cur ? new Set([cur.id]) : new Set()}
                    onSelectionChange={(keys) => {
                      if (keys !== "all") {
                        const [first] = keys;
                        if (first !== undefined) setSelectedId(String(first));
                      }
                    }}
                    renderEmptyState={() => (
                      <span className="block px-1 py-3 text-center text-xs text-muted">No one at this stage</span>
                    )}
                  >
                    {(c) => {
                      const nextShort = hiredHere[c.id] ? NEW_EMPLOYEE_ID : c.nextShort;
                      return (
                        <Kanban.Card id={c.id} textValue={c.name} className={CARD_STATES}>
                          <span className="text-[13px] font-semibold">{c.name}</span>
                          <span className="text-xs text-muted">
                            {c.role} · {c.source}
                          </span>
                          <span className="flex flex-wrap items-center gap-1">
                            <Chip size="sm" variant="soft">
                              <ShieldCheck className="size-3" aria-hidden="true" />
                              <Chip.Label>Until {c.consentUntil}</Chip.Label>
                            </Chip>
                            {nextShort ? (
                              <Chip size="sm" variant="soft" color="accent">
                                {nextShort}
                              </Chip>
                            ) : null}
                          </span>
                        </Kanban.Card>
                      );
                    }}
                  </Kanban.CardList>
                </Kanban.ColumnBody>
              </Kanban.Column>
            );
          })}
        </Kanban>
      </section>

      <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">
        {cur ? (
          <Card aria-labelledby="cand-h" className="gap-[12px] p-[18px]">
            <div className="flex items-start gap-[12px]">
              <Avatar variant="soft">
                <Avatar.Fallback>{initials(cur.name)}</Avatar.Fallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h2 id="cand-h" className="text-base leading-[22px] font-semibold">
                  {cur.name}
                </h2>
                <span className="text-[13px] text-muted">
                  {cur.role} · {STAGES[curIdx]?.title}
                </span>
              </div>
              <Chip size="sm" variant="soft" className="shrink-0">
                <LinkSlash className="size-3" aria-hidden="true" />
                <Chip.Label>No login</Chip.Label>
              </Chip>
            </div>
            <KeyValueList
              items={[
                { label: "Applied", value: `${cur.applied} · ${cur.source}` },
                { label: "Consent", value: consentText(cur) },
                {
                  label: "Next step",
                  value: hiredNow ? "Contract signature, then start on 1 November" : cur.next,
                },
              ]}
            />
            {cur.scores.length ? (
              <ListView
                aria-label={`Scores for ${cur.name}`}
                variant="secondary"
                items={cur.scores.map((s) => ({ ...s, id: s.what }))}
              >
                {(s) => (
                  <ListView.Item id={s.id} textValue={s.what}>
                    <ListView.ItemContent>
                      <Star className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>{s.what}</ListView.Title>
                        <ListView.Description>{s.who}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                      <span className="font-semibold tabular">{s.score}</span>
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
            ) : null}
            {cur.stage === "offer" ? (
              <>
                <Card variant="secondary" className="gap-1.5 p-3">
                  <span className="text-[13px] font-semibold">Offer · approved by Didier Mugenzi on 10 Oct</span>
                  <span className="text-[13px]">
                    Sous chef · RWF 420,000 base · start 1 November 2026 · 3-month probation
                  </span>
                  <span className="text-xs text-muted">
                    Sent 10 Oct. Accepting creates an employee record only: no Injishi login, no pay line until the
                    contract is signed.
                  </span>
                </Card>
                <Button fullWidth onPress={accept}>
                  <PersonPlus className="size-4" aria-hidden="true" />
                  Offer accepted · create employee record
                </Button>
              </>
            ) : null}
            {cur.stage === "hired" ? (
              <>
                <Alert status="success">
                  <Alert.Indicator>
                    <CircleCheck aria-hidden="true" />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>
                      {hiredNow
                        ? `Employee record ${NEW_EMPLOYEE_ID} created for ${cur.name}`
                        : `Hired · employee record ${cur.nextShort ?? ""}`}
                    </Alert.Title>
                    <Alert.Description>
                      {hiredNow
                        ? "Injishi login: none. Payroll: no pay line until the contract is signed; first pay from 1 November. Onboarding checklist started."
                        : "Started 6 Oct. Injishi login: none, not needed for his role. Payroll from his first day, pro-rated in October."}
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
                <LinkButton href={screenHref("Employees")} variant="secondary" className="self-start">
                  Open employee file
                </LinkButton>
              </>
            ) : null}
            {curIdx < stageIndex("offer") ? (
              <div className="flex items-center gap-2">
                <Button className="flex-1" onPress={advance}>
                  Move to {STAGES[curIdx + 1]?.title}
                </Button>
                <Button variant="ghost" onPress={reject}>
                  Reject with reason
                </Button>
              </div>
            ) : null}
            {lastRejected ? (
              <p className="text-xs text-muted" role="status">
                {lastRejected} was declined with a reason by SMS. Their data is deleted on the consent date.
              </p>
            ) : null}
          </Card>
        ) : null}

        <Card aria-labelledby="int-h" className="gap-[10px] p-[18px]">
          <Card.Header>
            <Card.Title id="int-h" className="text-[15px] font-semibold">
              Interview Schedule
            </Card.Title>
            <Card.Description>Panels score separately before they compare notes</Card.Description>
          </Card.Header>
          <Card.Content>
            <Timeline size="sm" density="compact">
              {data.interviews.map((i) => (
                <Timeline.Item key={i.id} status={i.status}>
                  <Timeline.Rail>
                    <Timeline.Marker>
                      <Calendar className="size-3" aria-hidden="true" />
                    </Timeline.Marker>
                    <Timeline.Connector />
                  </Timeline.Rail>
                  <Timeline.Content className="flex flex-col pb-0.5 text-sm">
                    <span className="font-medium">
                      {i.when} · {i.who}
                    </span>
                    <span className="text-xs leading-4 text-muted">{i.what}</span>
                  </Timeline.Content>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card.Content>
        </Card>

        <Card aria-labelledby="onb-h" className="gap-[10px] p-[18px]">
          <Card.Header className="flex flex-row items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Card.Title id="onb-h" className="text-[15px] font-semibold">
                Onboarding · Fabrice Ndayisenga
              </Card.Title>
              <Card.Description>Commis chef · started 6 Oct · buddy Alphonse Bizimana</Card.Description>
            </div>
            <Chip size="sm" variant="soft" color="accent" className="shrink-0">
              {onboardingDone} of {data.onboarding.length}
            </Chip>
          </Card.Header>
          <Card.Content>
            <ul className="flex flex-col gap-2">
              {data.onboarding.map((o) => (
                <li key={o.id}>
                  <Checkbox
                    isSelected={!!done[o.id]}
                    onChange={(v) => setDone((d) => ({ ...d, [o.id]: v }))}
                    className="flex flex-col gap-0"
                  >
                    <Checkbox.Content className="items-center gap-[10px] text-[13px] font-medium">
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      {o.title}
                    </Checkbox.Content>
                    <Description className="ps-[26px] text-xs leading-4">{o.detail}</Description>
                  </Checkbox>
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      </div>

      <Card aria-labelledby="perf-h" className="gap-[14px] p-[18px]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id="perf-h" className="text-[15px] leading-[22px] font-semibold">
              H2 2026 Review Cycle · Objectives and 360 Feedback
            </h2>
            <span className="text-[13px] text-muted">
              1 September – 15 November · final ratings signed off by Didier Mugenzi · 360 answers shown only when 3 or
              more people respond
            </span>
          </div>
          <Chip variant="soft" color="accent">
            360 feedback stage
          </Chip>
        </div>
        <div className="grid gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
          {data.cycle.map((k) => (
            <div key={k.id} className="flex flex-col gap-1.5">
              <ProgressBar
                value={k.done ?? 0}
                maxValue={k.total ?? 100}
                valueLabel={k.done === null || k.total === null ? "Not started" : `${k.done} of ${k.total}`}
                className="gap-1.5"
              >
                <Label>{k.label}</Label>
                <ProgressBar.Output className="tabular" />
                <ProgressBar.Track>
                  <ProgressBar.Fill className={k.done ? undefined : "opacity-0"} />
                </ProgressBar.Track>
              </ProgressBar>
              <span className="text-xs text-muted">{k.note}</span>
            </div>
          ))}
        </div>
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Review progress by department">
              <Table.Header>
                <Table.Column isRowHeader>Department</Table.Column>
                <Table.Column>Objectives set</Table.Column>
                <Table.Column>Self reviews</Table.Column>
                <Table.Column>360 responses</Table.Column>
                <Table.Column>Manager reviews</Table.Column>
                <Table.Column>Status</Table.Column>
              </Table.Header>
              <Table.Body>
                {data.departments.map((d) => (
                  <Table.Row key={d.id} id={d.id}>
                    <Table.Cell className="font-medium">{d.name}</Table.Cell>
                    <Table.Cell className="tabular">{d.objectives}</Table.Cell>
                    <Table.Cell className="tabular">{d.selfReviews}</Table.Cell>
                    <Table.Cell className="tabular">{d.feedback360}</Table.Cell>
                    <Table.Cell className="tabular">{d.managerReviews}</Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={toneColor(d.statusTone)}>
                        {d.status}
                      </Chip>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Card>
    </PageContent>
  );
}
