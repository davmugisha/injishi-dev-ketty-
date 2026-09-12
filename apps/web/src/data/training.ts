/**
 * THE INJISHI SOFTWARE TRAINING COURSE, WRITTEN FOR A DEMO.
 *
 * Read this before you quote a word of it. There is no Training module on the
 * API, no courses table, no enrolment record and no examiner. The curriculum
 * below was WRITTEN for a presentation: the lessons, the questions, the marked
 * answers, the durations and the fee are all authored here, by hand, so that a
 * presenter can walk a room through the whole course without a backend.
 *
 * That is a different standing from `data/properties.ts`, which is a curated
 * fixture whose facts are true of a real property. It is closer to
 * `data/demo-commerce.ts`: invented, deliberately, in one place. The teaching
 * content is written to be genuinely correct for a Rwandan host — a bad course
 * demonstrates nothing — but it has not been reviewed by RRA, by a lawyer, or
 * by anyone who could sign it off, and it must not be printed, quoted to a
 * hotelier as guidance, or screenshotted as a product claim.
 *
 * TWO NUMBERS ARE THE DEMO'S, NOT THE PRODUCT'S, and they are the two most
 * likely to be repeated out of the room: the 25,000 RWF fee and the MTN MoMo
 * Pay code `*182*8*1*123456#`. The code is a placeholder merchant code. Dialling
 * it does not pay Injishi anything.
 *
 * WHEN A REAL TRAINING MODULE LANDS, DELETE THIS FILE. Every consumer imports
 * `TRAINING_COURSE` and the four types beside it, so the swap is one import.
 *
 * Nothing here is derived from `Math.random()` or `Date.now()`. The whole file
 * is a constant, so a lesson renders identically on the server and on the
 * client and React never has to tear the page down and rebuild it.
 */

/** One marked question. `correct` is the index into `options`. */
export interface TrainingQuestion {
  slug: string;
  prompt: string;
  options: string[];
  /** The index of the right answer in `options`. */
  correct: number;
  /** Shown after the learner answers — why that answer is the right one. */
  why: string;
}

export interface TrainingLesson {
  slug: string;
  title: string;
  /** Reading time in minutes, authored rather than computed. */
  minutes: number;
  /** One string per paragraph. The lesson screen renders each as a `<p>`. */
  body: string[];
  quiz: TrainingQuestion[];
}

export interface TrainingModule {
  slug: string;
  title: string;
  summary: string;
  lessons: TrainingLesson[];
}

/**
 * The course as a whole.
 *
 * `feeRwf` is whole Rwandan francs — there are no minor units to guess at, and
 * `lib/money.ts` formats it. `momoCode` is the USSD string exactly as a host
 * would dial it, kept as one literal because a demo that shows a code assembled
 * from parts shows a code nobody can read off the screen.
 */
