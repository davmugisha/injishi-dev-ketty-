"use client";

/**
 * The owner's own bar and restaurant catalogue, listed and priced by them.
 *
 * This is the demo half of the Menu lens (see `screens/menu.tsx` for why there
 * are two). It reads `pms/data/dining.ts` — the same catalogue, field for
 * field, that the guest app's room-service menu reads — through the overlay in
 * `menu-store.ts`, so a price typed here is the price a guest is quoted.
 *
 * WHY THE OUTLET IS ON EVERY ROW AND IN EVERY HEADING. The rule the whole
 * feature exists to demonstrate is that a product belongs to an OUTLET, an
 * outlet belongs to a PROPERTY, and a property's products are shown to that
 * property's guests and to nobody else's. An owner who cannot see which card a
 * dish is on cannot tell whether the rule is working, so the answer is repeated
 * rather than inferred: a rail across the top, a heading per outlet, and the
 * property named on each of them.
 *
 * OFF TODAY IS NOT OFF THE MENU, and the two controls are worded apart on
 * purpose. A kitchen that has run out of tilapia wants it back tomorrow; a
 * property that has stopped serving it wants it gone. One button for both is
 * how a dish disappears for a season because the fish did not come in.
 */

import { Button } from "@injishi/ui";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

import {
  type DiningProduct,
  outletsForProperty,
  productsForProperty,
  unavailableOnly,
} from "../../data/dining";
import { useCapability } from "../../data/capability";
import { fmt } from "../../lib/format";
import { usePms } from "../../store";
import { ActionButton, Badge, EmptyState, SectionHeading, StatCard, surfaceClass } from "../ui";
import { DemoNotice } from "./demo-notice";
import {
  type ProductDraft,
  addProduct,
  categoryOptions,
  groupByCategory,
  removeProduct,
  restoreProduct,
  setProductAvailable,
  updateProduct,
} from "./menu-store";
import { ProductEditor } from "./product-editor";
import { marketplaceName } from "./property-name";
import { useDemoPropertySlug, useDiningGuard, useMenu } from "./store-hooks";

const OUTLET_KIND: Record<string, string> = {
  bar: "Bar",
  restaurant: "Restaurant",
  cafe: "Café",
};

/** What the editor opens with when nothing is being edited yet. */
function blankDraft(outletSlug: string, category: string): ProductDraft {
  return {
    name: "",
    outletSlug,
    category,
    priceRwf: 0,
    description: "",
    available: true,
  };
}

function draftOf(product: DiningProduct): ProductDraft {
  return {
    name: product.name,
    outletSlug: product.outletSlug,
    category: product.category,
    priceRwf: product.priceRwf,
    description: product.description,
    available: product.available,
  };
}

