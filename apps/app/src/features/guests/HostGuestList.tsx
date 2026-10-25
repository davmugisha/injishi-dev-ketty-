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
  FilterTabs,
  IconAction,
  PersonCell,
  RowActions,
  StatusChip,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/rentals/action-kit";
import { phoneWords, ROUTE_STATE, stayWords } from "../oversight/guests/parts";
import { GuestFormPanel } from "./GuestForm";

const TABS: { id: HostGuestTab; label: string }[] = [
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
 * A host's overnight guests (P5), the same for a tenant and for a landlord: the tabs of where each stay
 * is with their counts, one table (a list on a phone) with who they are, the stay, who they are to the
 * host, where they come from and which leaders it went to, and Change or Cancel until arrival day has
 * passed. Registering opens the guest form in a side panel.
 */
export function HostGuestList({
  list,
  tab,
  onTab,
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
  tab: HostGuestTab;
  onTab: (tab: HostGuestTab) => void;
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
      <FilterTabs
        label="Guests by stay"
        tabs={TABS.filter((t) => t.id !== "cancelled" || (list.counts.cancelled ?? 0) > 0 || tab === "cancelled").map(
          (t) => ({ ...t, count: list.counts[t.id] ?? 0 }),
        )}
        selectedKey={tab}
        onSelectionChange={(k) => onTab(k as HostGuestTab)}
      />
      <DataTable
        label="Guests"
        rows={list.guests}
        rowKey={(g) => g.id}
        columns={columns}
        defaultSort={{ column: "stay", direction: tab === "left" ? "descending" : "ascending" }}
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
            title={
              tab === "arriving"
                ? "Nobody is on the way"
                : tab === "staying"
                  ? "Nobody is staying now"
                  : tab === "left"
                    ? "No guest has left yet"
                    : "No stay was cancelled"
            }
            description={canRegister ? "Register a guest before they stay the night." : (registerReason ?? undefined)}
            action={
              canRegister && tab !== "left" && tab !== "cancelled" ? (
                <ActionButton icon="PersonPlus" intent="primary" onPress={() => onRegistering(true)}>
                  Register a guest
                </ActionButton>
              ) : undefined
            }
          />
        }
      />
      {list.guests.length > 0 ? (
        <p className="text-xs text-muted">
          Each registration goes to the village leader, the sector DASSO, the cell executive and the district. Green
          means they opened it; amber that the post has nobody in it yet.
        </p>
      ) : null}

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
