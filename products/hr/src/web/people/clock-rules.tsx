"use client";

import { CircleXmark, LocationArrow, Plus, TrashBin, TriangleExclamation } from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Chip,
  Input,
  Label,
  Modal,
  Radio,
  RadioGroup,
  Separator,
  TextArea,
  TextField,
} from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react";
import { useState, useTransition } from "react";
import type { ClockRecord } from "../../model/people.ts";
import type { ClockMode, ClockSetup, EntranceTablet, FarClockIn } from "../../model/time.ts";
import { useBoardHref, useHrActions } from "../mount.tsx";
import { locate } from "./locate.ts";

const KIGALI_TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });

const MODES: { id: ClockMode; title: string; detail: string }[] = [
  { id: "anywhere", title: "From their phone, anywhere", detail: "Clock-ins far from work wait for you to check." },
  {
    id: "at_work",
    title: "From their phone, at work only",
    detail: "Refused when the phone is far away or location is off.",
  },
  {
    id: "entrance",
    title: "At the entrance only",
    detail: "Scan the tablet's code, or use a PIN there.",
  },
];
const RADII = [50, 100, 150, 250, 500];
const OPENS: { value: string; label: string }[] = [
  { value: "", label: "Any time" },
  { value: "15", label: "15 min before the shift" },
  { value: "30", label: "30 min before the shift" },
  { value: "60", label: "1 hour before the shift" },
];

/**
 * Clock-in rules for a branch (058-time): how its staff clock themselves in, how near counts as
 * at work, how early a clock-in opens, where the branch is, and the entrance tablets that show the
 * code phones scan.
 */
