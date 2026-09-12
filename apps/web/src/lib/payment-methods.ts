/**
 * What the paywall may offer, in the order it offers it.
 *
 * ## Why the order is data and not markup
 *
 * Rwanda pays by handset. MTN MoMo and Airtel Money are the rails a guest
 * actually holds; a card is the exception, not the default. So the two mobile
 * money rails come first and the card comes last, and that order lives HERE,
 * in one array, rather than in the JSX of the step that renders it. A list
 * written out again in a component is a list that gets re-ordered by whoever
 * edits the component next, and nothing would fail.
 *
 * `step-payment-method.tsx` maps this array and never sorts it.
 *
 * ## What this file is not
 *
 * It holds no secrets, talks to no provider, and tokenises nothing. Every check
 * here is the cheap local one that stops a guest submitting a number with a
 * typo in it. The real answer always comes from the provider through the API's
 * `PaymentPort` (F-S08, ADR-020). Nothing in this file may ever be treated as
 * authorisation.
 *
 * ## What changed (ADR-047)
 *
 * Two things, and both were the same mistake in different clothes.
 *
 * The PREFIX TABLE moved to `@injishi/contracts`. One fact about the Rwandan
 * numbering plan was written out in this file, again in
 * `apps/mobile/src/screens/guest/book-format.ts`, and implicitly a third time
 * wherever the API would have decided which rail to push at. The API now
 * validates the instrument against the same constant this form checks, so a
 * form can no longer accept a number the server will refuse.
 *
 * The CARD FORM is gone. It collected a PAN, a CVV and a full billing address
 * into this app's own DOM for a value the wire had nowhere to carry — and it
 * could never have shipped as written, because the card branch of
 * `PaymentInstrument` takes a provider TOKEN and the moment a real card number
 * crossed this boundary the whole web origin would be in PCI scope. The row
 * stays in the registry, marked unavailable, so a guest sees the rail is coming
 * rather than wondering why it is missing.
 *
 * The captured reference also offered PayPal, Google Pay and Apple Pay. None of
 * the three settles into a Rwandan franc account today, so offering them would
 * be three more buttons that cannot take money.
 */

import {
  NETWORK_PREFIXES,
  networkForMsisdn,
  type MobileMoneyNetwork,
  type PaymentInstrument,
} from "@injishi/contracts";

/* --------------------------------------------------------------- registry */

export type PaymentMethodId = MobileMoneyNetwork | "card";

export type PaymentMethodKind = "mobile_money" | "card";

export interface PaymentMethodMeta {
  id: PaymentMethodId;
  /** The name on the row, as a guest would say it out loud. */
  label: string;
  /** The quiet second line under the label. */
  hint: string;
  kind: PaymentMethodKind;
  /**
   * Whether this rail can actually take money today.
   *
   * A method that is offered and cannot charge is exactly the defect the header
   * above warns about: a button that cannot take money. Card is `false` until a
   * provider hosted field exists to return a token.
   */
  available: boolean;
  /**
   * The MSISDN prefixes this network owns, after the +250 country code.
   *
   * Present for a mobile money rail and absent for a card. They are what lets
   * the form say "that is an Airtel number" instead of failing at the provider
   * thirty seconds later, which is the single most common mis-entry on a
   * two-network market.
   */
  prefixes?: readonly string[];
}

/**
 * The offer, in order. MTN MoMo, then Airtel Money, then card.
 *
 * `as const` so the order is part of the type, not a runtime accident.
 */
export const PAYMENT_METHODS: readonly PaymentMethodMeta[] = [
  {
    id: "mtn_momo",
    label: "MTN MoMo",
    hint: "Approve the prompt on your handset",
    kind: "mobile_money",
    available: true,
    prefixes: NETWORK_PREFIXES.mtn_momo,
  },
  {
    id: "airtel_money",
    label: "Airtel Money",
    hint: "Approve the prompt on your handset",
    kind: "mobile_money",
    available: true,
    prefixes: NETWORK_PREFIXES.airtel_money,
  },
  {
    id: "card",
    label: "Credit or debit card",
    hint: "Not open yet. We are certifying a card processor that settles in Rwandan francs.",
    kind: "card",
    available: false,
  },
] as const;

export const DEFAULT_PAYMENT_METHOD: PaymentMethodId = PAYMENT_METHODS[0].id;

export function paymentMethod(id: PaymentMethodId): PaymentMethodMeta {
  const found = PAYMENT_METHODS.find((method) => method.id === id);
  // The id is a union, so this cannot happen — but a registry row deleted
  // without its id is worth failing loudly rather than rendering an empty row.
  if (!found) throw new Error(`unknown payment method: ${id}`);
  return found;
}

/* ----------------------------------------------------------------- drafts */

/**
 * Everything the payment step is holding.
 *
 * `phone` survives a change of rail on purpose: a guest who types a number,
 * looks at the other row, and comes back must find it still there.
 */
export interface PaymentDraft {
  method: PaymentMethodId;
  /** The handset, as typed. Normalised only when it is read. */
  phone: string;
}

export const EMPTY_PAYMENT_DRAFT: PaymentDraft = {
  method: DEFAULT_PAYMENT_METHOD,
  phone: "",
};

/* ------------------------------------------------------------- validation */

/** One refusal, or nothing. `null` means the field is acceptable so far. */
export type FieldProblem = string | null;

/**
 * A Rwandan handset, reduced to its nine national digits.
 *
 * Accepts every shape a guest types it in: `0788123456`, `788123456`,
 * `+250 788 123 456`, `250788123456`. Returns null when it is not nine digits
 * after that, which is the only shape the two networks issue.
 */
