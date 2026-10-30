"use client";

import { BOARDS, screenHref } from "@injishi/data";
import { type PayLinks, PayProvider } from "@injishi/product-pay/web";
import type { ReactNode } from "react";

/*
 * What Pay's views may not import, handed to them by the app (ADR-074 stage 6). The views live in
 * `@injishi/product-pay`, and a product never imports an app, so every route that draws one wraps it in
 * `PayMount`: the app's route for every screen, built from the screen registry, which keeps gating access until
 * the app takes access from the server. Finance's mount (`../finance/finance-mount.tsx`) is the same with the
 * topbar pill added.
 */

const links: PayLinks = Object.fromEntries(BOARDS.map((board) => [board, screenHref(board)]));

/** Mounts a Pay view: wrap it in this on every route that draws one. */
export function PayMount({ children }: { children: ReactNode }) {
  return <PayProvider links={links}>{children}</PayProvider>;
}
