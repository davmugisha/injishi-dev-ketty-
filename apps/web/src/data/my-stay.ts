import {
  ClaimStayResult,
  GuestOfferList,
  MyStays,
  OpenDepartmentResult,
  RedeemOfferResult,
  StayDepartments,
  StayRefundQuote,
  StayRefundRequestList,
  StayRefundRequestView,
  type GuestOffer,
  type MyStay,
  type OpenDepartmentRequest,
  type RaiseStayRefundRequest,
  type StayDepartment,
  type StayRefundReason,
} from "@injishi/contracts";
import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * THE IN-HOUSE GUEST'S OWN SURFACE — the web client for `/api/v1/me/stays*`
 * (§6.8).
 *
 * `/stay` has shipped since ADR-016 reading its whole world out of
 * `localStorage`: the room, the property, the orders, all of it fiction written
 * by a demo control on the same screen. That was honest while no endpoint could
 * answer "which stay am I in", and it is not honest now. These calls are the
 * replacement.
 *
 * Every answer is validated against the contract's own schema and a response
 * that does not match is reported as `failed` rather than rendered. Half a
 * stay is worse than an honest "we couldn't load this" — and on this screen
 * half a stay means a room number that might be somebody else's.
 */

/** Every stay on this account, newest arrival first. */
export async function fetchMyStays(): Promise<ApiResult<MyStay[]>> {
  const result = await apiFetch<unknown>("/api/v1/me/stays");
  if (result.status !== "ok") return result;

  const parsed = MyStays.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };
  return { status: "ok", data: parsed.data.stays };
}

/**
 * The one they are in right now.
 *
 * A person can hold several open stays — two rooms on one booking, two hotels
 * on one trip — so this picks the most recent arrival rather than asserting
 * there is only one. `/stay` shows that one and says so; the full list is what
 * `/trips` is for.
 */
export function currentStay(stays: MyStay[]): MyStay | null {
  const open = stays.filter((stay) => stay.lifecycle === "open");
  if (open.length === 0) return null;
  return open.reduce((newest, stay) =>
    stay.entryAt > newest.entryAt ? stay : newest,
  );
}

/**
 * Bind a desk-registered stay to this account.
 *
 * The code is the whole credential: there is no stay id in the request, because
 * a body that could name the stay it wanted would be a body that could ask for
 * a stay it holds no code for.
 *
 * A wrong code, a spent code and a code for somebody else's stay all come back
 * as the same refusal, which is deliberate on the server: telling a caller
 * "that one was already claimed" confirms a real code.
 */
export async function claimStay(
  code: string,
): Promise<ApiResult<ClaimStayResult>> {
  const result = await apiFetch<unknown>("/api/v1/me/stays/claim", {
    method: "POST",
    body: { code: code.trim().toUpperCase() },
  });
  if (result.status !== "ok") return result;

  const parsed = ClaimStayResult.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };
  return { status: "ok", data: parsed.data };
}

/** The desks at this stay's property that take messages from guests. */
export async function fetchStayDepartments(
  stayId: string,
): Promise<ApiResult<StayDepartment[]>> {
  const result = await apiFetch<unknown>(
    `/api/v1/me/stays/${encodeURIComponent(stayId)}/departments`,
  );
  if (result.status !== "ok") return result;

  const parsed = StayDepartments.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };
  return { status: "ok", data: parsed.data.departments };
}

/**
 * Say something to one desk, opening the conversation if it is the first time.
 *
 * One call. The thread and the first message are written together on the
 * server, because a thread with nothing in it is a row the desk reads as a
 * guest who wanted something and did not say what.
 */
export async function openDepartmentRequest(
  stayId: string,
  body: OpenDepartmentRequest,
): Promise<ApiResult<OpenDepartmentResult>> {
  const result = await apiFetch<unknown>(
    `/api/v1/me/stays/${encodeURIComponent(stayId)}/requests`,
    { method: "POST", body },
  );
  if (result.status !== "ok") return result;

  const parsed = OpenDepartmentResult.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };
  return { status: "ok", data: parsed.data };
}

/**
 * What the rules of the accommodation would allow, before anything is sent.
 *
 * Asked of the SERVER rather than worked out here, even though the function
 * that decides it ships in `@injishi/contracts` and this app could call it. The
 * inputs are what matter — the locked tier, the nights already slept, what was
 * actually paid — and none of them is on this screen. A number computed from
 * what a browser happens to know is a number the property's queue will
 * contradict.
 */
export async function fetchRefundQuote(
  stayId: string,
  reason: StayRefundReason,
): Promise<ApiResult<StayRefundQuote>> {
  const result = await apiFetch<unknown>(
    `/api/v1/me/stays/${encodeURIComponent(stayId)}/refund-quote?reason=${encodeURIComponent(reason)}`,
  );
  if (result.status !== "ok") return result;

  const parsed = StayRefundQuote.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };
  return { status: "ok", data: parsed.data };
}

/** Ask for money back. The property answers, and a refusal names its rule. */
export async function raiseRefundRequest(
  stayId: string,
  body: RaiseStayRefundRequest,
): Promise<ApiResult<StayRefundRequestView>> {
  const result = await apiFetch<unknown>(
    `/api/v1/me/stays/${encodeURIComponent(stayId)}/refund-requests`,
    { method: "POST", body },
  );
  if (result.status !== "ok") return result;

  const parsed = StayRefundRequestView.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };
  return { status: "ok", data: parsed.data };
}

/** Everything this person has ever asked for, and how each was answered. */
export async function fetchMyRefundRequests(): Promise<
  ApiResult<StayRefundRequestView[]>
> {
  const result = await apiFetch<unknown>("/api/v1/me/stays/refund-requests");
  if (result.status !== "ok") return result;

  const parsed = StayRefundRequestList.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };
  return { status: "ok", data: parsed.data.requests };
}

/** Change your mind about one nobody has answered yet. */
export async function withdrawRefundRequest(
  requestId: string,
): Promise<ApiResult<StayRefundRequestView>> {
  const result = await apiFetch<unknown>(
    `/api/v1/me/stays/refund-requests/${encodeURIComponent(requestId)}/withdraw`,
    { method: "POST", body: {} },
  );
  if (result.status !== "ok") return result;

  const parsed = StayRefundRequestView.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };
  return { status: "ok", data: parsed.data };
}

/**
 * What this guest could take off this bill right now.
 *
 * Each card arrives with its own verdict and, when it is refused, the sentence
 * that says why. The client never decides eligibility: the conditions are the
 * property's prices, and a condition enforced in a browser is a condition
 * anybody can decline.
 */
export async function fetchStayOffers(
  stayId: string,
  code?: string,
): Promise<ApiResult<GuestOffer[]>> {
  const query = code ? `?code=${encodeURIComponent(code)}` : "";
  const result = await apiFetch<unknown>(
    `/api/v1/me/stays/${encodeURIComponent(stayId)}/offers${query}`,
  );
  if (result.status !== "ok") return result;

  const parsed = GuestOfferList.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };
  return { status: "ok", data: parsed.data.offers };
}

/** Take one. The credit posts to the bill as a negative discount line. */
export async function redeemOffer(
  stayId: string,
  offerId: string,
  code?: string,
): Promise<ApiResult<RedeemOfferResult>> {
  const result = await apiFetch<unknown>(
    `/api/v1/me/stays/${encodeURIComponent(stayId)}/offers/${encodeURIComponent(offerId)}/redeem`,
    { method: "POST", body: code ? { code } : {} },
  );
  if (result.status !== "ok") return result;

  const parsed = RedeemOfferResult.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };
  return { status: "ok", data: parsed.data };
}
