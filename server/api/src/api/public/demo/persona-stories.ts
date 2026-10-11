import type { DemoStory } from '@injishi/contracts';

/**
 * The demo guide's words for each persona, keyed by the local part of the
 * seeded email (`denise` for `denise@demo.injishi.com`).
 *
 * Lives beside the roster route rather than in a client so the web picker, the
 * `/demo` guide, the operator app's guide panel and mobile all read one copy.
 * Every step must point at something the demo seed holds; the anchors are
 * checked by `scripts/verify-demo-story.mjs`.
 *
 * Rules the copy keeps, so it stays true on stage:
 *
 * - A step promises only what an anchor in `verify-demo-story.mjs` guarantees
 *   ("guests due out today with a bill to settle"), never a row a seed may
 *   rename ("the guest in room 204"). The few references named outright
 *   (`BK-DEMO-001` to `005`) are rows `seed-demo.mjs` has always written.
 * - A step links only to a screen that role can open. Screen access in the
 *   operator app is the grant's permissions (`navFor` in `apps/app`), so a
 *   receptionist is never sent to Rooms or Finance except to show the refusal.
 * - No step points at a placeholder lens (Finance Payouts, Tax invoices, the
 *   landlord's Rent ledger, Settings Policies and Plan) or at the broker
 *   screens, which still read fixtures.
 * - The operator app is served under the web origin, so its hrefs are paths
 *   (`/w/<workspaceId>/...`, `/oversight/...`). The admin console lives on its
 *   own host and is linked absolutely.
 */

/**
 * Amahoro Hospitality Group: Yves, Solange, Denise, Beatha, and the two office
 * roles of ADR-069, Grace (finance) and Diane (hr), seeded by
 * `scripts/seed-ui2/00-personas.mjs`.
 */
const AMAHORO = '/w/de300000-0000-4000-8000-000000000201';
/** Green Hills Properties (Ingoro Apartments): Josephine. */
const GREEN_HILLS = '/w/de300000-0000-4000-8000-000000000202';
/** Samuel's own businesses, `SW(1)` and `SW(2)` in `seed-demo.mjs`. */
const KAYITARE_COURT = '/w/de300000-0000-4000-8000-000000001301';
const KIVU_CREST = '/w/de300000-0000-4000-8000-000000001302';

const VERIFIER = '/oversight/verifier';
const APPROVER = '/oversight/approver';
const ADMIN = 'https://admin-demo.injishi.com';

