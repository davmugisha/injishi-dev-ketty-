"use client";

import {
  ArrowsRotateRight,
  Ban,
  Bell,
  Camera,
  Check,
  ChevronLeft,
  CircleCheck,
  CircleCheckFill,
  CircleInfo,
  CloudSlash,
  FloppyDisk,
  PaperPlane,
  Plus,
  Wrench,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Label,
  Switch,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { RadioButtonGroup, Timeline } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { ProblemCategory, ProblemReport, ReportPlace, UrgencyLevel } from "@injishi/data/fixtures/staff";
import { Icon, KeyValueList, LinkButton, PhoneBody, PhoneTop, StatusDot } from "@injishi/ui";
import type { ReactNode } from "react";
import { useState } from "react";
import { PhoneActionBar, PhoneTitle, PhotoTile, renderSection, ToneTile } from "./parts";

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

const photoLabel = (n: number) => (n ? `${n} ${n === 1 ? "photo" : "photos"}` : "None");

/** Housekeeper reports a problem to maintenance: place, category, urgency, photo (artifact: StaffReport). */
export function StaffReportView({ data, offline = false }: { data: StaffReportData; offline?: boolean }) {
  const { places, categories, urgencies, report } = data;
  const [place, setPlace] = useState(report.place);
  const [category, setCategory] = useState(report.category);
  const [urgency, setUrgency] = useState(report.urgency);
  const [photos, setPhotos] = useState(report.photos);
  const [block, setBlock] = useState(report.askBlock);
  const [sent, setSent] = useState(false);
  const [retried, setRetried] = useState(false);

  const placeDoc = places.find((p) => p.id === place) ?? places[0];
  const isRoom = placeDoc.isRoom;
  const blockOn = block && isRoom;
  const where = isRoom ? `Room ${placeDoc.label}` : "Floor 2 corridor";
  const cat = categories.find((c) => c.id === category) ?? categories[0];
  const sev = urgencies.find((u) => u.id === urgency) ?? urgencies[0];
  const backLabel = `Back to room ${report.place}`;

  const steps: Step[] = offline
    ? [
        {
          status: "warning",
          icon: <FloppyDisk />,
          title: "Saved on this phone",
          detail: `${report.sentAt} · waiting for signal`,
        },
        {
          status: "default",
          icon: <PaperPlane />,
          title: "Sends to maintenance",
          detail: "Automatically, as soon as there is signal",
        },
        {
          status: "default",
          icon: <Wrench />,
          title: `${report.assigneeFirst} gets the job`,
          detail: "Ticket number is given when it arrives",
        },
      ]
    : [
        {
          status: "success",
          icon: <Check />,
          title: "Sent to maintenance",
          detail: `${report.sentAt} · ${photos ? `with ${photoLabel(photos)}` : "no photo"}`,
        },
        {
          status: "current",
          icon: <Wrench />,
          title: `${report.assignee} notified`,
          detail: "It is in his queue · Beatrice gets a copy",
        },
        ...(blockOn
          ? [
              {
                status: "warning" as const,
                icon: <Ban />,
                title: `Out-of-order request with ${report.manager}`,
                detail: `Room ${placeDoc.label} stays on sale until she approves`,
              },
            ]
          : []),
        {
          status: "default",
          icon: <Bell />,
          title: "You get a message when it is fixed",
          detail: "Check it in Today",
        },
      ];

  const blockNote = !isRoom
    ? "Corridors are not sold, so there is nothing to block."
    : blockOn
      ? `This asks ${report.managerFirst} (manager) to take room ${placeDoc.label} out of order. Front desk keeps selling it until she approves.`
      : "Leave this off if guests can still use the room.";

  const reset = () => {
    setSent(false);
    setPhotos(0);
    setUrgency(report.urgency);
    setCategory(report.category);
    setRetried(false);
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
                You can still report. It is saved on this phone and sends when signal is back.
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
              {photos > 0 ? (
                <>
                  <PhotoTile image={report.photo} caption={report.photoCaption} className="h-[168px] w-full" priority>
                    {photos > 1 ? (
                      <Chip size="sm" variant="soft" className="absolute top-[10px] right-[10px]">
                        {photoLabel(photos)}
                      </Chip>
                    ) : null}
                  </PhotoTile>
                  <div className="grid grid-cols-2 gap-[8px]">
                    <Button variant="secondary" size="lg" fullWidth className="min-h-12" onPress={() => setPhotos(0)}>
                      <Camera className="size-4" />
                      Retake
                    </Button>
                    <Button
                      variant="ghost"
                      size="lg"
                      fullWidth
                      className="min-h-12"
                      isDisabled={photos >= 3}
                      onPress={() => setPhotos((n) => Math.min(3, n + 1))}
                    >
                      <Plus className="size-4" />
                      Add another
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  className="min-h-24 flex-col gap-[6px]"
                  onPress={() => setPhotos(1)}
                >
                  <Camera className="size-6" />
                  Take a photo
                </Button>
              )}
              <p className="text-xs leading-4 text-muted">Photos are made smaller so they send on weak signal.</p>
            </section>

            <TextField defaultValue={report.description} fullWidth className="flex flex-col gap-1">
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
            <ToneTile tone={offline ? "warning" : "success"}>{offline ? <CloudSlash /> : <CircleCheck />}</ToneTile>
            <div className="flex flex-col gap-1">
              <h2 id="ok-h" className="text-xl leading-[26px] font-semibold">
                {offline ? "Saved on phone · will send" : "Report sent"}
              </h2>
              {!offline ? (
                <span className="text-[28px] leading-9 font-semibold tracking-[-0.01em] tabular">{report.ticket}</span>
              ) : null}
              <p className="text-muted">
                {offline
                  ? "No signal right now. Your report is safe on this phone. It gets a ticket number when it reaches maintenance."
                  : "Maintenance has your report. Keep this number if anyone asks."}
              </p>
            </div>
            <KeyValueList
              items={[
                { label: "Where", value: where },
                { label: "Problem", value: cat.label },
                { label: "Urgency", value: sev.label },
                { label: "Photo", value: photoLabel(photos) },
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
            {offline ? (
              <>
                <Button variant="secondary" size="lg" fullWidth className="min-h-14" onPress={() => setRetried(true)}>
                  <ArrowsRotateRight className="size-4" />
                  Try sending now
                </Button>
                {retried ? (
                  <p role="status" className="text-xs leading-4 text-muted">
                    Still no signal at 10:53. The phone keeps trying on its own.
                  </p>
                ) : null}
              </>
            ) : null}
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
          <Button
            size="lg"
            fullWidth
            className="min-h-14"
            onPress={() => {
              setSent(true);
              setRetried(false);
            }}
          >
            {offline ? <FloppyDisk className="size-4" /> : <PaperPlane className="size-4" />}
            {offline ? "Save report on phone" : "Send report"}
          </Button>
        </PhoneActionBar>
      ) : null}
    </>
  );
}
