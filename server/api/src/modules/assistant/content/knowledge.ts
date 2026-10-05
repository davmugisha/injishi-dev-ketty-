import { z } from 'zod';

/**
 * The assistant's knowledge base (ADR-061 D-h), seed set.
 *
 * Every entry restates something Injishi already tells people, and `source`
 * names where, so a reviewer can check the claim against the copy or the code
 * it came from. An entry that describes intended behaviour rather than shipped
 * behaviour does not belong here: the assistant would present it as fact.
 *
 * `status` gates serving: only `current` entries are searched. Mark an entry
 * `needs_review` the moment the workflow it describes changes, and move
 * `lastVerified` when someone has checked it against the product again.
 *
 * Parsed at module load by `KNOWLEDGE`, so a malformed entry fails the boot
 * and CI instead of reaching a person.
 */
export const KnowledgeArticle = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(3).max(120),
    summary: z.string().min(10).max(400),
    body: z.string().min(10).max(2000),
    tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1),
    audience: z.enum(['everyone', 'guest', 'business']),
    /** A web path that opens the fuller page, or null. */
    href: z
      .string()
      .regex(/^\/[a-z0-9/-]*$/)
      .nullable(),
    lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(['current', 'needs_review', 'retired']),
    source: z.string().min(3),
  })
  .strict();
export type KnowledgeArticle = z.infer<typeof KnowledgeArticle>;

const HOST_FAQ = 'apps/web/src/data/host.ts HOST_FAQ (published on /host)';

