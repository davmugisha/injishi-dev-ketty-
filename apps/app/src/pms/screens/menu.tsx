"use client";

/**
 * Menu and pricing (F-P06) — the department service catalog, as a gallery.
 *
 * **On real data** (ADR-035, D-f wave 2). Reads `GET /api/v1/ops/service-catalog`
 * and commands the catalog routes behind `menu.manage`. The demo store is gone
 * from this screen (D-i).
 *
 * What a guest orders from is a picture and a price, so this is the operator's
 * view of the same thing: a tile per item, its availability on the tile, and a
 * category rail deciding what is on show. A list view made a 60 minute massage
 * and a Fanta the same 40px row, and gave the host nowhere to notice the
 * ABSENCE of the photograph a guest will be looking at.
 *
 * **THE CATALOG CAN BE SOLD** (ADR-050 slice 3, task 17). A menu can be added
 * and set up, an item added and edited in full, with the RRA codes a receipt
 * needs and the options a guest can pick. And the screen says out loud what the
 * server now enforces: an item without every RRA value is not sold on any
 * channel. Items that were on sale before the codes existed are still flagged
 * orderable and are held back until someone classifies them, so the first thing
 * on the screen is how many, with a way to show only those.
 *
 * **EDITING AN ITEM NEVER REWRITES A PLACED ORDER.** An order snapshots the
 * name, the price, the chosen options and the tax code at order time (D8,
 * AC-23), which is what makes it safe to reprice mid service.
 *
 * **THREE STATES, NOT A SWITCH.** `out_of_stock` means we still sell this, just
 * not right now, while `archived` means we stopped selling it. Collapsing them
 * would make a host archive the fish every time it ran out.
 *
 * Not here, and why: an outlet cannot be chosen for a menu because nothing lists
 * outlets yet (slice 4's `/outlets` page), and service hours are the outlet's,
 * not the menu's. A photograph still waits on the photo pipeline (F-S09).
 */

import { Button, Input } from "@injishi/ui";
import type {
  OperatorServiceCategory,
  OperatorServiceItem,
  ServiceCatalogStatus,
  UpdateServiceItemRequest,
} from "@injishi/contracts";
import { useState } from "react";

import { MediaTile, NeedsPhoto } from "../components/media-tile";
import {
  CategoryEditor,
  draftForNewCategory,
  draftFromCategory,
  type CategoryDraft,
  type DepartmentChoice,
} from "../components/menu/category-editor";
import {
  ItemEditor,
  draftForNewItem,
  draftFromItem,
  type ItemDraft,
} from "../components/menu/item-editor";
import { ActionButton, Badge, EmptyState, LoadFailed, Skeleton, StatCard, surfaceClass } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import {
  useCreateServiceCategory,
  useCreateServiceItem,
  useDepartments,
  useServiceCatalog,
  useUpdateServiceCategory,
  useUpdateServiceItem,
} from "../data/ops";
import { fmt, parseAmount } from "../lib/format";
import { menuItemPhoto } from "../lib/media";
import { usePms } from "../store";
import { cn } from "@/lib/utils";

/** The three real states, worded for a kitchen rather than a database. */
const STATUS: Record<
  ServiceCatalogStatus,
  { label: string; intent: "ok" | "warn" | "neutral" }
> = {
  active: { label: "On the menu", intent: "ok" },
  out_of_stock: { label: "Off today", intent: "warn" },
  archived: { label: "Withdrawn", intent: "neutral" },
};

/** The RRA values an item lacks, as the owner reads them. */
const MISSING_WORD: Record<OperatorServiceItem["missingRra"][number], string> = {
  classification: "classification",
  productType: "product type",
  itemCode: "item code",
  packagingUnit: "packaging unit",
  quantityUnit: "quantity unit",
};

/** An item the host thinks is on sale, which the server will not sell (D-m, amended). */
function heldBack(item: OperatorServiceItem): boolean {
  return item.guestOrderable && item.status !== "archived" && item.missingRra.length > 0;
}

