/**
 * The one read path for screens: `getCollection / getCollections / getDocument("<area>.<thing>")`.
 *
 * A collection with a live source (`server/sources/<area>.ts`) is read from server/api, as the
 * signed-in person, and presented in the screen's document shape. Any other collection comes from
 * the embedded fixture store (`@injishi/db`) and is sample data: `scripts/data-coverage.mjs` counts
 * them, and the shell marks every screen that still draws one.
 *
 * API failures are not papered over with fixtures. A 401 (the session ended) sends the person to
 * sign in again; anything else surfaces as the error it is.
 */

import type { Doc } from "@injishi/data/types";
import * as fixtureStore from "@injishi/db";
import { redirect } from "next/navigation";
import { cache } from "react";
import { currentAccount, currentApi } from "@/lib/session";
import { ApiError } from "./api";
import { sourceContext } from "./sources/context";
import { liveSources } from "./sources/index";
import type { SourceContext } from "./sources/types";

/** The source context of this request (who is signed in, their API session, today in Kigali). Actions use it too. */
export const requestContext = cache(async (): Promise<SourceContext> => {
  const [api, account] = await Promise.all([currentApi(), currentAccount()]);
  return sourceContext(api, account);
});

async function live<T>(run: (ctx: SourceContext) => Promise<T>): Promise<T> {
  try {
    return await run(await requestContext());
  } catch (error) {
    if (error instanceof ApiError && error.unauthenticated) redirect("/sign-in");
    throw error;
  }
}

/** All documents of a collection, in screen order. */
export async function getCollection<T extends Doc>(collection: string): Promise<T[]> {
  const source = liveSources[collection];
  if (!source) return fixtureStore.getCollection<T>(collection);
  return live((ctx) => source.list(ctx) as Promise<T[]>);
}

/** Several collections at once, keyed by name: `const { a, b } = await getCollections({ a: "x.a", b: "x.b" })`. */
export async function getCollections<K extends string>(names: Record<K, string>): Promise<Record<K, Doc[]>> {
  const entries = await Promise.all(
    Object.entries<string>(names).map(async ([key, name]) => [key, await getCollection(name)] as const),
  );
  return Object.fromEntries(entries) as Record<K, Doc[]>;
}

/** One document by id, or undefined. */
export async function getDocument<T extends Doc>(collection: string, id: string): Promise<T | undefined> {
  const source = liveSources[collection];
  if (!source) return fixtureStore.getDocument<T>(collection, id);
  return live(async (ctx) => {
    if (source.get) return (await source.get(ctx, id)) as T | undefined;
    const all = (await source.list(ctx)) as T[];
    return all.find((d) => String(d.id) === id);
  });
}
