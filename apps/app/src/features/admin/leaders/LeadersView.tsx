"use client";

import { Description, FieldError, Label, TextArea, TextField, toast } from "@heroui/react";
import {
  type GovernmentBody,
  type OversightAppointment,
  type OversightAppointmentList,
  tidyPlaceName,
  type WaitingArea,
} from "@injishi/contracts";
import {
  ActionButton,
  DataTable,
  EmptyBlock,
  FormDialog,
  formatDay,
  formatNumber,
  IconAction,
  PageContent,
  PersonCell,
  type PlaceChain,
  PlacePicker,
  placeLine,
} from "@injishi/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { loadGuestPlaces } from "../../guests/places";
import { AppointPanel, type AppointPrefill, ROLE_CHOICES } from "./AppointPanel";
import { endAppointment } from "./actions";

const KIND_TABS = [
  { id: "all", label: "All" },
  { id: "leader", label: "Local leaders" },
  { id: "reviewer", label: "Business reviewers" },
  { id: "officer", label: "Other officers" },
] as const;

/** A waiting area's (or a coverage gap's) place as the place picker holds it. */
export function chainOf(
  w: Pick<WaitingArea, "provinceId" | "districtId" | "sectorId" | "cellId" | "villageId" | "names">,
): PlaceChain {
  const chain: PlaceChain = {};
  if (w.provinceId && w.names.province) chain.province = { id: w.provinceId, name: tidyPlaceName(w.names.province) };
  if (chain.province && w.districtId && w.names.district)
    chain.district = { id: w.districtId, name: tidyPlaceName(w.names.district) };
  if (chain.district && w.sectorId && w.names.sector)
    chain.sector = { id: w.sectorId, name: tidyPlaceName(w.names.sector) };
  if (chain.sector && w.cellId && w.names.cell) chain.cell = { id: w.cellId, name: tidyPlaceName(w.names.cell) };
  if (chain.cell && w.villageId && w.names.village)
    chain.village = { id: w.villageId, name: tidyPlaceName(w.names.village) };
  return chain;
}

/** End an appointment, with the reason the audit log keeps. */
function EndDialog({ appointment, onClose }: { appointment: OversightAppointment; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`End ${appointment.name ?? appointment.email}'s appointment?`}
      description={`${appointment.roleLabel}, ${appointment.area}`}
      submitLabel="End appointment"
      submitIcon="PersonXmark"
      isPending={pending}
      validationErrors={error ? { reason: error } : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await endAppointment(appointment.id, reason);
          if (!result.ok) {
            setError(result.fieldErrors?.reason ?? result.error);
            return;
          }
          toast.success("Appointment ended");
          onClose();
          router.refresh();
        });
      }}
    >
      <TextField
        name="reason"
        value={reason}
        onChange={setReason}
        isInvalid={error ? true : undefined}
        fullWidth
        className="gap-1"
      >
        <Label>Why</Label>
        <TextArea rows={3} placeholder="Moved to another district" />
        <Description>Kept in the audit log.</Description>
        <FieldError>{error}</FieldError>
      </TextField>
    </FormDialog>
  );
}

/** Narrow the list to an area: picked down the cascade, applied on Apply. */
function AreaFilterDialog({
  value,
  onApply,
  onClose,
}: {
  value: PlaceChain;
  onApply: (chain: PlaceChain) => void;
  onClose: () => void;
}) {
  const [chain, setChain] = useState<PlaceChain>(value);
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Show one area"
      submitLabel="Apply"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(chain);
      }}
    >
      <PlacePicker label="Area" value={chain} onChange={setChain} loadPlaces={loadGuestPlaces} reserveSpace={false} />
    </FormDialog>
  );
}

/**
 * Local leaders and officers (P5): every oversight appointment (the local leaders guests are reported
 * to, the business reviewers, other officers) with their area and, for a leader, how many guests reached
 * them and how many they opened; filters by kind, role and area; appointing (by email, role, body, title
 * and area) and ending (with a reason); and the areas where guests wait for a leader, each with an
 * Appoint shortcut.
 */
