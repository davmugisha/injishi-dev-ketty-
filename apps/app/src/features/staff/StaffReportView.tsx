"use client";

import {
  Ban,
  Camera,
  Check,
  ChevronLeft,
  CircleCheck,
  CircleCheckFill,
  CircleInfo,
  CloudSlash,
  PaperPlane,
  Wrench,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Description,
  Label,
  Switch,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  toast,
} from "@heroui/react";
import { RadioButtonGroup, Timeline } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { ProblemCategory, ProblemReport, ReportPlace, UrgencyLevel } from "@injishi/data/fixtures/staff";
import { Icon, KeyValueList, LinkButton, PhoneBody, PhoneTop, StatusDot } from "@injishi/ui";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { reported } from "../operations/shared";
import { reportProblemAction } from "./actions";
import { kigaliClock, PhoneActionBar, PhoneTitle, PhoneToasts, renderSection, ToneTile } from "./parts";

export interface StaffReportData {
  places: ReportPlace[];
  categories: ProblemCategory[];
  urgencies: UrgencyLevel[];
  report: ProblemReport;
}

interface Step {
  status: "success" | "current" | "warning" | "default";
  icon: ReactNode;
  title: string;
  detail: string;
}

/**
 * Why the photo button does nothing yet: a work order is raised without photos (`POST /ops/work-orders` names
 * none), so a photo taken here would never reach maintenance.
 */
const PHOTO_UNAVAILABLE = "Photos cannot be sent with a report yet. Say what you see in a few words instead.";

