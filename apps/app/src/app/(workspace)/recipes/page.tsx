import { screens } from "@injishi/data";
import type { PosEvent, ProductionBatch, Recipe, RecipeIngredient } from "@injishi/data/fixtures/stock";
import { getCollection, getDocument } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecipesView } from "@/features/stock/RecipesView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.Recipes.pageTitle };

/** Tonight's planned batch on the Terrace kitchen board. */
const PLANNED_BATCH = "PB-0059";

export default async function RecipesPage() {
  await requirePersona("Recipes");
  const [recipes, ingredients, batch, events] = await Promise.all([
    getCollection<Recipe>("stock.recipes"),
    getCollection<RecipeIngredient>("stock.recipeIngredients"),
    getDocument<ProductionBatch>("stock.batches", PLANNED_BATCH),
    getCollection<PosEvent>("stock.posEvents"),
  ]);
  if (!batch || !recipes.length) notFound();
  return <RecipesView data={{ recipes, ingredients, batch, events }} />;
}
