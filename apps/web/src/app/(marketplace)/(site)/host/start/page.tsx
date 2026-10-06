import { redirect } from "next/navigation";
import { findHostKind, hostKindHref } from "@/data/host";

/**
 * `/host/start` is no longer a page. It answers with a redirect into
 * registration, carrying the kind, so the links that still name it keep working
 * (the footer's "Become a host", anything bookmarked or shared).
 *
 * It was the step between the `/host` chooser and `/register`: it named the
 * choice back, previewed the wizard's step rail, said a fee applied, and offered
 * one button, "Register your business". That button was the only way on, so
 * the page cost every registrant a screen and decided nothing. What it said
 * that was worth keeping now lives on `/host` itself: the step overview in
 * "How a listing goes live", and the fee and the monthly plan beside the
 * chooser and in "What it costs to list".
 *
 * THE FILE STAYS, AND THAT IS LOAD BEARING. `next.config.ts` forwards every
 * `/host/*` path that web has no page for to the operator app (`afterFiles`,
 * ADR-044 D-b). Deleting this file would send `/host/start` to the operator
 * app's shim, an operator login, instead of to registration.
 *
 * The kind is checked against the chooser's own list (`findHostKind`), the
 * same check this page always made, so `?kind=castle` lands on `/register`
 * with nothing chosen rather than carrying junk into the sign in round trip.
 * `redirect`, not `permanentRedirect`: a 308 is cached by the browser for
 * good, and whether this path ever becomes a page again is not this change's
 * to decide.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string | string[] }>;
}) {
  const { kind } = await searchParams;
  const chosen = findHostKind(typeof kind === "string" ? kind : null);
  redirect(chosen ? hostKindHref(chosen.value) : "/register");
}
