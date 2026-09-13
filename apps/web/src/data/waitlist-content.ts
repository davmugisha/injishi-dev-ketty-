/**
 * Every string the waitlist surface renders (ADR-048 copy.md).
 *
 * It is a data file rather than prose inside components for one reason worth
 * stating: this copy was WRITTEN, in the decision record, and `/develop`
 * implements it rather than inventing it. Keeping it in one place is what lets
 * the next person check the page against `copy.md` line by line, and what makes
 * launch day's deletion a single file rather than a hunt through markup.
 *
 * TWO RULES HOLD OVER EVERY STRING HERE and neither is decoration:
 *
 * 1. NO DATE, month, quarter or year appears anywhere. Not on the page, not in
 *    the email, not in the metadata. A date is the one value on a pre-launch
 *    page that can expire into a lie, and nothing in this system knows one.
 * 2. ENGLISH ONLY. Rwandan language support is not in v1. Every label slot is
 *    tolerant of a longer string, so adding it later is a translation job and
 *    not a layout job.
 */

export const WAITLIST_META = {
  title: "Injishi · Stay anywhere in Rwanda",
  description:
    "Injishi is a new way to find and book places to stay across Rwanda, and a new way for property owners to fill them. Join the waitlist and we will email you the day it opens.",
  ogTitle: "Injishi · Stay anywhere in Rwanda",
  ogDescription:
    "A new way to find and book places to stay across Rwanda. Join the waitlist.",
} as const;

/**
 * The hero (the 2026-09-13 redesign after suspense.framer.website).
 *
 * THE OWNER ASKED FOR FEWER WORDS, and this is what that cut to. The long
 * subhead, the form heading and the step one question are gone; the two
 * audiences are a switch above the form rather than a screen of their own.
 *
 * `preview` is the floating card over the photographs. It is an ILLUSTRATION
 * of the product, rendered `aria-hidden`, and it carries no price and no count
 * on purpose: rule 1 above applies to a picture of a number as much as to the
 * number.
 */
export const WAITLIST_HERO = {
  eyebrow: "Coming soon to Rwanda",
  headline: "Stay anywhere in Rwanda.",
  subhead: "Hotels, guest houses and homes. One place to find them.",
  proof: "Starting in Kigali",
  photoPlace: "Karongi",
  preview: { title: "Booking confirmed", detail: "Karongi · 2 nights" },
  image: "/waitlist/hero.jpg",
} as const;

export const WAITLIST_AUDIENCE_CHOICES = [
  { value: "traveller", label: "I'm travelling" },
  { value: "owner", label: "I have a property" },
] as const;

/**
 * The labels are real `<label>`s, visually hidden: the placeholder says the
 * same thing on screen, but a placeholder is not a name a screen reader can
 * rely on and it disappears the moment somebody types.
 */
export const WAITLIST_FORM = {
  audienceLegend: "Which are you?",
  submitLabel: "Join the waitlist",
  fields: {
    fullName: { label: "Your name" },
    email: { label: "Email address" },
    phone: { label: "Phone number" },
    businessName: { label: "Property name" },
    district: {
      label: "District",
      loading: "Loading districts…",
      failed: "Could not load districts. Open this list again to retry.",
    },
    propertyType: { label: "Type" },
    sizeBand: { label: "Rooms" },
  },
  consentLead: "We only email you about the launch. See our ",
  consentLinkLabel: "privacy notice",
  consentTrail: ".",
  marketingOptIn: "Also send me updates and offers.",
  errors: {
    email: "Enter an email address we can reach you on.",
    name: "Enter your name.",
    // The string `packages/contracts/src/phone.ts` already carries, repeated
    // here so the field can say it before a round trip rather than after.
    ownerPhone: "Enter a Rwandan mobile number, like 0788 123 456.",
    requiredOwnerField: "Add your property details so we can reach you.",
    throttled: "That is a few too many tries. Give it an hour and try again.",
    failed: "We could not save that just now. Try again in a moment.",
  },
  done: {
    joinedHeading: "You are on the list.",
    // `{email}` is substituted at render. It is the one value on this screen
    // that comes from the person rather than from this file.
    joinedBody: "We will email {email} the day we open.",
    alreadyHeading: "You are already on the list.",
    alreadyBody: "That address joined earlier. We will email it the day we open.",
  },
} as const;

