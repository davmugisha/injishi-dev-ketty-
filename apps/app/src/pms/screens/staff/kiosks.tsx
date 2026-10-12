"use client";

/**
 * Staff · Kiosks (ADR-058, 058-time AC-TM10, AC-TM11).
 *
 * A kiosk is a shared tablet at a branch where people clock in with their
 * employee number and a PIN: for the cook without a phone or an account. Add
 * one here and this screen shows a one time code for ten minutes; on the
 * tablet, open web's `/kiosk` and type it. The tablet keeps a device cookie the
 * page itself cannot read, and nothing else: no session, no list of people.
 * Revoking a kiosk stops it at once.
 *
 * PINs are set here by whoever runs attendance, never shown again, and a
 * person can change their own in self service. Five wrong PINs in a row lock a
 * person on that kiosk for fifteen minutes; the desk can lift it sooner.
 *
 * The desk cannot read staff files, so the people it chooses from are those
 * on the roster these two weeks; someone who reads files chooses from all.
 *
 * THE SCREEN ANSWERS TWO QUESTIONS IT USED TO LEAVE OPEN.
 *
 * "Is the tablet working?" Each kiosk is a card whose edge and badge say its
 * state: in use and when it was last used, waiting for its tablet, or
 * revoked. Pairing is three numbered steps with the address to open on the
 * tablet, a button that copies it, and the code large enough to read across a
 * counter.
 *
 * "Who can use it?" PINs were set one person at a time through a form that
 * said nothing about anybody else, so nobody could tell who was still without
 * one until they stood at the door unable to clock in. People are a list now:
 * each row says whether that person has a PIN and since when, and sets or
 * resets it in place. "Suggest one" offers four random digits, shown in
 * clear because the office has to read them to the person; a PIN typed by
 * hand stays hidden, as before.
 */

import { ListQuery, type Kiosk, type KioskPairingCode } from "@injishi/contracts";
import { Input } from "@injishi/ui";
import { KeyRound, UserX } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { ConfirmAction } from "../../components/confirm-action";
import { ActionButton, Badge, EmptyState, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useEmployees, useRosterPage } from "../../data/people";
import { useCreateKiosk, useKioskPairingCode, useKiosks, usePinState, useRevokeKiosk, useSetPin, useUnlockPin } from "../../data/time";
import { addDaysIso, dshortIso, kigaliDateOf, todayIso } from "../../lib/format";
import { WEB_URL } from "../../lib/sign-in-url";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Avatar, Figure } from "./staff-look";
import { Field, FormError, RowList, clock, inputClass, rowClass, type PersonOption } from "./staff-ui";

/** How many people the PIN list draws at once. Past it, the search finds the rest: each row asks the server about one person. */
const PIN_ROWS = 30;

