import type { LegalContent } from "./types";

/**
 * Privacy Policy, DRAFT for legal review (2026-10-21).
 *
 * Written from what the code collects and where it sends it, not from the
 * design corpus. Where the corpus and the code disagree (the corpus describes
 * live identity checks, SMS and payments), this says what runs today and names
 * the rest as not switched on. Sources, so the next edit can re-check them:
 *
 * - Sign-in: `packages/auth/src/server.ts` (email code, Google, codes hashed,
 *   ten minutes) and the `sessions` table (IP address and user agent).
 *   Phone sign-in is built, but `SMS_MODE` resolves to `off` over a real
 *   database and no live SMS adapter is registered (`sms.module.ts`).
 * - Payer number: masked to `078••••456` on `payment_attempts`, the full
 *   number only ever passed to the payment port; production pins payments off.
 * - Identity: the ID scan (ADR-075 A1) uploads a photo of the ID and a selfie
 *   as `id_photo` and keeps every try in `identity_scans`, in every mode.
 *   `identity-adapters.provider.ts` has no live document reader, so on a real
 *   database nothing reads the photos and the person types the details. The
 *   population register lookup and its SMS code are gone (AC-4). ADR-075 D-n
 *   deletes the photos 90 days after the case's final decision; that deletion
 *   is not built, which is why the period below is marked to confirm.
 * - Ask Injishi: `modules/assistant/domain/retention.ts` (7 and 90 days),
 *   `redaction.ts` (what is removed before Anthropic sees it), usage rows
 *   anonymised at 90 days (`retention.service.ts`).
 * - Sentry: `shared/observability/error-reporter.ts` strips the request and the
 *   user; DOKPLOY.md keeps the DSN empty until the NCSA registration names it.
 * - The signed registration agreement: only its version, the account and the
 *   time reached the server (`orgs.contract_*`), for the businesses that
 *   accepted it before paying. ADR-075 took it out of registration (AC-12);
 *   its A3 agreement after approval records a typed name, the device and the
 *   IP, so this policy's line on the agreement changes when A3 ships.
 */