export function LeadersView({
  list,
  bodies,
  canAppoint,
  areaChain,
  initialAppoint,
}: {
  list: OversightAppointmentList;
  bodies: GovernmentBody[];
  canAppoint: boolean;
  /** The area filter in the address, as a chain. */
  areaChain: PlaceChain;
  /** `?appoint=` from the coverage page: open the form with this role and area. */
  initialAppoint: AppointPrefill | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [appoint, setAppoint] = useState<AppointPrefill | null | false>(initialAppoint ?? false);
  const [ending, setEnding] = useState<OversightAppointment | null>(null);
  const [areaOpen, setAreaOpen] = useState(false);

  const go = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("appoint");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const kind = params.get("kind") ?? "all";
  const role = params.get("role");
  const areaWords = placeLine(areaChain);
  const total = list.counts.leader + list.counts.reviewer + list.counts.officer;

  return (
    <PageContent>
      <AreaHeader
        actions={
          canAppoint ? (
            <ActionButton icon="PersonPlus" intent="primary" onPress={() => setAppoint(null)}>
              Appoint
            </ActionButton>
          ) : null
        }
      />

      <div className="flex min-w-0 flex-col gap-5">
        <DataTable<OversightAppointment>
          label="Appointments"
          rows={list.appointments}
          rowKey={(a) => a.id}
          noun={{ one: "appointment", many: "appointments" }}
          search={{ placeholder: "Name, email or area", text: (a) => `${a.name ?? ""} ${a.email} ${a.area}` }}
          filters={[
            {
              id: "kind",
              name: "Show",
              options: KIND_TABS.map((t) => ({
                id: t.id,
                label: t.label,
                count: t.id === "all" ? total : list.counts[t.id],
              })),
              value: kind,
              onChange: (k) => go({ kind: k === "all" ? null : k, role: null }),
            },
            {
              id: "role",
              name: "Role",
              options: [{ id: "all", label: "All" }, ...ROLE_CHOICES.map((r) => ({ id: r.id, label: r.label }))],
              value: role ?? "all",
              onChange: (v) => go({ role: v === "all" ? null : v }),
            },
            {
              id: "opened",
              name: "Opened",
              icon: "Eye",
              options: [
                { id: "all", label: "All" },
                { id: "never", label: "Never opened a guest" },
              ],
              match: (a) => a.kind === "leader" && a.delivered > 0 && a.seen === 0,
            },
          ]}
          onClearFilters={() =>
            go({
              kind: null,
              role: null,
              provinceId: null,
              districtId: null,
              sectorId: null,
              cellId: null,
              villageId: null,
            })
          }
          toolbarEnd={
            <>
              <ActionButton
                icon="MapPin"
                size="sm"
                intent="ghost"
                onPress={() => setAreaOpen(true)}
                className="max-w-56"
              >
                <span className="truncate">{areaWords || "Everywhere"}</span>
              </ActionButton>
              {areaWords ? (
                <IconAction
                  icon="Xmark"
                  label="Show every area"
                  onPress={() =>
                    go({ provinceId: null, districtId: null, sectorId: null, cellId: null, villageId: null })
                  }
                />
              ) : null}
            </>
          }
          empty={
            <EmptyBlock
              icon="Persons"
              title="Nobody appointed yet"
              action={
                canAppoint ? (
                  <ActionButton icon="PersonPlus" onPress={() => setAppoint(null)}>
                    Appoint
                  </ActionButton>
                ) : undefined
              }
            />
          }
          columns={[
            {
              id: "person",
              header: "Person",
              isRowHeader: true,
              sortValue: (a) => a.name ?? a.email,
              cell: (a) => <PersonCell name={a.name ?? a.email} secondary={a.name ? a.email : "No name yet"} />,
            },
            {
              id: "role",
              header: "Role",
              sortValue: (a) => a.roleLabel,
              cell: (a) => (
                <div className="flex min-w-0 flex-col text-sm">
                  <span className="truncate">{a.roleLabel}</span>
                  <span className="truncate text-xs text-muted">{a.title ?? a.bodyName ?? a.bodyCode}</span>
                </div>
              ),
            },
            {
              id: "area",
              header: "Area",
              sortValue: (a) => a.area,
              cell: (a) => <span className="text-sm whitespace-normal">{a.area}</span>,
            },
            {
              id: "guests",
              header: "Guests",
              align: "end",
              hideBelow: "lg",
              sortValue: (a) => a.delivered,
              cell: (a) =>
                a.kind === "leader" ? (
                  <span className="text-sm whitespace-nowrap tabular">
                    {formatNumber(a.seen)} of {formatNumber(a.delivered)} opened
                  </span>
                ) : (
                  <span className="text-xs whitespace-nowrap text-muted">Not a leader</span>
                ),
            },
            {
              id: "since",
              header: "Since",
              hideBelow: "xl",
              sortValue: (a) => a.grantedAt,
              cell: (a) => <span className="text-sm whitespace-nowrap">{formatDay(a.grantedAt)}</span>,
            },
          ]}
          rowActions={
            canAppoint
              ? (a) => (
                  <IconAction
                    icon="PersonXmark"
                    label={`End ${a.name ?? a.email}'s appointment`}
                    onPress={() => setEnding(a)}
                  />
                )
              : undefined
          }
          mobile={{
            title: (a) => a.name ?? a.email,
            description: (a) => `${a.roleLabel} · ${a.area}`,
          }}
        />
      </div>

      {appoint !== false ? <AppointPanel bodies={bodies} prefill={appoint} onClose={() => setAppoint(false)} /> : null}
      {ending ? <EndDialog appointment={ending} onClose={() => setEnding(null)} /> : null}
      {areaOpen ? (
        <AreaFilterDialog
          value={areaChain}
          onClose={() => setAreaOpen(false)}
          onApply={(chain) => {
            setAreaOpen(false);
            go({
              provinceId: chain.province ? String(chain.province.id) : null,
              districtId: chain.district ? String(chain.district.id) : null,
              sectorId: chain.sector ? String(chain.sector.id) : null,
              cellId: chain.cell ? String(chain.cell.id) : null,
              villageId: chain.village ? String(chain.village.id) : null,
            });
          }}
        />
      ) : null}
    </PageContent>
  );
}
