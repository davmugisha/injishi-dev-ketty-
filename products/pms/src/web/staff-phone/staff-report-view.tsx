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
import { Icon, KeyValueList, LinkButton, PhoneBody, PhoneTop, StatusDot } from "@injishi/ui";
import { PhoneActionBar, PhoneTitle, PhoneToasts, renderSection, ToneTile } from "@injishi/ui/phone";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import type { ProblemCategory, ProblemReport, ReportPlace, UrgencyLevel } from "../../model/staff.ts";
import { useBoardHref, usePmsActions } from "../mount.tsx";
import { reported } from "../operations/shared.tsx";
import { kigaliClock } from "./parts.tsx";

interface StaffReportData {
  places: ReportPlace[];
  categories: ProblemCategory[];
  urgencies: UrgencyLevel[];
  /** The person's own reports still open in maintenance, as the API holds them: listed so nothing is sent twice. */
  open: ProblemReport[];
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

const BACK_LABEL = "Back to my rooms";

/**
 * Housekeeper reports a problem to maintenance: place, category, urgency, photo (artifact: StaffReport). The form
 * starts empty: the place, what is wrong and how urgent are the person's choices, never copied from an earlier report.
 */
export function StaffReportView({ data, offline = false }: { data: StaffReportData; offline?: boolean }) {
  const screenHref = useBoardHref();
  const { reportProblemAction } = usePmsActions();
  const { places, categories, urgencies } = data;
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState("");
  const [urgency, setUrgency] = useState("");
  const [block, setBlock] = useState(false);
  const [description, setDescription] = useState("");
  /** The work order the report became, and when the API took it. */
  const [sent, setSent] = useState<{ ticket: string; at: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const placeDoc = places.find((p) => p.id === place);
  const isRoom = placeDoc?.isRoom ?? false;
  const blockOn = block && isRoom;
  const where = placeDoc ? (isRoom ? `Room ${placeDoc.label}` : placeDoc.label) : "";
  const ready = Boolean(placeDoc && category && urgency && description.trim());
  const send = () => {
    // Nothing is kept on the phone: with no signal the report is not sent, and the screen says so.
    if (offline) {
      toast.warning("No signal: the report was not sent and is not saved on this phone. Send it when you have signal.");
      return;
    }
    if (!placeDoc) return;
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
            detail: `${where} stays on sale until a manager approves`,
          },
        ]
      : []),
  ];

  const blockNote = !placeDoc
    ? "Choose where first. Only a room can be taken out of order."
    : !isRoom
      ? "Corridors and shared spaces are not sold, so there is nothing to block."
      : blockOn
        ? `This asks a manager to take room ${placeDoc.label} out of order. Front desk keeps selling it until a manager approves.`
        : "Leave this off if guests can still use the room.";

  const reset = () => {
    setSent(null);
    setPlace("");
    setCategory("");
    setUrgency("");
    setBlock(false);
    setDescription("");
  };

  return (
    <>
      <PhoneTop>
        <LinkButton
          href={screenHref("StaffTask")}
          variant="ghost"
          isIconOnly
          aria-label={BACK_LABEL}
          title={BACK_LABEL}
          className="size-11"
        >
          <ChevronLeft className="size-4" />
        </LinkButton>
        <PhoneTitle title="Report a problem" sub="Goes to maintenance as a work order" />
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

        {!sent && data.open.length ? (
          <p className="text-[13px] leading-[18px] text-muted">
            Already open from you: {data.open.map((o) => (o.place ? `${o.ticket} (${o.place})` : o.ticket)).join(", ")}
          </p>
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
                selectedKeys={place ? [place] : []}
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
              <p className="text-xs leading-4 text-muted">
                {places.length
                  ? "Your rooms today and the shared spaces on your floors."
                  : "No room or space is assigned to you today, so there is nowhere to choose. Tell a supervisor."}
              </p>
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
                selectedKeys={category ? [category] : []}
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
              <TextArea rows={3} placeholder="Water under the basin, the pipe drips" />
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
              {BACK_LABEL}
            </LinkButton>
            <Button variant="ghost" size="lg" fullWidth className="min-h-12" onPress={reset}>
              Report another problem
            </Button>
          </Card>
        )}
      </PhoneBody>

      {!sent ? (
        <PhoneActionBar className="flex-col">
          <Button size="lg" fullWidth className="min-h-14" isDisabled={pending || !ready} onPress={send}>
            <PaperPlane className="size-4" />
            Send report
          </Button>
        </PhoneActionBar>
      ) : null}
      <PhoneToasts />
    </>
  );
}