const STORIES: Readonly<Record<string, DemoStory>> = {
  yves: {
    headline: 'Owner of Amahoro Boutique Hotel',
    summary:
      'You own a 20-room hotel in Kigali, with smaller branches in Musanze and Rubavu, and you are not at the desk every day. Instead of phoning the manager for last night\'s occupancy or reading a cash book at month end, you open one screen and see today\'s arrivals, who is in house, what each department earned and who works for you.',
    tryThis: [
      {
        title: 'Read today at a glance',
        detail:
          'Today shows the guests arriving, the guests due out with a bill still to settle, and the booking requests waiting for someone to say yes.',
        href: `${AMAHORO}/today`,
      },
      {
        title: 'See how full the hotel is',
        detail:
          'Room status lists every room across your branches: the head office\'s 20 in Kigali and the branch rooms, which are occupied tonight and which are clean, dirty or inspected.',
        href: `${AMAHORO}/rooms`,
      },
      {
        title: 'Check what each department earned',
        detail:
          'Finance, Revenue: this month\'s takings per department, net of anything voided. Costs are not recorded yet, so it stops at revenue.',
        href: `${AMAHORO}/finance/revenue`,
      },
      {
        title: 'See who works here, and which departments you run',
        detail:
          'Team & Departments lists your staff with their roles, and the departments every charge and order routes through. The roster stays yours — your manager runs the hotel but does not decide who is on the staff.',
        href: `${AMAHORO}/people`,
      },
      {
        title: 'Decide what each role may do',
        detail:
          'Roles starts from the access Injishi gives each role and lets you change it. You have already granted your front desk "view money", and taken "refund a signed receipt" away from your manager. Managing the team is the one thing you cannot hand to anybody else.',
        href: `${AMAHORO}/people/roles`,
      },
      {
        title: 'See the hotel the way a guest does',
        detail:
          'Your public page on the marketplace, where travellers find the hotel and send a booking request.',
        href: '/property/amahoro-boutique-hotel',
      },
    ],
  },

  solange: {
    headline: 'Manager at Amahoro Boutique Hotel',
    summary:
      'You run the hotel day to day: rooms, cleaning, repairs, the restaurant and the bills. Work that used to live in a paper register, a WhatsApp group with the housekeepers and a notebook of broken things is on one board, and everyone on the team sees the same state.',
    tryThis: [
      {
        title: 'Plan the cleaning',
        detail:
          'Housekeeping lists today\'s cleaning tasks by status, and who each one is assigned to. Beatha, the housekeeper, holds several of them.',
        href: `${AMAHORO}/housekeeping`,
      },
      {
        title: 'Follow the repairs',
        detail:
          'Maintenance holds open tickets at different stages. Move one forward and add the note the next person needs.',
        href: `${AMAHORO}/maintenance`,
      },
      {
        title: 'Watch the restaurant and room service',
        detail:
          'Services shows live orders from more than one outlet, including at least one charged to a guest\'s room bill rather than paid on the spot.',
        href: `${AMAHORO}/services`,
      },
      {
        title: 'Check the bills',
        detail:
          'Finance lists every guest bill, open and closed. Open one to see each charge and payment on it.',
        href: `${AMAHORO}/finance`,
      },
      {
        title: 'Edit the menu',
        detail:
          'The menu is grouped into categories with prices in RWF. A manager can change an item; a receptionist can only read it.',
        href: `${AMAHORO}/services/menu`,
      },
    ],
  },

  denise: {
    headline: 'Front desk at Amahoro Boutique Hotel',
    summary:
      'You run the front desk. Instead of a paper arrivals list, a phone full of booking messages and a calculator at checkout, you approve requests, give arriving guests a room, answer guests and settle bills from one place. You see what the desk needs and nothing else: no revenue, no staff list.',
    tryThis: [
      {
        title: 'Check out today\'s departures',
        detail:
          'Today lists the guests due out, each with a bill that still has money owed. Take the payment and check the guest out.',
        href: `${AMAHORO}/today`,
      },
      {
        title: 'Approve a booking request',
        detail:
          'Reservations holds requests waiting for approval. BK-DEMO-002 arrives today, so approve or decline it before the guest turns up.',
        href: `${AMAHORO}/reservations`,
      },
      {
        title: 'Give an arriving guest a room',
        detail:
          'The calendar shows the next two weeks room by room. Some of today\'s arrivals already have a room; at least one still needs one.',
        href: `${AMAHORO}/calendar`,
      },
      {
        title: 'Answer guests',
        detail:
          'Inbox holds the live conversations with guests: early check-in questions, requests from rooms, changes of plan.',
        href: `${AMAHORO}/inbox`,
      },
      {
        title: 'Try to open Finance',
        detail:
          'You are refused. A receptionist holds no money permission, so Finance is not in the menu and typing its address does not open it.',
        href: `${AMAHORO}/finance`,
      },
    ],
  },

  // Keyed `grace.uwera`, not `grace`: `grace@demo.injishi.com` is Grace
  // Kwizera, the guest with no ID on file, further down.
  'grace.uwera': {
    headline: 'Accountant at Amahoro Hospitality Group',
    summary:
      'You keep the books for the whole group: the head office in Kigali and the branches in Musanze and Rubavu. Instead of collecting the desk\'s cash book and a pile of receipts at the end of the month and typing them into a spreadsheet, you see every guest bill as it is written and every payment as it is taken, with the bookings they came from. You see the money and nothing else: no staff files, no guest messages, no cleaning board.',
    tryThis: [
      {
        title: 'Start the day on Finance',
        detail:
          'Finance is the first screen you see: every guest bill, open and closed, with what is still owed on each. Open one to read every charge and payment on it.',
        href: `${AMAHORO}/finance`,
      },
      {
        title: 'Take a payment on a departing guest\'s bill',
        detail:
          'Every guest due out today has an open bill with money still owed. Open one and record what the guest pays, by mobile money, card or cash; the balance falls as you post it.',
        href: `${AMAHORO}/finance`,
      },
      {
        title: 'See the bookings behind the bills',
        detail:
          'Reservations lists every booking with its dates and price, so a bill can be traced to the stay it came from. Approving requests and moving guests between rooms stay with the front desk: you read them, you do not change them.',
        href: `${AMAHORO}/reservations`,
      },
      {
        title: 'Try to open People',
        detail:
          'You are refused. An accountant holds no staff permission, so People is not in the menu and typing its address does not open it. Diane in HR drafts the pay run and Yves confirms it.',
        href: `${AMAHORO}/people`,
      },
    ],
  },

  'diane.ingabire': {
    headline: 'HR officer at Amahoro Hospitality Group',
    summary:
      'You look after the people who work across the group\'s hotels in Kigali, Musanze and Rubavu, and you head its Human Resources department. Staff files, the roster, attendance, leave and the monthly pay run used to live in a binder, a WhatsApp group and the accountant\'s spreadsheet; here they are one screen, and every change to a file is recorded under your name. You see the staff and nothing else: no guest bills, no takings, no guest messages.',
    tryThis: [
      {
        title: 'Start the day on People',
        detail:
          'People is the first screen you see: who is in today, who is late or not in yet, the leave waiting for your decision and where this month\'s pay run stands.',
        href: `${AMAHORO}/people`,
      },
      {
        title: 'Open a staff file',
        detail:
          'Everyone on the staff has a file, yours included. A file still missing an ID or RSSB number says what is missing, so you know what to ask for before a contract can start.',
        href: `${AMAHORO}/people`,
      },
      {
        title: 'Draft this month\'s pay run',
        detail:
          'Payroll builds the month\'s draft from each contract and recomputes it as attendance and leave change. You draft and revise it; only Yves, the owner, confirms it, so your screen has no confirm button.',
        href: `${AMAHORO}/people/payroll`,
      },
      {
        title: 'Try to open Finance',
        detail:
          'You are refused. HR holds no money permission: the wages on the pay run, yes; guest bills and the hotel\'s takings, no. Finance is not in the menu and typing its address does not open it.',
        href: `${AMAHORO}/finance`,
      },
    ],
  },

  beatha: {
    headline: 'Housekeeper at Amahoro Boutique Hotel',
    summary:
      'You clean rooms, and your whole app is a phone screen. Rather than being told at the desk in the morning which rooms to do and walking back down to report each one finished, you see your own list, and the room board shows each room\'s state.',
    tryThis: [
      {
        title: 'Open your cleaning list',
        detail:
          'The phone opens on the tasks assigned to you. There is no desk, no bills and no guest messages on this account.',
        href: `${AMAHORO}/today`,
      },
      {
        title: 'Look over the room board',
        detail:
          'The phone shows each room\'s housekeeping state: clean, dirty, inspected.',
        href: `${AMAHORO}/today`,
      },
      {
        title: 'Finish a room',
        detail:
          'Mark a task done or a room clean. Sign in as Solange afterwards to see the housekeeping board change.',
        href: `${AMAHORO}/today`,
      },
    ],
  },

  josephine: {
    headline: 'Landlord of Ingoro Apartments',
    summary:
      'You own an apartment block in Kicukiro. Rent used to mean a notebook, mobile money screenshots and chasing tenants on WhatsApp at the end of the month. Here each lease, each month\'s rent, each deposit and each repair is written down once, and you can see at a glance who has paid.',
    tryThis: [
      {
        title: 'See who has paid this month',
        detail:
          'The rent roll shows every charge for the month: paid, partly paid or due, and at least one overdue.',
        href: `${GREEN_HILLS}/rent-roll`,
      },
      {
        title: 'Open the leases',
        detail:
          'Leases lists the active tenancies with the tenant, the unit and the rent. Open one to see its details.',
        href: `${GREEN_HILLS}/leases`,
      },
      {
        title: 'Handle deposits',
        detail:
          'Move-outs and deposits shows the deposits you hold, including one already settled with the amount returned.',
        href: `${GREEN_HILLS}/move-outs`,
      },
      {
        title: 'Follow the repairs',
        detail:
          'Maintenance holds tenants\' repair tickets at different stages, so nothing reported by phone gets lost.',
        href: `${GREEN_HILLS}/maintenance`,
      },
    ],
  },

  aimable: {
    headline: 'Owner of a hotel group waiting for approval',
    summary:
      'Aimable registered Inzozi Hotels Ltd, a head office in Kigali with branches in Huye and Karongi. He has paid the fee and his TIN has been checked, but no government officer has visited yet. Instead of travelling to the district office to ask where his file is, he opens one screen and sees which stage it is at and who holds it. Until the business is approved it cannot list a room.',
    tryThis: [
      {
        title: 'See where the registration stands',
        detail:
          'The registration screen shows each stage, which ones are done, and who holds the next one: the field visit by the district verifier.',
        href: '/register',
      },
      {
        title: 'Try to open the business before approval',
        detail:
          'The workspace is listed, but every action is refused, and the refusal names the registration stage rather than a missing permission.',
        href: '/w/de300000-0000-4000-8000-000000000209',
      },
      {
        title: 'Watch the file from the other side',
        detail:
          'Sign in as Jean-Bosco, the PSF verifier for Gasabo: Inzozi Hotels Ltd is in his verification queue, waiting for his visit.',
        href: null,
      },
    ],
  },

  samuel: {
    headline: 'One person with five seats',
    summary:
      'Samuel owns a building, owns a guesthouse, cleans rooms at another hotel, books stays as a guest and is registered as a broker. In real life that is five apps, five logins or five paper books. Here it is one account, and the switcher moves him between seats without any of them seeing the others\' data.',
    tryThis: [
      {
        title: 'Switch between seats',
        detail:
          'Open the workspace switcher: each seat opens its own screens, and what one business holds never shows in another.',
        href: null,
      },
      {
        title: 'Clean rooms at Kivu Crest Hotel',
        detail:
          'As Kivu Crest\'s housekeeper you get the phone screen only, the same one Beatha uses at Amahoro, for a different hotel.',
        href: `${KIVU_CREST}/today`,
      },
      {
        title: 'Open your own building',
        detail:
          'Kayitare Court is your landlord seat, with the same tools Josephine uses, kept apart from every other business.',
        href: `${KAYITARE_COURT}/units`,
      },
      {
        title: 'Look at your own stay',
        detail:
          'You are also staying at Amahoro Boutique Hotel right now (BK-DEMO-005). Your trips show the stay with its dates and price.',
        href: '/trips',
      },
    ],
  },

  jeanbosco: {
    headline: 'Field verifier, PSF Gasabo',
    summary:
      'You check that a business registering in Gasabo really exists where it says it does. Instead of a paper file travelling between offices and an owner returning to the district to ask what happened, you see every file waiting for your visit, record what you found, and the decision is logged under your name.',
    tryThis: [
      {
        title: 'Open your verification queue',
        detail:
          'Businesses in Gasabo waiting for a field visit. Files from other districts never appear here.',
        href: `${VERIFIER}/queue`,
      },
      {
        title: 'Record a visit',
        detail:
          'Open a file, check what the owner submitted, then field-verify or reject it with a reason. A verified file moves on to the district approver.',
        href: `${VERIFIER}/queue`,
      },
      {
        title: 'Read the decision log',
        detail:
          'Every past decision with who made it and when, so the owner and the approver see the same record.',
        href: `${VERIFIER}/log`,
      },
    ],
  },

  claudine: {
    headline: 'Business approver, MINALOC Gasabo',
    summary:
      'You give the final approval before a business in Gasabo may trade on the platform. A business you have not approved cannot list a single room. The platform also stops you approving a file you verified in the field yourself, so one person never both checks and signs.',
    tryThis: [
      {
        title: 'Open your approval queue',
        detail:
          'Businesses already verified in the field, waiting for your decision.',
        href: `${APPROVER}/queue`,
      },
      {
        title: 'Approve a business',
        detail:
          'Pick a file you are free to decide and approve it. If the queue holds a file you field-verified yourself, its approve button is disabled and the screen says a different officer must decide it.',
        href: `${APPROVER}/queue`,
      },
      {
        title: 'Read the decision log',
        detail:
          'Your past approvals and rejections, each with its reason and time.',
        href: `${APPROVER}/log`,
      },
    ],
  },

  alice: {
    headline: 'Field verifier, PSF Kicukiro',
    summary:
      'You do the same job as Jean-Bosco, in Kicukiro. Your queue holds only Kicukiro\'s businesses: the district boundary is enforced by the server, not by a filter you could clear.',
    tryThis: [
      {
        title: 'Open your verification queue',
        detail:
          'At least one Kicukiro business is waiting for a field visit. None of Gasabo\'s files appear.',
        href: `${VERIFIER}/queue`,
      },
      {
        title: 'Record a visit',
        detail:
          'Open the file, check the submission and field-verify or reject it with a reason.',
        href: `${VERIFIER}/queue`,
      },
      {
        title: 'Read the decision log',
        detail: 'Decisions you record are listed here under your name.',
        href: `${VERIFIER}/log`,
      },
    ],
  },

  yvette: {
    headline: 'Field verifier, PSF Karongi',
    summary:
      'A verifier in Karongi. Signing in as her beside Jean-Bosco and Alice shows that each officer sees only their own district.',
    tryThis: [
      {
        title: 'Open your verification queue',
        detail: 'Only businesses registering in Karongi can appear here.',
        href: `${VERIFIER}/queue`,
      },
      {
        title: 'Read the decision log',
        detail: 'Decisions recorded under your name.',
        href: `${VERIFIER}/log`,
      },
      {
        title: 'Compare with another district',
        detail:
          'Sign in as Alice (Kicukiro) or Jean-Bosco (Gasabo) and open the same address: their queues hold their own district\'s businesses, none of which appear here.',
        href: `${VERIFIER}/queue`,
      },
    ],
  },

  fidele: {
    headline: 'A verifier whose assignment was revoked',
    summary:
      'Fidele used to be a field verifier. His assignment was withdrawn, so he still signs in but the government console no longer opens for him. Access follows the assignment, not the person\'s account, and ends the moment the assignment does.',
    tryThis: [
      {
        title: 'Try to open the console',
        detail:
          'You are signed in, and the screen says you hold no oversight assignment. No queue, no files.',
        href: '/oversight',
      },
      {
        title: 'See what the account can still do',
        detail:
          'He can still book like any guest: his trips list a confirmed stay at Amahoro Boutique Hotel arriving today (BK-DEMO-004).',
        href: '/trips',
      },
      {
        title: 'Compare with an active verifier',
        detail:
          'Sign in as Jean-Bosco and open the same address: his queue opens.',
        href: '/oversight',
      },
    ],
  },

  ops: {
    headline: 'Platform staff, operations',
    summary:
      'Olivier works for the platform itself. He follows businesses through registration, handles support tickets and moderates guest reviews, without holding a seat in any business. The admin console asks for a second sign-in code (the demo\'s fixed code works) and is reachable only from allowed IP addresses, so it may not open from every network.',
    tryThis: [
      {
        title: 'Follow the registration pipeline',
        detail:
          'Businesses lists the organisations in the pipeline and the stage each has reached.',
        href: `${ADMIN}/businesses`,
      },
      {
        title: 'Moderate reviews',
        detail:
          'Moderation and support holds guest reviews waiting for a decision.',
        href: `${ADMIN}/moderation`,
      },
      {
        title: 'Answer support tickets',
        detail:
          'The same screen holds support tickets from users of the platform.',
        href: `${ADMIN}/moderation`,
      },
    ],
  },

  rayan: {
    headline: 'Guest booking a stay',
    summary:
      'Rayan is a traveller. Instead of calling hotels one by one and keeping the quoted price in a text message, he finds a stay, sends a request, and keeps every booking with its reference and agreed price on his account. He also rents a flat at Ingoro Apartments, which is why his name is on Josephine\'s rent roll.',
    tryThis: [
      {
        title: 'Find a place to stay',
        detail:
          'Search stays across Rwanda and open a hotel\'s page to see rooms, prices in RWF and house rules.',
        href: '/explore',
      },
      {
        title: 'Check your trips',
        detail:
          'Each booking is listed with its reference, dates and the price fixed when it was made. BK-DEMO-001 is a request the hotel has not approved yet.',
        href: '/trips',
      },
      {
        title: 'Message the hotel',
        detail: 'Your conversations with hotels you have booked with.',
        href: '/inbox',
      },
    ],
  },

  grace: {
    headline: 'Guest with no ID on file',
    summary:
      'Grace books with her email address alone and has no identity document on file. A guest needs no ID to book; only registering a business asks for one. She also rents a flat at Ingoro Apartments.',
    tryThis: [
      {
        title: 'Check your trips',
        detail:
          'Your request BK-DEMO-002 is listed with today as its arrival date. The hotel has not approved it yet.',
        href: '/trips',
      },
      {
        title: 'See the same request at the desk',
        detail:
          'Sign in as Denise: BK-DEMO-002 is among the requests waiting for approval in Reservations. Grace herself cannot open that screen.',
        href: null,
      },
      {
        title: 'Find another stay',
        detail: 'Search stays and open a property page, with no ID asked for.',
        href: '/explore',
      },
    ],
  },

  theoneste: {
    headline: 'Guest who wants to become a host',
    summary:
      'Theoneste books stays with just his email. When he tries to register a business, the form asks for his national ID, because a business on the platform must be tied to a real, identified owner.',
    tryThis: [
      {
        title: 'Check your trips',
        detail: 'The stays booked on this account.',
        href: '/trips',
      },
      {
        title: 'Start registering a business',
        detail:
          'The first step, About you, asks for the owner\'s national ID. This account has none on file.',
        href: '/register',
      },
      {
        title: 'Read how hosting works',
        detail: 'The page for anyone who wants to list a place: what hosting on the platform involves and where to start.',
        href: '/host',
      },
    ],
  },
};

export function storyFor(email: string): DemoStory | null {
  return STORIES[email.split('@')[0] ?? ''] ?? null;
}
