/**
 * Real product copy for the stories, English beside Kinyarwanda.
 *
 * ui-rules.md: "Layout survives label-length variance (EN/RW) with no
 * truncation." Storybook is the cheapest place to keep checking that, so every
 * long-content story renders the Kinyarwanda string, which is the longer of the
 * two in almost every pair below.
 *
 * Every string is COPIED from `apps/mobile/src/i18n/messages/*.ts`, the one
 * translated catalogue in the repo, under the key named beside it. They are not
 * translated here, and none may be: a package cannot import from an app, so
 * this is a copy, and a copy that invents a word is a lie a reviewer trusts.
 * When web grows its own catalogue (Paraglide, ui-rules.md § i18n), point this
 * file at it instead.
 */
export const COPY = {
  // auth.ts
  continue: { en: "Continue", rw: "Komeza" }, // auth.continue
  google: { en: "Sign in with Google", rw: "Injira ukoresheje Google" }, // auth.google
  activate: {
    en: "Activate and review lease",
    rw: "Emeza hanyuma usome amasezerano",
  }, // auth.activateAction
  // book.ts
  confirmAndPay: { en: "Confirm and pay", rw: "Emeza wishyure" }, // book.confirmAndPay
  continueToPay: { en: "Continue to pay", rw: "Komeza wishyure" }, // book.continueToPay
  // account.ts
  sendInvite: { en: "Send invitation", rw: "Ohereza ubutumire" }, // staff.inviteSend
  // common.ts
  retry: { en: "Try again", rw: "Ongera ugerageze" }, // state.retry
} as const;

/** common.ts `status.*` — the labels mobile's StatusBadge prints. */
export const STATUS = {
  "booking.pending_approval": { en: "Pending approval", rw: "Bitegereje kwemezwa" },
  "booking.confirmed": { en: "Confirmed", rw: "Byemejwe" },
  "booking.declined": { en: "Declined", rw: "Byanzwe" },
  "booking.cancelled": { en: "Cancelled", rw: "Byahagaritswe" },
  "booking.no_show": { en: "No-show", rw: "Ntiyaje" },
  "lease.draft": { en: "Draft", rw: "Umushinga" },
  "lease.pending_signature": { en: "Pending signature", rw: "Bitegereje umukono" },
  "lease.active": { en: "Active", rw: "Arakora" },
  "lease.ending": { en: "Ending", rw: "Arangira" },
  "lease.ended": { en: "Ended", rw: "Yarangiye" },
  "rent.paid": { en: "Paid", rw: "Bwishyuwe" },
  "rent.due": { en: "Due", rw: "Bugomba kwishyurwa" },
  "rent.overdue": { en: "Overdue", rw: "Bwarengeje igihe" },
  "identity.verified": { en: "Verified", rw: "Byemejwe" },
  "identity.unverified": { en: "Unverified", rw: "Bitaremezwa" },
} as const;

export type StatusKey = keyof typeof STATUS;
