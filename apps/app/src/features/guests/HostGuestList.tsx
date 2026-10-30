"use client";

import { toast } from "@heroui/react";
import {
  type GuestBuilding,
  type GuestRelationship,
  type HostChainStep,
  type HostGuest,
  type HostGuestList as HostGuestListData,
  type HostGuestTab,
  type LandlordGuestRequest,
  LEADER_ROLE_SHORT,
  type TenantGuestRequest,
} from "@injishi/contracts";
import {
  ActionButton,
  ConfirmDialog,
  type DataColumn,
  DataTable,
  EmptyBlock,
  IconAction,
  PersonCell,
  RowActions,
  StatusChip,
  StatusDot,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/rentals/action-kit";
import { phoneWords, ROUTE_STATE, stayWords } from "../oversight/guests/parts";
import { GuestFormPanel } from "./GuestForm";

const TABS: { id: HostGuestTab | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "arriving", label: "Arriving" },
  { id: "staying", label: "Staying" },
  { id: "left", label: "Left" },
  { id: "cancelled", label: "Cancelled" },
];

/** Who a registration was shared with: one chip per step of the chain, in the tone of where it stands. */
export function ChainChips({ chain }: { chain: HostChainStep[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {chain.map((c) => {
        const state = ROUTE_STATE[c.state];
        return (
          <span key={c.role} title={`${c.roleLabel}: ${state.words}`}>
            <StatusChip tone={state.tone}>
              {LEADER_ROLE_SHORT[c.role]}
              <span className="sr-only">: {state.words}</span>
            </StatusChip>
          </span>
        );
      })}
    </span>
  );
}

export interface GuestCalls {
  register: (request: TenantGuestRequest | LandlordGuestRequest) => Promise<ActionResult<HostGuest>>;
  update: (id: string, request: TenantGuestRequest | LandlordGuestRequest) => Promise<ActionResult<HostGuest>>;
  cancel: (id: string) => Promise<ActionResult<HostGuest>>;
}

/**
 * A host's overnight guests (P5), the same for a tenant and for a landlord: one table with a stay filter
 * (all by default) and a search (a list on a phone) with who they are, the stay, who they are to the
 * host, where they come from and which leaders it went to, and Change or Cancel until arrival day has
 * passed. Registering opens the guest form in a side panel.
 */
export function HostGuestList({
  list,
  relationships,
  today,
  window,
  buildings,
  calls,
  canRegister,
  registerReason,
  registering,
  onRegistering,
}: {
  list: HostGuestListData;
  relationships: readonly GuestRelationship[];
  today: string;
  window?: { start?: string | null; end?: string | null };
  /** A landlord's buildings (the form asks which one). */
  buildings?: readonly GuestBuilding[];
  calls: GuestCalls;
  canRegister: boolean;
  /** Why registering is closed, when it is. */
  registerReason?: string | null;
  /** The register panel is open (the page's header button opens it). */
  registering: boolean;
  onRegistering: (open: boolean) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<HostGuest | null>(null);
  const [cancelling, setCancelling] = useState<HostGuest | null>(null);
  const [pending, start] = useTransition();

  const columns: DataColumn<HostGuest>[] = [
    {
      id: "guest",
      header: "Guest",
      isRowHeader: true,
      sortValue: (g) => g.fullName,
      cell: (g) => <PersonCell name={g.fullName} secondary={<span className="tabular">{phoneWords(g.phone)}</span>} />,
    },
    { id: "stay", header: "Stay", sortValue: (g) => g.arrivalOn, cell: (g) => stayWords(g) },
    {
      id: "who",
      header: "Who they are",
      hideBelow: "lg",
      cell: (g) => g.relationshipOther ?? g.relationshipLabel,
    },
    {
      id: "from",
      header: "Coming from",
      hideBelow: "xl",
      cell: (g) => <span className="text-sm">{g.originWords}</span>,
    },
    { id: "chain", header: "Shared with", cell: (g) => <ChainChips chain={g.chain} /> },
    {
      id: "status",
      header: "Status",
      cell: (g) => <StatusChip kind="guest" status={g.status === "cancelled" ? "cancelled" : (g.stay ?? "left")} />,
    },
  ];

  const save = (existing: HostGuest | null) => async (request: TenantGuestRequest | LandlordGuestRequest) => {
    const r = existing ? await calls.update(existing.id, request) : await calls.register(request);
    if (!r.ok) return { ok: false as const, error: r.error, fieldErrors: r.fieldErrors };
    toast.success(existing ? `${r.value.fullName} saved` : `${r.value.fullName} registered`);
    router.refresh();
    return { ok: true as const };
  };

  const confirmCancel = () => {
    if (!cancelling) return;
    const guest = cancelling;
    start(async () => {
      const r = await calls.cancel(guest.id);
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      setCancelling(null);
      toast.success(`${guest.fullName}'s stay cancelled`);
      router.refresh();
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {list.guests.length > 0 ? (
        <ul
          aria-label="What the leader chips mean"
          className="hidden items-center justify-end gap-3 text-xs text-muted md:flex"
        >
          {(["seen", "delivered", "waiting"] as const).map((key) => (
            <li key={key} className="flex items-center gap-1.5">
              <StatusDot tone={ROUTE_STATE[key].tone} />
              {ROUTE_STATE[key].words}
            </li>
          ))}
        </ul>
      ) : null}
      <DataTable
        label="Guests"
        rows={list.guests}
        rowKey={(g) => g.id}
        columns={columns}
        defaultSort={{ column: "stay", direction: "descending" }}
        noun={{ one: "guest", many: "guests" }}
        search={{ placeholder: "Guest name or phone", text: (g) => `${g.fullName} ${g.phone ?? ""}` }}
        filters={[
          {
            id: "stay",
            name: "Stay",
            options: TABS.filter((t) => t.id !== "cancelled" || (list.counts.cancelled ?? 0) > 0).map((t) => ({
              ...t,
              count: t.id === "all" ? list.guests.length : (list.counts[t.id] ?? 0),
            })),
            match: (g, v) => (v === "cancelled" ? g.status === "cancelled" : g.status !== "cancelled" && g.stay === v),
          },
        ]}
        rowActions={(g) =>
          g.canChange && g.status !== "cancelled" ? (
            <RowActions>
              <IconAction icon="PencilToSquare" label={`Change ${g.fullName}`} onPress={() => setEditing(g)} />
              <IconAction
                icon="Xmark"
                intent="danger"
                label={`Cancel ${g.fullName}'s stay`}
                onPress={() => setCancelling(g)}
              />
            </RowActions>
          ) : null
        }
        mobile={{
          title: (g) => g.fullName,
          description: (g) => (
            <span className="flex flex-col gap-1.5">
              <span>{stayWords(g)}</span>
              <ChainChips chain={g.chain} />
            </span>
          ),
          trailing: (g) => (
            <StatusChip kind="guest" status={g.status === "cancelled" ? "cancelled" : (g.stay ?? "left")} />
          ),
        }}
        empty={
          <EmptyBlock
            icon="PersonPlus"
            title="No guests yet"
            description={canRegister ? undefined : (registerReason ?? undefined)}
            action={
              canRegister ? (
                <ActionButton icon="PersonPlus" intent="primary" onPress={() => onRegistering(true)}>
                  Register a guest
                </ActionButton>
              ) : undefined
            }
          />
        }
      />

      {registering || editing ? (
        <GuestFormPanel
          key={editing?.id ?? "new"}
          relationships={relationships}
          today={today}
          window={window}
          buildings={buildings}
          initial={editing}
          onSave={save(editing)}
          onClose={() => {
            setEditing(null);
            onRegistering(false);
          }}
        />
      ) : null}
      <ConfirmDialog
        isOpen={cancelling !== null}
        onOpenChange={(o) => (o ? undefined : setCancelling(null))}
        title={`Cancel ${cancelling?.fullName ?? ""}'s stay?`}
        confirmLabel="Cancel the stay"
        confirmIcon="Xmark"
        intent="danger"
        cancelLabel="Keep it"
        isPending={pending}
        onConfirm={confirmCancel}
      >
        It stays on record as cancelled. Register them again if they come after all.
      </ConfirmDialog>
    </div>
  );
}
