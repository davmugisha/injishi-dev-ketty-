"use client";

/**
 * Settings · Branches (ADR-054, AC-M1 to AC-M5).
 *
 * Every location of the business under its one TIN: add one, edit its name,
 * address, contact and RRA branch id, archive it, restore it, and move the head
 * office. Archived branches stay listed, because their history stays readable.
 *
 * The API decides every refusal, and this screen shows it in the server's words.
 * An archive refusal lists EVERY reason at once, so an owner does not clear one
 * blocker only to be refused for the next.
 *
 * Adding, archiving, restoring and moving the head office reshape the whole
 * business, so a member limited to some branches is not offered them (AC-M6).
 * Hiding them is an affordance only; `InventoryService` is the refusal.
 */

import type { OperatorPropertySummary } from "@injishi/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

import { SectorPicker } from "../components/sector-picker";
import { ActionButton, Badge, EmptyState, LoadFailed, Skeleton, surfaceClass } from "../components/ui";
import { humanError } from "../data/api";
import { useCapability, useWorkspaceId } from "../data/capability";
import { archiveReasons, useBranches, useMoveBranch, useUpdateBranch, type BranchMove } from "../data/inventory";
import { useCreateProperty, useProperty } from "../data/ops";
import { queryKeys } from "../data/queries";
import { usePms } from "../store";
import { currentGrant } from "../store/helpers";
import { BranchSetupDrawer } from "./branch-setup";

const inputClass = "h-10 w-full rounded border border-line2 bg-field px-3 text-sm text-foreground";

function addressLine(b: OperatorPropertySummary): string {
  // A sector named after its district ("Kicukiro, Kicukiro") is said once.
  return [...new Set([b.address.street, b.address.sectorName, b.address.districtName].filter((p): p is string => Boolean(p)))].join(", ");
}