export function MenuManager() {
  const { toast } = usePms();
  const { reasonFor } = useCapability();
  const guard = useDiningGuard();
  const propertySlug = useDemoPropertySlug();
  const products = useMenu(propertySlug);

  const [outletFilter, setOutletFilter] = useState<string>("all");
  /**
   * Which form is open: the add form, one product's edit form, or neither.
   *
   * Two fields rather than one slug with a `"new"` sentinel, because a product
   * an owner names "New" slugs to exactly that and would have opened both.
   */
  const [adding, setAdding] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  const outlets = useMemo(
    () => (propertySlug === null ? [] : outletsForProperty(propertySlug)),
    [propertySlug],
  );
  const categories = useMemo(() => categoryOptions(products), [products]);
  /* What the shipped catalogue carries. Derived from the fixture rather than
     read back out of the overlay, because an overlay read during render does
     not happen on the server and would break hydration. */
  const fixture = useMemo(
    () => (propertySlug === null ? [] : productsForProperty(propertySlug)),
    [propertySlug],
  );
  const shipped = useMemo(() => new Set(fixture.map((p) => p.slug)), [fixture]);
  /* Shipped products currently off the menu. Derived by SUBTRACTION rather than
     read from the overlay, for the same hydration reason — and it means the two
     lists can never disagree about where a product is. */
  const takenOff = useMemo(
    () => fixture.filter((p) => !products.some((q) => q.slug === p.slug)),
    [fixture, products],
  );

  const denied = reasonFor("menu.manage");
  const offToday = unavailableOnly(products);

  if (propertySlug === null || outlets.length === 0) {
    return (
      <EmptyState className="p-6">
        This workspace runs no bar or restaurant, so there is no catalogue to price. A
        property gets one the moment it opens an outlet.
      </EmptyState>
    );
  }

  const propertyName = marketplaceName(propertySlug);
  const shown =
    outletFilter === "all" ? outlets : outlets.filter((outlet) => outlet.slug === outletFilter);

  function openAdd() {
    if (!guard("menu.manage")) return;
    setEditingSlug(null);
    setAdding(true);
  }

  function openEdit(slug: string) {
    if (!guard("menu.manage")) return;
    setAdding(false);
    setEditingSlug(slug);
  }

  function shut() {
    setAdding(false);
    setEditingSlug(null);
  }

  function saveNew(draft: ProductDraft) {
    if (propertySlug === null || !guard("menu.manage")) return;
    const product = addProduct(propertySlug, draft);
    shut();
    setOutletFilter(product.outletSlug);
    toast(`${product.name} is on the menu at ${fmt(product.priceRwf)}`, "ok");
  }

  function saveEdit(slug: string, draft: ProductDraft) {
    if (propertySlug === null || !guard("menu.manage")) return;
    const product = updateProduct(propertySlug, slug, draft);
    shut();
    if (product) toast(`${product.name} — saved at ${fmt(product.priceRwf)}`, "ok");
  }

  function toggle(product: DiningProduct) {
    if (propertySlug === null || !guard("menu.manage")) return;
    setProductAvailable(propertySlug, product.slug, !product.available);
    toast(
      product.available
        ? `${product.name} is off today. It stays on the card and a guest cannot order it.`
        : `${product.name} is back on. Guests can order it again.`,
      product.available ? "info" : "ok",
    );
  }

  function putBack(product: DiningProduct) {
    if (propertySlug === null || !guard("menu.manage")) return;
    restoreProduct(propertySlug, product.slug);
    toast(`${product.name} is back on the ${product.category.toLowerCase()} card.`, "ok");
  }

  function drop(product: DiningProduct) {
    if (propertySlug === null || !guard("menu.manage")) return;
    removeProduct(propertySlug, product.slug);
    if (editingSlug === product.slug) shut();
    toast(
      `${product.name} is off the menu. Orders already placed keep the name and price they were placed at.`,
      "info",
    );
  }

  return (
    <div className="pms-enter flex flex-col gap-4">
      <DemoNotice>
        Demo data. Every outlet, dish and price below is invented for this demonstration and
        must not be quoted as something this property charges. This workspace manages the
        catalogue listed in the marketplace as <strong>{propertyName}</strong>, so a guest
        checked in there — and only there — sees exactly these cards in their room.
      </DemoNotice>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatCard n={String(products.length)} label="Products on the card" />
        <StatCard n={String(outlets.length)} label="Outlets you run" />
        <StatCard n={String(offToday.length)} label="Off the menu today" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[{ slug: "all", name: "All outlets" }, ...outlets].map((outlet) => {
          const on = outletFilter === outlet.slug;
          return (
            <Button
              key={outlet.slug}
              variant="outline"
              size="sm"
              shape="pill"
              onClick={() => setOutletFilter(outlet.slug)}
              aria-pressed={on}
              className={cn(
                "font-semibold",
                on
                  ? "border-accent-text bg-accent-soft text-accent-text hover:bg-accent-soft"
                  : "border-card-bd text-ink2 hover:bg-hover",
              )}
            >
              {outlet.name}
            </Button>
          );
        })}
        <span className="flex-1" />
        <ActionButton
          variant="primary"
          deniedReason={denied}
          onClick={openAdd}
        >
          Add a product
        </ActionButton>
      </div>

      {adding && (
        <ProductEditor
          mode="add"
          outlets={outlets}
          categories={categories}
          initial={blankDraft(
            outletFilter === "all" ? outlets[0].slug : outletFilter,
            categories[0] ?? "",
          )}
          onSave={saveNew}
          onCancel={shut}
          deniedReason={denied}
        />
      )}

      {shown.map((outlet) => {
        const mine = products.filter((product) => product.outletSlug === outlet.slug);
        return (
          <section key={outlet.slug} className="flex flex-col gap-2.5">
            <div className={cn(surfaceClass, "flex flex-col gap-1.5 p-4")}>
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-base font-bold text-foreground">{outlet.name}</h3>
                <Badge intent="neutral">{OUTLET_KIND[outlet.kind] ?? outlet.kind}</Badge>
                <Badge intent="accent">{propertyName}</Badge>
                <span className="flex-1" />
                <span className="pms-num text-2xs text-faint">{outlet.hours}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{outlet.blurb}</p>
              <p className="text-2xs text-ink2">
                This outlet belongs to {propertyName}. Its {mine.length} products are offered
                to that property&apos;s checked-in guests and to nobody else&apos;s.
              </p>
            </div>

            {mine.length === 0 ? (
              <EmptyState className="p-5">
                Nothing on this card yet. Add a product and it appears in the room of every
                guest checked in at {propertyName}.
              </EmptyState>
            ) : (
              groupByCategory(mine).map((group) => (
                <div key={group.category} className="flex flex-col gap-2">
                  <SectionHeading n={group.products.length}>{group.category}</SectionHeading>
                  <div className={cn(surfaceClass, "flex flex-col")}>
                    {group.products.map((product, index) => (
                      <div
                        key={product.slug}
                        className={cn(
                          "flex flex-col gap-2 px-4 py-3",
                          index > 0 && "border-t border-line",
                          !product.available && "opacity-70",
                        )}
                      >
                        {editingSlug === product.slug ? (
                          <ProductEditor
                            mode="edit"
                            outlets={outlets}
                            categories={categories}
                            initial={draftOf(product)}
                            onSave={(draft) => saveEdit(product.slug, draft)}
                            onCancel={shut}
                            deniedReason={denied}
                          />
                        ) : (
                          <>
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                {product.name}
                              </span>
                              {product.available ? (
                                <Badge intent="ok">On the menu</Badge>
                              ) : (
                                <Badge intent="warn">Off today</Badge>
                              )}
                              {!shipped.has(product.slug) && (
                                <Badge intent="info">Added by you</Badge>
                              )}
                              <span className="flex-1" />
                              <span className="pms-num text-sm font-bold text-foreground">
                                {fmt(product.priceRwf)}
                              </span>
                            </div>
                            {product.description && (
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                {product.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-2xs text-faint">
                                {outlet.name} · {product.category}
                              </span>
                              <span className="flex-1" />
                              <ActionButton
                                deniedReason={denied}
                                onClick={() => openEdit(product.slug)}
                              >
                                Edit
                              </ActionButton>
                              <ActionButton deniedReason={denied} onClick={() => toggle(product)}>
                                {product.available ? "Off today" : "Back on"}
                              </ActionButton>
                              <ActionButton deniedReason={denied} onClick={() => drop(product)}>
                                Take off the menu
                              </ActionButton>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        );
      })}

      {takenOff.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionHeading n={takenOff.length}>Taken off the menu</SectionHeading>
          {/*
            Listed rather than forgotten. Removing is meant to be a decision an
            owner makes about the season, not one they discover was permanent —
            and during a demo it is the action most likely to be pressed to see
            what happens. Only a shipped product can come back; one the operator
            invented is deleted outright and has nothing left to restore.
          */}
          <div className={cn(surfaceClass, "flex flex-col")}>
            {takenOff.map((product, index) => (
              <div
                key={product.slug}
                className={cn(
                  "flex flex-wrap items-baseline gap-2 px-4 py-3",
                  index > 0 && "border-t border-line",
                )}
              >
                <span className="text-sm font-semibold text-muted-foreground line-through">
                  {product.name}
                </span>
                <span className="text-2xs text-faint">{product.category}</span>
                <span className="flex-1" />
                <span className="pms-num text-sm text-muted-foreground">
                  {fmt(product.priceRwf)}
                </span>
                <ActionButton deniedReason={denied} onClick={() => putBack(product)}>
                  Put it back
                </ActionButton>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
