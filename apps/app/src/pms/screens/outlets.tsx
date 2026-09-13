"use client";

/**
 * Outlets (ADR-050 slice 4, task 21) — the places this property sells from.
 *
 * **On real data.** Reads `GET /api/v1/ops/outlets` and commands `POST
 * /ops/outlets`, `PATCH /ops/outlets/:id` and `POST /ops/outlets/:id/archive`,
 * all three behind `outlet.manage` (owner and manager). Everyone else sees the
 * list and every manage control refused with the reason, as Departments does.
 *
 * **What the form deliberately does not offer, and why:**
 *
 *  - **Only the hotel runs an outlet here.** Every other arrangement (leased,
 *    managed, concession, franchise, revenue share) answers 422 until tenancies
 *    exist, so a picker would lead only to a refusal. The arrangement is shown
 *    read only, naming the operator party.
 *  - **Only property departments.** An outlet with no property needs an address
 *    and a business wide department; standalone outlets arrive with F&B
 *    registration, and the form says so.
 *  - **An amenity is picked, never typed**, from what the property lists, less
 *    those another outlet already carries — the server refuses both (422, 409).
 *  - **Weekly hours are not edited here yet.** The row says whether hours are
 *    set; editing them (the `OutletHoursInput` shape) is a follow up.
 *
 * Every refusal the server still gives is shown as the server's own sentence,
 * as a toast and, for the form, inline under the save button.
 */

import type {
  OperatorDepartment,
  OperatorOutlet,
  OrderingAccess,
  OutletKind,
  OutletRelationshipType,
  UpdateOutletRequest,
} from "@injishi/contracts";
import { Input } from "@injishi/ui";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { ConfirmAction } from "../components/confirm-action";
import {
  ActionButton,
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  SelectField,
  Skeleton,
  surfaceClass,
} from "../components/ui";
import { humanError } from "../data/api";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useAmenities, useDepartments } from "../data/ops";
import {
  useAmenityLabels,
  useArchiveOutlet,
  useCreateOutlet,
  useOutletParties,
  useOutlets,
  useUpdateOutlet,
} from "../data/outlets";
import { workspaceBase } from "../lib/nav";
import { usePms } from "../store";

/* ── Vocabulary ─────────────────────────────────────────────────────────── */

const KIND_LABEL: Record<OutletKind, string> = {
  restaurant: "Restaurant",
  bar: "Bar",
  lounge: "Lounge",
  banquet: "Banquet and events",
  room_service: "Room service",
  spa: "Spa",
  gym: "Gym",
  pool: "Pool",
  gift_shop: "Gift shop",
  parking: "Parking",
  laundry: "Laundry",
  business_center: "Business centre",
  other: "Other",
};

const ACCESS: { value: OrderingAccess; label: string; note: string }[] = [
  {
    value: "in_house_only",
    label: "In-house guests only",
    note: "Only guests staying here can order, and it goes on their room bill.",
  },
  {
    value: "walk_in_only",
    label: "Walk-in customers only",
    note: "Paid on the spot by anyone. Staying guests are not offered it.",
  },
  {
    value: "both",
    label: "Guests and walk-ins",
    note: "Staying guests charge it to the room; everyone else pays on the spot.",
  },
];

const ACCESS_LABEL = Object.fromEntries(ACCESS.map((a) => [a.value, a.label])) as Record<
  OrderingAccess,
  string
>;

const RELATIONSHIP_LABEL: Record<OutletRelationshipType, string> = {
  hotel_operated: "Run by the hotel",
  third_party_managed: "Managed by another business",
  leased_tenant: "Leased to a tenant",
  concession: "Concession",
  franchise: "Franchise",
  revenue_share: "Revenue share",
};

/** The select sentinel for "no amenity". An empty value would render as the placeholder. */
const NO_AMENITY = "__none";

const labelClass = "text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]";

/* ── Screen ─────────────────────────────────────────────────────────────── */

type Editor = { mode: "add" } | { mode: "edit"; outletId: string } | null;