export function normaliseMsisdn(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const national = digits.startsWith("250")
    ? digits.slice(3)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  return /^\d{9}$/.test(national) ? national : null;
}

/** `078 812 3456`, the grouping the networks print on their own bills. */
export function formatMsisdn(national: string): string {
  return `0${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
}

/**
 * The number as typed, grouped as it goes: `078 812 3456`.
 *
 * Unlike `formatMsisdn` this works on a PARTIAL number, so the field can group
 * while the guest is still typing rather than snapping into shape at the ninth
 * digit. A leading `+250` or `250` is kept as the guest wrote it — rewriting
 * someone's country code under their cursor is the kind of "help" that makes a
 * field feel broken.
 */
export function groupHandset(input: string): string {
  const trimmed = input.trimStart();
  const intl = /^(\+?250)/.exec(trimmed);
  const prefix = intl ? intl[1] : "";
  const rest = trimmed.slice(prefix.length).replace(/\D/g, "");

  const national = prefix ? rest.slice(0, 9) : rest.slice(0, 10);
  const groups = prefix
    ? [national.slice(0, 3), national.slice(3, 6), national.slice(6, 9)]
    : [national.slice(0, 3), national.slice(3, 6), national.slice(6, 10)];

  const body = groups.filter(Boolean).join(" ");
  return prefix ? `${prefix} ${body}`.trimEnd() : body;
}

/**
 * Is this handset on the network the guest picked?
 *
 * Answering it here rather than at the provider is what stops the commonest
 * error on a two-network market: an Airtel number typed into the MTN row,
 * which the provider refuses with a message about the account, not the number.
 */
export function validateMobileNumber(
  id: PaymentMethodId,
  input: string,
): FieldProblem {
  const method = paymentMethod(id);
  if (!method.prefixes) return null;

  if (input.trim() === "") return "Enter the number that holds the money.";

  const national = normaliseMsisdn(input);
  if (!national) {
    return "A Rwandan mobile number is nine digits, like 0788 123 456.";
  }

  // `networkForMsisdn` is the contract's, so "which network owns this prefix"
  // is answered identically here and in the API.
  const owner = networkForMsisdn(national);
  if (owner !== id) {
    const other = owner ? paymentMethod(owner) : undefined;
    return other
      ? `That is ${other.label.startsWith("A") ? "an" : "a"} ${other.label} number. Pick ${other.label} above, or enter your ${method.label} number.`
      : `${method.label} numbers start ${method.prefixes.join(" or ")}.`;
  }

  return null;
}

/** Is the whole draft complete enough to move past the payment step? */
export function paymentDraftProblem(draft: PaymentDraft): FieldProblem {
  const method = paymentMethod(draft.method);
  if (!method.available) {
    return `${method.label} is not open yet. Pick MTN MoMo or Airtel Money.`;
  }
  return validateMobileNumber(draft.method, draft.phone);
}

/**
 * The draft, as the wire wants it (ADR-047).
 *
 * This is the function that closes the gap the whole paywall had: it collected
 * a handset, validated it, and then sent a body with nowhere to put it. The
 * number is normalised to its nine national digits here, because that is what
 * `NationalMsisdn` accepts and what the rails address; the shape a guest typed
 * it in is a presentation detail that stops at this boundary.
 *
 * Returns null when there is no chargeable instrument — an unavailable rail, or
 * a number that is not yet nine digits. The caller must refuse the press rather
 * than send a booking nobody can be charged for.
 */
export function toInstrument(draft: PaymentDraft): PaymentInstrument | null {
  const method = paymentMethod(draft.method);
  if (!method.available || method.kind !== "mobile_money") return null;

  const national = normaliseMsisdn(draft.phone);
  if (!national) return null;

  return {
    kind: "mobile_money",
    network: draft.method as MobileMoneyNetwork,
    msisdn: national,
  };
}

/**
 * Where the caret belongs after a value has been reformatted.
 *
 * A field whose `value` is a formatted string rebuilds that string on every
 * keystroke, and React then restores the caret to the END of it. Correcting a
 * digit in the middle of a number therefore threw the cursor to the end and the
 * guest had to click back — every time.
 *
 * The fix does not track the separators. It counts how many SIGNIFICANT
 * characters sit to the left of the caret in the raw text, then walks the
 * formatted text until it has passed that many. Grouping can change shape
 * underneath it and the caret still lands after the same digit it was after
 * before.
 */
export function caretAfterFormat(
  formatted: string,
  rawCaret: number,
  raw: string,
  isSignificant: (ch: string) => boolean = (ch) => /\d/.test(ch),
): number {
  let significantBefore = 0;
  for (let i = 0; i < rawCaret && i < raw.length; i += 1) {
    if (isSignificant(raw[i])) significantBefore += 1;
  }
  if (significantBefore === 0) return 0;

  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (isSignificant(formatted[i])) {
      seen += 1;
      if (seen === significantBefore) return i + 1;
    }
  }
  return formatted.length;
}

/* -------------------------------------------------------------- summaries */

/**
 * The one line the collapsed payment step shows.
 *
 * A handset is shown in the grouping its own network prints, so the guest can
 * check it at a glance against the phone in their hand.
 */
export function describePaymentMethod(draft: PaymentDraft): string {
  const method = paymentMethod(draft.method);
  if (method.kind !== "mobile_money") return method.label;

  const national = normaliseMsisdn(draft.phone);
  return national ? `${method.label} · ${formatMsisdn(national)}` : method.label;
}