export function Branches() {
  const workspaceId = useWorkspaceId();
  const { state } = usePms();
  const { can, reasonFor } = useCapability();
  const branches = useBranches(workspaceId);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  /**
   * The branch whose setup (rooms, photos, publish) is open under its row.
   * One panel at a time, edit or setup, so the screen never stacks two forms.
   */
  const [settingUp, setSettingUp] = useState<string | null>(null);


  // Coverage is the grant's. Absent (the grant has not answered) reads as
  // `all`, so nothing flickers away; the API refuses a limited member anyway.
  const coversEvery = currentGrant(state)?.branchCoverage !== "limited";

  if (!can("listing.manage")) {
    return <EmptyState className="p-6 text-sm">{reasonFor("listing.manage")}</EmptyState>;
  }
  if (branches.isPending) return <Skeleton height={320} />;
  if (branches.isError) {
    return (
      <LoadFailed onRetry={() => void branches.refetch()}>
        We couldn&apos;t load your branches. Nothing is lost — this is on our side.
      </LoadFailed>
    );
  }

  const all = branches.data.properties;
  const active = all.filter((b) => b.archivedAt === null);
  // Head office first, then the rest by name, archived last.
  const ordered = [...all].sort(
    (a, b) =>
      Number(a.archivedAt !== null) - Number(b.archivedAt !== null) ||
      Number(b.isHeadOffice) - Number(a.isHeadOffice) ||
      a.name.localeCompare(b.name),
  );

  return (
    <div className="pms-enter flex flex-col gap-4" data-screen="branches">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-ink">Branches</div>
          <p className="text-sm text-muted-foreground">
            {active.length === 1 ? "One active branch" : `${active.length} active branches`}
            {all.length > active.length ? `, ${all.length - active.length} archived` : ""}. Every branch
            works under this business&apos;s TIN; a location with its own TIN registers as its own business.
          </p>
        </div>
        {coversEvery && !adding && (
          <ActionButton variant="primary" onClick={() => setAdding(true)}>
            Add branch
          </ActionButton>
        )}
      </div>

      {adding && workspaceId && (
        <AddBranch
          workspaceId={workspaceId}
          onDone={(createdId) => {
            setAdding(false);
            // Straight on to its setup: no hunting for it under Inventory.
            if (createdId) {
              setEditing(null);
              setSettingUp(createdId);
            }
          }}
        />
      )}

      {ordered.length === 0 ? (
        <EmptyState className="p-6 text-sm">No branch on this business yet. Add the first one to start.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {ordered.map((b) => (
            <BranchRow
              key={b.id}
              branch={b}
              workspaceId={workspaceId}
              coversEvery={coversEvery}
              editing={editing === b.id}
              onEdit={() => {
                setSettingUp(null);
                setEditing(editing === b.id ? null : b.id);
              }}
              settingUp={settingUp === b.id}
              onSetup={() => {
                setEditing(null);
                setSettingUp(settingUp === b.id ? null : b.id);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function BranchRow({
  branch: b,
  workspaceId,
  coversEvery,
  editing,
  onEdit,
  settingUp,
  onSetup,
}: {
  branch: OperatorPropertySummary;
  workspaceId: string | null;
  coversEvery: boolean;
  editing: boolean;
  onEdit: () => void;
  settingUp: boolean;
  onSetup: () => void;
}) {
  const { toast } = usePms();
  const move = useMoveBranch(workspaceId);
  const [reasons, setReasons] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const archived = b.archivedAt !== null;

  const run = (m: BranchMove, done: string) => {
    setReasons([]);
    setError(null);
    move.mutate(
      { propertyId: b.id, move: m },
      {
        onSuccess: () => toast(done, "ok"),
        onError: (err) => {
          const listed = archiveReasons(err);
          if (listed.length > 0) setReasons(listed);
          else setError(humanError(err));
        },
      },
    );
  };
  const pending = (m: BranchMove) => move.isPending && move.variables?.move === m;

  return (
    <li className={cn(surfaceClass, "flex flex-col gap-3 p-4")} data-branch={b.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-sm font-semibold", archived ? "text-muted-foreground" : "text-ink")}>
              {b.name}
            </span>
            {b.isHeadOffice && <Badge intent="accent">Head office</Badge>}
            {archived ? (
              <Badge intent="neutral">Archived</Badge>
            ) : (
              <Badge intent={b.listingStatus === "published" ? "ok" : "neutral"}>
                {b.listingStatus === "published" ? "On the marketplace" : "Draft listing"}
              </Badge>
            )}
            {b.rraBranchId && <Badge intent="info">RRA branch {b.rraBranchId}</Badge>}
          </div>
          <span className="text-xs text-muted-foreground">{addressLine(b) || "No address yet"}</span>
          {!archived && (
            <span className="text-xs text-muted-foreground">
              {b.roomTypeCount} room {b.roomTypeCount === 1 ? "type" : "types"} · {b.sellableRoomCount} sellable{" "}
              {b.sellableRoomCount === 1 ? "room" : "rooms"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!archived && (
            <ActionButton
              variant={b.listingStatus === "published" || settingUp ? "secondary" : "primary"}
              onClick={onSetup}
              aria-expanded={settingUp}
            >
              {settingUp ? "Close setup" : b.listingStatus === "published" ? "Rooms & photos" : "Finish setup"}
            </ActionButton>
          )}
          <ActionButton variant="secondary" onClick={onEdit}>
            {editing ? "Close" : "Edit"}
          </ActionButton>
          {coversEvery && !archived && !b.isHeadOffice && (
            <>
              <ActionButton
                variant="secondary"
                pending={pending("head-office")}
                onClick={() => run("head-office", `${b.name} is now the head office`)}
              >
                Make head office
              </ActionButton>
              <ActionButton
                variant="secondary"
                pending={pending("archive")}
                onClick={() => run("archive", `${b.name} is archived. Its history stays readable.`)}
              >
                Archive
              </ActionButton>
            </>
          )}
          {coversEvery && archived && (
            <ActionButton
              variant="secondary"
              pending={pending("restore")}
              onClick={() => run("restore", `${b.name} is back. Publish its listing again when it is ready.`)}
            >
              Restore
            </ActionButton>
          )}
        </div>
      </div>

      {reasons.length > 0 && (
        <div role="alert" className="flex flex-col gap-1 text-sm text-danger">
          <span className="font-semibold">{b.name} can&apos;t be archived yet:</span>
          <ul className="list-disc pl-5">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {editing && workspaceId && <EditBranch workspaceId={workspaceId} branchId={b.id} onDone={onEdit} />}
      {settingUp && workspaceId && !archived && (
        <BranchSetupDrawer workspaceId={workspaceId} branch={b} onClose={onSetup} />
      )}
    </li>
  );
}

interface Draft {
  name: string;
  street: string;
  contactPhone: string;
  contactEmail: string;
  rraBranchId: string;
}

function EditBranch({ workspaceId, branchId, onDone }: { workspaceId: string; branchId: string; onDone: () => void }) {
  const { toast } = usePms();
  const { can } = useCapability();
  const detail = useProperty(workspaceId, branchId);
  const update = useUpdateBranch(workspaceId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [moving, setMoving] = useState(false);
  const [sectorId, setSectorId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mayRra = can("ebm.manage");

  useEffect(() => {
    const p = detail.data;
    if (!p) return;
    setDraft({
      name: p.name,
      street: p.address.street ?? "",
      contactPhone: p.contactPhone ?? "",
      contactEmail: p.contactEmail ?? "",
      rraBranchId: p.rraBranchId ?? "",
    });
  }, [detail.data]);

  if (detail.isPending || !draft) return <Skeleton height={180} />;
  if (detail.isError) {
    return <LoadFailed onRetry={() => void detail.refetch()}>We couldn&apos;t load this branch.</LoadFailed>;
  }

  const p = detail.data;
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const field = (label: string, key: keyof Draft, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold text-ink">{label}</span>
      <input
        aria-label={label}
        value={draft[key]}
        onChange={(e) => set({ [key]: e.target.value } as Partial<Draft>)}
        className={inputClass}
        {...props}
      />
    </label>
  );

  const save = () => {
    setError(null);
    const name = draft.name.trim();
    if (name.length < 2) return setError("Give the branch a name guests will recognise.");
    if (moving && sectorId === null) return setError("Choose the sector the branch moved to.");
    const rra = draft.rraBranchId.trim();
    if (mayRra && rra !== "" && !/^[0-9]{2}$/.test(rra)) {
      return setError("Use the two digit branch id RRA gave you, like 01.");
    }
    update.mutate(
      {
        propertyId: branchId,
        body: {
          name,
          street: draft.street.trim() || undefined,
          contactPhone: draft.contactPhone.trim() || null,
          contactEmail: draft.contactEmail.trim() || null,
          ...(moving && sectorId !== null ? { sectorId } : {}),
          // Sent only when it changed, so an edit by someone without
          // `ebm.manage` never trips that check.
          ...(mayRra && rra !== (p.rraBranchId ?? "") ? { rraBranchId: rra || null } : {}),
        },
      },
      {
        onSuccess: () => {
          toast(`${name} saved`, "ok");
          onDone();
        },
        onError: (err) => setError(humanError(err)),
      },
    );
  };

  return (
    <form
      className="flex flex-col gap-3 border-t border-line2 pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {field("Branch name", "name")}
        {field("Street", "street", { placeholder: "KG 11 Ave" })}
        {field("Front desk phone", "contactPhone", { inputMode: "tel", placeholder: "+250 788 123 456" })}
        {field("Contact email", "contactEmail", { type: "email", placeholder: "frontdesk@example.com" })}
        {mayRra &&
          field("RRA branch id", "rraBranchId", { inputMode: "numeric", maxLength: 2, placeholder: "01" })}
      </div>
      {mayRra && (
        <p className="text-xs text-muted-foreground">
          The two digit id RRA issued for this location. Receipts from this branch are declared under it, and no
          other branch of the business can reuse it.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground">
          {[p.address.sectorName, p.address.districtName, p.address.provinceName].filter(Boolean).join(", ")}
        </span>
        {moving ? (
          <SectorPicker onSector={setSectorId} />
        ) : (
          <div>
            <ActionButton variant="secondary" onClick={() => setMoving(true)}>
              Change address
            </ActionButton>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <ActionButton variant="primary" type="submit" pending={update.isPending}>
          {update.isPending ? "Saving" : "Save branch"}
        </ActionButton>
      </div>
    </form>
  );
}

function AddBranch({
  workspaceId,
  onDone,
}: {
  workspaceId: string;
  /** The new branch's id when one was added; undefined on Cancel. */
  onDone: (createdId?: string) => void;
}) {
  const { toast } = usePms();
  const client = useQueryClient();
  const create = useCreateProperty(workspaceId);
  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [sectorId, setSectorId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) return setError("Give the branch a name guests will recognise.");
    if (sectorId === null) return setError("Choose a sector for the address.");
    create.mutate(
      { name: trimmed, sectorId, street: street.trim() || undefined },
      {
        onSuccess: (created) => {
          // The new branch joins the grant's list (the switcher) and this one.
          void client.invalidateQueries({ queryKey: ["inventory"] });
          void client.invalidateQueries({ queryKey: queryKeys.meWorkspaces });
          toast(`${trimmed} is added. Add its rooms and photos below, then publish it.`, "ok");
          onDone(created.id);
        },
        onError: (err) => setError(humanError(err)),
      },
    );
  };

  return (
    <form
      className={cn(surfaceClass, "flex flex-col gap-3 p-4")}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <span className="text-sm font-semibold text-ink">New branch</span>
      <p className="text-xs text-muted-foreground">
        No fee and no review: it is ready to set up as soon as you add it, starting with a draft listing.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">Branch name</span>
          <input
            aria-label="Branch name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Lavender Hill Musanze"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-ink">Street (optional)</span>
          <input
            aria-label="Street"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            className={inputClass}
            placeholder="KG 11 Ave"
          />
        </label>
      </div>
      <SectorPicker onSector={setSectorId} />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <ActionButton variant="secondary" onClick={() => onDone()}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={create.isPending}>
          {create.isPending ? "Adding" : "Add branch"}
        </ActionButton>
      </div>
    </form>
  );
}
