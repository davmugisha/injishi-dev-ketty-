"use client";

import { Card, Chip, Description, FieldError, Label, TextArea, TextField, toast } from "@heroui/react";
import { ListView } from "@heroui-pro/react";
import {
  type GovernmentBody,
  type OversightAppointment,
  type OversightAppointmentList,
  type OversightRole,
  tidyPlaceName,
  type WaitingArea,
} from "@injishi/contracts";
import {
  ActionButton,
  ActionLink,
  DataTable,
  EmptyBlock,
  FilterTabs,
  FormDialog,
  formatDay,
  formatNumber,
  IconAction,
  PageContent,
  PageHeader,
  PersonCell,
  type PlaceChain,
  PlacePicker,
  placeLine,
  SectionCard,
  SelectField,
} from "@injishi/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
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
      description={`${appointment.roleLabel}, ${appointment.area}. Guests staying now go to whoever else holds the post, or wait for a new leader.`}
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
      description="Appointments inside the place you pick: a district shows its sectors, cells and villages too."
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

function WaitingList({
  waiting,
  total,
  onAppoint,
}: {
  waiting: WaitingArea[];
  total: number;
  onAppoint?: (w: WaitingArea) => void;
}) {
  return (
    <SectionCard
      title="Guests waiting for a leader"
      description={
        total === 0
          ? "Every guest reached a leader."
          : `${formatNumber(total)} ${total === 1 ? "guest is" : "guests are"} registered where nobody holds the post.`
      }
      contentClassName="gap-0"
    >
      {waiting.length === 0 ? (
        <EmptyBlock
          size="sm"
          icon="CircleCheck"
          title="Nobody is waiting"
          description="Guests in areas with no leader show here."
        />
      ) : (
        <ListView
          aria-label="Areas waiting for a leader"
          variant="secondary"
          items={waiting.map((w, i) => ({ ...w, key: `${w.role}-${i}` }))}
        >
          {(w) => (
            <ListView.Item id={w.key} textValue={`${w.roleLabel} ${w.area}`} className="items-center">
              <ListView.ItemContent className="items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <ListView.Title className="whitespace-normal">{w.area}</ListView.Title>
                  <ListView.Description className="whitespace-normal">
                    {w.roleLabel} · {w.reports === 1 ? "1 guest" : `${formatNumber(w.reports)} guests`} · since{" "}
                    {formatDay(w.oldestArrival)}
                  </ListView.Description>
                </span>
              </ListView.ItemContent>
              {onAppoint && w.located ? (
                <ListView.ItemAction>
                  <ActionButton size="sm" icon="PersonPlus" onPress={() => onAppoint(w)}>
                    Appoint
                  </ActionButton>
                </ListView.ItemAction>
              ) : w.located ? null : (
                <ListView.ItemAction>
                  <Chip size="sm" variant="soft" color="warning">
                    Building has no village
                  </Chip>
                </ListView.ItemAction>
              )}
            </ListView.Item>
          )}
        </ListView>
      )}
    </SectionCard>
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
  const filtered = Boolean(role || areaWords || params.get("q"));

  return (
    <PageContent>
      <PageHeader
        title="Local leaders and officers"
        description="Who guests are reported to, and who reviews businesses."
        actions={
          <>
            <ActionLink href="/admin/leaders/coverage" icon="MapPin">
              Coverage
            </ActionLink>
            {canAppoint ? (
              <ActionButton icon="PersonPlus" intent="primary" onPress={() => setAppoint(null)}>
                Appoint
              </ActionButton>
            ) : null}
          </>
        }
      />

      <FilterTabs
        label="Appointments"
        selectedKey={kind}
        onSelectionChange={(k) => go({ kind: k === "all" ? null : k, role: null })}
        tabs={KIND_TABS.map((t) => ({
          id: t.id,
          label: t.label,
          count: t.id === "all" ? total : list.counts[t.id],
        }))}
      />

      <div className="grid min-w-0 items-start gap-4 2xl:grid-cols-3">
        <Card className="min-w-0 gap-4 p-4 2xl:col-span-2">
          <div className="flex flex-wrap items-end gap-3">
            <SelectField
              label="Role"
              className="w-full sm:w-64"
              value={role}
              placeholder="Every role"
              options={[{ id: "", label: "Every role" }, ...ROLE_CHOICES.map((r) => ({ id: r.id, label: r.label }))]}
              onChange={(v) => go({ role: v || null })}
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Area</span>
              <div className="flex flex-wrap items-center gap-2">
                <ActionButton icon="MapPin" onPress={() => setAreaOpen(true)}>
                  {areaWords || "Everywhere"}
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
              </div>
            </div>
          </div>
          <DataTable<OversightAppointment>
            label="Appointments"
            rows={list.appointments}
            rowKey={(a) => a.id}
            empty={
              <EmptyBlock
                icon="Persons"
                title={filtered ? "Nobody matches" : "Nobody appointed yet"}
                description={
                  filtered
                    ? "Try every role or every area."
                    : "Appoint village leaders, DASSOs, cell executive secretaries and district officers so guests reach them."
                }
                action={
                  filtered ? (
                    <ActionButton
                      icon="Xmark"
                      onPress={() =>
                        go({
                          role: null,
                          provinceId: null,
                          districtId: null,
                          sectorId: null,
                          cellId: null,
                          villageId: null,
                          q: null,
                        })
                      }
                    >
                      Clear filters
                    </ActionButton>
                  ) : canAppoint ? (
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
        </Card>
        <WaitingList
          waiting={list.waiting}
          total={list.waitingReports}
          onAppoint={canAppoint ? (w) => setAppoint({ role: w.role as OversightRole, chain: chainOf(w) }) : undefined}
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
