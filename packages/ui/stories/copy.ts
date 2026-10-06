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

/** common.ts `nav.*` — the tab and drawer labels. */
export const NAV = {
  explore: { en: "Explore", rw: "Shakisha" }, // nav.explore
  saved: { en: "Saved", rw: "Ibyabitswe" }, // nav.saved
  trips: { en: "Trips", rw: "Ingendo" }, // nav.trips
  inbox: { en: "Messages", rw: "Ubutumwa" }, // nav.inbox
  account: { en: "Profile", rw: "Umwirondoro" }, // nav.account
  today: { en: "Today", rw: "Uyu munsi" }, // nav.today
  reservations: { en: "Reservations", rw: "Ubwandikishe" }, // nav.reservations
} as const;

/** common.ts `a11y.*` and `sheet.*` — names for controls that show only an icon. */
export const A11Y = {
  close: { en: "Close", rw: "Funga" }, // a11y.close
  closeSheet: { en: "Close this sheet", rw: "Funga iyi paji" }, // sheet.close
  save: { en: "Save this stay", rw: "Bika iyi nzu" }, // a11y.save
  openGallery: { en: "Open the photo gallery", rw: "Fungura amafoto yose" }, // a11y.openGallery
} as const;

/**
 * common.ts `calendar.*`. Months and weekdays are indexed the way `Date`
 * counts them (January is 0, Sunday is 0), so a formatter can read them
 * straight off a date.
 */
export const CALENDAR = {
  months: {
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    rw: ["Mutarama", "Gashyantare", "Werurwe", "Mata", "Gicurasi", "Kamena", "Nyakanga", "Kanama", "Nzeri", "Ukwakira", "Ugushyingo", "Ukuboza"],
  }, // calendar.m1 … calendar.m12
  weekdays: {
    en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    rw: ["Cyu", "Mbe", "Kab", "Gat", "Kan", "Gtn", "Gtd"],
  }, // calendar.d0 … calendar.d6
  prevMonth: { en: "Previous month", rw: "Ukwezi gushize" }, // calendar.prevMonth
  nextMonth: { en: "Next month", rw: "Ukwezi gutaha" }, // calendar.nextMonth
  checkIn: { en: "Check-in", rw: "Kwinjira" }, // calendar.checkIn
  checkOut: { en: "Check-out", rw: "Gusohoka" }, // calendar.checkOut
  pickStart: { en: "Pick your arrival", rw: "Hitamo umunsi wo kugera" }, // calendar.pickStart
  clear: { en: "Clear dates", rw: "Siba amatariki" }, // calendar.clear
} as const;

/** search.ts — the price filter. */
export const SEARCH = {
  priceBand: { en: "Price per night", rw: "Igiciro cy’ijoro" }, // search.priceBand
  bandAny: { en: "Any price", rw: "Igiciro icyo ari cyo cyose" }, // search.bandAny
} as const;

/**
 * account.ts — the workspace switcher and the sign-out confirmation. `{name}`
 * and `{count}` are the catalogue's own placeholders; `fill` below puts a
 * value in them the way the app's `t()` does.
 */
export const ACCOUNT = {
  switchTitle: { en: "Switch workspace", rw: "Hindura urwego" }, // switch.title
  personal: { en: "Personal", rw: "Bwite" }, // switch.personal
  business: { en: "Business", rw: "Ubucuruzi" }, // switch.business
  broker: { en: "Broker", rw: "Umuhuza" }, // switch.broker
  current: { en: "Current", rw: "Iriho" }, // switch.current
  create: { en: "Create a business workspace", rw: "Fungura urwego rw’ubucuruzi" }, // switch.create
  isolationNote: {
    en: "One identity, one login. A payout as a host, rent as a tenant and a placement fee as a broker never mix — each stays inside the workspace that earned it.",
    rw: "Umuntu umwe, kwinjira rimwe. Amafaranga nk’umucuruzi, ubukode nk’ukodesha n’ikiguzi cy’umuhuza ntibivangwa — buri kimwe gisigara mu rwego cyakivuyemo.",
  }, // switch.isolationNote
  switchNote: {
    en: "Switching keeps you on Account, the one tab every workspace has, so the tab you are standing on never disappears under you. Anything half-captured is held, not dropped.",
    rw: "Guhindura bigusigira kuri Konti, isakoshi rimwe buri rwego rufite, bityo isakoshi uhagazeho ntirizigera ribura. Ibyari byatangiye bibikwa, ntibitakara.",
  }, // switch.note
  signOut: { en: "Sign out", rw: "Sohoka" }, // account.signOut
  signOutHint: {
    en: "Asks before it signs you out of every workspace.",
    rw: "Irabanza ikakubaza mbere yo kugusohora mu nzego zose.",
  }, // account.signOutHint
  signOutTitle: { en: "Sign out?", rw: "Gusohoka?" }, // signOut.title
  signOutSubtitle: { en: "You are signed in as {name}.", rw: "Winjiye nka {name}." }, // signOut.subtitle
  signOutScope: {
    en: "This signs you out of all {count} of your workspaces, not just this one. Signing back in restores every seat.",
    rw: "Ibi bigusohora mu nzego zawe zose {count}, atari muri uru rwonyine. Kongera kwinjira bigarura buri mwanya.",
  }, // signOut.scope
  signOutSwitchInstead: {
    en: "If you only wanted to leave {name}, use Switch workspace instead — it keeps you signed in.",
    rw: "Niba washakaga gusa kuva muri {name}, koresha Hindura urwego — bigusigira winjiye.",
  }, // signOut.switchInstead
  signOutConfirm: { en: "Sign out", rw: "Sohoka" }, // signOut.confirm
  signOutCancel: { en: "Stay signed in", rw: "Guma winjiye" }, // signOut.cancel
} as const;

/** Puts values into a catalogue string's `{placeholders}`, as the app's `t()` does. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
