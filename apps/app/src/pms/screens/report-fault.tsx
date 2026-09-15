"use client";

/**
 * Report a fault — the one way onto the maintenance board from this app.
 *
 * The board could move a ticket but never open one, so a fault a tenant phoned
 * in, or one the caretaker saw on a walk round, had nowhere to be written down.
 * `POST /ops/tickets` was already there (ADR-016 slice 6).
 *
 * A residence names the TENANCY the fault is in, a hotel names the ROOM, which
 * is the same rule the contract enforces: a work order nobody can locate is
 * refused. Only live tenancies are offered, because a fault in a flat nobody
 * lives in belongs to the unit's setup, not to a tenant's record.
 */

import type { MaintenanceCategory, MaintenancePriority } from "@injishi/contracts";
import { Input } from "@injishi/ui";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { ActionButton, SelectField, surfaceClass } from "../components/ui";
import { useWorkspaceId } from "../data/capability";
import { useLeases, useRaiseTicket, useRooms } from "../data/ops";
import { usePms } from "../store";

const CATEGORIES: { value: MaintenanceCategory; label: string }[] = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "appliance", label: "Appliance" },
  { value: "furniture", label: "Furniture" },
  { value: "hvac", label: "Heating or cooling" },
  { value: "safety", label: "Safety" },
  { value: "it_tech", label: "Internet or TV" },
  { value: "other", label: "Something else" },
];

const PRIORITIES: { value: MaintenancePriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function ReportFault({ landlord, onDone }: { landlord: boolean; onDone: () => void }) {
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  // Only the list this surface names a subject from is read.
  const leases = useLeases(landlord ? workspaceId : null);
  const rooms = useRooms(landlord ? null : workspaceId);
  const raise = useRaiseTicket(workspaceId);

  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [priority, setPriority] = useState<MaintenancePriority>("normal");

  const subjects = landlord
    ? (leases.data?.leases ?? [])
        .filter((l) => l.status === "active" || l.status === "ending")
        .map((l) => ({ value: l.id, label: `${l.unitLabel ?? "Unit"} · ${l.tenantName ?? "Tenant"}` }))
    : (rooms.data?.rooms ?? []).map((r) => ({ value: r.id, label: `${r.label ?? "Room"} · ${r.roomTypeName}` }));

  const ready = subject !== "" && title.trim().length > 0;

  function submit() {
    if (!ready || raise.isPending) return;
    raise.mutate(
      {
        ...(landlord ? { leaseId: subject } : { roomId: subject }),
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(category ? { category: category as MaintenanceCategory } : {}),
        priority,
      },
      {
        onSuccess: (ticket) => {
          toast(`${ticket.title} is on the board${ticket.unitLabel ? ` for ${ticket.unitLabel}` : ""}.`, "ok");
          onDone();
        },
        onError: toastError,
      },
    );
  }

  return (
    <section className={cn(surfaceClass, "mb-3.5 flex flex-col gap-3 px-4 py-3.5")} aria-label="Report a fault">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">{landlord ? "Tenancy" : "Room"}</span>
          <SelectField
            value={subject}
            onChange={setSubject}
            options={subjects}
            placeholder={landlord ? "Which unit is it in?" : "Which room is it in?"}
            label={landlord ? "Tenancy" : "Room"}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">What is wrong</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Water heater not working"
            maxLength={200}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold text-ink">Details</span>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional. When it started, what has been tried."
          maxLength={2000}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">Kind of fault</span>
          <SelectField value={category} onChange={setCategory} options={CATEGORIES} placeholder="Optional" label="Kind of fault" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">Priority</span>
          <SelectField
            value={priority}
            onChange={(v) => setPriority((v || "normal") as MaintenancePriority)}
            options={PRIORITIES}
            label="Priority"
          />
        </label>
      </div>
      {subjects.length === 0 && !(landlord ? leases.isPending : rooms.isPending) && (
        <p className="text-xs text-muted-foreground">
          {landlord ? "No live tenancy to report against yet." : "No rooms to report against yet."}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <ActionButton onClick={onDone}>Cancel</ActionButton>
        <ActionButton variant="primary" onClick={submit} disabled={!ready} pending={raise.isPending}>
          {raise.isPending ? "Reporting" : "Report fault"}
        </ActionButton>
      </div>
    </section>
  );
}