export function Outlets() {
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const mayManage = can("outlet.manage");
  const denied = mayManage ? undefined : reasonFor("outlet.manage");

  const query = useOutlets(workspaceId);
  const archive = useArchiveOutlet(workspaceId);

  const [editor, setEditor] = useState<Editor>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const all = useMemo(() => query.data?.outlets ?? [], [query.data]);
  const propertyIds = useMemo(
    () => [...new Set(all.map((o) => o.propertyId).filter((id): id is string => id !== null))],
    [all],
  );
  const { labelFor } = useAmenityLabels(workspaceId, propertyIds);

  // Bring an opened editor into view: on a long list the row pressed may be far below it.
  useEffect(() => {
    if (editor) editorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [editor]);

  // A permission lost while a form is open closes the form rather than leaving a dead one.
  useEffect(() => {
    if (!mayManage) setEditor(null);
  }, [mayManage]);

  function doArchive(outlet: OperatorOutlet) {
    archive.mutate(
      { outletId: outlet.id },
      {
        onSuccess: () => {
          if (editor?.mode === "edit" && editor.outletId === outlet.id) setEditor(null);
          toast(`${outlet.name} archived — its sales history stays`, "ok");
        },
        onError: toastError,
      },
    );
  }

  if (query.isPending) {
    return (
      <div className="pms-enter flex flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={260} delay={60} />
      </div>
    );
  }

  if (query.isError) {
    /* No answer is not "no outlets". Told that, a manager would add a second
       restaurant beside the one guests are already ordering from. */
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your outlets. They are all still there and still taking orders —
        this is on our side, not an empty property.
      </LoadFailed>
    );
  }

  const open = all.filter((o) => o.status === "active");
  const archived = all.filter((o) => o.status !== "active");
  const editing = editor?.mode === "edit" ? all.find((o) => o.id === editor.outletId) : undefined;

  const row = (o: OperatorOutlet, i: number) => {
    const live = o.status === "active";
    const archiving = archive.isPending && archive.variables?.outletId === o.id;
    const isEditing = editing?.id === o.id;
    const meta = [
      KIND_LABEL[o.outletKind] ?? o.outletKind,
      o.departmentName,
      o.propertyName,
      o.hours === null ? "Open all hours" : "Weekly hours set",
    ].filter(Boolean);

    return (
      <li
        key={o.id}
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3 md:px-[18px]",
          i > 0 && "border-t border-line",
          isEditing && "bg-hover",
        )}
      >
        <span className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
          <span className={cn("truncate text-sm font-semibold", live ? "text-ink" : "text-muted-foreground")}>
            {o.name}
          </span>
          <span className="text-2xs text-muted-foreground">{meta.join(" · ")}</span>
        </span>

        <span className="flex flex-1 basis-64 flex-wrap gap-1.5">
          <Badge intent={o.orderingAccess === "both" ? "accent" : "neutral"}>
            {ACCESS_LABEL[o.orderingAccess] ?? o.orderingAccess}
          </Badge>
          <Badge intent={o.guestVisible ? "info" : "neutral"}>
            {o.guestVisible ? "Guests see it" : "Hidden from guests"}
          </Badge>
          {o.amenityCode && (
            <Badge intent="ok">Amenity: {labelFor(o.propertyId, o.amenityCode)}</Badge>
          )}
          {o.relationshipType !== "hotel_operated" && (
            <Badge intent="warn">
              {RELATIONSHIP_LABEL[o.relationshipType]}
              {o.operatorParty ? ` · ${o.operatorParty.legalName}` : ""}
            </Badge>
          )}
          {o.tenancy && <Badge intent="warn">Tenancy {o.tenancy.status}</Badge>}
        </span>

        {live && (
          <span className="flex shrink-0 flex-wrap justify-end gap-2 max-md:w-full">
            <ActionButton
              deniedReason={denied}
              disabled={archiving}
              aria-label={`Edit ${o.name}`}
              onClick={() => setEditor(isEditing ? null : { mode: "edit", outletId: o.id })}
            >
              {isEditing ? "Editing" : "Edit"}
            </ActionButton>
            {denied ? (
              /* Refused, it is an ActionButton: that one carries the reason to
                 a screen reader as well as a tooltip, and a refused press has
                 nothing to confirm. */
              <ActionButton deniedReason={denied}>Archive</ActionButton>
            ) : (
              <ConfirmAction
                pending={archiving}
                confirmLabel="Yes, archive it"
                onConfirm={() => doArchive(o)}
              >
                {archiving ? "Archiving" : "Archive"}
              </ConfirmAction>
            )}
          </span>
        )}
      </li>
    );
  };

  return (
    <div className="pms-enter flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <span className="max-w-form text-xs text-muted-foreground">
          An outlet is a place that sells: a restaurant, a bar, the spa. It decides who may order
          there and whether guests see it in the app. Its department decides where the revenue is
          reported.
        </span>
        <ActionButton
          variant="primary"
          deniedReason={denied}
          disabled={editor?.mode === "add"}
          onClick={() => setEditor({ mode: "add" })}
        >
          Add an outlet
        </ActionButton>
      </div>

      {mayManage && editor && (
        <div ref={editorRef}>
          {editor.mode === "add" ? (
            <OutletEditor
              key="add"
              mode="add"
              workspaceId={workspaceId}
              outlets={all}
              relationshipPolicy={query.data.relationshipPolicy}
              onDone={() => setEditor(null)}
            />
          ) : editing ? (
            <OutletEditor
              key={editing.id}
              mode="edit"
              outlet={editing}
              workspaceId={workspaceId}
              outlets={all}
              relationshipPolicy={query.data.relationshipPolicy}
              onDone={() => setEditor(null)}
            />
          ) : null}
        </div>
      )}

      <section>
        <SectionHeading n={open.length}>Open</SectionHeading>
        {open.length === 0 ? (
          <EmptyState className="mt-2.5 p-5">
            {mayManage
              ? "No outlets yet. Add one to give a menu somewhere to sell and guests somewhere to order."
              : "No outlets yet. An owner or a manager adds them; until then nothing here takes orders."}
          </EmptyState>
        ) : (
          <ul aria-label="Open outlets" className={cn(surfaceClass, "mt-2.5")}>
            {open.map(row)}
          </ul>
        )}
      </section>

      {archived.length > 0 && (
        <section>
          <SectionHeading n={archived.length}>Archived</SectionHeading>
          <ul aria-label="Archived outlets" className={cn(surfaceClass, "mt-2.5")}>
            {archived.map(row)}
          </ul>
        </section>
      )}

      <p className="text-2xs text-muted-foreground">
        An outlet is never deleted, only archived: its orders and receipts name it. An archived
        outlet cannot be changed — create a new one instead.
      </p>
    </div>
  );
}

