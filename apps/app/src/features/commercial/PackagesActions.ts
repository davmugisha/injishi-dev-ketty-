"use server";

import { randomUUID } from "node:crypto";
import { screenHref } from "@injishi/data";
import type { PackagesItem } from "@injishi/data/fixtures/commercial";
import { deleteDocument, getCollection, getDocument, saveDocument } from "@injishi/db";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";

export interface PackagesDraftInput {
  name: string;
  summary: string;
  price: number;
  per: string;
}

export type PackagesDraftResult = { ok: true; id: string } | { ok: false; error: string };

/** "Sunset Kayak Escape" + 4 existing packages → "SKE-05" (same pattern as LKW-01 … HBL-04). */
function packagesCode(name: string, position: number): string {
  const letters = name
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ""))
    .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return `${letters.padEnd(3, "X")}-${String(position).padStart(2, "0")}`;
}

/** Manager starts a new package. It is saved as a draft with no components; it cannot go on sale until it has some. */
export async function createPackagesDraft(input: PackagesDraftInput): Promise<PackagesDraftResult> {
  await requirePersona("Packages");
  const name = input.name.trim();
  const summary = input.summary.trim();
  const per = input.per.trim();
  if (!name) return { ok: false, error: "Give the package a name." };
  if (!summary) return { ok: false, error: "Say what the package includes." };
  if (!Number.isFinite(input.price) || input.price <= 0) return { ok: false, error: "Set a package price." };
  if (!per) return { ok: false, error: "Choose what the price covers." };

  const existing = await getCollection<PackagesItem>("commercial.packagesItems");
  const draft: PackagesItem = {
    id: `pkg-${randomUUID().slice(0, 8)}`,
    icon: "Gift",
    name,
    code: packagesCode(name, existing.length + 1),
    status: "draft",
    price: Math.round(input.price),
    per,
    summary,
    sold: "Not on sale",
    alert: {
      tone: "danger",
      title: "Cannot go on sale yet",
      description:
        "This package has no components yet. Add each room, meal or activity it sells with its seller, tax classification and refund terms.",
    },
    facts: [
      { label: "Sell dates", value: "Not set" },
      { label: "Stay dates", value: "Not set" },
      { label: "Channels", value: "None until published" },
      { label: "Missing", value: "Components, sellers and refund terms" },
    ],
    discountFrom: "Not set until components are added",
    components: [],
  };
  await saveDocument<PackagesItem>("commercial.packagesItems", draft);
  revalidatePath(screenHref("Packages"));
  return { ok: true, id: draft.id };
}

/** Discard a draft that has no components yet (a package started with "New package" and not built). */
export async function discardPackagesDraft(id: string): Promise<void> {
  await requirePersona("Packages");
  const pkg = await getDocument<PackagesItem>("commercial.packagesItems", id);
  if (pkg?.status !== "draft" || pkg.components.length > 0) return;
  await deleteDocument("commercial.packagesItems", id);
  revalidatePath(screenHref("Packages"));
}