export function ClockRulesModal({
  isOpen,
  onOpenChange,
  setup,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  setup: ClockSetup;
}) {
  const [branchId, setBranchId] = useState(setup.branches[0]?.propertyId ?? "");
  const branch = setup.branches.find((b) => b.propertyId === branchId) ?? null;
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog aria-labelledby="rules-h">
          <Modal.Header className="flex flex-col items-start gap-2">
            <Modal.Heading id="rules-h" className="text-[18px] leading-6 font-semibold">
              Clock-in rules
            </Modal.Heading>
            {setup.branches.length > 1 ? (
              <NativeSelect className="w-full max-w-xs">
                <NativeSelect.Trigger
                  aria-label="Branch"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                >
                  {setup.branches.map((b) => (
                    <NativeSelect.Option key={b.propertyId} value={b.propertyId}>
                      {b.branchName}
                    </NativeSelect.Option>
                  ))}
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
            ) : branch ? (
              <span className="text-sm text-muted">{branch.branchName}</span>
            ) : null}
          </Modal.Header>
          {branch ? (
            <BranchRules
              key={branch.propertyId}
              branch={branch}
              tablets={setup.tablets.filter((t) => t.propertyId === branch.propertyId)}
              onDone={() => onOpenChange(false)}
            />
          ) : (
            <Modal.Body>
              <p className="text-sm text-muted">No branches.</p>
            </Modal.Body>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function BranchRules({
  branch,
  tablets,
  onDone,
}: {
  branch: ClockSetup["branches"][number];
  tablets: EntranceTablet[];
  onDone: () => void;
}) {
  const screenHref = useBoardHref();
  const { addTabletAction, newTabletCodeAction, removeTabletAction, saveClockRuleAction } = useHrActions();
  const [mode, setMode] = useState<ClockMode>(branch.clockMode);
  const [radius, setRadius] = useState(String(branch.geofenceRadiusM));
  const [opens, setOpens] = useState(branch.opensMinutesBefore === null ? "" : String(branch.opensMinutesBefore));
  const [centre, setCentre] = useState<{ lat: number; lng: number; accuracyM: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "success" | "warning"; text: string } | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [tabletName, setTabletName] = useState("Staff entrance");
  const [pending, startTransition] = useTransition();
  const radiusOptions = RADII.includes(branch.geofenceRadiusM)
    ? RADII
    : [...RADII, branch.geofenceRadiusM].sort((a, b) => a - b);

  const useHere = () => {
    setMessage(null);
    setLocating(true);
    void locate().then((fix) => {
      setLocating(false);
      if (!fix) setMessage({ tone: "danger", text: "Could not get your location. Allow it and try again." });
      else if (fix.accuracyM > 200)
        setMessage({
          tone: "warning",
          text: `Only accurate to ${Math.round(fix.accuracyM)} m. Try again from inside the branch.`,
        });
      else setCentre(fix);
    });
  };

  const save = () =>
    startTransition(async () => {
      const r = await saveClockRuleAction(branch.propertyId, {
        clockMode: mode,
        opensMinutesBefore: opens ? Number(opens) : null,
        geofenceRadiusM: Number(radius),
        ...(centre ? { centre: { lat: centre.lat, lng: centre.lng } } : {}),
      });
      if (r.ok) onDone();
      else setMessage({ tone: "danger", text: r.error });
    });

  const showCode = (r: Awaited<ReturnType<typeof addTabletAction>>) => {
    if (r.ok) setCode({ code: r.code, expiresAt: r.expiresAt });
    else setMessage({ tone: "danger", text: r.error });
  };

  const located = centre
    ? `Set to your location (accurate to ${Math.round(centre.accuracyM)} m). Save to keep it.`
    : branch.centre
      ? "Set here, where staff clock in."
      : branch.propertyHasCoordinates
        ? "The property's map pin."
        : null;

  return (
    <>
      <Modal.Body className="flex flex-col gap-4">
        <RadioGroup
          aria-label="How staff clock in"
          value={mode}
          onChange={(v) => setMode(v as ClockMode)}
          className="gap-2"
        >
          <Label className="text-sm font-semibold">How staff clock in</Label>
          {MODES.map((m) => (
            <Radio
              key={m.id}
              value={m.id}
              className="rounded-xl border border-separator px-3 py-2.5 data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft"
            >
              <Radio.Content className="flex w-full items-start gap-3">
                <Radio.Control className="mt-0.5">
                  <Radio.Indicator />
                </Radio.Control>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{m.title}</span>
                  <span className="text-xs text-muted">{m.detail}</span>
                </span>
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>

        <div className="grid gap-3 sm:grid-cols-2">
          <NativeSelect fullWidth className="flex flex-col gap-1">
            <Label htmlFor="rules-radius">Counts as at work within</Label>
            <NativeSelect.Trigger id="rules-radius" value={radius} onChange={(e) => setRadius(e.target.value)}>
              {radiusOptions.map((m) => (
                <NativeSelect.Option key={m} value={String(m)}>
                  {m} m of the branch
                </NativeSelect.Option>
              ))}
              <NativeSelect.Indicator />
            </NativeSelect.Trigger>
          </NativeSelect>
          <NativeSelect fullWidth className="flex flex-col gap-1">
            <Label htmlFor="rules-opens">Clock-in opens</Label>
            <NativeSelect.Trigger id="rules-opens" value={opens} onChange={(e) => setOpens(e.target.value)}>
              {OPENS.map((o) => (
                <NativeSelect.Option key={o.value} value={o.value}>
                  {o.label}
                </NativeSelect.Option>
              ))}
              <NativeSelect.Indicator />
            </NativeSelect.Trigger>
          </NativeSelect>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-secondary px-3 py-2.5">
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold">Branch location</span>
            <span className={`text-xs ${located ? "text-muted" : "font-medium text-warning-soft-foreground"}`}>
              {located ?? "Not set: every phone clock-in waits for you to check."}
            </span>
          </span>
          <Button size="sm" variant="secondary" isPending={locating} onPress={useHere}>
            <LocationArrow className="size-4" aria-hidden="true" />
            Use my location here
          </Button>
        </div>

        <Separator />

        <section aria-labelledby="tablets-h" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span id="tablets-h" className="text-sm font-semibold">
              Entrance tablets
            </span>
            <span className="flex items-center gap-2">
              <TextField value={tabletName} onChange={setTabletName} aria-label="Tablet name" className="w-36">
                <Input className="h-8 text-sm" />
              </TextField>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={pending}
                onPress={() =>
                  startTransition(async () => showCode(await addTabletAction(branch.propertyId, tabletName)))
                }
              >
                <Plus className="size-4" aria-hidden="true" />
                Add
              </Button>
            </span>
          </div>
          {code ? (
            <div className="flex flex-col gap-1 rounded-xl border border-accent bg-accent-soft px-3 py-2.5">
              <span className="font-mono text-2xl font-semibold tracking-[0.2em] tabular">
                {code.code.slice(0, 4)} {code.code.slice(4)}
              </span>
              <span className="text-xs">
                On the tablet, open <span className="font-semibold">{screenHref("AttendanceKiosk")}</span> and type this
                code before {KIGALI_TIME.format(new Date(code.expiresAt))}.
              </span>
            </div>
          ) : null}
          {tablets.length === 0 ? (
            <p className="text-xs text-muted">No tablets yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-separator">
              {tablets.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
                  <Chip size="sm" variant="soft" color={t.status === "active" ? "success" : "warning"}>
                    {t.status === "active"
                      ? t.lastSeenAt
                        ? `Paired · seen ${KIGALI_TIME.format(new Date(t.lastSeenAt))}`
                        : "Paired"
                      : "Waiting to pair"}
                  </Chip>
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={pending}
                    onPress={() => startTransition(async () => showCode(await newTabletCodeAction(t.id)))}
                  >
                    New code
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    aria-label={`Remove ${t.name}`}
                    isDisabled={pending}
                    onPress={() =>
                      startTransition(async () => {
                        const r = await removeTabletAction(t.id);
                        if (!r.ok) setMessage({ tone: "danger", text: r.error });
                      })
                    }
                  >
                    <TrashBin className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {message ? (
          <Alert status={message.tone}>
            <Alert.Indicator>{message.tone === "danger" ? <CircleXmark /> : <TriangleExclamation />}</Alert.Indicator>
            <Alert.Content>
              <Alert.Description>{message.text}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={onDone}>
          Cancel
        </Button>
        <Button onPress={save} isPending={pending}>
          Save rules
        </Button>
      </Modal.Footer>
    </>
  );
}

/** A clock-in from a phone nobody has checked: count it, or not, because the person was not at work. */
export function CheckClockInModal({ row, onClose }: { row: ClockRecord | null; onClose: () => void }) {
  const { checkClockInAction } = useHrActions();
  const [refusing, setRefusing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const close = () => {
    setRefusing(false);
    setNote("");
    setError(null);
    onClose();
  };
  const decide = (count: boolean) =>
    startTransition(async () => {
      if (!row?.check) return;
      const r = await checkClockInAction(row.check.recordId, count ? { count: true } : { count: false, note });
      if (r.ok) close();
      else setError(r.error);
    });

  return (
    <Modal.Backdrop isOpen={row !== null} onOpenChange={(o) => (o ? undefined : close())}>
      <Modal.Container size="sm">
        <Modal.Dialog aria-labelledby="check-h">
          <Modal.Header>
            <Modal.Heading id="check-h" className="text-[18px] leading-6 font-semibold">
              Check clock-in
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3">
            {row ? (
              <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-muted">Employee</dt>
                <dd className="font-semibold">{row.name}</dd>
                <dt className="text-muted">Clocked in</dt>
                <dd className="tabular">
                  {row.clockIn} · {row.day === "today" ? "today" : "yesterday"}
                </dd>
                <dt className="text-muted">Where</dt>
                <dd className="font-medium">{row.check?.why}</dd>
              </dl>
            ) : null}
            {refusing ? (
              <TextField value={note} onChange={setNote} className="flex flex-col gap-1" autoFocus>
                <Label>Why it does not count</Label>
                <TextArea rows={2} placeholder="Was not at work; their manager confirmed" />
              </TextField>
            ) : null}
            {error ? <p className="text-sm font-medium text-danger-soft-foreground">{error}</p> : null}
          </Modal.Body>
          <Modal.Footer>
            {refusing ? (
              <>
                <Button variant="ghost" onPress={() => setRefusing(false)}>
                  Back
                </Button>
                <Button
                  variant="danger"
                  isPending={pending}
                  isDisabled={note.trim().length < 3}
                  onPress={() => decide(false)}
                >
                  Mark not counted
                </Button>
              </>
            ) : (
              <>
                <Button variant="danger-soft" isDisabled={pending} onPress={() => setRefusing(true)}>
                  Not at work
                </Button>
                <Button isPending={pending} onPress={() => decide(true)}>
                  Count it
                </Button>
              </>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Who clocked in, or tried to, far from work this month, in name order. */
export function FarFromWork({ far }: { far: FarClockIn[] }) {
  if (far.length === 0) return null;
  const shown = far.slice(0, 4);
  return (
    <Alert status="warning">
      <Alert.Indicator>
        <TriangleExclamation />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>Clocked in far from work this month</Alert.Title>
        <Alert.Description>
          {shown.map((p, i) => (
            <span key={p.employeeId}>
              {i > 0 ? " · " : ""}
              <span className="font-semibold">{p.displayName}</span> {p.times === 1 ? "once" : `${p.times} times`}
            </span>
          ))}
          {far.length > shown.length ? ` · and ${far.length - shown.length} more` : ""}
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
