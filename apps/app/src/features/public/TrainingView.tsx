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
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { ItemCard, Segment, Timeline } from "@heroui-pro/react";
import { type BoardId, screenHref } from "@injishi/data";
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
import type { CertificateCheck } from "@/server/mutations/public";
import { checkCertificateAction } from "./actions";
import type { DemoLinks } from "./links";
import { CaptionedPhoto, PublicFooter, PublicHeader, PublicMain, SignInAction } from "./PublicChrome";
import { linkTo, Pending } from "./shared";

export interface TrainingData {
  courses: Course[];
  sessions: CourseSession[];
  learners: Learner[];
  enrolments: Enrolment[];
  certificates: Certificate[];
}

/** The signed-in person reading the page (null: nobody is signed in). */
export interface TrainingVisitor {
  personaId: string;
  name: string;
  initials: string;
  /** Where "Back to work" goes. */
  home: BoardId;
}

type TeamFilter = "all" | CourseTeam;

const TEAMS: { id: TeamFilter; label: string }[] = [
  { id: "all", label: "All teams" },
  { id: "front", label: "Front office" },
  { id: "finance", label: "Finance" },
  { id: "hk", label: "Housekeeping" },
];

/** A day the API sends ("2026-10-12" or an ISO instant) as the page writes dates: "12 Oct 2026", in Kigali. */
function kigaliDay(iso: string): string {
  const at = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Kigali" });
}

/**
 * Why a seat cannot be asked for here yet: the sessions on this page are the prototype's (the training collections
 * are deferred until the course schema grows, data map public.courseSessions), so there is no real session to
 * register for, and the API's registration (`POST /training/registrations`) has no employer approval or waitlist.
 */
const SEAT_UNAVAILABLE =
  "Asking for a seat is not available here yet. Nothing was requested; ask your manager to register you.";

/**
 * A session's seat line. `attended` and `mine` describe the sample learner, so they are read only when that learner
 * is the person signed in (`isLearner`); anyone else is never told they attended or enrolled.
 */