/** Housekeeper reports a problem to maintenance: place, category, urgency, photo (artifact: StaffReport). */
export function StaffReportView({ data, offline = false }: { data: StaffReportData; offline?: boolean }) {
  const { places, categories, urgencies, report } = data;
  const [place, setPlace] = useState(() =>
    places.some((p) => p.id === report.place) ? report.place : (places[0]?.id ?? ""),
  );
  const [category, setCategory] = useState(report.category);
  const [urgency, setUrgency] = useState(report.urgency);
  const [block, setBlock] = useState(report.askBlock);
  const [description, setDescription] = useState(report.description);
  /** The work order the report became, and when the API took it. */
  const [sent, setSent] = useState<{ ticket: string; at: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const placeDoc = places.find((p) => p.id === place) ?? places[0];
  const isRoom = placeDoc.isRoom;
  const blockOn = block && isRoom;
  const where = isRoom ? `Room ${placeDoc.label}` : placeDoc.label;
  const send = () => {
    // Nothing is kept on the phone: with no signal the report is not sent, and the screen says so.
    if (offline) {
      toast.warning("No signal: the report was not sent and is not saved on this phone. Send it when you have signal.");
      return;
    }
    startTransition(async () => {
      const result = await reportProblemAction({
        place: placeDoc.label,
        isRoom,
        category,
        urgency,
        description,
        askBlock: blockOn,
      });
      if (reported(result) && result.ok) setSent({ ticket: result.value, at: kigaliClock() });
    });
  };
  const cat = categories.find((c) => c.id === category) ?? categories[0];
  const sev = urgencies.find((u) => u.id === urgency) ?? urgencies[0];
  const backLabel = `Back to room ${report.place}`;

  const steps: Step[] = [
    {
      status: "success",
      icon: <Check />,
      title: "Sent to maintenance",
      detail: `${sent?.at ?? ""} · ${sent?.ticket ?? ""} · no photo`,
    },
    {
      status: "current",
      icon: <Wrench />,
      title: "In the maintenance queue",
      detail: "A technician takes it from the work order list",
    },
    ...(blockOn
      ? [
          {
            status: "warning" as const,
            icon: <Ban />,
            title: "Out-of-order request with a manager",
            detail: `Room ${placeDoc.label} stays on sale until a manager approves`,
          },
        ]
      : []),
  ];

  const blockNote = !isRoom
    ? "Corridors are not sold, so there is nothing to block."
    : blockOn
      ? `This asks a manager to take room ${placeDoc.label} out of order. Front desk keeps selling it until a manager approves.`
      : "Leave this off if guests can still use the room.";

  const reset = () => {
    setSent(null);
    setUrgency(report.urgency);
    setCategory(report.category);
    setDescription("");
  };

  return (
    <>
      <PhoneTop>
        <LinkButton
          href={screenHref("StaffTask")}
          variant="ghost"
          isIconOnly
          aria-label={backLabel}
          title={backLabel}
          className="size-11"
        >
          <ChevronLeft className="size-4" />
        </LinkButton>
        <PhoneTitle title="Report a problem" sub={`Goes to maintenance · ${report.assigneeFirst} is on shift`} />
      </PhoneTop>

      <PhoneBody>
        {offline && !sent ? (
          <Alert status="warning" role="status">
            <Alert.Indicator>
              <CloudSlash />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>No connection</Alert.Title>
              <Alert.Description>
                A report is not saved on this phone. Send it once signal is back, or tell a supervisor.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        {!sent ? (
          <>
            <section className="flex flex-col gap-[8px]" aria-labelledby="where-h">
              <h2 id="where-h" className="text-[15px] leading-[22px] font-semibold">
                Where
              </h2>
              <ToggleButtonGroup
                aria-labelledby="where-h"
                selectionMode="single"
                disallowEmptySelection
                isDetached
                selectedKeys={[place]}
                onSelectionChange={(keys) => {
                  const k = [...keys][0];
                  if (k) setPlace(String(k));
                }}
                className="flex-wrap justify-start gap-[6px]"
              >
                {places.map((p) => (
                  <ToggleButton key={p.id} id={p.id} size="lg" className="h-11 min-w-14 tabular">
                    {p.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <p className="text-xs leading-4 text-muted">Your rooms today and the floor 2 corridor.</p>
            </section>

            <section className="flex flex-col gap-[8px]" aria-labelledby="cat-h">
              <h2 id="cat-h" className="text-[15px] leading-[22px] font-semibold">
                What is wrong?
              </h2>
              <ToggleButtonGroup
                aria-labelledby="cat-h"
                selectionMode="single"
                disallowEmptySelection
                isDetached
                selectedKeys={[category]}
                onSelectionChange={(keys) => {
                  const k = [...keys][0];
                  if (k) setCategory(String(k));
                }}
                className="grid w-full grid-cols-3 gap-[8px]"
              >
                {categories.map((c) => (
                  <ToggleButton
                    key={c.id}
                    id={c.id}
                    className="h-16 w-full flex-col gap-[4px] rounded-[18px] text-sm [&_svg]:size-5"
                  >
                    <Icon name={c.icon} className="size-5" />
                    {c.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </section>

            <section className="flex flex-col gap-[8px]" aria-labelledby="sev-h">
              <h2 id="sev-h" className="text-[15px] leading-[22px] font-semibold">
                How urgent?
              </h2>
              <RadioButtonGroup
                aria-labelledby="sev-h"
                value={urgency}
                onChange={setUrgency}
                className="flex flex-col gap-[8px]"
              >
                {urgencies.map((u) => (
                  <RadioButtonGroup.Item
                    key={u.id}
                    value={u.id}
                    className="min-h-14 w-full flex-row items-center gap-[12px] px-[14px] py-[12px]"
                  >
                    <StatusDot tone={u.tone} />
                    <RadioButtonGroup.ItemContent className="flex-1">
                      <Label className="font-semibold">{u.label}</Label>
                      <Description className="text-xs leading-4">{u.hint}</Description>
                    </RadioButtonGroup.ItemContent>
                    <RadioButtonGroup.Indicator className="static">
                      <CircleCheckFill className="size-4 text-accent" />
                    </RadioButtonGroup.Indicator>
                  </RadioButtonGroup.Item>
                ))}
              </RadioButtonGroup>
            </section>

            <section className="flex flex-col gap-[8px]" aria-labelledby="ph-h">
              <h2 id="ph-h" className="text-[15px] leading-[22px] font-semibold">
                Photo
              </h2>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                className="min-h-24 flex-col gap-[6px]"
                onPress={() => toast.warning(PHOTO_UNAVAILABLE)}
              >
                <Camera className="size-6" />
                Take a photo
              </Button>
              <p className="text-xs leading-4 text-muted">Not available yet: photos are not sent with a report.</p>
            </section>

            <TextField value={description} onChange={setDescription} fullWidth className="flex flex-col gap-1">
              <Label>What did you see?</Label>
              <TextArea rows={3} />
              <Description>A few words is enough.</Description>
            </TextField>

            <Card
              render={renderSection}
              aria-label="Room can't be sold"
              className="gap-[6px] px-[16px] pt-[8px] pb-[14px]"
            >
              <Switch
                size="lg"
                isSelected={blockOn}
                isDisabled={!isRoom}
                onChange={setBlock}
                className="min-h-[52px] w-full flex-row items-center gap-[12px]"
              >
                <Switch.Content className="flex flex-1 flex-col items-start text-left">
                  <Label className="font-semibold">Room can't be sold</Label>
                  <Description className="text-xs leading-4">Ask to take it out of order</Description>
                </Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
              <p className="flex items-start gap-[8px] text-xs leading-4 text-muted">
                {blockOn ? (
                  <CircleInfo className="mt-[1px] size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <CircleCheck className="mt-[1px] size-4 shrink-0" aria-hidden="true" />
                )}
                <span>{blockNote}</span>
              </p>
            </Card>
          </>
        ) : (
          <Card render={renderSection} role="status" aria-labelledby="ok-h" className="gap-[14px] p-[20px]">
            <ToneTile tone="success">
              <CircleCheck />
            </ToneTile>
            <div className="flex flex-col gap-1">
              <h2 id="ok-h" className="text-xl leading-[26px] font-semibold">
                Report sent
              </h2>
              <span className="text-[28px] leading-9 font-semibold tracking-[-0.01em] tabular">{sent?.ticket}</span>
              <p className="text-muted">Maintenance has your report. Keep this number if anyone asks.</p>
            </div>
            <KeyValueList
              items={[
                { label: "Where", value: where },
                { label: "Problem", value: cat.label },
                { label: "Urgency", value: sev.label },
              ]}
            />
            <Timeline size="sm" density="compact">
              {steps.map((s) => (
                <Timeline.Item key={s.title} status={s.status}>
                  <Timeline.Rail>
                    <Timeline.Marker>{s.icon}</Timeline.Marker>
                    <Timeline.Connector />
                  </Timeline.Rail>
                  <Timeline.Content>
                    <span className="font-medium">{s.title}</span>
                    <span className="text-xs leading-4 text-muted">{s.detail}</span>
                  </Timeline.Content>
                </Timeline.Item>
              ))}
            </Timeline>
            <LinkButton href={screenHref("StaffTask")} size="lg" fullWidth className="min-h-14">
              {backLabel}
            </LinkButton>
            <Button variant="ghost" size="lg" fullWidth className="min-h-12" onPress={reset}>
              Report another problem
            </Button>
          </Card>
        )}
      </PhoneBody>

      {!sent ? (
        <PhoneActionBar className="flex-col">
          <Button size="lg" fullWidth className="min-h-14" isDisabled={pending || !description.trim()} onPress={send}>
            <PaperPlane className="size-4" />
            Send report
          </Button>
        </PhoneActionBar>
      ) : null}
      <PhoneToasts />
    </>
  );
}