/** Only the fields the owner changed, so a save never sends what it did not mean to. */
function itemPatch(before: ItemDraft, after: ItemDraft): UpdateServiceItemRequest {
  const patch: UpdateServiceItemRequest = {};
  if (after.name !== before.name) patch.name = after.name;
  if (after.description !== before.description) patch.description = after.description;
  if (after.priceRwf !== before.priceRwf) patch.priceRwf = after.priceRwf;
  if (after.taxCode !== before.taxCode) patch.taxCode = after.taxCode;
  if (after.stockQty !== before.stockQty) patch.stockQty = after.stockQty;
  if (after.guestOrderable !== before.guestOrderable) patch.guestOrderable = after.guestOrderable;
  if (JSON.stringify(after.options) !== JSON.stringify(before.options)) patch.options = after.options;
  if (after.rraItemClsCd && after.rraItemClsCd !== before.rraItemClsCd) patch.rraItemClsCd = after.rraItemClsCd;
  if (after.rraItemTyCd && after.rraItemTyCd !== before.rraItemTyCd) patch.rraItemTyCd = after.rraItemTyCd;
  if (after.rraPkgUnitCd && after.rraPkgUnitCd !== before.rraPkgUnitCd) patch.rraPkgUnitCd = after.rraPkgUnitCd;
  if (after.rraQtyUnitCd && after.rraQtyUnitCd !== before.rraQtyUnitCd) patch.rraQtyUnitCd = after.rraQtyUnitCd;
  return patch;
}

type Editing =
  | { kind: "none" }
  | { kind: "new-category" }
  | { kind: "category"; id: string }
  | { kind: "new-item"; categoryId: string }
  | { kind: "item"; id: string };

