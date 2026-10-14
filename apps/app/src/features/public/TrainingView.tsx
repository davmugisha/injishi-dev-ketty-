"use client";

import {
  ArrowLeft,
  Camera,
  Check,
  CircleCheck,
  CircleInfo,
  CircleQuestion,
  CircleXmark,
  FileArrowDown,
  GraduationCap,
  Medal,
  QrCode,
  ShieldCheck,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Label,
  Meter,
  ProgressBar,
  Table,
  Tag,
  TagGroup,
  TextField,
} from "@heroui/react";
import { ItemCard, Segment, Timeline } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  Certificate,
  Course,
  CourseSession,
  CourseTeam,
  Enrolment,
  Learner,
  Tone,
} from "@injishi/data/fixtures/public";
import { stock } from "@injishi/data/media";
import { KeyValueList, LinkButton, toneColor } from "@injishi/ui";
import NextLink from "next/link";
import { useState } from "react";
import type { DemoLinks } from "./links";
import { CaptionedPhoto, PublicFooter, PublicHeader, PublicMain } from "./PublicChrome";
import { linkTo, Pending } from "./shared";

export interface TrainingData {
  courses: Course[];
  sessions: CourseSession[];
  learners: Learner[];
  enrolments: Enrolment[];
  certificates: Certificate[];
}

type TeamFilter = "all" | CourseTeam;

const TEAMS: { id: TeamFilter; label: string }[] = [
  { id: "all", label: "All teams" },
  { id: "front", label: "Front office" },
  { id: "finance", label: "Finance" },
  { id: "hk", label: "Housekeeping" },
];

const SAMPLES = [
  { id: "INJ-FDE-26-0417", label: "Valid" },
  { id: "INJ-EBM-25-0112", label: "Revoked" },
  { id: "INJ-HKS-26-9999", label: "Unknown code" },
];

function seatOf(session: CourseSession, requested: boolean) {
  const full = session.taken >= session.capacity;
  const taken = session.taken + (requested && !full ? 1 : 0);
  let chip: { label: string; tone: Tone } | null = null;
  if (session.attended) chip = { label: `Completed · ${session.attended}`, tone: "default" };
  else if (session.mine) chip = { label: "You're enrolled", tone: "success" };
  else if (requested && full) chip = { label: "On waitlist · position 3", tone: "info" };
  else if (requested) chip = { label: "Requested · waiting for your manager", tone: "warning" };
  const open = !session.attended && !session.mine && !requested;
  const seatText = session.attended
    ? session.attended
    : full
      ? `Full · ${session.capacity} of ${session.capacity}`
      : `${taken} of ${session.capacity} taken`;
  return {
    taken,
    chip,
    seatText,
    canEnrol: open && !full,
    canWait: open && full,
    label: `${taken} of ${session.capacity} seats taken`,
  };
}

