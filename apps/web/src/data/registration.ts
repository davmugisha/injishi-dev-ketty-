import {
  BrokerRegistrationSummary,
  type CreateBrokerRegistrationRequest,
  type CreateRegistrationRequest,
  MyProfile,
  type PersonalDetails,
  RegistrationFeeQuote,
  RegistrationSummary,
  type RegistrationBusinessType,
} from "@injishi/contracts";

import {
  registrationFeeFor,
  type RegistrationFee,
  type RegistrationFeeOverrides,
} from "@/data/registration-fees";
import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * The web client for business registration — `/api/v1/me/profile` and
 * `/api/v1/registrations/*` (F-S03 / FL01).
 *
 * Every response is parsed against the contract the API validated it with, so
 * the two ends refuse the same shape for the same reason. The wizard also
 * validates its INPUT against those contracts before sending, which is an
 * affordance and never the control: the server checks again, and the database
 * checks after that.
 */

/** The caller's own Step 1 answers, or an empty profile for a new account. */
export async function fetchMyProfile(): Promise<ApiResult<MyProfile>> {
  const res = await apiFetch<unknown>("/api/v1/me/profile");
  if (res.status !== "ok") return res;
  const parsed = MyProfile.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

/** Save Step 1 on its own — the edit path for someone who already registered. */
export async function saveMyProfile(
  details: PersonalDetails,
): Promise<ApiResult<MyProfile>> {
  const res = await apiFetch<unknown>("/api/v1/me/profile", {
    method: "PUT",
    body: details,
  });
  if (res.status !== "ok") return res;
  const parsed = MyProfile.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

/**
 * What this kind of registration costs right now.
 *
 * Public on purpose — a price nobody can see before signing in is a price
 * nobody trusts — so this is asked before the wizard has an identity.
 */
export async function fetchRegistrationFee(
  businessType: RegistrationBusinessType,
): Promise<ApiResult<RegistrationFeeQuote>> {
  const res = await apiFetch<unknown>(
    `/api/v1/registrations/fee?businessType=${businessType}`,
  );
  if (res.status !== "ok") return res;
  const parsed = RegistrationFeeQuote.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

/** Where the figure on the pay step came from, in order of authority. */
export type RegistrationFeeSource = "invoice" | "quote" | "configured" | "none";

export interface ResolvedRegistrationFee {
  /** What to print. Null only when nothing anywhere could name an amount. */
  amountRwf: number | null;
  source: RegistrationFeeSource;
  /**
   * The configured row this landed on — the schedule the console edits.
   * Present whenever the accommodation type is known, even when the server
   * answered, because the screen still names the type it is quoting for.
   */
  configured: RegistrationFee | null;
}

/**
 * The one place the pay step's figure is decided, and the order is the point.
 *
 * 1. **The invoice.** Once a registration exists the amount is LOCKED onto it
 *    (D8), so the bill is the only figure worth showing — a quote fetched
 *    before it was raised is allowed to differ and showing that difference is
 *    how a registrant is told one price and charged another.
 * 2. **The server's quote.** `fetchRegistrationFee` reads `registration_fees`,
 *    which is the real price list. When the API answers, it wins over anything
 *    this app carries.
 * 3. **The configured schedule** in `data/registration-fees.ts` — the demo's
 *    admin-set, per-accommodation-type fee. This is a FALLBACK and never an
 *    override: it is what a demo laptop with no API quotes, so the wizard
 *    always names a price instead of stopping on an em dash and a "we couldn't
 *    load the fee" refusal that a stakeholder reads as a broken screen.
 *
 * THE ORDER OF 2 AND 3 WAS TRIED THE OTHER WAY ROUND AND PUT BACK. The case for
 * swapping them is real: the quote endpoint is keyed by BUSINESS TYPE and there
 * are only three of those (`hospitality`, `residence`, `broker`), it answers a
 * flat RWF 5,000 to all three, and it therefore cannot express what a hotel pays
 * against what a guest house pays — which is the whole of the per-accommodation
 * -type feature. Putting the schedule first does make that feature visible: the
 * review step then reads "RWF 250,000, the Hotel rate".
 *
 * It also breaks D8, and that is decisive. Walking the wizard to the end with
 * the schedule first quotes RWF 250,000 on the review step and then, the moment
 * `POST /registrations` raises the real bill, the same screen's button reads
 * "Pay RWF 5,000". Being told one price and charged another is the exact defect
 * rule 1 exists to prevent, and a demo that does it in front of a stakeholder is
 * worse than a demo where the per-type schedule is quieter. Verified in a
 * browser on 2026-09-09, both orderings.
 *
 * So the per-type schedule is demonstrated on the admin console screen that
 * edits it, and in the wizard on a machine where the API is not answering. If
 * the API ever prices by accommodation type, this note and the fallback can go.
 *
 * The caller passes the overrides it read from the cookie rather than this
 * reading them, so the function stays pure and hydration-safe — see
 * `registrationFeeFor`.
 */
export function resolveRegistrationFee({
  summary,
  quote,
  accommodationType,
  overrides,
}: {
  summary: RegistrationSummary | null;
  quote: RegistrationFeeQuote | null;
  accommodationType: string | null;
  overrides?: RegistrationFeeOverrides;
}): ResolvedRegistrationFee {
  const configured = registrationFeeFor(accommodationType, overrides ?? {});
  // `amountDueRwf` is set only while the registration is `pending_payment`, so
  // a summary can exist and still name no amount — a resubmitted registration
  // is past its bill and is never shown a second one (D23). That case falls
  // through to the quote rather than blanking the figure, which is what the
  // `??` chain this replaced already did and what the Pay button label needs.
  if (summary !== null && summary.amountDueRwf !== null)
    return { amountRwf: summary.amountDueRwf, source: "invoice", configured };
  if (quote !== null)
    return { amountRwf: quote.amountRwf, source: "quote", configured };
  if (configured !== null)
    return { amountRwf: configured.amountRwf, source: "configured", configured };
  return { amountRwf: null, source: "none", configured: null };
}

/** Create the registration at `pending_payment`, with its bill (D23). */
export async function createRegistration(
  request: CreateRegistrationRequest,
): Promise<ApiResult<RegistrationSummary>> {
  return summaryCall("/api/v1/registrations", "POST", request);
}

/**
 * Settle the registration fee, which is what enqueues the RRA check.
 *
 * Stands in for the payment provider callback until F-S08 lands a real one, so
 * this is the whole "pay" step today. It is idempotent server-side: pressing it
 * twice advances nothing twice and bills nothing twice.
 */
export async function payRegistrationFee(
  orgId: string,
): Promise<ApiResult<RegistrationSummary>> {
  return summaryCall(`/api/v1/registrations/${orgId}/pay`, "POST");
}

/** Where this registration got to — what the pending workspace renders. */
export async function fetchRegistration(
  orgId: string,
): Promise<ApiResult<RegistrationSummary>> {
  return summaryCall(`/api/v1/registrations/${orgId}`, "GET");
}

/**
 * Correct a rejection and go round again.
 *
 * Lands on `submitted`, never back on `pending_payment`: the fee is charged once
 * per org ever and is non-refundable (D23), so a corrected registration must
 * never be shown a second bill.
 */
export async function resubmitRegistration(
  orgId: string,
): Promise<ApiResult<RegistrationSummary>> {
  return summaryCall(`/api/v1/registrations/${orgId}/resubmit`, "POST");
}

async function summaryCall(
  path: string,
  method: string,
  body?: unknown,
): Promise<ApiResult<RegistrationSummary>> {
  const res = await apiFetch<unknown>(path, { method, body });
  if (res.status !== "ok") return res;
  const parsed = RegistrationSummary.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

/**
 * Register the caller as a broker (F-R09, ADR-026 assumption 2).
 *
 * Its own function rather than a branch of `createRegistration`, because it
 * returns a different thing. A broker has no org, no invoice and no
 * registration status, so `RegistrationSummary` could only describe one by
 * nulling six fields and showing a status it can never hold.
 *
 * There is no pay companion. Broker registration is free and instant while
 * ADR-026 assumption 2 stands.
 */
export async function registerAsBroker(
  request: CreateBrokerRegistrationRequest,
): Promise<ApiResult<BrokerRegistrationSummary>> {
  const res = await apiFetch<unknown>("/api/v1/registrations/broker", {
    method: "POST",
    body: request,
  });
  if (res.status !== "ok") return res;
  const parsed = BrokerRegistrationSummary.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}
