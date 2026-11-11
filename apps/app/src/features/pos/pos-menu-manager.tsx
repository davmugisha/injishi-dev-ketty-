"use client";

import { Archive, CircleInfo, Magnifier, Pencil, Plus } from "@gravity-ui/icons";
import { Button, Input, Label, SearchField, TextArea, TextField, ToggleButton } from "@heroui/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CatalogCategory, CatalogItem, PosCatalog, PosOutlet } from "@/server/pos";
import { createProductAction, createSectionAction, updateProductAction, updateSectionAction } from "./actions";
import { DishArt } from "./dish-art";
import { rwf } from "./format";
import { SECTION_PRESETS, type SectionKind, TAX_CHOICES } from "./menu-presets";
import { PosShell } from "./pos-shell";
import { PosDialog, parseRwf, StatusChip, useDialogKey, usePosAction, useStickyTitle } from "./shared";

const selectClass =
  "h-10 w-full rounded-lg border border-separator bg-field px-3 text-[14px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent";

type Filter = "all" | "on_sale" | "sold_out" | "archived";

type Dialog =
  | {
      kind: "product";
      id?: string;
      categoryId: string;
      name: string;
      description: string;
      price: string;
      tax: string;
      prep: string;
      track: boolean;
      stock: string;
      onSale: boolean;
      /** The stock the product has now, shown read-only on an edit (changes are counted on the Stock screen). */
      currentStock: number | null;
    }
  | { kind: "section"; id?: string; name: string; sectionKind: SectionKind; guestVisible: boolean }
  | { kind: "archive"; id: string; name: string };

const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["on_sale", "On sale"],
  ["sold_out", "Sold out"],
  ["archived", "Archived"],
];

/** What the till will do with a product, in the one word a manager needs. */
function stateOf(i: CatalogItem): {
  label: string;
  color: "success" | "warning" | "danger" | "default";
  sellable: boolean;
} {
  if (i.status === "archived") return { label: "Archived", color: "default", sellable: false };
  if (i.status === "out_of_stock" || i.stockQty === 0) return { label: "Sold out", color: "warning", sellable: false };
  if (i.missingRra.length > 0) return { label: "Not sellable yet", color: "danger", sellable: false };
  return { label: "On sale", color: "success", sellable: true };
}

/**
 * Menu management for an owner or manager (`menu.manage`): the products and sections of one outlet, through the
 * existing catalogue API. A price change never rewrites a bill already taken (an order keeps the price it was
 * placed at), and removing a product archives it, so history is kept. Product photos are not offered: the menu
 * has nowhere to store one yet, and this screen says so rather than pretend.
 */