export const TRAINING_COURSE: {
  title: string;
  feeRwf: number;
  momoCode: string;
  modules: TrainingModule[];
} = {
  title: "Injishi Software Training",
  feeRwf: 25_000,
  momoCode: "*182*8*1*123456#",
  modules: [
    {
      slug: "accommodation-and-booking",
      title: "Accommodation and Booking",
      summary:
        "Everything a host needs before the first guest arrives: what a listing promises, how to price a room from your own costs rather than the neighbour's sign, how the calendar prevents a double booking, what a confirmed booking commits you to, how the money moves, and what RRA expects of a small accommodation business.",
      lessons: [
        {
          slug: "what-is-a-listing",
          title: "What a listing actually is",
          minutes: 12,
          body: [
            "A listing is not an advertisement, it is a promise you can be held to, and that difference decides almost everything about how you write one. An advertisement is allowed to flatter. A listing is read by a stranger who is deciding whether to send money to a place they have never seen, in a town they may never have visited, so every line either earns that trust or quietly spends it.",
            "The easiest way to get the content right is to write down the answers you already give on the telephone twenty times a week and stop giving them one caller at a time. Room type and bed size, how many people it really sleeps, whether the water is heated and at what hours, whether there is a generator when the power goes, how far the gate is from the tarmac road, and what the compound looks like after dark. A guest who finds those answers on the page books. A guest who has to ring you for them usually rings somebody else instead.",
            "Photographs carry far more weight than any sentence you will write, and the most expensive mistake a new host makes is posting the room as they wish it looked rather than as a guest will find it. Shoot the room you actually rent, on an ordinary day, with the curtains open and the bed made the way your housekeeper makes it. A guest who arrives to a smaller room than the photograph showed does not shrug and accept it; they open a dispute, the money stops where it is, and you lose a week of your life to an argument about a picture you took in a hurry.",
            "Your listing also has to carry the things you would rather not mention, and mentioning them is what protects you. Say plainly that check-in is after two o'clock, that the third floor has no lift, that the access road is rough after heavy rain, that the room above the bar is louder on Friday. Every one of those sentences costs you a few bookings from people who would have complained anyway, and buys you the right to say, calmly and with the page open in front of you, that the guest was told.",
          ],
          quiz: [
            {
              slug: "listing-is-a-promise",
              prompt:
                "A guest books what your photographs showed as a twin room and arrives to find one double bed. What has actually gone wrong?",
              options: [
                "Nothing — photographs on any platform are understood to be illustrative",
                "The listing made a promise the room does not keep, and that is exactly what a dispute is opened on",
                "The guest chose the wrong filter when searching",
                "Injishi matched the guest to the wrong property",
              ],
              correct: 1,
              why: "The listing is the promise. The guest paid against what the page said, so a room that does not match the page is a broken promise regardless of who took the photograph or how long ago.",
            },
            {
              slug: "listing-awkward-facts",
              prompt:
                "Your access road is badly rutted and becomes difficult after rain. What should the listing say?",
              options: [
                "Nothing — it would put guests off",
                "That the property is 'easily accessible', because most days it is",
                "That the last stretch of road is rough and can be difficult after heavy rain",
                "Mention it only to guests who ask directly",
              ],
              correct: 2,
              why: "Saying it costs you the few bookings that would have ended in a complaint anyway, and it earns you the right to point at the page when a guest arrives and objects.",
            },
          ],
        },
        {
          slug: "pricing-a-room",
          title: "Pricing a room without guessing",
          minutes: 14,
          body: [
            "Most hosts set their first price by asking the guesthouse down the road what it charges, which is a reasonable place to start and a very poor place to stop, because their building is not your building, their staff are not your staff and their occupancy is not yours either. Copying a neighbour's rate copies their mistakes as well as their judgement, and you will never know which of the two you took.",
            "Start instead from your own floor, which is simply the price below which a night costs you money. Add up what one occupied room night genuinely consumes: laundry and cleaning for that room, the water and electricity a guest uses, the share of wages and rent that the night has to carry, the platform commission, and the tax you owe on the sale. That number is dull to work out and you only have to do it once a year, and once you have it you can say no to a haggling guest without guessing whether you just lost money.",
            "Above the floor sits demand, and demand in Rwanda is emphatically not flat across the year. Conference weeks in Kigali, the gorilla naming ceremony, school holidays, the long dry season and the trough after the rains all move occupancy by more than any discount you could offer, so a single rate held all year both leaves money on the table in the busy weeks and leaves rooms empty in the quiet ones. Set a base rate, then a higher season rate and a lower one, and put them on the calendar in advance rather than reacting the week before.",
            "Length of stay is the other lever, and it is the one hosts forget. A guest staying six nights costs you one arrival, one departure and one deep clean instead of six of each, so a weekly rate that looks like a discount to the guest is often better business for you than six nights sold separately. Price the week, price the month, and let the arithmetic rather than the haggling decide what you accept.",
          ],
          quiz: [
            {
              slug: "pricing-floor",
              prompt:
                "What is the first number you should work out before setting a nightly rate?",
              options: [
                "What the guesthouse down the road charges",
                "What one occupied room night costs you, including cleaning, utilities, wages, commission and tax",
                "The highest rate any property in your district has ever charged",
                "The average rate shown in the Injishi search results",
              ],
              correct: 1,
              why: "Your floor is the only number that tells you when a booking is losing you money. Everything above it is judgement; below it, no amount of occupancy helps.",
            },
            {
              slug: "seasonal-rate",
              prompt:
                "You hold one rate all year. What does that cost you?",
              options: [
                "Nothing, as long as the rate is above your floor",
                "Only the administrative work of changing it",
                "Revenue in the busy weeks and empty rooms in the quiet ones, at the same time",
                "Guest trust, because rates should never move",
              ],
              correct: 2,
              why: "A flat rate is simultaneously too low when demand peaks and too high when it collapses. It loses at both ends of the year, which is why it feels safe and performs badly.",
            },
          ],
        },
        {
          slug: "availability-and-the-calendar",
          title: "Availability, the calendar and how double bookings happen",
          minutes: 11,
          body: [
            "The calendar is not a diary of your intentions, it is the live statement of what a stranger is allowed to buy in the next few seconds, and treating it as anything softer than that is where double bookings come from. If a night is open on Injishi then a guest can pay for it right now, from anywhere, without ringing you first, and no amount of good intent afterwards puts that night back.",
            "Almost every double booking a small hotel suffers has the same cause, and it is not the software. Somebody took a booking by telephone or over WhatsApp, wrote it in the paper register at the desk, and did not close the night on the platform, so for the hours between the two the same room was on sale twice. Fix that by making the calendar the single record: a walk-in, a phone booking and an online booking are all blocked in the same place, at the moment they are agreed, by whoever agreed them.",
            "Blocks are as important as bookings and are used far too rarely. Close a room while it is being repainted, close the whole property for the days you are away with nobody at the desk, and close a night you have promised to a returning guest who has not paid yet. A room that is quietly unbookable is far cheaper than a room that is sold and then withdrawn.",
            "Finally, keep the check-in and check-out times on the calendar honest, because they are what makes back-to-back nights possible. If your housekeeper needs three hours between a departure and the next arrival then say check-out is at ten and check-in is at two, and hold it. Hosts who publish a generous check-in and then leave arrivals waiting in the lobby are not being kind; they are producing complaints for a courtesy nobody asked for.",
          ],
          quiz: [
            {
              slug: "calendar-is-the-truth",
              prompt:
                "A regular guest rings and asks you to hold a room for next Friday. What do you do on the calendar?",
              options: [
                "Nothing until they pay — holding it might lose a paying booking",
                "Block the night immediately, so the room cannot be sold underneath the promise you just made",
                "Raise the price for that night so nobody else takes it",
                "Write it in the desk register and leave the platform alone",
              ],
              correct: 1,
              why: "An open night is a night a stranger can buy in the next second. Once you promised it, the only safe record of that promise is a block on the calendar itself.",
            },
            {
              slug: "double-booking-cause",
              prompt:
                "What causes the great majority of double bookings at a small hotel?",
              options: [
                "Two guests pressing Book at the same instant",
                "A booking taken by phone or at the desk that was never blocked on the platform",
                "The platform releasing rooms it should have held",
                "Guests booking and then changing their dates",
              ],
              correct: 1,
              why: "The gap between agreeing a booking off-platform and recording it is the window in which the same room is on sale twice. Closing the night at the moment you agree it removes the window.",
            },
          ],
        },
        {
          slug: "taking-a-booking",
          title: "What a confirmed booking commits you to",
          minutes: 13,
          body: [
            "When a guest completes a booking they are not asking you a question, they are entering an agreement, and the room, the dates, the number of people and the price on that confirmation are the terms of it. This is the single idea that separates hosts who run smoothly from hosts who spend their evenings apologising: after confirmation, the things on that page are no longer yours to change unilaterally.",
            "Read what the confirmation actually says before the guest arrives, and read it again the morning of the arrival. It names the room type you sold, not merely a room; it names an arrival window; it names how many adults and children the price covers. A guest who booked a room for two and arrives with four has changed the agreement, and the moment to say so is at the desk on arrival, politely and with the confirmation open, not silently by charging them more later.",
            "You are allowed to be unable to honour a booking. Buildings flood, generators fail and staff do not turn up. What you are not allowed to do is discover it at the moment the guest arrives, because at that point the guest has travelled, has nowhere to sleep and has already paid. Tell the platform and the guest the instant you know, and move them somewhere of at least the same standard at your cost, which is what any serious operator in Kigali would do and what your rating will survive.",
            "Keep the arrival itself boring. Confirm the identity of the person checking in against the booking, hand over the key, walk them to the room, and say out loud when breakfast is and how to reach the desk at night. Almost every review that mentions a problem also mentions that nobody explained something at arrival.",
          ],
          quiz: [
            {
              slug: "booking-is-a-contract",
              prompt:
                "After a booking is confirmed, which of these may you change on your own?",
              options: [
                "The nightly price, if your costs have risen since",
                "The room type, as long as the replacement is roughly similar",
                "The number of guests the price covers",
                "None of them — the confirmation is the agreement, and a change needs the guest",
              ],
              correct: 3,
              why: "Confirmation turns the listing's promise into specific terms. Changing any of them without the guest's agreement is a broken booking, however reasonable the reason feels.",
            },
            {
              slug: "cannot-honour-a-booking",
              prompt:
                "A burst pipe makes the booked room unusable two days before arrival. What is the right move?",
              options: [
                "Wait and hope the guest cancels first",
                "Tell the guest and the platform straight away and rehouse them at equal standard at your cost",
                "Put them in a smaller room at the same price and explain on arrival",
                "Cancel the booking on the morning of arrival",
              ],
              correct: 1,
              why: "Nobody is penalised for a burst pipe. Hosts are penalised for letting a guest travel to a room that is not there, because at that moment the guest has no options left.",
            },
          ],
        },
        {
          slug: "getting-paid",
          title: "How a guest pays, and when the money reaches you",
          minutes: 12,
          body: [
            "The most common misunderstanding among new hosts is that a booking and a payout are the same event, and they are not. The guest pays when they book, the money is held rather than forwarded, and it is released to you on a schedule tied to the stay itself. That gap exists for the guest's protection and it is also the reason a guest is willing to pay a property they have never seen, so it is working for you even on the days it is inconvenient.",
            "Held money is not the platform's money and it is not yet yours. It sits in escrow against the possibility that the room is not as described, that the property cannot be reached, or that the stay does not happen. If the stay proceeds normally the hold simply expires and the payout runs. If there is a dispute the hold is what makes it possible to settle it in money rather than in argument, which is far better for an honest host than a system where the guest has already paid you in cash and has to persuade you to give it back.",
            "Payouts arrive at the destination you set, which for most Rwandan hosts is a MoMo number or a bank account in the business name. Two practical points cost hosts real money here. The name on the payout destination should match the registered business, because a mismatch is the single most common reason a payout is held for review, and the number should be one somebody at the business actually watches, not a personal line that changes when a manager leaves.",
            "Reconcile weekly rather than monthly. Open the bookings for the week, open the payouts for the week, and check that every completed stay produced a payout and that every payout names a stay. Doing this on a Monday morning takes fifteen minutes and catches a problem while everyone still remembers the guest; doing it once a quarter turns it into an afternoon of guesswork.",
          ],
          quiz: [
            {
              slug: "escrow-timing",
              prompt:
                "A guest paid in full when they booked, three weeks before arrival. When does that money become yours?",
              options: [
                "Immediately — the guest has paid",
                "On the payout schedule tied to the stay, once the hold has run",
                "Only after the guest leaves a review",
                "At the end of the calendar month in which they booked",
              ],
              correct: 1,
              why: "Payment and payout are separate events. The hold between them is what makes a stranger willing to pay a property they have never seen, so it protects the host as much as the guest.",
            },
            {
              slug: "momo-payout-name",
              prompt:
                "Why should the payout MoMo or bank account be in the registered business name?",
              options: [
                "It is a formality with no practical effect",
                "It reduces the commission charged",
                "A name that does not match the registered business is the most common reason a payout is held for review",
                "It changes how quickly the guest is charged",
              ],
              correct: 2,
              why: "A payout to a name that does not match the business looks exactly like a redirected payout, so it gets checked by a human, and that check is the delay hosts most often complain about.",
            },
          ],
        },
        {
          slug: "cancellations-and-no-shows",
          title: "Cancellations, no-shows and the policy you choose",
          minutes: 10,
          body: [
            "A cancellation policy is a business decision rather than a piece of paperwork, and it is one of the few levers where being stricter genuinely costs you bookings and being looser genuinely costs you nights. A flexible policy fills a quiet calendar because it removes the risk a guest is being asked to carry; a strict one protects a property that is nearly full and cannot resell a night at short notice. Choose deliberately, according to how full you actually are, and revisit it twice a year.",
            "Whatever you choose, publish it in plain words and apply it the same way to everyone. Hosts get into trouble not by having a strict policy but by having a strict policy they waive for people who argue loudest, because that teaches every guest that the policy is a starting position and turns each cancellation into a negotiation. Consistency is what makes a strict policy tolerable to guests and a flexible one survivable for you.",
            "A no-show is not the same thing as a cancellation and should not be treated as one. The guest never told you, so you could not resell the night, and the night is genuinely lost. Mark the booking as a no-show on the day rather than a week later, because a record made on the day is evidence and a record made later is a claim, and never mark a guest as a no-show while they might still be on a delayed bus without trying to reach them first.",
            "Finally, remember that a cancellation is not automatically a lost customer. Somebody who cancelled a trip to Musanze in March may well be planning it again in August, and a short courteous message confirming the cancellation without complaint is worth more than the one night you lost.",
          ],
          quiz: [
            {
              slug: "cancellation-consistency",
              prompt:
                "You have a strict policy but you waive it whenever a guest complains loudly. What is the effect?",
              options: [
                "Guests appreciate the flexibility and rate you higher",
                "The policy stops being a policy and every cancellation becomes a negotiation",
                "Nothing, as long as you keep the written rule strict",
                "It reduces disputes because nobody is ever refused",
              ],
              correct: 1,
              why: "A rule applied unevenly teaches guests that the rule is an opening position. Consistency is what makes any policy, strict or flexible, actually work.",
            },
            {
              slug: "no-show-handling",
              prompt:
                "A guest has not arrived by midnight and has not been in touch. What should you do first?",
              options: [
                "Mark them a no-show immediately and resell the room",
                "Try to reach them, then record the no-show on the day if there is no answer",
                "Wait a week, then decide",
                "Cancel the booking so it disappears from the calendar",
              ],
              correct: 1,
              why: "A delayed bus is not a no-show. Trying to reach them costs nothing, and a record made on the day is evidence while a record made a week later is only a claim.",
            },
          ],
        },
        {
          slug: "rra-compliance",
          title: "RRA compliance for a small accommodation business",
          minutes: 15,
          body: [
            "Compliance is not a separate activity you do at the end of the year, it is a set of habits that either sit inside your daily routine or do not exist at all, and the hosts who find it painful are almost always the ones trying to reconstruct twelve months of guests in the week before a deadline. Build the habits first and the deadlines stop being events.",
            "The foundation is registration. Your business needs to be registered and to hold its own TIN, and every document you later issue, every payout you receive and every declaration you file hangs off that number. A property operating on a personal arrangement rather than a registered business cannot be listed, cannot be paid cleanly and cannot be defended if anybody asks a question, which is why Injishi asks for the registration before the rooms.",
            "The daily habit is the receipt. Every sale to a guest is invoiced through the electronic billing system, at the time of the sale, in the guest's name, and the guest is given their copy. That includes the room, and it also includes the things hosts routinely forget to invoice: the bar, the restaurant, the hall you hired out for a wedding, the parking you charged for and the laundry you did. An unreceipted sale is not a small administrative slip; it is the specific thing an audit looks for and the easiest thing in the world to prove after the fact.",
            "The monthly habit is reconciliation, and it is the same fifteen minutes described in the payments lesson seen from the other side. Match your declared sales against your bookings and your payouts, so that the three tell one story. When they do not, find out why in the same month, while the guest, the invoice and the payout are all still recognisable.",
            "Keep the paperwork you would need if somebody asked tomorrow: the registration certificate, the tax clearance, the invoices you issued, and the licences your district requires for the accommodation itself and for serving food and drink. None of it is difficult to hold on to. All of it is very difficult to recreate.",
          ],
          quiz: [
            {
              slug: "ebm-receipt",
              prompt:
                "Which of these sales needs an electronic invoice issued to the guest?",
              options: [
                "Only the room",
                "The room and the restaurant, but not the bar",
                "Every sale to the guest, including room, bar, restaurant, hall hire, parking and laundry",
                "Only sales above a certain value",
              ],
              correct: 2,
              why: "The obligation follows the sale, not the size or the category. Bar, hall hire and parking are the ones hosts forget, and they are exactly what an audit reconstructs first.",
            },
            {
              slug: "tin-registration",
              prompt:
                "Why does Injishi ask for your business registration before it will list your rooms?",
              options: [
                "To slow down new listings",
                "Because payouts, invoices and declarations all hang off the registered business and its TIN",
                "Because it is required to take photographs",
                "So that the platform can set your prices",
              ],
              correct: 1,
              why: "Registration is what makes a clean payout, a valid invoice and an honest declaration possible. A listing without it creates money movements nobody can account for.",
            },
          ],
        },
      ],
    },
  ],
};