/* ── Editor ─────────────────────────────────────────────────────────────── */

interface Draft {
  name: string;
  outletKind: OutletKind | "";
  departmentId: string;
  orderingAccess: OrderingAccess;
  guestVisible: boolean;
  /** "" means no amenity. */
  amenityCode: string;
}

function OutletEditor({
  mode,
  outlet,
  workspaceId,
  outlets,
  relationshipPolicy,
  onDone,
}: {
  mode: "add" | "edit";
  outlet?: OperatorOutlet;
  workspaceId: string | null;
  outlets: OperatorOutlet[];
  relationshipPolicy: Record<string, OutletRelationshipType[]>;
  onDone: () => void;
}) {
  const { toast, toastError } = usePms();
  const create = useCreateOutlet(workspaceId);
  const update = useUpdateOutlet(workspaceId);
  const departments = useDepartments(workspaceId);
  // Mounted only for someone holding `outlet.manage`, so this never asks a 403.
  const parties = useOutletParties(workspaceId, true);

  const [draft, setDraft] = useState<Draft>(() =>
    outlet
      ? {
          name: outlet.name,
          outletKind: outlet.outletKind,
          departmentId: outlet.departmentId,
          orderingAccess: outlet.orderingAccess,
          guestVisible: outlet.guestVisible,
          amenityCode: outlet.amenityCode ?? "",
        }
      : {
          name: "",
          outletKind: "",
          departmentId: "",
          orderingAccess: "in_house_only",
          guestVisible: true,
          amenityCode: "",
        },
  );
  const [showError, setShowError] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  /* Departments an outlet may earn for: active revenue centres at a property. */
  const choices = useMemo(() => {
    const rows = (departments.data?.departments ?? []).filter(
      (d): d is OperatorDepartment & { propertyId: string } =>
        d.status === "active" && d.isRevenueCenter && d.propertyId !== null,
    );
    const propertyName = new Map(outlets.map((o) => [o.propertyId, o.propertyName]));
    const several = new Set(rows.map((d) => d.propertyId)).size > 1;
    return rows.map((d) => ({
      id: d.id,
      propertyId: d.propertyId,
      label: several && propertyName.get(d.propertyId) ? `${d.name} · ${propertyName.get(d.propertyId)}` : d.name,
    }));
  }, [departments.data, outlets]);

  // A single choice is the answer; asking would be a formality.
  useEffect(() => {
    if (mode === "add" && !draft.departmentId && choices.length === 1) {
      setDraft((d) => ({ ...d, departmentId: choices[0].id }));
    }
  }, [mode, choices, draft.departmentId]);

  const propertyId =
    mode === "edit" ? (outlet?.propertyId ?? null) : (choices.find((c) => c.id === draft.departmentId)?.propertyId ?? null);
  const amenities = useAmenities(workspaceId, propertyId);

  /* Kinds the hotel may run itself, per the server's relationship policy. */
  const kindOptions = useMemo(
    () =>
      (Object.keys(KIND_LABEL) as OutletKind[])
        .filter((kind) => {
          const allowed = relationshipPolicy[kind] ?? relationshipPolicy["*"];
          return !allowed || allowed.includes("hotel_operated") || kind === outlet?.outletKind;
        })
        .map((kind) => ({ value: kind, label: KIND_LABEL[kind] })),
    [relationshipPolicy, outlet?.outletKind],
  );

  /* One amenity carries at most one outlet, archived outlets included. */
  const claimed = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of outlets) {
      if (o.propertyId === propertyId && o.amenityCode && o.id !== outlet?.id) map.set(o.amenityCode, o.name);
    }
    return map;
  }, [outlets, propertyId, outlet?.id]);

  const offered = (amenities.data?.amenities ?? []).filter((a) => a.offered || a.code === outlet?.amenityCode);
  const free = offered.filter((a) => !claimed.has(a.code));
  const taken = offered.filter((a) => claimed.has(a.code));
  const amenityOptions = [
    { value: NO_AMENITY, label: "Not one of the property's amenities" },
    ...free.map((a) => ({ value: a.code, label: a.label })),
  ];

  const ownParty = parties.data?.parties.find((p) => p.isOwnOrg && p.status === "active");
  const saving = create.isPending || update.isPending;

  const error =
    draft.name.trim().length === 0
      ? "Give the outlet a name, like Terrace bar or Room service."
      : !draft.outletKind
        ? "Choose what kind of outlet it is."
        : mode === "add" && !draft.departmentId
          ? "Choose the department it earns for."
          : null;

  function fail(e: unknown) {
    setServerError(humanError(e));
    toastError(e);
  }

  function save() {
    setServerError(null);
    if (error) {
      setShowError(true);
      return;
    }
    const name = draft.name.trim();
    const amenityCode = draft.amenityCode === "" ? null : draft.amenityCode;

    if (mode === "add") {
      create.mutate(
        {
          name,
          departmentId: draft.departmentId,
          propertyId: propertyId ?? undefined,
          outletKind: draft.outletKind as OutletKind,
          relationshipType: "hotel_operated",
          orderingAccess: draft.orderingAccess,
          guestVisible: draft.guestVisible,
          ...(amenityCode ? { amenityCode } : {}),
        },
        {
          onSuccess: (o) => {
            toast(`${o.name} is open`, "ok");
            onDone();
          },
          onError: fail,
        },
      );
      return;
    }

    if (!outlet) return;
    const patch: UpdateOutletRequest = {};
    if (name !== outlet.name) patch.name = name;
    if (draft.outletKind !== outlet.outletKind) patch.outletKind = draft.outletKind as OutletKind;
    if (draft.orderingAccess !== outlet.orderingAccess) patch.orderingAccess = draft.orderingAccess;
    if (draft.guestVisible !== outlet.guestVisible) patch.guestVisible = draft.guestVisible;
    if (amenityCode !== outlet.amenityCode) patch.amenityCode = amenityCode;
    // An unchanged form is not a command; the server would refuse an empty patch anyway.
    if (Object.keys(patch).length === 0) {
      onDone();
      return;
    }
    update.mutate(
      { outletId: outlet.id, patch },
      {
        onSuccess: (o) => {
          toast(`${o.name} saved`, "ok");
          onDone();
        },
        onError: fail,
      },
    );
  }

  const title = mode === "add" ? "Add an outlet" : `Edit ${outlet?.name ?? "outlet"}`;

  return (
    <section
      aria-labelledby="outlet-editor"
      className={cn(surfaceClass, "flex flex-col gap-5 p-4")}
      onKeyDown={(e) => {
        // Only from inside the form itself: an Escape that closes a select's
        // popover bubbles here through the React tree and must not close the form.
        if (e.key === "Escape" && e.currentTarget.contains(e.target as Node)) onDone();
      }}
    >
      <header className="flex flex-wrap items-baseline gap-2">
        <h3 id="outlet-editor" className="text-sm font-bold text-foreground">
          {title}
        </h3>
        <span className="text-2xs text-muted-foreground">
          {mode === "add"
            ? "Where it stands and who runs it are fixed once it opens, because its sales are declared there."
            : "Its department, property and who runs it stay as they are. To change those, archive it and add a new one."}
        </span>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Name</span>
          <Input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Terrace bar"
            maxLength={120}
            className="h-10 rounded border-line2 bg-field text-sm"
          />
        </label>

        <span className="flex flex-col gap-1.5">
          <span className={labelClass}>Kind</span>
          <SelectField
            label="Kind of outlet"
            value={draft.outletKind}
            onChange={(value) => setDraft({ ...draft, outletKind: value as OutletKind | "" })}
            placeholder="Restaurant, bar, spa…"
            options={kindOptions}
          />
        </span>

        {mode === "add" ? (
          <span className="flex flex-col gap-1.5">
            <span className={labelClass}>Department it earns for</span>
            {departments.isError ? (
              <span className="flex min-h-10 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                We couldn&apos;t load your departments.
                <ActionButton onClick={() => void departments.refetch()} pending={departments.isFetching}>
                  Try again
                </ActionButton>
              </span>
            ) : (
              <SelectField
                label="Department it earns for"
                value={draft.departmentId}
                onChange={(value) => setDraft({ ...draft, departmentId: value, amenityCode: "" })}
                placeholder={
                  departments.isPending
                    ? "Loading departments…"
                    : choices.length
                      ? "Which revenue department?"
                      : "No revenue department at a property yet"
                }
                disabled={departments.isPending || choices.length === 0}
                options={choices.map((c) => ({ value: c.id, label: c.label }))}
              />
            )}
          </span>
        ) : (
          <span className="flex flex-col gap-1.5">
            <span className={labelClass}>Department</span>
            <span className="flex min-h-10 items-center text-sm text-muted-foreground">
              {outlet?.departmentName ?? "Unnamed department"}
              {outlet?.propertyName ? ` · ${outlet.propertyName}` : ""}
            </span>
          </span>
        )}

        <span className="flex flex-col gap-1.5">
          <span className={labelClass}>Amenity it stands for</span>
          <SelectField
            label="Amenity it stands for"
            value={draft.amenityCode === "" ? NO_AMENITY : draft.amenityCode}
            onChange={(value) => setDraft({ ...draft, amenityCode: value === NO_AMENITY || value === "" ? "" : value })}
            placeholder={propertyId ? "Loading amenities…" : "Choose a department first"}
            disabled={!propertyId || amenities.isPending}
            options={amenityOptions}
          />
          <span className="text-2xs text-muted-foreground">
            {amenities.isError
              ? "We couldn't load this property's amenities, so none can be linked right now."
              : propertyId && !amenities.isPending && offered.length === 0
                ? "This property lists no amenities yet. "
                : "Linked, the property page shows one card for both. "}
            {taken.length > 0 &&
              `Already linked to an outlet: ${taken.map((a) => `${a.label}, to ${claimed.get(a.code)}`).join("; ")}. `}
            {propertyId && (
              <Link
                href={`${workspaceBase(workspaceId)}/inventory/amenities`}
                className="font-semibold text-accent-text underline-offset-2 hover:underline"
              >
                Manage amenities
              </Link>
            )}
          </span>
        </span>
      </div>

      <fieldset className="flex flex-col gap-3 border-t border-line pt-4">
        <legend className="flex flex-wrap items-baseline gap-2 pb-2">
          <span className="text-sm font-bold text-foreground">Who may order</span>
          <span className="text-2xs text-muted-foreground">Guests in the app and walk-ins at the counter.</span>
        </legend>
        <div className="grid gap-2 md:grid-cols-3">
          {ACCESS.map((a) => {
            const on = draft.orderingAccess === a.value;
            return (
              <label
                key={a.value}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded border px-3 py-2.5",
                  on ? "border-accent-text bg-accent-soft" : "border-line2 bg-field",
                )}
              >
                <input
                  type="radio"
                  name="ordering-access"
                  value={a.value}
                  checked={on}
                  onChange={() => setDraft({ ...draft, orderingAccess: a.value })}
                  className="mt-0.5 size-4 accent-[var(--accent)]"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">{a.label}</span>
                  <span className="text-2xs text-muted-foreground">{a.note}</span>
                </span>
              </label>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <input
            type="checkbox"
            checked={draft.guestVisible}
            onChange={(e) => setDraft({ ...draft, guestVisible: e.target.checked })}
            className="size-4 accent-[var(--accent)]"
          />
          Guests see it in the app
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5 border-t border-line pt-4">
        <legend className="pb-2 text-sm font-bold text-foreground">Who runs it</legend>
        <span className="text-sm text-foreground">
          {mode === "edit" && outlet
            ? `${RELATIONSHIP_LABEL[outlet.relationshipType]}${outlet.operatorParty ? ` · ${outlet.operatorParty.legalName}` : ""}`
            : `${RELATIONSHIP_LABEL.hotel_operated} · ${ownParty?.legalName ?? "your business"}`}
        </span>
        <span className="text-2xs text-muted-foreground">
          The hotel runs it and signs its receipts. Leased, managed and concession outlets arrive with
          tenancies, and a standalone outlet with no property arrives with food and beverage
          registration.
        </span>
      </fieldset>

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1" />
          <ActionButton onClick={onDone} disabled={saving}>
            Cancel
          </ActionButton>
          <ActionButton variant="primary" pending={saving} onClick={save}>
            {mode === "add" ? (saving ? "Adding" : "Add the outlet") : saving ? "Saving" : "Save changes"}
          </ActionButton>
        </div>
        {showError && error && (
          <p role="alert" className="text-xs font-semibold text-bad">
            {error}
          </p>
        )}
        {serverError && (
          <p role="alert" className="text-xs font-semibold text-bad">
            {serverError}
          </p>
        )}
      </div>
    </section>
  );
}