/**
 * The two audience cards. A tag, a title, three short lines. The paragraphs
 * each point used to carry are the words the redesign cut.
 */
export const WAITLIST_AUDIENCES = [
  {
    tag: "For travellers",
    title: "Find somewhere to stay.",
    image: "/waitlist/traveller.jpg",
    points: [
      "All thirty districts",
      "Prices with tax included",
      "Confirmed, with a receipt",
    ],
  },
  {
    tag: "For property owners",
    title: "Fill your rooms.",
    image: "/waitlist/owner.jpg",
    points: [
      "Reach travellers today",
      "Front desk on your phone",
      "Paperwork handled",
    ],
  },
] as const;

export const WAITLIST_AUDIENCES_BAND = {
  heading: "Both sides of the stay.",
  aside: "One platform, two doors in.",
} as const;

/**
 * The districts teaser.
 *
 * Each tile is a NAME AND AN IMAGE ONLY. No counts, no numbers, nothing that
 * can go stale: a "12 properties" tile is wrong the moment the thirteenth
 * property signs up, and nobody would notice for weeks.
 */
export const WAITLIST_DISTRICTS_BAND = {
  heading: "Kigali first. Then everywhere.",
  aside: "District by district.",
  tiles: [
    { name: "Gasabo", image: "/waitlist/districts/gasabo.jpg" },
    { name: "Kicukiro", image: "/waitlist/districts/kicukiro.jpg" },
    { name: "Nyarugenge", image: "/waitlist/districts/nyarugenge.jpg" },
    { name: "Musanze", image: "/waitlist/districts/musanze.jpg" },
    { name: "Rubavu", image: "/waitlist/districts/rubavu.jpg" },
    { name: "Rusizi", image: "/waitlist/districts/rusizi.jpg" },
  ],
} as const;

export const WAITLIST_FAQ_BAND = {
  heading: "Questions",
  aside: "Short answers.",
} as const;

export const WAITLIST_FAQ = [
  {
    question: "What is Injishi?",
    answer: "One place to find, book and run stays across Rwanda.",
  },
  {
    question: "When does it open?",
    answer: "Soon. We will email you the day it does.",
  },
  {
    question: "Is it free to join?",
    answer: "Yes. Just your name and email.",
  },
  {
    question: "How do I leave the list?",
    answer: "Every email has a one-click unsubscribe.",
  },
] as const;

/**
 * The closing band. Its button returns to the form in the hero rather than
 * carrying a second form: two forms on one page is two places for a field to
 * drift, and the hero is one tap away.
 */
export const WAITLIST_CLOSING = {
  heading: "Be first in line.",
  body: "We will email you the day we open.",
  button: "Join the waitlist",
} as const;

/**
 * The footer while the gate is up (copy.md §8).
 *
 * `Sign in` IS NOT OPTIONAL AND IS NOT DECORATION. It is the only route a pilot
 * operator or a staff member has back into the product from this domain, and
 * without it the gate locks out exactly the people the allowlist was written to
 * keep letting in. A stranger clicking it reaches a sign-in screen and nothing
 * else, which costs nothing.
 *
 * Every destination here is on `WAITLIST_OPEN_PREFIXES` in `middleware.ts`. No
 * link on this page may lead anywhere that redirects back to it (AC-19).
 */
export const WAITLIST_FOOTER_LINKS = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Contact", href: "/support" },
  { label: "Sign in", href: "/sign-in" },
] as const;

export const WAITLIST_FOOTER_LINE = "Made in Rwanda";

export const WAITLIST_UNSUBSCRIBE = {
  heading: "Leave the waitlist?",
  body: "We will stop emailing you about Injishi.",
  button: "Yes, remove me",
  doneHeading: "Done.",
  doneBodyLead:
    "You will not hear from us about Injishi again. If that was a mistake, you are welcome to ",
  doneBodyLinkLabel: "join again",
  doneBodyTrail: ".",
  failed: "We could not reach the server just now. Try that once more.",
} as const;