/** Every lesson in the course, in order, flattened across modules. */
export const TRAINING_LESSONS: TrainingLesson[] = TRAINING_COURSE.modules.flatMap(
  (module) => module.lessons,
);

/** One lesson by slug, or `null` — a typed URL must not throw. */
export function findTrainingLesson(slug: string): TrainingLesson | null {
  return TRAINING_LESSONS.find((lesson) => lesson.slug === slug) ?? null;
}

/** The lesson after `slug`, or `null` at the end of the course. */
export function nextTrainingLesson(slug: string): TrainingLesson | null {
  const index = TRAINING_LESSONS.findIndex((lesson) => lesson.slug === slug);
  if (index < 0) return null;
  return TRAINING_LESSONS[index + 1] ?? null;
}

/** Total authored reading time, so the landing page does not hand-count it. */
export const TRAINING_MINUTES: number = TRAINING_LESSONS.reduce(
  (total, lesson) => total + lesson.minutes,
  0,
);

/** How many marked questions the whole course asks. */
export const TRAINING_QUESTION_COUNT: number = TRAINING_LESSONS.reduce(
  (total, lesson) => total + lesson.quiz.length,
  0,
);

/**
 * The mark a learner must reach across the course before a certificate is
 * issued. Authored here rather than in the store so that the number a page
 * prints and the number the store enforces cannot drift apart.
 */
export const TRAINING_PASS_MARK = 70;