export function PosMenuManager({
  outlets,
  outlet,
  catalog: initial,
  can,
}: {
  outlets: PosOutlet[];
  outlet: PosOutlet;
  catalog: PosCatalog;
  can: string[];
}) {
  const [catalog, setCatalog] = useState(initial);
  useEffect(() => setCatalog(initial), [initial]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const { run, pending } = usePosAction();
  const dialogName = useStickyTitle(dialogTitle(dialog));
  const dialogKey = useDialogKey(dialog ? `${dialog.kind}:${dialog.id ?? "new"}` : null);

  const sections = useMemo(
    () =>
      catalog.categories
        .filter((c) => c.outletId === outlet.id && c.status === "active")
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [catalog, outlet.id],
  );
  const counts = useMemo(() => {
    const c = { all: 0, on_sale: 0, sold_out: 0, archived: 0 };
    for (const s of sections)
      for (const i of s.items) {
        const st = stateOf(i);
        if (i.status === "archived") c.archived++;
        else {
          c.all++;
          if (st.sellable) c.on_sale++;
          else if (st.label === "Sold out") c.sold_out++;
        }
      }
    return c;
  }, [sections]);

  const q = query.trim().toLowerCase();
  const visible = (s: CatalogCategory) =>
    s.items
      .filter((i) => {
        const st = stateOf(i);
        if (filter === "archived") return i.status === "archived";
        if (i.status === "archived") return false;
        if (filter === "on_sale") return st.sellable;
        if (filter === "sold_out") return st.label === "Sold out";
        return true;
      })
      .filter((i) => !q || `${i.name} ${i.description ?? ""} ${s.name}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));

  const close = () => setDialog(null);
  const apply = (c: PosCatalog) => {
    setCatalog(c);
    close();
  };
  const patch = (i: CatalogItem, body: Parameters<typeof updateProductAction>[1], done: string) =>
    run(
      () => updateProductAction(i.id, body),
      done,
      (c) => setCatalog(c),
    );

  const openProduct = (s: CatalogCategory, i?: CatalogItem) =>
    setDialog({
      kind: "product",
      id: i?.id,
      categoryId: s.id,
      name: i?.name ?? "",
      description: i?.description ?? "",
      price: i ? String(i.priceRwf) : "",
      tax: i?.taxCode ?? s.defaultTaxCode ?? "TAX_B",
      prep: i?.prepTimeMinutes != null ? String(i.prepTimeMinutes) : "",
      track: i ? i.stockQty !== null : false,
      stock: "",
      onSale: i ? i.status === "active" : true,
      currentStock: i?.stockQty ?? null,
    });

  const price = dialog?.kind === "product" ? parseRwf(dialog.price) : null;
  const valid =
    dialog?.kind === "product"
      ? dialog.name.trim().length > 0 &&
        price !== null &&
        (dialog.id ? true : !dialog.track || /^\d+$/.test(dialog.stock))
      : dialog?.kind === "section"
        ? dialog.name.trim().length > 0
        : true;

  const submit = () => {
    if (!dialog) return;
    if (dialog.kind === "section") {
      return run(
        () =>
          dialog.id
            ? updateSectionAction(dialog.id, { name: dialog.name.trim(), guestVisible: dialog.guestVisible })
            : createSectionAction(outlet.id, {
                name: dialog.name.trim(),
                kind: dialog.sectionKind,
                guestVisible: dialog.guestVisible,
              }),
        dialog.id ? "Section saved." : "Section added.",
        apply,
      );
    }
    if (dialog.kind === "archive") {
      return run(() => updateProductAction(dialog.id, { status: "archived" }), `${dialog.name} archived.`, apply);
    }
    // Emptying the field on an existing product clears the time (0 minutes); on a new one it is simply not set.
    const prep = dialog.prep.trim() ? Number(dialog.prep) : dialog.id ? 0 : undefined;
    if (dialog.id) {
      return run(
        () =>
          updateProductAction(dialog.id as string, {
            name: dialog.name.trim(),
            description: dialog.description.trim(),
            priceRwf: price as number,
            taxCode: dialog.tax,
            ...(prep !== undefined ? { prepTimeMinutes: prep } : {}),
            status: dialog.onSale ? "active" : "out_of_stock",
          }),
        "Product saved.",
        apply,
      );
    }
    return run(
      () =>
        createProductAction({
          serviceCategoryId: dialog.categoryId,
          name: dialog.name.trim(),
          description: dialog.description.trim() || undefined,
          priceRwf: price as number,
          taxCode: dialog.tax,
          ...(prep !== undefined ? { prepTimeMinutes: prep } : {}),
          stockQty: dialog.track ? Number(dialog.stock) : null,
        }),
      "Product added.",
      apply,
    );
  };

  const noSections = sections.length === 0;

  return (
    <PosShell
      board="PosMenu"
      title="Menu and products"
      subtitle="Add, price and organise what this outlet sells"
      outlet={outlet}
      outlets={outlets}
      outletId={outlet.id}
      switchHref="/pos/menu"
      can={can}
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => setDialog({ kind: "section", name: "", sectionKind: "food", guestVisible: true })}
          >
            <Plus className="size-4" /> Add section
          </Button>
          <Button
            variant="primary"
            size="sm"
            isDisabled={noSections}
            onPress={() => sections[0] && openProduct(sections[0])}
          >
            <Plus className="size-4" /> Add product
          </Button>
        </>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6 md:px-6">
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <fieldset className="m-0 flex min-w-0 flex-wrap gap-1 border-0 p-0">
            <legend className="sr-only">Show</legend>
            {FILTERS.map(([key, label]) => (
              <ToggleButton key={key} size="sm" isSelected={filter === key} onChange={() => setFilter(key)}>
                {label} ({counts[key]})
              </ToggleButton>
            ))}
          </fieldset>
          <span className="flex-1" />
          <SearchField value={query} onChange={setQuery} aria-label="Search the menu" className="w-full sm:w-64">
            <SearchField.Group>
              <SearchField.SearchIcon>
                <Magnifier className="size-4" />
              </SearchField.SearchIcon>
              <SearchField.Input placeholder="Search the menu" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </div>

        {noSections ? (
          <div className="flex shrink-0 flex-col items-start gap-3 rounded-2xl border border-dashed border-separator bg-surface p-6">
            <h2 className="text-[16px] font-semibold">Start your menu</h2>
            <p className="max-w-xl text-[14px] text-muted">
              A menu is organised in sections such as Beer, Grill or Desserts. Add your first section, then the products
              in it. You can add more at any time.
            </p>
            <Button
              variant="primary"
              onPress={() => setDialog({ kind: "section", name: "", sectionKind: "food", guestVisible: true })}
            >
              <Plus className="size-4" /> Add your first section
            </Button>
          </div>
        ) : null}

        {sections.map((s) => {
          const rows = visible(s);
          if ((q || filter !== "all") && rows.length === 0) return null;
          return (
            <section
              key={s.id}
              aria-label={s.name}
              className="shrink-0 overflow-hidden rounded-2xl border border-separator bg-surface"
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-separator px-4 py-3">
                <h2 className="text-[15px] font-semibold">{s.name}</h2>
                <span className="text-[12px] text-muted">
                  {s.items.filter((i) => i.status !== "archived").length === 1
                    ? "1 product"
                    : `${s.items.filter((i) => i.status !== "archived").length} products`}
                </span>
                {!s.guestVisible ? <StatusChip color="default">Hidden from guests</StatusChip> : null}
                <span className="flex-1" />
                <Button size="sm" variant="ghost" onPress={() => openProduct(s)}>
                  <Plus className="size-4" /> Product
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label={`Edit section ${s.name}`}
                  onPress={() =>
                    setDialog({
                      kind: "section",
                      id: s.id,
                      name: s.name,
                      sectionKind: "food",
                      guestVisible: s.guestVisible,
                    })
                  }
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
              {rows.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-muted">No products in this section yet.</p>
              ) : (
                <ul className="divide-y divide-separator">
                  {rows.map((i) => {
                    const st = stateOf(i);
                    return (
                      <li
                        key={i.id}
                        className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_104px_200px_116px_auto]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <DishArt name={i.name} section={s.name} size="thumb" />
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold">{i.name}</p>
                            {i.description ? <p className="truncate text-[12px] text-muted">{i.description}</p> : null}
                          </div>
                        </div>
                        <p className="text-right text-[14px] font-medium tabular md:order-none">{rwf(i.priceRwf)}</p>
                        <p className="col-span-1 text-[12px] whitespace-nowrap text-muted md:text-right">
                          {i.taxCode === "TAX_A" ? "Tax exempt" : "Tax 18%"} ·{" "}
                          {i.stockQty === null ? "Stock not tracked" : `${i.stockQty} in stock`}
                        </p>
                        <div className="md:justify-self-start">
                          <StatusChip color={st.color}>{st.label}</StatusChip>
                          {st.label === "Not sellable yet" ? (
                            <p className="mt-1 text-[11px] text-danger">Missing RRA codes</p>
                          ) : null}
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-1 md:col-span-1">
                          {i.status !== "archived" && i.stockQty === 0 ? (
                            // Nothing is left, so flipping a switch would change nothing: the fix is stock, counted on its own screen.
                            <Link
                              href={`/pos/stock?outlet=${outlet.id}`}
                              className="inline-flex min-h-8 items-center rounded-lg px-3 text-[13px] font-medium text-accent-soft-foreground hover:bg-default"
                            >
                              Restock
                            </Link>
                          ) : i.status !== "archived" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              isDisabled={pending}
                              onPress={() =>
                                i.status === "out_of_stock"
                                  ? patch(i, { status: "active" }, `${i.name} is back on sale.`)
                                  : patch(i, { status: "out_of_stock" }, `${i.name} marked sold out.`)
                              }
                            >
                              {i.status === "out_of_stock" ? "Back on sale" : "Sold out"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              isDisabled={pending}
                              onPress={() => patch(i, { status: "active" }, `${i.name} restored.`)}
                            >
                              Restore
                            </Button>
                          )}
                          {/* An archived product is restored, not edited: saving the form would otherwise change its status. */}
                          {i.status !== "archived" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              isIconOnly
                              aria-label={`Edit ${i.name}`}
                              onPress={() => openProduct(s, i)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          ) : null}
                          {i.status !== "archived" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              isIconOnly
                              aria-label={`Archive ${i.name}`}
                              onPress={() => setDialog({ kind: "archive", id: i.id, name: i.name })}
                            >
                              <Archive className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}

        {!noSections && (q || filter !== "all") && sections.every((s) => visible(s).length === 0) ? (
          <p className="shrink-0 rounded-2xl border border-dashed border-separator p-6 text-[14px] text-muted">
            Nothing matches{q ? ` "${query}"` : ""}
            {filter !== "all" ? ` in "${FILTERS.find(([k]) => k === filter)?.[1]}"` : ""}.
          </p>
        ) : null}

        <p className="flex shrink-0 items-start gap-2 text-[12px] text-muted">
          <CircleInfo className="mt-0.5 size-4 shrink-0" />
          <span>
            Changing a price never changes a bill already taken. Product photos are not available yet: the menu has
            nowhere to store them. Stock is counted on the{" "}
            <Link className="text-accent-soft-foreground hover:underline" href={`/pos/stock?outlet=${outlet.id}`}>
              Stock screen
            </Link>
            .
          </span>
        </p>
      </div>

      <PosDialog
        key={dialogKey}
        isOpen={dialog !== null}
        onOpenChange={(open) => !open && close()}
        title={dialogName}
        page={dialog?.kind === "product"}
        subtitle={
          dialog?.kind === "product" ? ("id" in dialog && dialog.id ? "Recipes / Edit" : "Recipes / Create") : undefined
        }
        onEnter={dialog && dialog.kind !== "archive" && valid && !pending ? submit : undefined}
        footer={
          <>
            <Button variant="ghost" onPress={close}>
              Cancel
            </Button>
            <Button
              variant={dialog?.kind === "archive" ? "danger" : "primary"}
              isDisabled={!valid || pending}
              onPress={submit}
            >
              {dialog?.kind === "archive" ? "Archive" : dialog && "id" in dialog && dialog.id ? "Save" : "Add"}
            </Button>
          </>
        }
      >
        {dialog?.kind === "product" ? (
          <div data-ui="recipe-form" className="flex flex-col">
            <section aria-labelledby="rf-details" className="flex flex-col gap-4 border-t border-separator py-5">
              <h3 id="rf-details" className="text-[15px] font-semibold">
                Recipe details
              </h3>
              <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                <TextField
                  value={dialog.name}
                  onChange={(v) => setDialog({ ...dialog, name: v })}
                  fullWidth
                  isRequired
                  autoFocus
                >
                  <Label>Recipe name</Label>
                  <Input maxLength={160} placeholder="Type recipe name" />
                </TextField>
                {!dialog.id ? (
                  <label className="flex flex-col gap-1 text-[13px] font-medium">
                    Menu category
                    <select
                      className={selectClass}
                      value={dialog.categoryId}
                      onChange={(e) =>
                        setDialog({
                          ...dialog,
                          categoryId: e.target.value,
                          tax: sections.find((s) => s.id === e.target.value)?.defaultTaxCode ?? dialog.tax,
                        })
                      }
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="flex flex-col gap-1 text-[13px] font-medium">
                    Menu category
                    <p className="flex h-10 items-center rounded-[10px] bg-surface-secondary px-3 text-[13px] font-normal text-muted">
                      Stays in its section (archive and add again to move it)
                    </p>
                  </div>
                )}
                <TextField
                  value={dialog.price}
                  onChange={(v) => setDialog({ ...dialog, price: v.replace(/[^\d]/g, "") })}
                  fullWidth
                  isRequired
                >
                  <Label>Selling price (RWF)</Label>
                  <Input inputMode="numeric" className="tabular" placeholder="5000" />
                </TextField>
                <label className="flex flex-col gap-1 text-[13px] font-medium">
                  Tax (RRA)
                  <select
                    className={selectClass}
                    value={dialog.tax}
                    onChange={(e) => setDialog({ ...dialog, tax: e.target.value })}
                  >
                    {TAX_CHOICES.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <TextField
                  value={dialog.description}
                  onChange={(v) => setDialog({ ...dialog, description: v })}
                  fullWidth
                  className="sm:col-span-2"
                >
                  <Label>Description</Label>
                  <TextArea rows={2} maxLength={1000} placeholder="What is in it, as the guest reads it" />
                </TextField>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium">Recipe image</span>
                <div className="flex items-center gap-4">
                  <span className="size-[88px] overflow-hidden rounded-2xl [&>span]:h-full [&>span]:!aspect-auto">
                    <DishArt
                      name={dialog.name || " "}
                      section={sections.find((s) => s.id === dialog.categoryId)?.name ?? ""}
                      size="tile"
                    />
                  </span>
                  <p className="max-w-[420px] text-[12.5px] leading-[18px] text-muted">
                    {dialog.name.trim()
                      ? "Chosen from the photo library by the recipe name, and shown on the till, the menu and the receipt screens."
                      : "Type the recipe name: a matching photo from the library appears here."}{" "}
                    Uploading your own photo comes with photo storage.
                  </p>
                </div>
              </div>
            </section>

            <section aria-labelledby="rf-ingredients" className="flex flex-col gap-3 border-t border-separator py-5">
              <h3 id="rf-ingredients" className="text-[15px] font-semibold">
                Ingredients
              </h3>
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] rounded-xl bg-[var(--pos-band)] px-3 py-2.5 text-[12.5px] text-muted">
                <span>Item</span>
                <span>Net qty</span>
                <span>Unit</span>
                <span className="text-right">Cost</span>
              </div>
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <svg width="64" height="56" viewBox="0 0 64 56" aria-hidden="true">
                  <path d="M8 18 32 8l24 10v24L32 52 8 42Z" fill="#e7e5e4" />
                  <path d="M8 18 32 28l24-10M32 28v24" fill="none" stroke="#a8a29e" strokeWidth="1.5" />
                  <path d="M8 18 2 10l24-10 6 8M56 18l6-8L38 0l-6 8" fill="#d6d3d1" />
                </svg>
                <p className="text-[14px] font-semibold">No ingredients yet</p>
                <p className="max-w-[380px] text-[12.5px] text-muted">
                  Ingredient lists and plate costing arrive with recipes in the stock module. Until then the cost of
                  goods is estimated at 35% of the price.
                </p>
              </div>
            </section>

            <section aria-labelledby="rf-portion" className="flex flex-col gap-4 border-t border-separator pt-5">
              <h3 id="rf-portion" className="text-[15px] font-semibold">
                Portion and stock
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  value={dialog.prep}
                  onChange={(v) => setDialog({ ...dialog, prep: v.replace(/[^\d]/g, "") })}
                  fullWidth
                >
                  <Label>Preparation time (minutes)</Label>
                  <Input inputMode="numeric" className="tabular" placeholder="Optional" />
                </TextField>
                {!dialog.id && dialog.track ? (
                  <TextField
                    value={dialog.stock}
                    onChange={(v) => setDialog({ ...dialog, stock: v.replace(/[^\d]/g, "") })}
                    fullWidth
                    isRequired
                  >
                    <Label>Opening stock</Label>
                    <Input inputMode="numeric" className="tabular" />
                  </TextField>
                ) : null}
              </div>
              {dialog.id ? (
                <>
                  <label className="flex items-center gap-3 text-[14px]">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-checked={dialog.onSale}
                      className="pos-switch"
                      checked={dialog.onSale}
                      onChange={(e) => setDialog({ ...dialog, onSale: e.target.checked })}
                    />
                    On sale (switch off to mark it sold out)
                  </label>
                  <p className="text-[12px] text-muted">
                    {dialog.currentStock === null
                      ? "Stock is not tracked for this recipe."
                      : `${dialog.currentStock} in stock.`}{" "}
                    Counts and corrections are recorded on the Stock screen, so every change keeps its reason.
                  </p>
                </>
              ) : (
                <label className="flex items-center gap-3 text-[14px]">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-checked={dialog.track}
                    className="pos-switch"
                    checked={dialog.track}
                    onChange={(e) => setDialog({ ...dialog, track: e.target.checked })}
                  />
                  Allow this recipe to be stockable (track stock)
                </label>
              )}
            </section>
          </div>
        ) : null}
        {dialog?.kind === "section" ? (
          <>
            <TextField
              value={dialog.name}
              onChange={(v) => setDialog({ ...dialog, name: v })}
              fullWidth
              isRequired
              autoFocus
            >
              <Label>Section name</Label>
              <Input maxLength={120} placeholder="Pizzas" />
            </TextField>
            {!dialog.id ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-[13px] font-medium">What it sells</legend>
                <div className="grid gap-2">
                  {(Object.keys(SECTION_PRESETS) as SectionKind[]).map((k) => (
                    <label
                      key={k}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${dialog.sectionKind === k ? "border-accent bg-accent-soft" : "border-separator"}`}
                    >
                      <input
                        type="radio"
                        name="kind"
                        className="mt-1"
                        checked={dialog.sectionKind === k}
                        onChange={() => setDialog({ ...dialog, sectionKind: k })}
                      />
                      <span className="flex flex-col">
                        <span className="text-[14px] font-medium">{SECTION_PRESETS[k].label}</span>
                        <span className="text-[12px] text-muted">{SECTION_PRESETS[k].hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-[12px] text-muted">
                  This sets the tax rate and the RRA classification every product in the section starts with.
                </p>
              </fieldset>
            ) : null}
            <label className="flex items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                className="size-4"
                checked={dialog.guestVisible}
                onChange={(e) => setDialog({ ...dialog, guestVisible: e.target.checked })}
              />
              Show this section to guests
            </label>
          </>
        ) : null}
        {dialog?.kind === "archive" ? (
          <p className="text-[14px] text-muted">
            <span className="font-medium text-foreground">{dialog.name}</span> will leave the till and the menu. Bills
            already taken keep it, and you can restore it later from the Archived filter.
          </p>
        ) : null}
      </PosDialog>
    </PosShell>
  );
}

function dialogTitle(d: Dialog | null): string {
  if (!d) return "";
  if (d.kind === "archive") return "Archive this product?";
  if (d.kind === "section") return d.id ? "Edit section" : "Add section";
  return d.id ? "Edit recipe" : "Create recipe";
}
