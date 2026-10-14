"use client";

import {
  ArrowRight,
  ArrowUturnCcwLeft,
  Camera,
  Check,
  CheckDouble,
  Clock,
  Picture,
  ShieldCheck,
  TriangleExclamation,
  Xmark,
} from "@gravity-ui/icons";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Description,
  Label,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { RadioButtonGroup } from "@heroui-pro/react";
import type { Persona } from "@injishi/data";
import type { CheckResult, InspectionCheck, InspectionRoom, StaffProfile } from "@injishi/data/fixtures/staff";
import { PhoneBody, PhoneTop, StatusDot } from "@injishi/ui";
import { useState } from "react";
import { PhoneTitle, PhotoTile, renderSection, ToneTile } from "./parts";

export interface InspectRoomData {
  profile: StaffProfile;
  rooms: InspectionRoom[];
  checks: InspectionCheck[];
}

type Decision = "released" | "returned";

/** Time the demo decision is recorded (the artifact's "now"). */
const NOW = "11:14";

/** Supervisor inspects cleaned rooms and releases them to the front desk or returns them (artifact: InspectRoom). */
export function InspectRoomView({ persona, data }: { persona: Persona; data: InspectRoomData }) {
  const { profile, rooms, checks } = data;
  const [roomNo, setRoomNo] = useState(rooms[0]?.no ?? "");
  const [results, setResults] = useState<Record<string, Record<string, CheckResult>>>(() =>
    Object.fromEntries(rooms.map((r) => [r.no, r.results])),
  );
  const [photos, setPhotos] = useState<Set<string>>(
    () => new Set(rooms.flatMap((r) => r.photos.map((id) => `${r.no}:${id}`))),
  );
  const [outcomes, setOutcomes] = useState<Record<string, "release" | "return">>(() =>
    Object.fromEntries(rooms.filter((r) => r.outcome).map((r) => [r.no, r.outcome as "release" | "return"])),
  );
  const [decided, setDecided] = useState<Record<string, Decision>>({});

  const r = rooms.find((x) => x.no === roomNo) ?? rooms[0];
  const res = results[r.no] ?? {};
  const decision = decided[r.no];
  const waiting = rooms.filter((x) => !decided[x.no]).length;

  const checked = checks.filter((c) => res[c.id]).length;
  const failed = checks.filter((c) => res[c.id] === "fail");
  const fails = failed.length;
  const unchecked = checks.length - checked;
  const missingPhoto = failed.some((c) => !photos.has(`${r.no}:${c.id}`));
  const outcome = outcomes[r.no] ?? (fails ? "return" : "release");
  const canRelease = unchecked === 0 && fails === 0;
  const isReturn = outcome === "return";
  let block = "";
  if (!isReturn && !canRelease)
    block = unchecked
      ? `Check all ${checks.length} items first (${unchecked} left).`
      : "A failed check cannot be released.";
  if (isReturn && missingPhoto) block = "Add a photo for each failed check.";

  const nextRoom = rooms.find((x) => x.no !== r.no && !decided[x.no]);

  const setResult = (checkId: string, value: CheckResult | null) =>
    setResults((all) => {
      const room = { ...(all[r.no] ?? {}) };
      if (value) room[checkId] = value;
      else delete room[checkId];
      return { ...all, [r.no]: room };
    });
  const setPhoto = (checkId: string, on: boolean) =>
    setPhotos((p) => {
      const next = new Set(p);
      if (on) next.add(`${r.no}:${checkId}`);
      else next.delete(`${r.no}:${checkId}`);
      return next;
    });

  const arrivalTime = r.arrival.startsWith("Arrival") ? r.arrival.replace("Arrival ", "") : null;
  const done =
    decision === "returned"
      ? {
          tone: "warning" as const,
          icon: <ArrowUturnCcwLeft />,
          title: `Returned to ${r.cleanedByFirst}`,
          text: "It is at the top of her list now. The room stays Clean, not Ready, until you inspect it again.",
          chip: "Returned · not sellable",
          history: `Returned by ${persona.name} at ${NOW} · ${fails} failed check${fails === 1 ? "" : "s"}, with photo`,
        }
      : {
          tone: "success" as const,
          icon: <CheckDouble />,
          title: `Room ${r.no} is Inspected`,
          text: `Front desk sees it as Ready from ${NOW}. ${
            arrivalTime ? `Eric can assign it for the ${arrivalTime} arrival.` : "It can be sold tonight."
          }`,
          chip: "Inspected",
          history: `Inspected by ${persona.name} at ${NOW} · ${checked} of ${checks.length} passed`,
        };

  return (
    <>
      <PhoneTop>
        <Avatar size="sm" variant="soft" color="success">
          <Avatar.Fallback>{persona.initials}</Avatar.Fallback>
        </Avatar>
        <PhoneTitle title="Inspections" sub={`${persona.name} · Supervisor · ${profile.area}`} />
        <Chip color="warning" variant="soft" className="shrink-0">
          {waiting} waiting
        </Chip>
      </PhoneTop>

      <div className="flex shrink-0 flex-col gap-[8px] px-[16px] pb-[8px]">
        <ToggleButtonGroup
          aria-label="Rooms waiting for inspection"
          selectionMode="single"
          disallowEmptySelection
          isDetached
          selectedKeys={[r.no]}
          onSelectionChange={(keys) => {
            const k = [...keys][0];
            if (k) setRoomNo(String(k));
          }}
          className="w-full justify-start gap-[6px] overflow-x-auto pb-[2px]"
        >
          {rooms.map((q) => {
            const d = decided[q.no];
            const tag = d === "released" ? "Inspected" : d === "returned" ? "Returned" : q.wait;
            const tone = d === "released" ? "success" : d === "returned" ? "warning" : q.late ? "danger" : "info";
            return (
              <ToggleButton key={q.no} id={q.no} className="h-12 shrink-0 gap-[8px] px-[12px]">
                <StatusDot tone={tone} />
                <span className="flex flex-col items-start">
                  <span className="leading-[18px] font-semibold tabular">{q.no}</span>
                  <span className="text-[11px] leading-[14px] font-medium opacity-80">{tag}</span>
                </span>
              </ToggleButton>
            );
          })}
        </ToggleButtonGroup>
        <p className="flex items-center gap-[6px] text-xs leading-4 text-muted">
          <ShieldCheck className="size-3 shrink-0" aria-hidden="true" />
          <span>Front desk can only give a room to a guest after you pass it here.</span>
        </p>
      </div>

      <PhoneBody key={r.no}>
        <Card render={renderSection} aria-labelledby="rm-h" className="gap-[10px] p-[16px]">
          <div className="flex items-start justify-between gap-[8px]">
            <div className="flex flex-col">
              <h2 id="rm-h" className="text-2xl leading-[30px] font-semibold tabular">
                Room {r.no}
              </h2>
              <span className="text-[13px] text-muted">{r.type} · checkout clean</span>
            </div>
            <Chip color={r.late ? "warning" : "default"} variant="soft" className="shrink-0">
              <Clock className="size-3" />
              <Chip.Label>{r.arrival}</Chip.Label>
            </Chip>
          </div>
          <div className="flex items-center gap-[10px]">
            <Avatar size="sm" variant="soft" color="accent">
              <Avatar.Fallback>{r.initials}</Avatar.Fallback>
            </Avatar>
            <span className="flex flex-col">
              <span className="font-medium">{r.cleanedBy}</span>
              <span className="text-xs leading-4 text-muted">
                {r.cleaned} · waiting {r.wait}
              </span>
            </span>
          </div>
          {r.skip ? (
            <p className="flex items-center gap-[8px] text-[13px] leading-[18px] text-warning-soft-foreground">
              <TriangleExclamation className="size-4 shrink-0" aria-hidden="true" />
              <span>{r.skip}</span>
            </p>
          ) : null}
        </Card>

        {!decision ? (
          <>
            <Card render={renderSection} aria-labelledby="ck-h" className="gap-0 px-[16px] pt-[8px] pb-[12px]">
              <div className="flex items-center justify-between py-[8px]">
                <h2 id="ck-h" className="text-[15px] leading-[22px] font-semibold">
                  Checklist
                </h2>
                <span className="text-xs text-muted tabular">
                  {checked} of {checks.length} checked · {fails} fail
                </span>
              </div>
              {checks.map((c) => {
                const v = res[c.id];
                const hasPhoto = photos.has(`${r.no}:${c.id}`);
                return (
                  <div key={c.id} className="flex flex-col gap-[8px] border-t border-separator py-[8px]">
                    <div className="flex items-center gap-[8px]">
                      <span className="flex-1 text-sm leading-[19px]">{c.label}</span>
                      <ToggleButtonGroup
                        aria-label={c.label}
                        selectionMode="single"
                        isDetached
                        selectedKeys={v ? [v] : []}
                        onSelectionChange={(keys) => {
                          const k = [...keys][0];
                          setResult(c.id, k === "pass" || k === "fail" ? k : null);
                        }}
                        className="shrink-0 gap-[6px]"
                      >
                        <ToggleButton
                          id="pass"
                          className="h-11 px-[12px] [--toggle-button-bg-selected-hover:var(--success-soft-hover)] [--toggle-button-bg-selected:var(--success-soft)] [--toggle-button-fg-selected:var(--success-soft-foreground)]"
                        >
                          <Check />
                          Pass
                        </ToggleButton>
                        <ToggleButton
                          id="fail"
                          className="h-11 px-[12px] [--toggle-button-bg-selected-hover:var(--danger-soft-hover)] [--toggle-button-bg-selected:var(--danger-soft)] [--toggle-button-fg-selected:var(--danger-soft-foreground)]"
                        >
                          <Xmark />
                          Fail
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </div>
                    {v === "fail" ? (
                      hasPhoto ? (
                        <div className="flex items-center gap-[10px]">
                          {c.photo ? (
                            <PhotoTile image={c.photo} className="h-16 w-[88px] shrink-0 rounded-[12px]" sizes="88px" />
                          ) : (
                            <span
                              role="img"
                              aria-label={`Photo of ${c.label.toLowerCase()}`}
                              className="flex h-16 w-[88px] shrink-0 items-center justify-center rounded-[12px] bg-surface-secondary text-muted"
                            >
                              <Picture className="size-5" aria-hidden="true" />
                            </span>
                          )}
                          <span className="flex flex-1 flex-col">
                            <span className="text-[13px] font-medium">Photo added</span>
                            <span className="text-xs text-muted">Goes to {r.cleanedByFirst} with the reason</span>
                          </span>
                          <Button variant="ghost" className="min-h-11" onPress={() => setPhoto(c.id, false)}>
                            <Camera className="size-4" />
                            Retake
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          fullWidth
                          className="min-h-12 text-danger-soft-foreground"
                          onPress={() => setPhoto(c.id, true)}
                        >
                          <Camera className="size-4" />
                          Add a photo of the problem
                        </Button>
                      )
                    ) : null}
                  </div>
                );
              })}
            </Card>

            <Card render={renderSection} aria-labelledby="out-h" className="gap-[12px] p-[16px]">
              <h2 id="out-h" className="text-[15px] leading-[22px] font-semibold">
                Outcome
              </h2>
              <RadioButtonGroup
                aria-labelledby="out-h"
                value={outcome}
                onChange={(v) => setOutcomes((o) => ({ ...o, [r.no]: v === "release" ? "release" : "return" }))}
                className="flex flex-col gap-[8px]"
              >
                <RadioButtonGroup.Item
                  value="release"
                  isDisabled={!canRelease}
                  className="w-full flex-row items-start gap-[12px] px-[14px] py-[12px]"
                >
                  <CheckDouble className="mt-[2px] size-5 shrink-0 text-success" aria-hidden="true" />
                  <RadioButtonGroup.ItemContent className="flex-1">
                    <Label className="font-semibold">Release to front desk</Label>
                    <Description className="text-xs leading-4">
                      {canRelease
                        ? "Status becomes Inspected. Front desk can give it to a guest."
                        : fails
                          ? "Not possible while a check has failed."
                          : "Check every item first."}
                    </Description>
                  </RadioButtonGroup.ItemContent>
                </RadioButtonGroup.Item>
                <RadioButtonGroup.Item
                  value="return"
                  className="w-full flex-row items-start gap-[12px] px-[14px] py-[12px]"
                >
                  <ArrowUturnCcwLeft className="mt-[2px] size-5 shrink-0 text-warning" aria-hidden="true" />
                  <RadioButtonGroup.ItemContent className="flex-1">
                    <Label className="font-semibold">Return to {r.cleanedByFirst}</Label>
                    <Description className="text-xs leading-4">
                      She gets it back on her phone with your reason and photos.
                    </Description>
                  </RadioButtonGroup.ItemContent>
                </RadioButtonGroup.Item>
              </RadioButtonGroup>
              {isReturn ? (
                <div className="flex flex-col gap-[6px]">
                  <span className="text-sm font-medium">Reason</span>
                  {fails ? (
                    <ul className="flex flex-col gap-[4px]">
                      {failed.map((c) => (
                        <li key={c.id} className="flex items-center gap-[8px] text-[13px]">
                          <Xmark className="size-3 shrink-0 text-danger" aria-hidden="true" />
                          <span>{c.label} — failed</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <TextField key={r.no} defaultValue={r.note} fullWidth>
                    <Label className="sr-only">Note for {r.cleanedByFirst}</Label>
                    <TextArea rows={2} placeholder="Tell her what to fix" />
                  </TextField>
                </div>
              ) : null}
              {block ? (
                <p role="alert" className="text-xs leading-4 text-danger-soft-foreground">
                  {block}
                </p>
              ) : null}
              <Button
                size="lg"
                fullWidth
                className="min-h-14"
                isDisabled={!!block}
                onPress={() => setDecided((d) => ({ ...d, [r.no]: isReturn ? "returned" : "released" }))}
              >
                {isReturn ? `Return to ${r.cleanedByFirst}` : `Release room ${r.no}`}
              </Button>
              <p className="text-xs leading-4 text-muted">Saved in the room history with your name and the time.</p>
            </Card>
          </>
        ) : (
          <Card render={renderSection} role="status" aria-labelledby="dn-h" className="gap-[12px] p-[20px]">
            <ToneTile tone={done.tone}>{done.icon}</ToneTile>
            <div className="flex flex-col gap-1">
              <h2 id="dn-h" className="text-xl leading-[26px] font-semibold">
                {done.title}
              </h2>
              <p className="text-muted">{done.text}</p>
            </div>
            <Chip color={done.tone} variant="soft" className="self-start">
              {done.chip}
            </Chip>
            <p className="text-xs leading-4 text-muted tabular">{done.history}</p>
            {nextRoom ? (
              <Button size="lg" fullWidth className="min-h-14" onPress={() => setRoomNo(nextRoom.no)}>
                Next: room {nextRoom.no}
                <ArrowRight className="size-4" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="min-h-11"
              onPress={() =>
                setDecided((d) => {
                  const next = { ...d };
                  delete next[r.no];
                  return next;
                })
              }
            >
              Undo within 1 minute
            </Button>
          </Card>
        )}
      </PhoneBody>
    </>
  );
}
