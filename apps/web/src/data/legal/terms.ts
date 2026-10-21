import type { LegalContent } from "./types";

/**
 * Terms of Service, DRAFT for legal review (2026-10-21).
 *
 * Written from what the product does today, not from the design corpus, and
 * each claim was checked against the code that makes it true:
 *
 * - Request to book: 24 hours or check-in, whichever is sooner
 *   (`APPROVAL_WINDOW_HOURS`, `approvalExpiresAt` in the API's booking pricing).
 * - Per guest pricing, the 10% non-refundable discount and the 5% guest service
 *   fee: `computeBreakdown` in `@injishi/contracts` (`booking.ts`).
 * - The cancellation tiers and their order of precedence: `CANCELLATION_TIERS`
 *   and `cancellationRefund` in the same file, which restate the checkout copy
 *   in `lib/booking.ts`. ADR-051 D-f says the percentages still need the
 *   owner's explicit yes, hence the markers beside them.
 * - Production takes no payments (`PAYMENT_ADAPTER_MODE=off`, DOKPLOY.md), the
 *   registration fee's Pay button records the fee and moves no money
 *   (`step-pay.tsx`), and EBM runs in mock (`VSDC_ADAPTER_MODE`).
 * - Two charges and no commission: `HOST_CHARGES` in `data/host.ts`.
 *
 * `cancellation` is linked from the checkout's "Full policy". Do not rename it.
 */