export const PRIVACY: LegalContent = {
  title: "Privacy Policy",
  summary:
    "What personal data Injishi collects, why, who sees it, how long we keep it, and the rights you have over it under Rwandan law.",
  status: "draft",
  lastUpdated: "2026-10-21",
  sections: [
    {
      id: "who-we-are",
      heading: "Who we are",
      blocks: [
        "Injishi is run by Hangaa Softwares [TO CONFIRM: registered company name, company code and registered address]. For most of the data described here, Hangaa Softwares is the data controller: it decides why and how the data is used.",
        "This notice follows Law No 058/2021 of 13/10/2021 relating to the protection of personal data and privacy [TO CONFIRM: our registration number with the National Cyber Security Authority (NCSA)].",
        "Our data protection officer is [TO CONFIRM: name and email address of the data protection officer]. You can also write to [support@injishi.com](mailto:support@injishi.com).",
      ],
    },
    {
      id: "businesses",
      heading: "When a business decides, not us",
      blocks: [
        "Businesses that list on Injishi also use it to run their property: the guest register, bills, orders, staff rosters and pay. For that data the business is the controller, and Injishi processes it for the business, on its instructions.",
        "That includes the business's own staff records: staff files, contracts, attendance, leave and payslips. We hold them for the business, show them only to the people the business allows, and use them for nothing else.",
        "When you book, the property receives your booking details and becomes a controller of them in its own right. Ask the property how it uses them.",
      ],
    },
    {
      id: "account",
      heading: "Your account and signing in",
      blocks: [
        {
          list: [
            "Your email address, and the one time codes we send to it. Codes are stored scrambled (hashed) and expire after ten minutes.",
            "If you sign in with Google: the name, email address and profile picture your Google account shares with us.",
            "For each signed in session: your IP address, your browser's user agent, and when the session started and ends.",
            "Your name, phone number, country and preferred language, if you add them to your account.",
          ],
        },
        "Sign-in by text message is built but not switched on. When it is, we will also hold the phone number you sign in with, and a text message provider will deliver the codes [TO CONFIRM: SMS provider, once chosen].",
      ],
    },
    {
      id: "bookings",
      heading: "Booking and staying",
      blocks: [
        {
          list: [
            "The property, room type, dates, number of guests and the rate you chose. We record how many guests, not their names.",
            "The mobile money number and network you pay from. The full number goes only to the payment provider, to request the payment. We keep it masked, showing only its first and last three digits.",
            "The booking's status, its payments and refunds, and its receipt.",
            "Messages you send to the property's desks, and anything you order during your stay.",
          ],
        },
        "Injishi does not take payments yet, so no number is sent to a payment provider today [TO CONFIRM: mobile money provider or aggregator, once chosen]. We do not accept cards and never ask for a card number.",
        "The property keeps a record of your stay: your name, contact details, room, arrival and departure, and the price. If you check in online before you arrive, you also send your ID or passport type and number, a photo of the document, and your home address. The property uses this to check you in and to keep the guest register accommodation businesses must keep [TO CONFIRM: legal basis for the guest register, and how long it must be kept]. We store it for the property. Injishi does not send guest records to any government body.",
      ],
    },
    {
      id: "registration",
      heading: "Registering a business",
      blocks: [
        {
          list: [
            "About you: your full name as written on your ID, the document's type and number, gender, date of birth, phone number and address, and your role in the business.",
            "Each time you scan your ID: a photo of the front of your National ID or of your passport's photo page, and a selfie. We keep them so the PSF officer reviewing your registration can compare them with your details [TO CONFIRM: how long the ID photos are kept].",
            "About the business: its name, its RRA TIN (or, for a home, its UPI), its classification, its branches, and its address down to the village. If you register it for its owner, the owner's name, National ID number and email address, so the owner can be matched when they claim it.",
            "The documents you upload, such as certificates, licences and land titles.",
            "That you accepted the registration agreement, which version, and when. The signature you draw stays in your browser, in the copy you download. We never receive it.",
            "If you apply for Private Sector Federation (PSF) membership while registering, that application.",
          ],
        },
        "Your answers are saved as a draft between steps, so you can finish another day. A draft never holds an ID number, and it is deleted when the registration is created.",
        "No machine reads your ID photos yet: you type your details as printed, and a PSF officer compares them with the photos before approving. Before an identity checking service is switched on, we will name its provider here [TO CONFIRM: identity verification provider]. No code is sent to your phone to check your ID.",
      ],
    },
    {
      id: "support",
      heading: "Support, Ask Injishi and training",
      blocks: [
        {
          list: [
            "Support requests: the topic, your name, email address, phone number if you give it, and your message. If you are signed in, the request is linked to your account.",
            "Ask Injishi: your questions, the answers and any feedback you give. A conversation is deleted 7 days after its last message if you were signed out, or 90 days after if you were signed in. We keep a record of each answer's size and cost, which stops naming you after 90 days.",
            "Training: if you register for a session, your name, phone number, the email address on your account and your business. If you attend, we issue a certificate. Anyone with its link or QR code can check it on our public verification page, which shows your name, the course, the date, the venue and district, the trainer, and whether the certificate is valid or withdrawn.",
          ],
        },
        "Some answers in Ask Injishi are written by Claude, an AI model run by Anthropic. Before your words are sent to it, we remove email addresses, phone numbers, ID numbers and TINs. See [international transfers](#transfers).",
      ],
    },
    {
      id: "browsing",
      heading: "When you browse",
      blocks: [
        "Our servers may record technical details of each request, such as your IP address and browser, to keep Injishi running and secure [TO CONFIRM: what our server logs hold, and for how long].",
        "Stays you save and stays you recently viewed are kept in your browser, not on our servers. Our [Cookie Policy](/legal/cookies) lists everything we store there.",
        "We are adding privacy-friendly, cookie-free analytics that count visits without identifying you. They set no cookies and build no profile of you, and they are off until configured.",
        "When you open a map, your browser loads the map images from OpenFreeMap or OpenStreetMap, which receive your IP address and the area you are viewing. We send them nothing else.",
      ],
    },
    {
      id: "why",
      heading: "Why we use your data",
      blocks: [
        "We use personal data only where the law gives us a basis:",
        {
          list: [
            "To run your account, sign you in, and take, manage and refund your bookings: because we need to, to provide the service you asked for.",
            "To tell you and the property about a booking: the same reason. These messages are part of the booking and cannot be switched off.",
            "To review business registrations, so only verified businesses reach guests: our legitimate interest in a trustworthy marketplace [TO CONFIRM: any legal obligation behind government verification].",
            "To keep tax and accounting records, including receipts: a legal obligation.",
            "To keep Injishi secure, prevent fraud and fix faults: our legitimate interest.",
            "To answer your support requests and questions: to provide the service, and our legitimate interest in helping you.",
            "Marketing: only if you say yes. We send none today.",
          ],
        },
        "Where we rely on your consent, you can withdraw it at any time. No decision with legal or similarly serious effects on you is made by a machine alone: registrations are decided by people.",
      ],
    },
    {
      id: "sharing",
      heading: "Who we share it with",
      blocks: [
        {
          list: [
            "The property you book: your name, contact details, booking details, and any check-in details you send.",
            "The officers who review business registrations: a registration's details and documents, shown only to officers assigned to its area [TO CONFIRM: which government bodies appoint these officers]. PSF membership officers see PSF applications.",
            "The Rwanda Revenue Authority (RRA): a business's TIN, to check it, and, once certified e-invoicing is live, the details of each sale a host declares. Neither connection is live yet, and today we send RRA nothing.",
            "Mobile money providers, to take and refund payments, once payments are live.",
            "Our email provider, which delivers sign-in codes, booking updates and invitations [TO CONFIRM: email (SMTP) provider and where it processes mail].",
            "Anthropic, for AI answers in Ask Injishi, with contact details and ID numbers removed first.",
            "Sentry, which receives error reports from our servers so we can fix faults. A report carries no request, form or account details, and its text is scrubbed. It is switched on only once our NCSA registration names it.",
            "Injishi staff, who see what their role needs to support you, review registrations and keep the service safe.",
            "Authorities, where the law requires it.",
          ],
        },
        "We do not sell your personal data, and we do not share it with advertisers.",
      ],
    },
    {
      id: "transfers",
      heading: "Where your data is kept, and transfers abroad",
      blocks: [
        "Your data is stored on servers we run ourselves, in [TO CONFIRM: country where our servers are hosted]. Files you upload are kept in our own encrypted file store on those servers. A browser can open a stored file only through a link we sign, which expires within 15 minutes.",
        "Some services above are outside Rwanda: Anthropic, in the United States, for AI answers; Sentry, in its European Union region, for error reports; and Google, if you choose Google sign-in [TO CONFIRM: location of the email provider].",
        "We transfer personal data outside Rwanda only as Law No 058/2021 allows [TO CONFIRM: the NCSA authorisation or safeguard relied on for each transfer].",
      ],
    },
    {
      id: "retention",
      heading: "How long we keep it",
      blocks: [
        {
          list: [
            "Sign-in codes: ten minutes.",
            "Signed in sessions: until you sign out, or 7 days after you last used Injishi.",
            "Ask Injishi conversations: 7 days after the last message if you were signed out, 90 days if signed in.",
            "Registration drafts: until the registration is created.",
            "Your account and profile: while your account is open, then [TO CONFIRM: period after closure].",
            "Bookings, payments and receipts: [TO CONFIRM: period Rwandan tax law requires].",
            "Business registrations and their documents: [TO CONFIRM: period].",
            "Support requests: [TO CONFIRM: period].",
            "Guest registers and check-in records: as long as the property must keep them [TO CONFIRM: period].",
          ],
        },
        "Some records are never edited in place. A cancelled booking, a voided charge or a withdrawn certificate stays on record, marked as such, so the history is honest. They are still deleted when their period ends.",
      ],
    },
    {
      id: "rights",
      heading: "Your rights",
      blocks: [
        "Under Law No 058/2021 you have the right to:",
        {
          list: [
            "know what personal data we hold about you and how we use it;",
            "get a copy of it;",
            "have it corrected if it is wrong;",
            "have it deleted, unless we must keep it, for example for tax;",
            "object to how we use it, or ask us to restrict it;",
            "receive it in a form you can take to another service;",
            "withdraw any consent you have given;",
            "not be subject to a decision made by a machine alone that seriously affects you.",
          ],
        },
        "To use any of these rights, email [support@injishi.com](mailto:support@injishi.com) from the address on your account. We may ask you to prove who you are. We will answer within [TO CONFIRM: response time].",
        "If a business holds your data as its controller, for example as its guest or its staff, we will pass your request to the business and help it answer.",
        "If you are not happy with our answer, you can complain to the National Cyber Security Authority (NCSA), which oversees data protection in Rwanda.",
      ],
    },
    {
      id: "security",
      heading: "How we protect it",
      blocks: [
        {
          list: [
            "Every connection to Injishi is encrypted.",
            "Sign-in codes are stored hashed, so a copy of our database cannot be used to sign in.",
            "Uploaded files are encrypted at rest and reachable only through short lived signed links.",
            "When we show you your own ID number, we show it masked, never in full.",
            "Staff and officers see only what their role allows.",
          ],
        },
        "No system is perfectly secure. If a breach puts your data at risk, we will tell you and NCSA as the law requires.",
      ],
    },
    {
      id: "children",
      heading: "Children",
      blocks: [
        "Injishi is not meant for children, and you must be at least 18 to create an account [TO CONFIRM: minimum age]. We do not knowingly collect children's data. A child may be one of the guests on a booking, and the booking records only how many guests there are.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      blocks: [
        "We will update this policy when what we collect, or how we use it, changes, and change the date at the top. If a change matters to you, we will email you before it applies.",
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      blocks: [
        "Hangaa Softwares, [TO CONFIRM: registered address]. Email [support@injishi.com](mailto:support@injishi.com), or use the [Support](/support) page.",
      ],
    },
  ],
};