export function Menu() {
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useServiceCatalog(workspaceId);
  const departmentsQuery = useDepartments(workspaceId);
  const update = useUpdateServiceItem(workspaceId);
  const createItem = useCreateServiceItem(workspaceId);
  const createCategory = useCreateServiceCategory(workspaceId);
  const updateCategory = useUpdateServiceCategory(workspaceId);

  const [category, setCategory] = useState<string | null>(null);
  /** Withdrawn items still matter to the host; they are dimmed, not dropped. */
  const [showWithdrawn, setShowWithdrawn] = useState(true);
  /** Show only what is held back for missing RRA codes. */
  const [onlyHeldBack, setOnlyHeldBack] = useState(false);
  /** The item whose price is being edited in its tile, and what has been typed. */
  const [pricing, setPricing] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState<Editing>({ kind: "none" });
  const [serverError, setServerError] = useState<string | null>(null);

  const mayManage = can("menu.manage");
  const denied = mayManage ? undefined : reasonFor("menu.manage");

  function open(next: Editing) {
    setServerError(null);
    setEditing(next);
  }

  function setStatus(item: OperatorServiceItem, status: ServiceCatalogStatus) {
    update.mutate(
      { itemId: item.id, status },
      {
        // What a guest ordering right now will see, rather than the word on
        // the button that was pressed.
        onSuccess: () =>
          toast(
            status === "active"
              ? heldBack(item)
                ? `${item.name} is on the menu, but still needs its RRA codes before guests can order it.`
                : `${item.name} is on the menu — guests can order it.`
              : status === "out_of_stock"
                ? `${item.name} is off for today. It stays on the menu for tomorrow.`
                : `${item.name} is withdrawn. Guests no longer see it.`,
            "ok",
          ),
        onError: toastError,
      },
    );
  }

  function savePrice(item: OperatorServiceItem) {
    const next = parseAmount(price);
    if (!Number.isFinite(next) || next <= 0 || next === item.priceRwf) {
      setPricing(null);
      return;
    }
    update.mutate(
      { itemId: item.id, priceRwf: next },
      {
        onSuccess: () => {
          setPricing(null);
          toast(`${item.name} is ${fmt(next)} from now on. Orders already placed keep the old price.`, "ok");
        },
        onError: toastError,
      },
    );
  }

  function saveNewCategory(draft: CategoryDraft) {
    setServerError(null);
    createCategory.mutate(
      {
        propertyId: draft.propertyId,
        departmentId: draft.departmentId,
        name: draft.name,
        guestVisible: draft.guestVisible,
        ...(draft.rraItemClsCd ? { defaultRraItemClsCd: draft.rraItemClsCd } : {}),
        ...(draft.rraItemTyCd ? { defaultRraItemTyCd: draft.rraItemTyCd } : {}),
        ...(draft.rraPkgUnitCd ? { defaultRraPkgUnitCd: draft.rraPkgUnitCd } : {}),
        ...(draft.rraQtyUnitCd ? { defaultRraQtyUnitCd: draft.rraQtyUnitCd } : {}),
        ...(draft.defaultTaxCode ? { defaultTaxCode: draft.defaultTaxCode } : {}),
      },
      {
        onSuccess: (catalog) => {
          const made = catalog.categories.find((c) => c.name === draft.name && c.departmentId === draft.departmentId);
          if (made) setCategory(made.id);
          setEditing({ kind: "none" });
          toast(`${draft.name} is added. Add its first item next.`, "ok");
        },
        onError: (error) => setServerError(error.message),
      },
    );
  }

  function saveCategory(current: OperatorServiceCategory, draft: CategoryDraft) {
    setServerError(null);
    const before = draftFromCategory(current);
    const patch = {
      ...(draft.name !== before.name ? { name: draft.name } : {}),
      ...(draft.guestVisible !== before.guestVisible ? { guestVisible: draft.guestVisible } : {}),
      ...(draft.rraItemClsCd && draft.rraItemClsCd !== before.rraItemClsCd ? { defaultRraItemClsCd: draft.rraItemClsCd } : {}),
      ...(draft.rraItemTyCd && draft.rraItemTyCd !== before.rraItemTyCd ? { defaultRraItemTyCd: draft.rraItemTyCd } : {}),
      ...(draft.rraPkgUnitCd && draft.rraPkgUnitCd !== before.rraPkgUnitCd ? { defaultRraPkgUnitCd: draft.rraPkgUnitCd } : {}),
      ...(draft.rraQtyUnitCd && draft.rraQtyUnitCd !== before.rraQtyUnitCd ? { defaultRraQtyUnitCd: draft.rraQtyUnitCd } : {}),
      ...(draft.defaultTaxCode && draft.defaultTaxCode !== before.defaultTaxCode ? { defaultTaxCode: draft.defaultTaxCode } : {}),
    };
    if (Object.keys(patch).length === 0) {
      setEditing({ kind: "none" });
      return;
    }
    updateCategory.mutate(
      { categoryId: current.id, ...patch },
      {
        onSuccess: () => {
          setEditing({ kind: "none" });
          toast(`${draft.name} is saved. Items already on it are unchanged.`, "ok");
        },
        onError: (error) => setServerError(error.message),
      },
    );
  }

  function saveNewItem(current: OperatorServiceCategory, draft: ItemDraft) {
    setServerError(null);
    createItem.mutate(
      {
        serviceCategoryId: current.id,
        name: draft.name,
        ...(draft.description ? { description: draft.description } : {}),
        priceRwf: draft.priceRwf,
        taxCode: draft.taxCode,
        ...(draft.stockQty !== null ? { stockQty: draft.stockQty } : {}),
        guestOrderable: draft.guestOrderable,
        options: draft.options,
        ...(draft.rraItemClsCd ? { rraItemClsCd: draft.rraItemClsCd } : {}),
        ...(draft.rraItemTyCd ? { rraItemTyCd: draft.rraItemTyCd } : {}),
        ...(draft.rraPkgUnitCd ? { rraPkgUnitCd: draft.rraPkgUnitCd } : {}),
        ...(draft.rraQtyUnitCd ? { rraQtyUnitCd: draft.rraQtyUnitCd } : {}),
      },
      {
        onSuccess: () => {
          setEditing({ kind: "none" });
          toast(
            draft.guestOrderable
              ? `${draft.name} is on ${current.name} and guests can order it.`
              : `${draft.name} is on ${current.name}, not on sale yet.`,
            "ok",
          );
        },
        onError: (error) => setServerError(error.message),
      },
    );
  }

  function saveItem(item: OperatorServiceItem, draft: ItemDraft) {
    setServerError(null);
    const patch = itemPatch(draftFromItem(item), draft);
    if (Object.keys(patch).length === 0) {
      setEditing({ kind: "none" });
      return;
    }
    update.mutate(
      { itemId: item.id, ...patch },
      {
        onSuccess: () => {
          setEditing({ kind: "none" });
          toast(`${draft.name} is saved. Orders already placed keep what they were ordered at.`, "ok");
        },
        onError: (error) => setServerError(error.message),
      },
    );
  }

  if (query.isPending) {
    return (
      <div className="pms-enter flex flex-col gap-4">
        <Skeleton height={88} />
        <Skeleton height={40} delay={60} />
        <Skeleton height={280} delay={120} />
      </div>
    );
  }

  if (query.isError) {
    /* A failed read is not an empty menu. A kitchen told it sells nothing is
       the worst possible reading of a failed request. */
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your menu. Every item and price is still there — this is on
        our side, not an empty catalogue.
      </LoadFailed>
    );
  }

  const categories = query.data?.categories ?? [];
  const departments: DepartmentChoice[] = (departmentsQuery.data?.departments ?? [])
    .filter((d) => d.isRevenueCenter && d.status === "active" && d.propertyId)
    .map((d) => ({ id: d.id, propertyId: d.propertyId!, label: d.name }));

  const allItems = categories.flatMap((c) => c.items);
  const live = allItems.filter((i) => i.status !== "archived");
  const onSale = live.filter((i) => i.guestOrderable && i.missingRra.length === 0).length;
  const held = allItems.filter(heldBack).length;
  const unclassified = live.filter((i) => i.missingRra.length > 0).length;

  const newCategoryEditor =
    editing.kind === "new-category" ? (
      <CategoryEditor
        key="new-category"
        workspaceId={workspaceId}
        mode="add"
        initial={draftForNewCategory(departments)}
        departments={departments}
        onSave={saveNewCategory}
        onCancel={() => open({ kind: "none" })}
        saving={createCategory.isPending}
        serverError={serverError}
        deniedReason={denied}
      />
    ) : null;

  if (categories.length === 0) {
    return (
      <div className="pms-enter flex flex-col gap-4">
        <EmptyState className="flex flex-col items-start gap-3">
          <span>
            No menu yet. A menu groups what one revenue department sells: drinks at the bar, room
            service, the spa. Add the first one to start selling.
          </span>
          {editing.kind !== "new-category" && (
            <ActionButton variant="primary" deniedReason={denied} onClick={() => open({ kind: "new-category" })}>
              Add a menu
            </ActionButton>
          )}
        </EmptyState>
        {newCategoryEditor}
      </div>
    );
  }

  const current = categories.find((c) => c.id === category) ?? categories[0]!;
  const items = current.items
    .filter((i) => showWithdrawn || i.status !== "archived")
    .filter((i) => !onlyHeldBack || i.missingRra.length > 0);
  const editingItem =
    editing.kind === "item" ? current.items.find((i) => i.id === editing.id) : undefined;

  return (
    <div className="pms-enter flex flex-col gap-4">
      {/* Selling on Injishi: what is actually for sale, and what the codes hold back. */}
      <section aria-labelledby="menu-readiness" className={cn(surfaceClass, "flex flex-col gap-3 p-4")}>
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 id="menu-readiness" className="text-sm font-bold text-foreground">
            Selling on Injishi
          </h2>
          <span className="text-2xs text-muted-foreground">
            A receipt RRA accepts names what was sold with the Authority&apos;s own codes, so an item
            without them is not sold anywhere, in the guest app or at the desk.
          </span>
        </div>
        {/* Two figures, side by side even on a phone: what sells, and what the
            host meant to sell and the codes are holding back. */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard n={String(onSale)} label="On sale to guests" />
          <StatCard n={String(held)} label="Held back, missing RRA codes" />
        </div>
        {unclassified > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {unclassified} {unclassified === 1 ? "item still needs" : "items still need"} codes
              {unclassified > held ? `, ${unclassified - held} of them not offered to guests anyway` : ""}.
            </span>
            <Button
              variant="outline"
              size="sm"
              shape="pill"
              onClick={() => setOnlyHeldBack((v) => !v)}
              aria-pressed={onlyHeldBack}
              className={cn(
                "font-semibold",
                onlyHeldBack
                  ? "border-accent-text bg-accent-soft text-accent-text hover:bg-accent-soft"
                  : "border-card-bd text-ink2 hover:bg-hover",
              )}
            >
              {onlyHeldBack ? "Showing only what needs codes" : "Show only what needs codes"}
            </Button>
          </div>
        )}
      </section>

      {/* The menu rail */}
      <nav aria-label="Menus" className="flex flex-wrap items-center gap-2.5">
        {categories.map((c) => {
          const on = c.id === current.id;
          const needs = c.items.filter((i) => i.status !== "archived" && i.missingRra.length > 0).length;
          return (
            <Button
              variant="outline"
              size="sm"
              shape="pill"
              key={c.id}
              onClick={() => {
                setCategory(c.id);
                if (editing.kind !== "new-category") open({ kind: "none" });
              }}
              aria-pressed={on}
              className={cn(
                // Never wider than the screen: a long menu name is cut with an
                // ellipsis rather than pushing the pill past a phone's edge.
                "min-h-10 max-w-full font-semibold",
                on
                  ? "border-accent-text bg-accent-soft text-accent-text hover:bg-accent-soft"
                  : "border-card-bd bg-card text-ink2 hover:bg-hover",
              )}
              title={c.name}
            >
              <span className="min-w-0 truncate">
                {c.name}
                {c.departmentName ? ` · ${c.departmentName}` : ""}
              </span>
              {needs > 0 && (
                <span className="pms-num shrink-0 text-2xs text-warn" aria-label={`${needs} need RRA codes`}>
                  {needs}
                </span>
              )}
            </Button>
          );
        })}
        <span className="flex-1" />
        <ActionButton deniedReason={denied} onClick={() => open({ kind: "new-category" })}>
          Add a menu
        </ActionButton>
      </nav>

      {newCategoryEditor}

      {/* The chosen menu */}
      <section aria-labelledby="menu-current" className={cn(surfaceClass, "flex flex-col gap-3 p-4")}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="menu-current" className="text-base font-bold text-foreground">
            {current.name}
          </h2>
          {current.departmentName && (
            <span className="text-xs text-muted-foreground">earns for {current.departmentName}</span>
          )}
          <Badge intent={current.guestVisible ? "ok" : "neutral"}>
            {current.guestVisible ? "Guests see it" : "Hidden from guests"}
          </Badge>
          {!current.outletId && <Badge intent="neutral">No outlet: not in the guest app</Badge>}
          <span className="flex-1" />
          <ActionButton deniedReason={denied} onClick={() => open({ kind: "category", id: current.id })}>
            Menu settings
          </ActionButton>
          <ActionButton
            variant="primary"
            deniedReason={denied}
            onClick={() => open({ kind: "new-item", categoryId: current.id })}
          >
            Add an item
          </ActionButton>
        </div>
        <p className="text-xs text-muted-foreground">
          {current.defaultRraItemTyCd || current.defaultRraItemClsCd || current.defaultRraPkgUnitCd
            ? `New items start with ${[
                current.defaultRraItemClsCd && `classification ${current.defaultRraItemClsCd}`,
                current.defaultRraItemTyCd && `product type ${current.defaultRraItemTyCd}`,
                current.defaultRraPkgUnitCd && `packaging ${current.defaultRraPkgUnitCd}`,
                current.defaultRraQtyUnitCd && `quantity ${current.defaultRraQtyUnitCd}`,
              ]
                .filter(Boolean)
                .join(", ")}.`
            : "New items start with no RRA codes. Set prefills in menu settings to save answering them per item."}
        </p>
      </section>

      {editing.kind === "category" && editing.id === current.id && (
        <CategoryEditor
          key={`category-${current.id}`}
          workspaceId={workspaceId}
          mode="edit"
          initial={draftFromCategory(current)}
          departments={departments}
          onSave={(draft) => saveCategory(current, draft)}
          onCancel={() => open({ kind: "none" })}
          saving={updateCategory.isPending}
          serverError={serverError}
          deniedReason={denied}
        />
      )}

      {editing.kind === "new-item" && editing.categoryId === current.id && (
        <ItemEditor
          key={`new-item-${current.id}`}
          workspaceId={workspaceId}
          mode="add"
          category={current}
          initial={draftForNewItem(current)}
          onSave={(draft) => saveNewItem(current, draft)}
          onCancel={() => open({ kind: "none" })}
          saving={createItem.isPending}
          serverError={serverError}
          deniedReason={denied}
        />
      )}

      {editingItem && (
        <ItemEditor
          key={`item-${editingItem.id}`}
          workspaceId={workspaceId}
          mode="edit"
          category={current}
          item={editingItem}
          initial={draftFromItem(editingItem)}
          onSave={(draft) => saveItem(editingItem, draft)}
          onCancel={() => open({ kind: "none" })}
          saving={update.isPending && update.variables?.itemId === editingItem.id}
          serverError={serverError}
          deniedReason={denied}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
        <span className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          shape="pill"
          onClick={() => setShowWithdrawn((v) => !v)}
          aria-pressed={showWithdrawn}
          className="border-card-bd font-semibold text-muted-foreground hover:bg-hover"
        >
          {showWithdrawn ? "Hiding nothing" : "Withdrawn hidden"}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState className="p-6">
          {onlyHeldBack
            ? "Everything on this menu has its RRA codes."
            : "Nothing on this menu yet. Add its first item, with a price and its RRA codes."}
        </EmptyState>
      ) : (
        <ul
          aria-label={`${current.name} items`}
          className="grid gap-3.5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}
        >
          {items.map((item) => {
            const photo = menuItemPhoto(item.name);
            const status = STATUS[item.status];
            const editingPrice = pricing === item.id;
            // THIS item, not every item on the menu: a shared `isPending`
            // greyed the whole gallery while one price saved.
            const busy = update.isPending && update.variables?.itemId === item.id;
            const needs = item.missingRra.filter((f) => f !== "itemCode");
            return (
              <li
                key={item.id}
                className={cn(
                  "overflow-hidden rounded-card border border-card-bd bg-card",
                  item.status === "archived" && "opacity-60",
                  editing.kind === "item" && editing.id === item.id && "ring-2 ring-ring",
                )}
              >
                <MediaTile
                  photo={photo}
                  name={item.name}
                  radius={0}
                  overlay={<Badge intent={status.intent}>{status.label}</Badge>}
                />
                {/* The absence of a photograph is a fact the host should see,
                    not a grey box that reads as a loading state. */}
                {!photo && <NeedsPhoto />}

                <div className="flex flex-col gap-2 px-3 pt-2.5 pb-3">
                  <div className="text-sm font-semibold text-foreground">{item.name}</div>
                  {item.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                  )}

                  {/* What the receipt will say, or what stops it selling. */}
                  {item.missingRra.length === 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge intent={item.guestOrderable ? "ok" : "neutral"}>
                        {item.guestOrderable ? "Sells" : "Not offered to guests"}
                      </Badge>
                      <span className="pms-num text-2xs text-muted-foreground">{item.rraItemCd}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <Badge intent={item.guestOrderable ? "warn" : "neutral"}>
                        {item.guestOrderable ? "Held back: needs RRA codes" : "Needs RRA codes"}
                      </Badge>
                      <span className="text-2xs text-muted-foreground">
                        Missing {(needs.length ? needs : item.missingRra).map((f) => MISSING_WORD[f]).join(", ")}
                      </span>
                    </div>
                  )}

                  {item.options.length > 0 && (
                    <span className="text-2xs text-muted-foreground">
                      {item.options.map((o) => o.name).join(" · ")}
                    </span>
                  )}

                  {/* Wraps rather than squeezes: a price broken across two lines
                      ("RWF" over "11,000") reads as two numbers. */}
                  <div className="flex flex-wrap items-center gap-2">
                    {editingPrice ? (
                      <Input
                        autoFocus
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") savePrice(item);
                          if (e.key === "Escape") setPricing(null);
                        }}
                        inputMode="numeric"
                        aria-label={`Price for ${item.name}`}
                        className="h-9 rounded border-line2 bg-field text-sm"
                      />
                    ) : (
                      <span className="pms-num text-sm font-bold whitespace-nowrap">{fmt(item.priceRwf)}</span>
                    )}
                    <span className="flex-1" />
                    <span className="flex gap-2">
                    <ActionButton
                      deniedReason={denied}
                      pending={busy && editingPrice}
                      aria-label={editingPrice ? `Save the price of ${item.name}` : `Change the price of ${item.name}`}
                      onClick={() => {
                        if (editingPrice) {
                          savePrice(item);
                          return;
                        }
                        setPricing(item.id);
                        setPrice(String(item.priceRwf));
                      }}
                    >
                      {editingPrice ? (busy ? "Saving" : "Save") : "Price"}
                    </ActionButton>
                    <ActionButton
                      deniedReason={denied}
                      aria-label={`Edit ${item.name}`}
                      onClick={() => open({ kind: "item", id: item.id })}
                    >
                      Edit
                    </ActionButton>
                    </span>
                  </div>

                  {/*
                    Three states, not a toggle. "Off today" is the one a kitchen
                    reaches for when the fish runs out, and it is not the same
                    thing as taking the dish off the menu.
                  */}
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Availability of ${item.name}`}>
                    {(Object.keys(STATUS) as ServiceCatalogStatus[]).map((s) => {
                      const on = item.status === s;
                      const off = Boolean(denied) || busy || on;
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          shape="rounded"
                          key={s}
                          onClick={() => !off && setStatus(item, s)}
                          aria-pressed={on}
                          aria-disabled={off ? true : undefined}
                          title={denied}
                          className={cn(
                            "text-2xs font-semibold",
                            on
                              ? "border-accent-text bg-accent-soft text-accent-text hover:bg-accent-soft"
                              : "border-line2 bg-field text-muted-foreground hover:bg-hover",
                            denied && "opacity-50",
                          )}
                        >
                          {STATUS[s].label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