const ENTRIES: KnowledgeArticle[] = [
  {
    id: 'what-is-injishi',
    title: 'What Injishi is',
    summary:
      'Injishi is a Rwandan platform where guests find and book places to stay, and businesses register, list and run their property.',
    body:
      'Guests search listings and book stays. Hotels, motels, tented camps, guest houses, apartments, lodges and villas anywhere in Rwanda can register and list; bars, restaurants and residences let on a lease register on the same verification. Registered businesses run their property from the Injishi operator app.',
    tags: ['about', 'platform', 'overview', 'injishi', 'what'],
    audience: 'everyone',
    href: '/how-it-works',
    lastVerified: '2026-09-30',
    status: 'current',
    source: `${HOST_FAQ}, listing group; /how-it-works`,
  },
  {
    id: 'what-can-i-list',
    title: 'What kind of accommodation can be listed',
    summary:
      'Hotels, motels, tented camps, guest houses, apartments, lodges and villas anywhere in Rwanda, plus bars, restaurants and leased residences.',
    body:
      'If you can show you are entitled to run or let the place, it qualifies. Bars and restaurants register too, and so do residences let on a lease, on the same verification.',
    tags: ['list', 'listing', 'property', 'host', 'accommodation', 'hotel', 'register'],
    audience: 'business',
    href: '/host',
    lastVerified: '2026-09-30',
    status: 'current',
    source: HOST_FAQ,
  },
  {
    id: 'list-elsewhere',
    title: 'Listing on Injishi and on other sites',
    summary:
      'Nothing about Injishi is exclusive: you can list on other sites too and keep control of your own calendar and rates.',
    body:
      'Most hosts list in more than one place. You keep control of your own calendar and rates.',
    tags: ['list', 'listing', 'exclusive', 'other-sites', 'host', 'calendar'],
    audience: 'business',
    href: '/host',
    lastVerified: '2026-09-30',
    status: 'current',
    source: HOST_FAQ,
  },
  {
    id: 'how-long-to-go-live',
    title: 'How long until a listing is live',
    summary:
      'Usually under two weeks. The verification visit is the part that takes scheduling; photography and going live follow within a few days of it.',
    body:
      'After you register, Injishi schedules a verification visit. Photography and going live follow within a few days of the visit, so most listings are live in under two weeks.',
    tags: ['live', 'listing', 'verification', 'visit', 'how-long', 'publish', 'host'],
    audience: 'business',
    href: '/host',
    lastVerified: '2026-09-30',
    status: 'current',
    source: HOST_FAQ,
  },
  {
    id: 'accepting-bookings',
    title: 'Do hosts have to accept every booking',
    summary:
      'No. Hosts set their own availability, minimum stay and house rules, and can close dates at any time without penalty.',
    body:
      'You set your own availability, minimum stay and house rules, and you can close dates at any time without penalty.',
    tags: ['booking', 'accept', 'availability', 'close-dates', 'host', 'rules'],
    audience: 'business',
    href: '/host',
    lastVerified: '2026-09-30',
    status: 'current',
    source: HOST_FAQ,
  },
  {
    id: 'host-charges',
    title: 'What Injishi charges a host',
    summary:
      'Nothing: no commission from the host and no listing fee. The rate you set is the rate you are paid.',
    body:
      'Injishi takes no commission from the host and charges no listing fee. The rate you set is the rate you are paid.',
    tags: ['fee', 'commission', 'charge', 'cost', 'price', 'host', 'payout'],
    audience: 'business',
    href: '/host',
    lastVerified: '2026-09-30',
    status: 'current',
    source: HOST_FAQ,
  },
  {
    id: 'when-hosts-are-paid',
    title: 'When a host is paid',
    summary:
      "The guest's payment is held in escrow and released after check in; funds reach the host's account within three working days of release.",
    body:
      "The guest's payment is held in escrow and released to the host after check in. Funds reach the host's account within three working days of release. If a guest disputes a stay, Injishi reviews it before any money moves.",
    tags: ['payout', 'paid', 'payment', 'escrow', 'money', 'host', 'dispute'],
    audience: 'business',
    href: '/host',
    lastVerified: '2026-09-30',
    status: 'current',
    source: HOST_FAQ,
  },
  {
    id: 'rra-and-documents',
    title: 'RRA registration and the documents a host provides',
    summary:
      'Injishi registers the accommodation and keeps the records a compliant let requires. It asks for proof of identity and entitlement after the verification visit.',
    body:
      'Injishi registers the accommodation and keeps the records a compliant let requires, so the paperwork is in place before the first guest arrives. The documents it asks for are proof of identity and proof that you own or are entitled to let the accommodation, and it asks for them after the verification visit, not before. You remain the operator of your accommodation.',
    tags: ['rra', 'tax', 'documents', 'compliance', 'identity', 'register', 'host'],
    audience: 'business',
    href: '/host',
    lastVerified: '2026-09-30',
    status: 'current',
    source: HOST_FAQ,
  },
  {
    id: 'cannot-publish-listing',
    title: "Why a property can't be published yet",
    summary:
      'A property is published only when it has a sector, at least one active room type, a priced room type, and at least one photograph.',
    body:
      'Publishing checks four things together and reports every one that is missing: the property must have its sector (location) set; at least one room type must be active; at least one room type must have a default rate plan with a price; and at least one photograph must be attached. Fix each item it names, then publish again.',
    tags: ['publish', 'listing', 'property', 'cannot', 'error', 'photo', 'price', 'room-type', 'troubleshoot'],
    audience: 'business',
    href: null,
    lastVerified: '2026-09-30',
    status: 'current',
    source: 'server/api/src/modules/listing-setup/domain/publish-eligibility.ts',
  },
  {
    id: 'contact-support',
    title: 'How to reach Injishi support',
    summary:
      'Use the contact form on the support page. Choose a topic (booking, payment, listing or other) and leave the address you want the reply sent to.',
    body:
      'The support page has a contact form. Pick the topic that fits (booking, payment, listing or other), write what happened, and give the email address you want the answer sent to. You do not need to be signed in.',
    tags: ['support', 'contact', 'help', 'human', 'problem', 'complaint'],
    audience: 'everyone',
    href: '/support',
    lastVerified: '2026-09-30',
    status: 'current',
    source: 'packages/contracts/src/support.ts SupportTopic; /support',
  },
  {
    id: 'assistant-privacy',
    title: 'What the assistant keeps, and for how long',
    summary:
      'A conversation started signed out is kept for 7 days after its last message; one tied to an account for 90 days. Contact details and ID numbers are removed before a question reaches the AI provider.',
    body:
      'Signed out, your conversation is linked to this browser only and is deleted 7 days after its last message. Signed in, it is kept with your account and deleted 90 days after its last message. Before any question or result reaches the AI provider, email addresses, phone numbers, national ID numbers and TINs are removed.',
    tags: ['privacy', 'data', 'assistant', 'conversation', 'delete', 'retention', 'ai'],
    audience: 'everyone',
    href: null,
    lastVerified: '2026-09-30',
    status: 'current',
    source: 'ADR-061 D-d and D-g',
  },
  {
    // Added after the live walk: the signed out mobile assistant sits on the
    // sign in screen, and "I can't sign in" had no article to answer from.
    id: 'signing-in',
    title: 'Signing in, and when the code does not arrive',
    summary:
      'Injishi has no passwords: you sign in with your email address and a 6 digit code sent to it, valid for 10 minutes.',
    body:
      'Enter your email address and Injishi emails you a 6 digit code; type it in within 10 minutes. If it does not arrive, check your spam or junk folder, and check the address for a typo. A code stops working after 5 wrong tries, and one address can be sent at most 5 codes an hour and 15 a day, so if you hit the limit, wait before asking again. Business screens in the operator app ask for a second emailed code before they open. If you still cannot get in, ask for human support.',
    tags: ['sign-in', 'login', 'log-in', 'code', 'otp', 'email', 'password', 'cannot', 'access', 'account', 'arrive'],
    audience: 'everyone',
    href: '/sign-in',
    lastVerified: '2026-09-30',
    status: 'current',
    source: 'packages/auth/src/options.ts (OTP_LENGTH, OTP_EXPIRY_SECONDS, OTP_MAX_ATTEMPTS, OTP_MAX_PER_HOUR, OTP_MAX_PER_DAY); F-S01; F-S02 step up',
  },
];

/** The served knowledge base, validated at load. */
export const KNOWLEDGE: readonly KnowledgeArticle[] = Object.freeze(
  z.array(KnowledgeArticle).parse(ENTRIES),
);

const ids = new Set<string>();
for (const entry of KNOWLEDGE) {
  if (ids.has(entry.id)) throw new Error(`Duplicate knowledge id: ${entry.id}`);
  ids.add(entry.id);
}
