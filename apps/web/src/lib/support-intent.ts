import type { SupportTopic } from "@injishi/contracts";

/**
 * Why a visitor was sent to `/support` from somewhere else on the site, so the
 * contact form opens already pointed at it.
 *
 * The URL carries a slug from this closed set, never the words themselves: a
 * link that prefilled the form from free text in the query string would let
 * anyone craft an injishi.com URL that puts their sentence in a stranger's
 * message box. Each intent maps to a ticket topic the API already accepts, so
 * none of this needs a new route. They are leads, not support, and land in the
 * support inbox only because that is the one intake the API has today.
 */
export const SUPPORT_INTENTS = {
  /** A guest asking to hear when stays open where they want to go. */
  opening: {
    topic: "other",
    message: "Please tell me when stays open in: ",
  },
  /** An owner who wants a person to call before they register. */
  hosting: {
    topic: "listing",
    message: "I would like a call about listing my place. Where it is, and a good time to call: ",
  },
} as const satisfies Record<string, { topic: SupportTopic; message: string }>;

export type SupportIntent = keyof typeof SUPPORT_INTENTS;

/** The intent a `?intent=` value names, or `null` for anything else. */
export function supportIntent(value: unknown): SupportIntent | null {
  return typeof value === "string" && Object.hasOwn(SUPPORT_INTENTS, value)
    ? (value as SupportIntent)
    : null;
}

/** `/support` opened on an intent, scrolled to the form. */
export function supportHref(intent: SupportIntent): string {
  return `/support?intent=${intent}#contact`;
}
