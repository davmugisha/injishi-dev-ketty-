/**
 * Promotion slots, as fixture data.
 *
 * ADR-022 defers the real Promotions module: one authored record, three slots,
 * dates enforced at render. Until that exists these bands still have to render
 * something, so the copy lives HERE rather than inline in three components.
 * One place to edit, one place to delete when the module lands.
 *
 * Every claim below is product-true and carries no number: no percentage, no
 * count, no "was" price. A discount printed from a fixture is a promise the
 * platform cannot keep the day it expires, and nothing here can expire into a
 * lie. The module is what earns the right to quote a figure.
 *
 * A slot set to `null` renders nothing at all. The band disappears rather than
 * showing an empty frame, which is the rule ADR-022 records.
 */

export interface Promotion {
  /** Small chip above the claim. */
  tag: string;
  headline: string;
  body: string;
  ctaLabel: string;
  href: string;
}

/**
 * Slot 1 — the full-width bar directly under the hero. Empty: it claimed
 * "seven nights below the nightly rate", and no rate or rule anywhere backs
 * that (2026-10-29). A promotion comes back when the API serves one.
 */
export const PROMO_BAR: Promotion | null = null;

