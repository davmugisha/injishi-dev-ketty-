import "server-only";

import { apiBaseUrl, apiOrigin } from "./api";

/**
 * Table QR self-service ordering (migration 0156), between a guest's phone and the API. Nobody is signed in: the
 * table's code in the address is the whole key, and the API decides everything from it (the table, the outlet, the
 * menu, every price). This file forwards and never adds a cookie or a workspace, so a guest can reach nothing a staff
 * session could. The shapes mirror `@injishi/contracts` table-order.ts, which the app does not import.
 */
export interface TableOrderMenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceRwf: number;
  taxRateBps: number;
  options: {
    name: string;
    required: boolean;
    maxChoices: number;
    choices: { label: string; priceDeltaRwf: number }[];
  }[];
  photo: string | null;
  left: number | null;
}

export interface TableOrderMenu {
  outletName: string;
  tableLabel: string;
  areaName: string;
  taxMode: "exclusive" | "inclusive";
  currency: "RWF";
  acceptingOrders: boolean;
  notice: string | null;
  categories: { id: string; name: string }[];
  items: TableOrderMenuItem[];
}

export interface TableOrderStatus {
  orderNumber: string;
  tableLabel: string;
  stage: "received" | "preparing" | "ready" | "served" | "cancelled";
  taxMode: "exclusive" | "inclusive";
  taxRwf: number;
  totalRwf: number;
  placedAt: string;
  lines: { name: string; quantity: number; totalRwf: number }[];
}

/** The shape of a table's code. Anything else is answered as an unknown table, without asking the API. */
export const TABLE_CODE = /^[A-Za-z0-9_-]{24,64}$/;
const CLIENT_KEY = /^[A-Za-z0-9-]{16,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const base = (code: string) => `${apiBaseUrl()}/api/v1/table-order/${encodeURIComponent(code)}`;

/** The guest's address, passed on so the API's limits count each phone (honoured where the API trusts this app). */
function forwardedFor(request?: Request): Record<string, string> {
  const ip = request?.headers.get("x-forwarded-for") ?? request?.headers.get("x-real-ip");
  return ip ? { "x-forwarded-for": ip } : {};
}

export type TableMenuRead = { state: "open"; menu: TableOrderMenu } | { state: "missing" } | { state: "down" };

/** The table's menu, for the page. A wrong, old or replaced code is `missing`; an outage is `down`. */
export async function readTableMenu(code: string): Promise<TableMenuRead> {
  if (!TABLE_CODE.test(code)) return { state: "missing" };
  try {
    const res = await fetch(base(code), {
      headers: { accept: "application/json", origin: apiOrigin() },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 404 || res.status === 400) return { state: "missing" };
    if (!res.ok) return { state: "down" };
    return { state: "open", menu: (await res.json()) as TableOrderMenu };
  } catch {
    return { state: "down" };
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/** POST the guest's cart on to the API, unread: it validates, prices and places it. */
export async function forwardTableOrder(request: Request, code: string): Promise<Response> {
  if (!TABLE_CODE.test(code)) return json(404, { message: "This QR code is not linked to a table." });
  const body = await request.text();
  if (body.length > 64_000) return json(413, { message: "That order is too large." });
  try {
    const res = await fetch(`${base(code)}/orders`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: apiOrigin(),
        ...forwardedFor(request),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
    });
  } catch {
    return json(503, {
      message:
        "The restaurant could not be reached. Check your connection and send again: you will not be charged twice.",
    });
  }
}

/** The progress of the order this phone sent, by the key it made. */
export async function forwardTableOrderStatus(request: Request, code: string, key: string): Promise<Response> {
  if (!TABLE_CODE.test(code) || !CLIENT_KEY.test(key)) return json(404, { message: "That order was not found." });
  try {
    const res = await fetch(`${base(code)}/orders/${encodeURIComponent(key)}`, {
      headers: { accept: "application/json", origin: apiOrigin(), ...forwardedFor(request) },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
    });
  } catch {
    return json(503, { message: "The restaurant could not be reached." });
  }
}

/** The uploaded photo of an item on this table's menu, as a JPEG. */
export async function forwardTablePhoto(request: Request, code: string, itemId: string): Promise<Response> {
  if (!TABLE_CODE.test(code) || !UUID.test(itemId)) return new Response(null, { status: 404 });
  try {
    const res = await fetch(`${base(code)}/photos/${itemId}`, {
      headers: { accept: "image/jpeg", origin: apiOrigin(), ...forwardedFor(request) },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return new Response(null, { status: 404 });
    return new Response(await res.arrayBuffer(), {
      status: 200,
      headers: {
        "content-type": "image/jpeg",
        // The address carries the photo's version (`?v=`), so a copy never goes stale.
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