function seatOf(session: CourseSession, isLearner: boolean) {
  const attended = isLearner ? session.attended : undefined;
  const mine = isLearner && session.mine;
  const full = session.taken >= session.capacity;
  const taken = session.taken;
  let chip: { label: string; tone: Tone } | null = null;
  if (attended) chip = { label: `Completed · ${attended}`, tone: "default" };
  else if (mine) chip = { label: "You're enrolled", tone: "success" };
  const open = !attended && !mine;
  const seatText = attended
    ? attended
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
export function TrainingView({
  links,
  data,
  visitor,
}: {
  links: DemoLinks;
  data: TrainingData;
  visitor: TrainingVisitor | null;
}) {
  const [team, setTeam] = useState<TeamFilter>("all");
  const [courseId, setCourseId] = useState("fde");
  const [code, setCode] = useState("");
  // The API's answer for the code last checked (`GET /verify/:token`), never a lookup in this page's own data.
  const [check, setCheck] = useState<{ code: string; answer: CertificateCheck } | null>(null);
  const [checking, setChecking] = useState(false);

  // The sample learning record is shown only to the person it describes; another visitor never sees it as theirs.
  // Matched on the person, not only on the shell: every receptionist gets the front-desk shell, and only the one the
  // sample describes may see it.
  const learner = visitor
    ? data.learners.find((l) => l.personaId === visitor.personaId && l.name === visitor.name)
    : undefined;
  const course = data.courses.find((c) => c.id === courseId) ?? data.courses[0];
  const visible = data.courses.filter((c) => team === "all" || c.team === team);
  const mine = learner ? data.enrolments.filter((e) => e.learner === learner.id) : [];
  const held = learner ? data.certificates.find((c) => c.learner === learner.id && c.status === "valid") : undefined;
  const answer = check?.answer;
  const result = answer?.status ?? "idle";

  const ask = () => toast.warning(SEAT_UNAVAILABLE);
  const verify = async () => {
    const typed = code.trim().toUpperCase();
    if (!typed) {
      toast.warning("Type the verification code printed under the certificate's QR code.");
      return;
    }
    setChecking(true);
    try {
      const res = await checkCertificateAction(typed);
      if (res.ok) setCheck({ code: typed, answer: res.value });
      else toast.danger(res.error);
    } catch {
      toast.danger("The certificate could not be checked. Try again.");
    } finally {
      setChecking(false);
    }
  };

  if (!course) {
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
          visitor ? (
            <>
              <LinkButton href={linkTo(links, visitor.home)} variant="ghost" size="sm">
                <ArrowLeft className="size-4" />
                Back to work
              </LinkButton>
              <NextLink
                href={linkTo(links, "Account")}
                aria-label={`Your account, ${visitor.name}`}
                className="inline-flex no-underline"
              >
                <Avatar size="sm" variant="soft" color="accent">
                  <Avatar.Fallback>{visitor.initials}</Avatar.Fallback>
                </Avatar>
              </NextLink>
            </>
          ) : (
            <SignInAction visitor={null} />
          )
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
                      const seat = seatOf(session, Boolean(learner));
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
                              <Button size="sm" onPress={ask}>
                                Request a seat
                              </Button>
                            ) : null}
                            {seat.canWait ? (
                              <Button size="sm" variant="secondary" onPress={ask}>
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
                {learner
                  ? `${learner.name} · ${learner.context} · a sample record, not yet read from Injishi`
                  : visitor
                    ? "No courses or certificates of yours are shown on this page yet."
                    : "Sign in to see your courses and certificates."}
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
                        onPress={() => toast.warning("Downloading the certificate is not available here yet.")}
                      >
                        <FileArrowDown className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => toast.warning("Showing your certificate's QR code is not available here yet.")}
                      >
                        <QrCode className="size-4" />
                        Show QR
                      </Button>
                    </span>
                  </ItemCard.Action>
                </ItemCard>
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
                For employers and anyone else. Type the verification code printed under the certificate's QR code and
                Injishi checks it.
              </span>
            </div>
            <div className="flex items-end gap-2">
              <TextField value={code} onChange={setCode} className="min-w-0 flex-1 gap-1">
                <Label htmlFor="code">Verification code</Label>
                <Input id="code" placeholder="The code under the QR" className="uppercase tabular" />
              </TextField>
              <Button onPress={() => void verify()} isDisabled={checking}>
                Verify
              </Button>
            </div>
            <Button
              variant="secondary"
              className="self-start"
              onPress={() => toast.warning("Scanning a QR code is not available here yet. Type the code instead.")}
            >
              <Camera className="size-4" />
              Scan QR instead
            </Button>
            {result === "valid" && answer ? (
              <>
                <Alert status="success" role="status">
                  <Alert.Indicator>
                    <CircleCheck />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Valid certificate</Alert.Title>
                    <Alert.Description>Checked with Injishi just now.</Alert.Description>
                  </Alert.Content>
                </Alert>
                <KeyValueList
                  items={[
                    { label: "Certificate", value: <span className="tabular">{answer.serial ?? check?.code}</span> },
                    { label: "Issued to", value: answer.holderName ?? "Not shown" },
                    { label: "Course", value: answer.courseTitle ?? "Not shown" },
                    {
                      label: "Session",
                      value:
                        [
                          answer.sessionDate ? kigaliDay(answer.sessionDate) : null,
                          answer.venueName,
                          answer.districtName,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Not shown",
                    },
                    {
                      label: "Issued",
                      value: answer.issuedAt
                        ? `${kigaliDay(answer.issuedAt)}${answer.leadTrainerName ? ` · trainer ${answer.leadTrainerName}` : ""}`
                        : "Not shown",
                    },
                  ]}
                />
              </>
            ) : null}
            {result === "revoked" && answer ? (
              <>
                <Alert status="danger" role="status">
                  <Alert.Indicator>
                    <CircleXmark />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Revoked · do not accept</Alert.Title>
                    <Alert.Description>
                      Marked revoked{answer.revokedAt ? ` on ${kigaliDay(answer.revokedAt)}` : ""}. The reason is not
                      shown publicly.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
                <KeyValueList
                  items={[
                    { label: "Certificate", value: <span className="tabular">{answer.serial ?? check?.code}</span> },
                    { label: "Course", value: answer.courseTitle ?? "Not shown" },
                    { label: "Originally issued", value: answer.issuedAt ? kigaliDay(answer.issuedAt) : "Not shown" },
                    { label: "Revoked", value: answer.revokedAt ? kigaliDay(answer.revokedAt) : "Not shown" },
                  ]}
                />
              </>
            ) : null}
            {result === "unknown" ? (
              <Alert status="warning" role="status">
                <Alert.Indicator>
                  <CircleQuestion />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Not found</Alert.Title>
                  <Alert.Description>
                    No certificate matches “{check?.code}”. Check the code for typos, or ask the holder to show the QR
                    code.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            <p className="flex gap-1.5 text-[12px] leading-[17px] text-muted">
              <ShieldCheck className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              We never show the holder’s employer, contact details or scores.
            </p>
          </Card>
        </div>
      </PublicMain>

      <Toast.Provider placement="bottom" />
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
