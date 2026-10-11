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
 */

import { ListQuery, type Kiosk, type KioskPairingCode } from "@injishi/contracts";
import { Input } from "@injishi/ui";
import { useEffect, useState } from "react";

import { ConfirmAction } from "../../components/confirm-action";
import { ActionButton, Badge, EmptyState, SectionHeading, SelectField } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useEmployees, useRosterPage } from "../../data/people";
import { useCreateKiosk, useKioskPairingCode, useKiosks, usePinState, useRevokeKiosk, useSetPin, useUnlockPin } from "../../data/time";
import { addDaysIso, dshortIso, kigaliDateOf, todayIso } from "../../lib/format";
import { WEB_URL } from "../../lib/sign-in-url";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Field, FormError, RowList, clock, inputClass, rowClass, type PersonOption } from "./staff-ui";

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
    return (employees.data ?? []).map((e) => ({ id: e.id, label: e.displayName, detail: e.employeeNumber }));
  }
  const seen = new Map<string, PersonOption>();
  for (const entry of roster.data?.items ?? []) {
    seen.set(entry.employee.employeeId, { id: entry.employee.employeeId, label: entry.employee.displayName, detail: entry.employee.jobPositionTitle });
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function statusOf(k: Kiosk): { label: string; intent: "ok" | "warn" | "neutral" } {
  if (k.status === "revoked") return { label: "Revoked", intent: "neutral" };
  if (k.status === "pairing") return { label: "Waiting for its tablet", intent: "warn" };
  return { label: "Active", intent: "ok" };
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
  const [draft, setDraft] = useState({ name: "", propertyId: "", allowedIps: "" });
  const propertyId = draft.propertyId || branches[0]?.id || "";
  const rows = kiosks.data?.kiosks ?? [];
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "";

  return (
    <div className="pms-enter flex max-w-page flex-col gap-5">
      {code && <PairingCode code={code} onClose={() => setCode(null)} />}

      <section className="flex flex-col gap-2">
        <SectionHeading n={rows.filter((k) => k.status !== "revoked").length}>Kiosks</SectionHeading>
        <form
          className="flex flex-wrap items-end gap-3 rounded-card border border-card-bd bg-card p-4"
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
                  toast(`${out.kiosk.name} added. Pair its tablet within ten minutes.`, "ok");
                },
              },
            );
          }}
        >
          <div className="min-w-0 flex-1">
            <Field label="Name" htmlFor="kiosk-name">
              <Input id="kiosk-name" placeholder="Kitchen door" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
            </Field>
          </div>
          {branches.length > 1 && (
            <div className="w-56">
              <Field label="Branch">
                <SelectField label="Branch" value={propertyId} onChange={(v) => setDraft({ ...draft, propertyId: v })} options={branches.map((b) => ({ value: b.id, label: b.name }))} />
              </Field>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <Field label="Only from these addresses" hint="Optional. Empty: any address." htmlFor="kiosk-ips">
              <Input id="kiosk-ips" placeholder="41.186.1.20" value={draft.allowedIps} onChange={(e) => setDraft({ ...draft, allowedIps: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <ActionButton variant="primary" type="submit" pending={create.isPending} deniedReason={draft.name.trim() ? undefined : "Name the kiosk"}>
            {create.isPending ? "Adding" : "Add a kiosk"}
          </ActionButton>
          <div className="w-full">
            <FormError error={create.error} />
          </div>
        </form>
        {rows.length === 0 ? (
          <EmptyState className="p-5">No kiosks yet. A kiosk is a tablet at the door where people clock in with a PIN.</EmptyState>
        ) : (
          <RowList>
            {rows.map((k, i) => {
              const status = statusOf(k);
              return (
                <div key={k.id} className={`${rowClass(i)} flex flex-wrap items-center gap-3`} data-kiosk={k.id}>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold text-ink">{k.name}</span>
                    <span className="text-2xs text-muted-foreground">
                      {branchName(k.propertyId) || k.branchName}
                      {k.allowedIps.length > 0 ? ` · only from ${k.allowedIps.join(", ")}` : ""}
                      {k.lastSeenAt ? ` · last used ${dshortIso(kigaliDateOf(k.lastSeenAt))} ${clock(k.lastSeenAt)}` : ""}
                    </span>
                  </span>
                  <Badge intent={status.intent}>{status.label}</Badge>
                  {k.status !== "revoked" && (
                    <span className="flex gap-2">
                      <ActionButton
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
            })}
          </RowList>
        )}
        <FormError error={newCode.error ?? revoke.error} />
      </section>

      <Pins kiosks={rows.filter((k) => k.status !== "revoked")} />
    </div>
  );
}

/** The code, once, big enough to read across a counter, and how long it has left. */
function PairingCode({ code, onClose }: { code: KioskPairingCode; onClose: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((Date.parse(code.expiresAt) - now) / 1000));
  const shown = `${code.pairingCode.slice(0, 4)} ${code.pairingCode.slice(4)}`;
  return (
    <section aria-label="Pairing code" className="flex flex-col gap-2 rounded-card border border-card-bd bg-card p-5">
      <SectionHeading>Pair {code.kiosk.name}</SectionHeading>
      <p className="text-sm text-ink2">
        On the tablet, open <span className="font-semibold text-ink">{WEB_URL}/kiosk</span> and type this code. It works once,
        and is not shown again.
      </p>
      <p className="pms-num text-4xl font-bold tracking-widest text-foreground" data-pairing-code>
        {left > 0 ? shown : "Expired"}
      </p>
      <p className="pms-num text-2xs text-muted-foreground">
        {left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} left` : "Ask for a new code from the kiosk's row."}
      </p>
      <span>
        <ActionButton onClick={onClose}>Done</ActionButton>
      </span>
    </section>
  );
}

function Pins({ kiosks }: { kiosks: Kiosk[] }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const people = usePinPeople();
  const setPin = useSetPin(workspaceId);
  const unlock = useUnlockPin(workspaceId);
  const [who, setWho] = useState("");
  const [pin, setPinValue] = useState("");
  const [kioskId, setKioskId] = useState("");
  const state = usePinState(workspaceId, who || null);
  const person = people.find((p) => p.id === who);
  const validPin = /^\d{4,6}$/.test(pin);

  return (
    <section className="flex flex-col gap-2">
      <SectionHeading>PINs</SectionHeading>
      <div className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Person" hint={who ? (state.data?.hasPin ? `Has a PIN since ${state.data.setAt ? dshortIso(kigaliDateOf(state.data.setAt)) : "before"}.` : "Has no PIN yet.") : undefined}>
            <SelectField
              label="Person"
              value={who}
              onChange={(v) => {
                setWho(v);
                setPinValue("");
              }}
              placeholder={people.length ? "Choose someone" : "Nobody on the roster these two weeks"}
              options={people.map((p) => ({ value: p.id, label: p.detail ? `${p.label} · ${p.detail}` : p.label }))}
            />
          </Field>
          <Field label={state.data?.hasPin ? "New PIN" : "PIN"} hint="4 to 6 digits. Tell them; it is not shown again." htmlFor="pin-value">
            <Input
              id="pin-value"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <ActionButton
            variant="primary"
            pending={setPin.isPending}
            deniedReason={!who ? "Choose someone" : !validPin ? "A PIN is 4 to 6 digits" : undefined}
            onClick={() =>
              setPin.mutate(
                { employeeId: who, pin },
                {
                  onSuccess: () => {
                    toast(`PIN ${state.data?.hasPin ? "reset" : "set"} for ${person?.label ?? "them"}. It is not shown again.`, "ok");
                    setPinValue("");
                  },
                },
              )
            }
          >
            {state.data?.hasPin ? "Reset the PIN" : "Set the PIN"}
          </ActionButton>
          {kiosks.length > 0 && (
            <>
              <span className="flex-1" />
              <div className="w-56">
                <SelectField
                  label="Kiosk to unlock on"
                  value={kioskId || kiosks[0]?.id || ""}
                  onChange={setKioskId}
                  options={kiosks.map((k) => ({ value: k.id, label: k.name }))}
                />
              </div>
              <ActionButton
                pending={unlock.isPending}
                deniedReason={!who ? "Choose someone" : undefined}
                onClick={() =>
                  unlock.mutate(
                    { kioskId: kioskId || kiosks[0]?.id || "", employeeId: who },
                    { onSuccess: () => toast(`${person?.label ?? "They"} can try their PIN again`, "ok") },
                  )
                }
              >
                Lift a wrong PIN lock
              </ActionButton>
            </>
          )}
        </div>
        <FormError error={setPin.error ?? unlock.error} />
      </div>
    </section>
  );
}