/** The people a picker here offers: every file when the caller reads files, else who is rostered these two weeks. */
function usePinPeople(): PersonOption[] {
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const readsFiles = can("people.view") || can("people.manage");
  const employees = useEmployees(readsFiles ? workspaceId : null, "active");
  const today = todayIso();
  const roster = useRosterPage(
    readsFiles ? null : workspaceId,
    ListQuery.parse({
      filters: [{ field: "workDate", op: "between", value: [addDaysIso(today, -7), addDaysIso(today, 7)] }],
      pageSize: 100,
    }),
  );
  if (readsFiles) {
    return (employees.data ?? [])
      .map((e) => ({ id: e.id, label: e.displayName, detail: [e.employeeNumber, e.jobPositionTitle].filter(Boolean).join(" · ") }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
  const seen = new Map<string, PersonOption>();
  for (const entry of roster.data?.items ?? []) {
    seen.set(entry.employee.employeeId, { id: entry.employee.employeeId, label: entry.employee.displayName, detail: entry.employee.jobPositionTitle });
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function statusOf(k: Kiosk): { label: string; intent: "ok" | "warn" | "neutral"; edge: string } {
  if (k.status === "revoked") return { label: "Revoked", intent: "neutral", edge: "var(--line2)" };
  if (k.status === "pairing") return { label: "Waiting for its tablet", intent: "warn", edge: "var(--warn)" };
  return { label: "In use", intent: "ok", edge: "var(--ok)" };
}

/** When a kiosk was last used, as somebody at the desk would say it. */
function lastUsed(k: Kiosk, today: string): string {
  if (k.status === "pairing") return "No tablet paired yet. Press New code, then type it on the tablet.";
  if (!k.lastSeenAt) return "Paired, and nobody has clocked on it yet.";
  const day = kigaliDateOf(k.lastSeenAt);
  return `Last used ${day === today ? "today" : dshortIso(day)} at ${clock(k.lastSeenAt)}.`;
}

export function Kiosks() {
  const { state, toast } = usePms();
  const workspaceId = useWorkspaceId();
  const branches = currentGrant(state)?.branches ?? [];
  const kiosks = useKiosks(workspaceId);
  const create = useCreateKiosk(workspaceId);
  const newCode = useKioskPairingCode(workspaceId);
  const revoke = useRevokeKiosk(workspaceId);
  const [code, setCode] = useState<KioskPairingCode | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", propertyId: "", allowedIps: "" });
  const propertyId = draft.propertyId || branches[0]?.id || "";
  const rows = kiosks.data?.kiosks ?? [];
  const live = rows.filter((k) => k.status !== "revoked");
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "";
  const today = todayIso();

  return (
    <div className="pms-enter @container flex max-w-page flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        A kiosk is a tablet at the staff door. People clock in on it with their employee number and a PIN, with no phone
        and no account. It never shows a list of staff.
      </p>

      {code && <PairingCode code={code} onClose={() => setCode(null)} />}

      <section className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <SectionHeading n={live.length}>Kiosks</SectionHeading>
          {!adding && (
            <span className="ml-auto">
              <ActionButton variant="primary" onClick={() => setAdding(true)}>
                Add a kiosk
              </ActionButton>
            </span>
          )}
        </div>

        {adding && (
          <form
            className="flex flex-col gap-3.5 rounded-card border border-card-bd bg-card p-5"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!draft.name.trim() || !propertyId) return;
              const allowedIps = draft.allowedIps
                .split(/[\s,]+/)
                .map((s) => s.trim())
                .filter(Boolean);
              create.mutate(
                { name: draft.name.trim(), propertyId, allowedIps },
                {
                  onSuccess: (out) => {
                    setCode(out);
                    setDraft({ name: "", propertyId: draft.propertyId, allowedIps: "" });
                    setAdding(false);
                    toast(`${out.kiosk.name} added. Pair its tablet within ten minutes.`, "ok");
                  },
                },
              );
            }}
          >
            <SectionHeading>A new kiosk</SectionHeading>
            <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-3">
              <Field label="Where it stands" htmlFor="kiosk-name" hint="What staff call the spot.">
                <Input id="kiosk-name" placeholder="Staff entrance" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
              </Field>
              {branches.length > 1 && (
                <Field label="Branch">
                  <SelectField label="Branch" value={propertyId} onChange={(v) => setDraft({ ...draft, propertyId: v })} options={branches.map((b) => ({ value: b.id, label: b.name }))} />
                </Field>
              )}
              <Field
                label="Only on this network"
                hint="Optional. The hotel's own internet address, so the tablet works nowhere else. Leave empty if unsure."
                htmlFor="kiosk-ips"
              >
                <Input id="kiosk-ips" placeholder="41.186.1.20" value={draft.allowedIps} onChange={(e) => setDraft({ ...draft, allowedIps: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <FormError error={create.error} />
            <div className="flex gap-2.5">
              <ActionButton variant="primary" type="submit" pending={create.isPending} deniedReason={draft.name.trim() ? undefined : "Say where it stands first."}>
                {create.isPending ? "Adding" : "Add it and show the code"}
              </ActionButton>
              <ActionButton type="button" onClick={() => setAdding(false)}>
                Cancel
              </ActionButton>
            </div>
          </form>
        )}

        {rows.length === 0 && !adding ? (
          <EmptyState className="p-5">
            No kiosk yet. Add one, open the kiosk page on a tablet at the door, and type the code this screen shows.
          </EmptyState>
        ) : (
          rows.map((k) => {
            const status = statusOf(k);
            return (
              <div
                key={k.id}
                data-kiosk={k.id}
                className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-card-bd bg-card px-[18px] py-3.5", k.status === "revoked" && "opacity-70")}
                style={{ borderLeft: `3px solid ${status.edge}` }}
              >
                <span className="flex min-w-48 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{k.name}</span>
                    <Badge intent={status.intent}>{status.label}</Badge>
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    {branchName(k.propertyId) || k.branchName}
                    {k.allowedIps.length > 0 ? ` · only on ${k.allowedIps.join(", ")}` : ""}
                  </span>
                  {k.status !== "revoked" && <span className="pms-num text-2xs text-ink2">{lastUsed(k, today)}</span>}
                </span>
                {k.status !== "revoked" && (
                  <span className="flex flex-wrap gap-2">
                    <ActionButton
                      variant={k.status === "pairing" ? "primary" : "secondary"}
                      pending={newCode.isPending && newCode.variables?.id === k.id}
                      onClick={() => newCode.mutate({ id: k.id }, { onSuccess: (out) => setCode(out) })}
                    >
                      {k.status === "active" ? "Pair a new tablet" : "New code"}
                    </ActionButton>
                    <ConfirmAction
                      confirmLabel="Yes, revoke it now"
                      pending={revoke.isPending && revoke.variables?.id === k.id}
                      onConfirm={() => revoke.mutate({ id: k.id }, { onSuccess: () => toast(`${k.name} revoked; its tablet stops at once`, "ok") })}
                    >
                      Revoke
                    </ConfirmAction>
                  </span>
                )}
              </div>
            );
          })
        )}
        <FormError error={newCode.error ?? revoke.error} />
      </section>

      <Pins kiosks={live} />
    </div>
  );
}

/** The code, once, big enough to read across a counter, how long it has left, and what to do with it. */
function PairingCode({ code, onClose }: { code: KioskPairingCode; onClose: () => void }) {
  const { toast } = usePms();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((Date.parse(code.expiresAt) - now) / 1000));
  const shown = `${code.pairingCode.slice(0, 4)} ${code.pairingCode.slice(4)}`;
  const address = `${WEB_URL}/kiosk`;

  return (
    <section
      aria-label="Pairing code"
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      style={{ borderLeft: `3px solid ${left > 0 ? "var(--chart-2)" : "var(--line2)"}` }}
    >
      <SectionHeading>Pair the tablet for {code.kiosk.name}</SectionHeading>
      <ol className="flex flex-col gap-3 text-sm text-ink2">
        <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Step n={1} />
          <span>
            On the tablet, open <span className="pms-num font-semibold text-ink">{address}</span>
          </span>
          <ActionButton
            onClick={() => {
              void navigator.clipboard?.writeText(address).then(
                () => toast("Address copied.", "ok"),
                () => toast("Could not copy. Type the address on the tablet.", "warn"),
              );
            }}
          >
            Copy the address
          </ActionButton>
          <a href={address} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent-text underline-offset-2 hover:underline">
            Open it on this device
          </a>
        </li>
        <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Step n={2} />
          <span>Type this code there. It works once, and is not shown again.</span>
        </li>
        <li className="pl-9">
          <p className="pms-num text-4xl font-bold tracking-widest text-foreground" data-pairing-code>
            {left > 0 ? shown : "Expired"}
          </p>
          <p className={cn("pms-num text-2xs", left > 0 && left <= 60 ? "font-semibold text-warn" : "text-muted-foreground")}>
            {left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} left` : "Ask for a new code on the kiosk's card."}
          </p>
        </li>
        <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Step n={3} />
          <span>The tablet shows the branch name. People clock in with their employee number and PIN.</span>
        </li>
      </ol>
      <span>
        <ActionButton onClick={onClose}>Done</ActionButton>
      </span>
    </section>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span aria-hidden className="pms-num grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-2xs font-bold text-accent-text">
      {n}
    </span>
  );
}

/** Four digits nobody chose: what the office reads to somebody who has no PIN in mind. */
function randomPin(): string {
  const digits = new Uint32Array(1);
  crypto.getRandomValues(digits);
  return String(digits[0] % 10_000).padStart(4, "0");
}

function Pins({ kiosks }: { kiosks: Kiosk[] }) {
  const people = usePinPeople();
  const [q, setQ] = useState("");
  const [kioskId, setKioskId] = useState("");
  const [known, setKnown] = useState<Record<string, boolean>>({});
  const needle = q.trim().toLowerCase();
  const matching = needle ? people.filter((p) => p.label.toLowerCase().includes(needle) || (p.detail ?? "").toLowerCase().includes(needle)) : people;
  const shown = matching.slice(0, PIN_ROWS);
  const unlockOn = kioskId || kiosks[0]?.id || "";
  // Counted from the rows that have answered, so the figures never claim more than was read.
  const answered = shown.filter((p) => p.id in known);
  const withPin = answered.filter((p) => known[p.id]).length;

  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeading n={people.length}>Who can use a kiosk</SectionHeading>
      {people.length === 0 ? (
        <EmptyState className="p-5">Nobody to give a PIN to yet. People appear here once they are on file or on the roster.</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
            <Figure icon={KeyRound} n={answered.length === shown.length ? String(withPin) : "…"} label="Have a PIN" tone="ok" />
            <Figure
              icon={UserX}
              n={answered.length === shown.length ? String(shown.length - withPin) : "…"}
              label="No PIN yet"
              tone={answered.length === shown.length && shown.length - withPin > 0 ? "warn" : "neutral"}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Input aria-label="Search people" placeholder="Search a name or a number" value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} />
            </div>
            {kiosks.length > 1 && (
              <div className="w-60">
                <Field label="Unlock on">
                  <SelectField label="Kiosk to unlock on" value={unlockOn} onChange={setKioskId} options={kiosks.map((k) => ({ value: k.id, label: k.name }))} />
                </Field>
              </div>
            )}
          </div>
          {shown.length === 0 ? (
            <EmptyState className="p-5">Nobody matches that.</EmptyState>
          ) : (
            <RowList>
              {shown.map((person, index) => (
                <PinRow
                  key={person.id}
                  person={person}
                  index={index}
                  unlockOn={unlockOn}
                  onKnown={(hasPin) => setKnown((k) => (k[person.id] === hasPin ? k : { ...k, [person.id]: hasPin }))}
                />
              ))}
            </RowList>
          )}
          {matching.length > shown.length && (
            <p className="text-2xs text-muted-foreground">
              Showing {shown.length} of {matching.length}. Search a name to find the others.
            </p>
          )}
          <p className="text-2xs text-muted-foreground">
            A PIN is 4 to 6 digits and is never shown again once saved, so tell the person as you set it. They can change it
            themselves under My work. Five wrong tries lock them on that kiosk for fifteen minutes; Unlock lifts it sooner.
          </p>
        </>
      )}
    </section>
  );
}

/** One person: whether they have a PIN, since when, and the way to set, reset or unlock it. */
function PinRow({
  person,
  index,
  unlockOn,
  onKnown,
}: {
  person: PersonOption;
  index: number;
  unlockOn: string;
  onKnown: (hasPin: boolean) => void;
}) {
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const state = usePinState(workspaceId, person.id);
  const setPin = useSetPin(workspaceId);
  const unlock = useUnlockPin(workspaceId);
  const [editing, setEditing] = useState(false);
  const [pin, setPinValue] = useState("");
  // A suggested PIN is read out, so it is shown; a typed one stays hidden.
  const [suggested, setSuggested] = useState(false);
  const hasPin = state.data?.hasPin;
  const validPin = /^\d{4,6}$/.test(pin);

  useEffect(() => {
    if (hasPin !== undefined) onKnown(hasPin);
    // Only when the answer changes: `onKnown` is a fresh function each render.
  }, [hasPin]);

  const close = () => {
    setEditing(false);
    setPinValue("");
    setSuggested(false);
    setPin.reset();
  };

  return (
    <div className={cn(rowClass(index), "flex flex-col gap-2.5")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Avatar name={person.label} size={36} />
        <span className="flex min-w-44 flex-1 flex-col">
          <span className="text-sm font-semibold text-ink">{person.label}</span>
          {person.detail && <span className="pms-num text-2xs text-muted-foreground">{person.detail}</span>}
        </span>
        {state.isPending ? (
          <span className="text-2xs text-muted-foreground">Checking</span>
        ) : state.isError ? (
          <Badge intent="neutral">Could not check</Badge>
        ) : hasPin ? (
          <Badge intent="ok">PIN set{state.data?.setAt ? ` ${dshortIso(kigaliDateOf(state.data.setAt))}` : ""}</Badge>
        ) : (
          <Badge intent="warn">No PIN yet</Badge>
        )}
        {!editing && (
          <span className="flex flex-wrap gap-2">
            <ActionButton variant={hasPin === false ? "primary" : "secondary"} onClick={() => setEditing(true)}>
              {hasPin ? "Reset the PIN" : "Set a PIN"}
            </ActionButton>
            {hasPin && unlockOn && (
              <ActionButton
                pending={unlock.isPending}
                onClick={() =>
                  unlock.mutate({ kioskId: unlockOn, employeeId: person.id }, { onSuccess: () => toast(`${person.label} can try their PIN again.`, "ok"), onError: toastError })
                }
              >
                Unlock
              </ActionButton>
            )}
          </span>
        )}
      </div>
      {editing && (
        <div className="flex flex-wrap items-end gap-2.5 pl-12">
          <div className="w-44">
            <Field label={hasPin ? "New PIN" : "PIN"} htmlFor={`pin-${person.id}`}>
              <Input
                id={`pin-${person.id}`}
                type={suggested ? "text" : "password"}
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPinValue(e.target.value.replace(/\D/g, ""));
                  setSuggested(false);
                }}
                className={cn(inputClass, "pms-num tracking-widest")}
              />
            </Field>
          </div>
          <ActionButton
            onClick={() => {
              setPinValue(randomPin());
              setSuggested(true);
            }}
          >
            Suggest one
          </ActionButton>
          <ActionButton
            variant="primary"
            pending={setPin.isPending}
            deniedReason={validPin ? undefined : "A PIN is 4 to 6 digits."}
            onClick={() =>
              setPin.mutate(
                { employeeId: person.id, pin },
                {
                  onSuccess: () => {
                    toast(`PIN ${hasPin ? "reset" : "set"} for ${person.label}. Tell them now: it is not shown again.`, "ok");
                    close();
                  },
                },
              )
            }
          >
            Save the PIN
          </ActionButton>
          <ActionButton onClick={close}>Cancel</ActionButton>
          <div className="w-full">
            <FormError error={setPin.error} />
          </div>
        </div>
      )}
    </div>
  );
}