export const TERMS: LegalContent = {
  title: "Terms of Service",
  summary:
    "The agreement between you and Hangaa Softwares, which runs Injishi. It covers browsing, booking a stay, and registering a business to host.",
  status: "draft",
  lastUpdated: "2026-10-21",
  sections: [
    {
      id: "about",
      heading: "About these terms",
      blocks: [
        "Injishi (www.injishi.com) is a marketplace for places to stay in Rwanda. It is run by Hangaa Softwares [TO CONFIRM: registered company name, company code and registered address]. In these terms, \"Injishi\", \"we\" and \"us\" mean Hangaa Softwares.",
        "By creating an account, booking a stay or registering a business, you agree to these terms. If you do not agree, do not use Injishi.",
        "How we handle personal data is in our [Privacy Policy](/legal/privacy), and the cookies we set are in our [Cookie Policy](/legal/cookies).",
        "Parts of Injishi are still being connected, and these terms say so where it matters. Where a section describes how something works \"when it is available\", it does not work that way yet.",
      ],
    },
    {
      id: "who-can-use",
      heading: "Who can use Injishi",
      blocks: [
        "Anyone can browse Injishi without an account.",
        "To book a stay you need an account, and you must be at least 18 [TO CONFIRM: minimum age to book]. To register a business you must be at least 18, and the registration form checks your date of birth.",
        "You must give us true details and keep them up to date. You may not use Injishi if we have closed your account before.",
      ],
    },
    {
      id: "accounts",
      heading: "Your account",
      blocks: [
        "You sign in with a six digit code we email to you, or, where the sign-in screen offers it, with your Google account [TO CONFIRM: whether Google sign-in is switched on in production]. Injishi does not use passwords. A code works once and expires after ten minutes.",
        "One person holds one account. Your account belongs to you, not to a business: if you run or work for several businesses, you reach each one from the same account.",
        "Browsing and booking need only an email address you have proved is yours. Before you register a business, or register one for its owner, we ask who you are: your full name as written on your National ID or passport, the document's number, your date of birth, phone number and address. One identity document can belong to only one account. If yours is already in use, we will help you recover that account rather than open a second one.",
        "Keep your email account secure, because anyone who can read your email can sign in as you. Tell us at once at [support@injishi.com](mailto:support@injishi.com) if you think someone else has used your account.",
      ],
    },
    {
      id: "bookings",
      heading: "Booking a stay",
      blocks: [
        "Each place on Injishi is listed by the business that runs it. That business, the host, provides your stay. Injishi runs the booking and the payment between you.",
        "Each room type is booked in one of two ways:",
        {
          list: [
            "Instant booking: your booking is confirmed as soon as your payment is taken.",
            "Request to book: the host has 24 hours to accept or decline, or until your check-in date if that comes sooner. If the host declines, or does not answer in time, the request ends and you are refunded in full.",
          ],
        },
        "Prices are per guest, per night. Before you pay, the checkout shows the nightly rate, the number of guests and nights, any discount, the guest service fee and the total. The total you see is the total you pay.",
        "Some rooms offer a non-refundable rate. It is 10% cheaper than the standard rate, and you get nothing back if you cancel.",
        "Your booking is an agreement between you and the host. Keep to the property's house rules and its check-in and check-out times, and do not bring more guests than you booked for.",
        "At check-in the property may ask for your ID and record your details in its guest register, which accommodation businesses in Rwanda keep [TO CONFIRM: the legal basis for the guest register].",
      ],
    },
    {
      id: "payment",
      heading: "Paying for a stay",
      blocks: [
        "Injishi does not take payments yet. Until it does, you cannot complete a paid booking and nothing is charged. This section describes how payment works when it is available.",
        {
          list: [
            "You pay by mobile money, MTN MoMo or Airtel Money, and approve the payment on your phone. Card payments are not offered.",
            "You pay the full total when you confirm. Paying in instalments is not offered.",
            "Your payment is held in escrow by Injishi rather than sent straight to the host. It is released to the host after you check in [TO CONFIRM: when escrow is released, and how long a host's payout takes]. If a booking is declined, expires or is cancelled, any refund comes out of the money held.",
            "The guest service fee is 5% of the price of your stay after any discount [TO CONFIRM: who receives the guest service fee, and under whose TIN it is declared].",
            "Refunds go back to the mobile money account you paid from [TO CONFIRM: refund method and how long a refund takes to arrive].",
          ],
        },
      ],
    },
    {
      id: "cancellation",
      heading: "Cancellations and refunds",
      blocks: [
        "Each room type carries one cancellation tier. The checkout shows it before you pay, and it is fixed on your booking when you book: a later change to the room does not change your terms. If a room type has no tier, Flexible applies.",
        {
          table: {
            columns: ["Tier", "If you cancel in time", "If you cancel later"],
            rows: [
              [
                "Flexible",
                "Full refund, up to 24 hours before check-in",
                "No refund [TO CONFIRM: that Flexible refunds nothing inside 24 hours]",
              ],
              ["Moderate", "Full refund, up to 5 days before check-in", "50% refund"],
              ["Limited", "50% refund, up to 7 days before check-in", "No refund"],
              ["Firm", "50% refund, up to 30 days before check-in", "No refund"],
              [
                "Extended stay",
                "50% refund, up to 30 days before check-in",
                "No refund [TO CONFIRM: that Extended stay refunds nothing inside 30 days]",
              ],
            ],
          },
        },
        "[TO CONFIRM: the owner's approval of every refund percentage in this table, before any real guest cancels]",
        "Time before check-in is counted to the property's check-in time on your arrival date, in Kigali time, or 14:00 if the property has not set one.",
        "These rules apply first, in this order:",
        {
          list: [
            "If the host cancels, you get a full refund.",
            "If you cancel a request the host has not yet accepted, you get a full refund.",
            "If you booked the non-refundable rate, you get nothing back.",
            "Otherwise, your tier decides.",
          ],
        },
        "The guest service fee is refunded in the same proportion as the stay. Refunds are rounded down to the franc. Money you do not get back goes to the host.",
        "Before you cancel, Injishi shows you exactly what you will get back, and the amount you confirm is the amount refunded. You cannot cancel online once you have checked in.",
      ],
    },
    {
      id: "hosting",
      heading: "Registering a business and hosting",
      blocks: [
        "Businesses that offer accommodation in Rwanda can apply to list on Injishi: hotels and other accommodation, and landlords who let a home.",
        "To register, you give us your identity, the business's RRA TIN (or, for a home you let, its UPI), its address and branches, and any certificates and licences you choose to attach. You can register a business for its owner, who then claims it.",
        "A registration is reviewed before the business goes live: the TIN is checked, an officer visits to verify the business, and an approver decides [TO CONFIRM: which bodies verify and approve registrations, and under what authority]. Nobody may approve a business they verified themselves.",
        "When you list, you promise that:",
        {
          list: [
            "you have the right to offer the accommodation, and hold every licence and registration the law requires, including your RDB operating licence where it applies;",
            "your listing is accurate: photos, rooms, prices, facilities, location and house rules;",
            "you will honour every booking you accept, at the price shown when it was made;",
            "you will meet your tax duties to RRA, including declaring your sales;",
            "you will use your guests' personal data only for their stay, and protect it as the law requires.",
          ],
        },
        "You remain the operator of your accommodation, and you are responsible for the stay itself: its safety, its cleanliness and what your listing promises.",
        "If you work for a business on Injishi, that business decides what you may see and do there.",
      ],
    },
    {
      id: "fees",
      heading: "What Injishi charges businesses",
      blocks: [
        "Injishi charges a business two things, and takes no commission on bookings:",
        {
          list: [
            "A one time registration fee, priced by type of business. You see the amount on the last step of registering, before you pay. Correcting and resubmitting a registration is not charged again.",
            "A monthly plan, which starts only once your listing is live [TO CONFIRM: plan prices, billing day, and how a plan is cancelled].",
          ],
        },
        "The rate you set for a stay is the rate you are paid. Your bank or mobile money provider may charge to move the money to you.",
        "Payment of the registration fee is not connected yet. Today, pressing Pay records the fee against your registration and sends it for review, and no money moves [TO CONFIRM: how fees recorded this way are settled].",
        "[TO CONFIRM: whether the registration fee is refunded if a registration is refused]",
      ],
    },
    {
      id: "receipts",
      heading: "Receipts and tax",
      blocks: [
        "Every booking comes with a receipt. Certified e-invoicing through the Electronic Billing Machine (EBM) system of the Rwanda Revenue Authority (RRA) is being connected. Until it is live, a receipt from Injishi is not a certified fiscal receipt and says so, and hosts should keep declaring their sales the way they do today.",
        "When certified e-invoicing is live, each sale will be declared to RRA under the host's own TIN, through the host's own EBM account, which the host connects to Injishi.",
      ],
    },
    {
      id: "acceptable-use",
      heading: "Using Injishi fairly",
      blocks: [
        "You must not:",
        {
          list: [
            "give false details, or book or register in someone else's name without their permission;",
            "list a place you have no right to let, or one that does not exist;",
            "harass, threaten or discriminate against a guest, a host or anyone's staff;",
            "send spam, malware or unlawful material through messages, uploads or the assistant;",
            "try to reach accounts, data or parts of Injishi you are not allowed to, or test our security without our written permission;",
            "copy listings or content from Injishi in bulk, or overload the service.",
          ],
        },
        "Messages you send to a property's desks are for your stay. The property's staff read them, and Injishi can see them to keep the service safe.",
      ],
    },
    {
      id: "content",
      heading: "Content and photos",
      blocks: [
        "You own what you upload: photos, descriptions and documents. You give Injishi permission to store it, show it on Injishi, and use it to run and promote your listing while it is on Injishi [TO CONFIRM: the scope and length of this licence].",
        "Upload only what you have the right to, and photos that show the place as it is.",
        "Some photos on Injishi show the area around a stay rather than the stay itself. They are freely licensed and credited on our [photo credits](/legal/photo-credits) page.",
        "The Injishi name, logo and website belong to Hangaa Softwares. Do not use them without our permission.",
      ],
    },
    {
      id: "assistant",
      heading: "Ask Injishi, our assistant",
      blocks: [
        "Ask Injishi answers questions about Injishi and your own bookings. Some of its answers are written by an AI model, and they can be wrong. Check prices, dates and policies on the booking itself before you rely on them.",
        "The assistant never books, cancels or changes anything unless you confirm it first.",
      ],
    },
    {
      id: "suspension",
      heading: "Suspension and closing an account",
      blocks: [
        "You can stop using Injishi at any time. To close your account, email [support@injishi.com](mailto:support@injishi.com) [TO CONFIRM: whether account closure will be offered on screen].",
        "We may suspend a business, or limit or close an account, if it breaks these terms, if the law requires it, or to protect guests, hosts or Injishi. A suspended business disappears from search and cannot take new bookings [TO CONFIRM: what happens to bookings already made with a business that is suspended].",
      ],
    },
    {
      id: "liability",
      heading: "Our responsibility to you",
      blocks: [
        "We work to keep Injishi available and its information accurate, but we cannot promise it will always be available or free of errors.",
        "The host provides your stay and is responsible for it. [TO CONFIRM: the limits on Injishi's liability, and any cap on it]",
        "Nothing in these terms takes away a right you have under Rwandan law that cannot be taken away by agreement.",
      ],
    },
    {
      id: "disputes",
      heading: "Problems and disputes",
      blocks: [
        "If something goes wrong with a stay, tell the property first, then tell us through the [Support](/support) page or at [support@injishi.com](mailto:support@injishi.com).",
        "If a guest and a host disagree about a stay, our team reviews it before any money held in escrow moves [TO CONFIRM: the dispute process and its time limits].",
        "These terms are governed by the laws of the Republic of Rwanda. [TO CONFIRM: the courts or arbitration body that hears disputes]",
      ],
    },
    {
      id: "changes",
      heading: "Changes to these terms",
      blocks: [
        "We may change these terms. The date at the top of this page shows the latest change, and we will email you before a change that affects you takes effect [TO CONFIRM: notice period].",
        "A booking keeps the price and cancellation tier it was made with, whatever changes later.",
      ],
    },
    {
      id: "contact",
      heading: "Contact us",
      blocks: [
        "Hangaa Softwares, [TO CONFIRM: registered address]. Email [support@injishi.com](mailto:support@injishi.com), or use the [Support](/support) page.",
      ],
    },
  ],
};