/** Training and certification (artifact: Training.dc.html) — courses, sessions, learning and the public register. */
export function TrainingView({ links, data }: { links: DemoLinks; data: TrainingData }) {
  const [team, setTeam] = useState<TeamFilter>("all");
  const [courseId, setCourseId] = useState("fde");
  const [requested, setRequested] = useState<string[]>([]);
  const [code, setCode] = useState("INJ-FDE-26-0417");
  const [checked, setChecked] = useState("INJ-FDE-26-0417");
  const [qr, setQr] = useState(false);

  const learner = data.learners[0];
  const course = data.courses.find((c) => c.id === courseId) ?? data.courses[0];
  const visible = data.courses.filter((c) => team === "all" || c.team === team);
  const mine = learner ? data.enrolments.filter((e) => e.learner === learner.id) : [];
  const held = learner ? data.certificates.find((c) => c.learner === learner.id && c.status === "valid") : undefined;
  const checkedCode = checked.trim().toUpperCase();
  const found = data.certificates.find((c) => c.id === checkedCode);
  const result = !checkedCode
    ? "idle"
    : found?.status === "valid"
      ? "valid"
      : found?.status === "revoked"
        ? "revoked"
        : "none";

  const ask = (id: string) => setRequested((cur) => (cur.includes(id) ? cur : [...cur, id]));
  const checkCode = (value: string) => {
    const next = value.trim().toUpperCase();
    setCode(next);
    setChecked(next);
  };

  if (!learner || !course) {
    return (
      <>
        <PublicHeader />
        <PublicMain>
          <p className="text-muted">Training is not available in this preview.</p>
        </PublicMain>
      </>
    );
  }

  return (
    <>
      <PublicHeader
        actions={
          <>
            <LinkButton href={linkTo(links, learner.home)} variant="ghost" size="sm">
              <ArrowLeft className="size-4" />
              Back to work
            </LinkButton>
            <NextLink
              href={linkTo(links, "Account")}
              aria-label={`Your account, ${learner.name}`}
              className="inline-flex no-underline"
            >
              <Avatar size="sm" variant="soft" color="accent">
                <Avatar.Fallback>{learner.initials}</Avatar.Fallback>
              </Avatar>
            </NextLink>
          </>
        }
      />

      <PublicMain className="gap-[26px] sm:pt-[28px]">
        <section className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-1.5">
            <p className="flex items-center gap-2 text-[13px] leading-[18px] font-medium text-muted">
              <GraduationCap className="size-4" aria-hidden="true" />
              Injishi training and certification
            </p>
            <h1 className="text-[30px] leading-[38px] font-[650] tracking-[-0.02em]">
              Learn the job, then prove it with a certificate
            </h1>
            <p className="text-sm text-muted">
              Short, practical courses run by certified trainers across Rwanda. Every certificate carries a code anyone
              can check.
            </p>
          </div>
          <Segment
            aria-label="Filter courses by team"
            selectedKey={team}
            onSelectionChange={(key) => {
              const next = String(key) as TeamFilter;
              setTeam(next);
              if (next !== "all") {
                const match = data.courses.find((c) => c.team === next);
                if (match) setCourseId(match.id);
              }
            }}
          >
            {TEAMS.map((item, i) => (
              <Segment.Item key={item.id} id={item.id}>
                {i > 0 ? <Segment.Separator /> : null}
                {item.label}
              </Segment.Item>
            ))}
          </Segment>
        </section>

        <section
          aria-label="Courses"
          className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))]"
        >
          {visible.map((c) => {
            const selected = c.id === course.id;
            return (
              <Card
                key={c.id}
                className={selected ? "gap-0 overflow-hidden p-0 ring-2 ring-accent" : "gap-0 overflow-hidden p-0"}
                render={(props) => <article {...props} />}
              >
                <CaptionedPhoto
                  image={stock[c.photo]}
                  caption={c.caption}
                  className="h-24 rounded-none"
                  sizes="(min-width: 1024px) 380px, 100vw"
                />
                <div className="flex flex-1 flex-col gap-2.5 px-[18px] pt-4 pb-[18px]">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-[16px] leading-[22px] font-semibold">{c.title}</h2>
                    <Chip size="sm" variant="soft">
                      <Chip.Label>{c.teamLabel}</Chip.Label>
                    </Chip>
                  </div>
                  <p className="text-[13px] leading-[19px] text-muted">{c.desc}</p>
                  <KeyValueList
                    className="gap-x-3 gap-y-1 text-[12px]"
                    items={[
                      { label: "Format", value: c.format },
                      { label: "Modules", value: c.modules },
                      { label: "Certificate", value: c.certificate },
                      { label: "Fee per learner", value: <Pending /> },
                    ]}
                  />
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <span className="text-[12px] text-muted">Next: {c.next}</span>
                    <Button
                      size="sm"
                      variant={selected ? "tertiary" : "secondary"}
                      aria-pressed={selected}
                      onPress={() => setCourseId(c.id)}
                    >
                      {selected ? "Showing sessions" : "See sessions"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="sess-h">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-0.5">
              <h2 id="sess-h" className="text-[17px] leading-[24px] font-semibold">
                Sessions · {course.title}
              </h2>
              <span className="text-[12px] text-muted">{course.sessionNote}</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
              <CircleInfo className="size-3" aria-hidden="true" />
              Your business approves and pays for staff enrolments
            </span>
          </div>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-labelledby="sess-h">
                <Table.Header>
                  <Table.Column isRowHeader>Session</Table.Column>
                  <Table.Column>Venue</Table.Column>
                  <Table.Column>Trainer</Table.Column>
                  <Table.Column>Language</Table.Column>
                  <Table.Column className="min-w-[150px]">Seats</Table.Column>
                  <Table.Column className="text-right">Enrolment</Table.Column>
                </Table.Header>
                <Table.Body>
                  {data.sessions
                    .filter((session) => session.course === course.id)
                    .map((session) => {
                      const seat = seatOf(session, requested.includes(session.id));
                      return (
                        <Table.Row key={session.id} id={session.id}>
                          <Table.Cell>
                            <span className="flex flex-col">
                              <span className="font-medium">{session.when}</span>
                              <span className="text-[12px] text-muted tabular">
                                {session.id} · {session.hours}
                              </span>
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="flex flex-col">
                              <span>{session.venue}</span>
                              <span className="text-[12px] text-muted">{session.venueSub}</span>
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="flex items-center gap-2">
                              <Avatar size="sm" variant="soft">
                                <Avatar.Fallback>{session.trainerInitials}</Avatar.Fallback>
                              </Avatar>
                              <span className="flex flex-col">
                                <span>{session.trainer}</span>
                                <span className="text-[12px] text-muted">Certified trainer</span>
                              </span>
                            </span>
                          </Table.Cell>
                          <Table.Cell>{session.language}</Table.Cell>
                          <Table.Cell>
                            <Meter
                              aria-label={seat.label}
                              value={Math.round((seat.taken / session.capacity) * 100)}
                              className="min-w-[140px] gap-1"
                            >
                              <span className="text-[12px] text-muted tabular">{seat.seatText}</span>
                              <Meter.Track className="h-1.5">
                                <Meter.Fill className="bg-[var(--chart-3)]" />
                              </Meter.Track>
                            </Meter>
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            {seat.canEnrol ? (
                              <Button size="sm" onPress={() => ask(session.id)}>
                                Request a seat
                              </Button>
                            ) : null}
                            {seat.canWait ? (
                              <Button size="sm" variant="secondary" onPress={() => ask(session.id)}>
                                Join waitlist
                              </Button>
                            ) : null}
                            {seat.chip ? (
                              <Chip size="sm" variant="soft" color={toneColor(seat.chip.tone)}>
                                <Chip.Label>{seat.chip.label}</Chip.Label>
                              </Chip>
                            ) : null}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </section>

        <div className="flex flex-wrap items-start gap-6">
          <Card
            className="min-w-0 flex-[1_1_600px] gap-4 p-5"
            aria-labelledby="mine-h"
            render={(props) => <section {...props} />}
          >
            <div className="flex flex-col gap-0.5">
              <h2 id="mine-h" className="text-[15px] leading-[22px] font-semibold">
                My Learning
              </h2>
              <span className="text-[12px] text-muted">
                {learner.name} · {learner.context}
              </span>
            </div>
            {mine.map((enrolment) => (
              <Card key={enrolment.id} variant="secondary" className="gap-2.5 px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{enrolment.title}</span>
                  <Chip size="sm" variant="soft" color={toneColor(enrolment.tone)}>
                    <Chip.Label>{enrolment.status}</Chip.Label>
                  </Chip>
                </div>
                <span className="text-[12px] text-muted">{enrolment.detail}</span>
                {enrolment.progress ? (
                  <ProgressBar
                    aria-label={enrolment.progress.label}
                    value={Math.round((enrolment.progress.done / enrolment.progress.total) * 100)}
                    className="gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">{enrolment.progress.label}</span>
                      <span className="text-sm tabular">
                        {enrolment.progress.done} of {enrolment.progress.total}
                      </span>
                    </div>
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                ) : null}
                {enrolment.note ? <span className="text-[12px] text-muted">{enrolment.note}</span> : null}
                {enrolment.attendance.length ? (
                  <Timeline size="sm" density="compact" aria-label={`${enrolment.title} attendance`}>
                    {enrolment.attendance.map((step) => (
                      <Timeline.Item key={step.id} status="success">
                        <Timeline.Rail>
                          <Timeline.Marker>
                            <Check className="size-3" />
                          </Timeline.Marker>
                          <Timeline.Connector />
                        </Timeline.Rail>
                        <Timeline.Content className="flex flex-col pb-0.5">
                          <span className="text-[13px] font-medium">{step.title}</span>
                          <span className="text-[12px] text-muted">{step.detail}</span>
                        </Timeline.Content>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                ) : null}
              </Card>
            ))}
            {held ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-[14px] leading-5 font-semibold">My Certificates</h3>
                <ItemCard variant="outline" className="items-center">
                  <ItemCard.Icon>
                    <Medal />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title>{held.course}</ItemCard.Title>
                    <ItemCard.Description className="tabular">
                      {held.id} · issued {held.issuedOn} · valid to {held.validUntil}
                    </ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <span className="flex items-center gap-1.5">
                      <Chip size="sm" variant="soft" color="success">
                        <Chip.Label>Valid</Chip.Label>
                      </Chip>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Download certificate PDF"
                        className="min-w-8 px-1.5"
                      >
                        <FileArrowDown className="size-4" />
                      </Button>
                      <Button size="sm" variant="secondary" aria-expanded={qr} onPress={() => setQr((open) => !open)}>
                        <QrCode className="size-4" />
                        {qr ? "Hide QR" : "Show QR"}
                      </Button>
                    </span>
                  </ItemCard.Action>
                </ItemCard>
                {qr ? (
                  <Card variant="secondary" className="flex-row items-center gap-2.5 p-3.5">
                    <div
                      className="flex size-24 shrink-0 items-center justify-center rounded-xl bg-surface"
                      role="img"
                      aria-label={`QR code for certificate ${held.id}`}
                    >
                      <QrCode className="size-16" aria-hidden="true" />
                    </div>
                    <span className="text-[12px] leading-[17px] text-muted">
                      Show this to an employer. Scanning it opens the public check below with the code filled in. The QR
                      is signed, so a copied image still verifies against our register.
                    </span>
                  </Card>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card
            className="min-w-0 flex-[1_1_380px] gap-3.5 p-5"
            aria-labelledby="ver-h"
            render={(props) => <section {...props} />}
          >
            <div className="flex flex-col gap-0.5">
              <h2 id="ver-h" className="text-[17px] leading-[24px] font-semibold">
                Verify a Certificate
              </h2>
              <span className="text-[12px] text-muted">
                For employers and anyone else. We only show what is printed on the certificate.
              </span>
            </div>
            <div className="flex items-end gap-2">
              <TextField value={code} onChange={setCode} className="min-w-0 flex-1 gap-1">
                <Label htmlFor="code">Certificate code</Label>
                <Input id="code" placeholder="INJ-XXX-00-0000" className="uppercase tabular" />
              </TextField>
              <Button onPress={() => setChecked(code)}>Verify</Button>
            </div>
            <Button variant="secondary" className="self-start" onPress={() => checkCode("INJ-FDE-26-0417")}>
              <Camera className="size-4" />
              Scan QR instead
            </Button>
            <div className="flex flex-wrap items-center gap-1.5">
              <span id="try-l" className="text-[12px] text-muted">
                Try:
              </span>
              <TagGroup
                aria-labelledby="try-l"
                size="sm"
                variant="surface"
                selectionMode="single"
                selectedKeys={SAMPLES.some((sample) => sample.id === checkedCode) ? [checkedCode] : []}
                onSelectionChange={(keys) => {
                  if (keys === "all") return;
                  const next = [...keys][0];
                  if (next != null) checkCode(String(next));
                }}
              >
                <TagGroup.List className="flex flex-wrap gap-1.5">
                  {SAMPLES.map((sample) => (
                    <Tag key={sample.id} id={sample.id}>
                      {sample.label}
                    </Tag>
                  ))}
                </TagGroup.List>
              </TagGroup>
            </div>
            {result === "valid" && found ? (
              <>
                <Alert status="success" role="status">
                  <Alert.Indicator>
                    <CircleCheck />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Valid certificate</Alert.Title>
                    <Alert.Description>Signature checked against the Injishi register just now.</Alert.Description>
                  </Alert.Content>
                </Alert>
                <KeyValueList
                  items={[
                    { label: "Code", value: <span className="tabular">{found.id}</span> },
                    { label: "Issued to", value: found.holder },
                    { label: "Course", value: found.course },
                    { label: "Issued", value: `${found.issuedOn} by ${found.issuer}` },
                    { label: "Valid until", value: found.validUntil },
                  ]}
                />
              </>
            ) : null}
            {result === "revoked" && found ? (
              <>
                <Alert status="danger" role="status">
                  <Alert.Indicator>
                    <CircleXmark />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Revoked · do not accept</Alert.Title>
                    <Alert.Description>
                      Injishi revoked this certificate on {found.revokedOn}. The reason is recorded with the issuer and
                      not shown publicly.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
                <KeyValueList
                  items={[
                    { label: "Code", value: <span className="tabular">{found.id}</span> },
                    { label: "Course", value: found.course },
                    { label: "Originally issued", value: found.issuedOn },
                    { label: "Revoked", value: found.revokedOn },
                  ]}
                />
              </>
            ) : null}
            {result === "none" ? (
              <Alert status="warning" role="status">
                <Alert.Indicator>
                  <CircleQuestion />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Not found</Alert.Title>
                  <Alert.Description>
                    No certificate matches “{checkedCode}”. Check the code for typos, or ask the holder to show the QR
                    code.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            <p className="flex gap-1.5 text-[12px] leading-[17px] text-muted">
              <ShieldCheck className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              We never show the holder’s employer, contact details or scores. Each check is logged without storing who
              checked.
            </p>
          </Card>
        </div>
      </PublicMain>

      <PublicFooter
        links={[
          { label: "Help centre", href: screenHref("PublicHelp") },
          { label: "Privacy notice", href: screenHref("PublicHelp") },
          { label: "For hosts", href: screenHref("PublicHost") },
        ]}
      />
    </>
  );
}
