/**
 * `pay` — the async payment state machine's copy, shared by the booking
 * checkout and the rent sheet.
 *
 * One namespace rather than two, because it is one machine. `book` owns the
 * checkout's own words and `tenant` owns the rent screen's; everything about
 * *what the rail is doing* is here, so the two screens cannot drift into saying
 * different things about the same four states.
 *
 * ## Why these strings are written the way they are
 *
 * Every terminal state names its NEXT ACTION. `ui-rules.md` forbids a raw error
 * message and "Payment failed" alone is one: it tells someone that money did
 * not move and leaves them with nothing to do about it. Each `next*` key below
 * is the sentence that makes the state actionable.
 *
 * `prompting` names the HANDSET. A guest with two SIMs told only "check your
 * phone" checks the wrong one, and the prompt has a timeout.
 *
 * `unknown` never claims either outcome. `benchmarks.md` §4 calls it *"the
 * commonest real case"* — the app has come back and the callback has not — and
 * a screen that guesses in either direction is worse than one that says so.
 *
 * ## The RW column
 *
 * **Not translated, deliberately, and MARKED as such.** Kinyarwanda is not in
 * v1.0; it lands after it. The catalogue types `rw` as
 * `Record<keyof typeof en, string>` so a key cannot simply be absent, and
 * inventing Kinyarwanda for a money screen is worse than shipping the English
 * it will ship anyway — a mistranslated refusal reason on a payment is a person
 * acting on a sentence nobody checked.
 *
 * So each value is the English string with the project's own ` (RW)` marker on
 * it, which `host-format.test.ts` describes as *"the deliberate marker for a
 * string this session had no confident Kinyarwanda for"*. The marker is what
 * separates this from the failure that test actually guards against: *"a value
 * that is simply the English, unmarked, which is a translation nobody can
 * find."* This block is the translation pass's work list and it is greppable.
 */

export const en = {
  /* ------------------------------------------------------------ prompting */
  'pay.checkYourPhone': 'Check your phone',
  // The two facts a guest needs while they are somewhere else: which handset,
  // and that the PIN is entered THERE and not here.
  'pay.checkYourPhoneBody': 'We sent a payment prompt to {handset}. Enter your PIN on that phone — not in this app.',
  // Only codes a Rwandan source confirms: MTN's `*182#`, and no Airtel code
  // until one is confirmed (benchmarks.md rows 29 and 46; mobile audit
  // 2026-10-05, GK-19). Shown as text, never as a dial link.
  'pay.ussdMomo': 'No prompt? Dial *182# on {handset} to open MTN MoMo.',
  'pay.ussdAirtel': 'No prompt? Open the Airtel Money app on {handset}.',
  'pay.leavingNote': 'You can leave this app. We will still be here when you come back.',
  'pay.waitingLabel': 'Waiting for your approval',

  /* ------------------------------------------------------------ confirmed */
  'pay.confirmedTitle': 'Payment confirmed',
  'pay.reference': 'Transaction reference',
  'pay.referenceHint': 'Keep this. It is what an agent will ask you for.',
  'pay.copyReference': 'Copy reference',
  'pay.referenceCopied': 'Reference copied',

  /* -------------------------------------------------------------- unknown */
  'pay.stillConfirming': 'Still confirming',
  'pay.unknownBody': 'Your bank has not answered yet. This is normal and it does not mean the payment failed — do not pay again.',
  'pay.checkAgain': 'Check again',
  'pay.checkingAgain': 'Checking…',

  /* -------------------------------------------------------------- refused */
  'pay.refusedTitle': 'Payment not approved',
  'pay.refusedByCustomer': 'The prompt was declined on {handset}.',
  'pay.nextRefused': 'Try again, or pick a different way to pay.',
  'pay.insufficientFunds': 'There was not enough in the {handset} wallet.',
  'pay.nextInsufficient': 'Top up and try again, or pick a different way to pay.',

  /* -------------------------------------------------------------- expired */
  'pay.expiredTitle': 'The prompt timed out',
  'pay.promptExpired': 'The prompt on {handset} was not answered in time.',
  'pay.nextExpired': 'Send it again and approve it on your phone.',
  'pay.tryAgain': 'Send the prompt again',

  /* --------------------------------------------------------------- resume */
  'pay.resumeTitle': 'You have a payment in progress',
  'pay.resumeBody': '{amount} to {handset}. We are still waiting for your bank.',
  'pay.resumeOpen': 'Open it',

  /* ------------------------------------------------------------- refusals */
  // Rent is deliberately NOT in the offline write queue: a queued payment is a
  // payment nobody consciously authorised at the moment it fires. So the
  // refusal has to say why, and leave the obligation visible.
  'pay.offlineTitle': 'You are offline',
  'pay.offlineBody': 'A payment needs a connection. We will not queue it — a payment that fires later is one you did not agree to at the time. Your rent is still due; come back when you have signal.',
  'pay.a11yState': 'Payment status: {state}',

  /* --------------------------------------------------------- adapter mode */
  // ui-rules.md: a mocked success must never look like a real one. The state
  // that most needs this said is the CONFIRMED one, which is why the chip is
  // rendered on every state rather than on the failures.
  'pay.mockAdapter': 'Payments · mock adapter',
  'pay.mockAdapterHint': 'No money moves. This reference is not a real transaction.',

  /* ------------------------------------------------- the offline write queue */
  // Every string a queued intent can show. They live in this namespace rather
  // than in each screen's because the queue is one mechanism: a fault report
  // and a room status waiting to send should not describe themselves
  // differently.
  'queue.waitingOne': '1 thing waiting to send',
  'queue.waitingMany': '{count} things waiting to send',
  'queue.willSend': 'We will send it when you are back online. Nothing is lost.',
  'queue.sendFailed': 'That did not send.',
  // A refusal, which is a different thing from a failure to reach the server
  // (ADR-038 child 0, AC-S17). The server's own sentence is shown beside this
  // one and is what actually explains it, so this line only says which of the
  // two happened and that trying again will not help.
  'queue.refused': 'Injishi would not accept that.',
  'queue.noHandler': 'This app does not know how to send that yet.',
  'queue.retry': 'Try now',
  'queue.cancelOne': 'Discard',
  'queue.queued': 'Waiting to send',
  'queue.sending': 'Sending…',
  'queue.sent': 'Sent',
  'queue.failed': 'Not sent',
  // "Submitted when you reconnect", never "received" — data-seam.md §5. The
  // report has not reached anyone yet and saying it has is the lie the queue
  // makes tempting.
  'queue.submittedWhenOnline': 'Saved. It will be submitted when you reconnect.',
  'queue.a11yPending': '{count} actions waiting to send',
} as const;

export const rw: Record<keyof typeof en, string> = {
  'pay.checkYourPhone': `${en['pay.checkYourPhone']} (RW)`,
  'pay.checkYourPhoneBody': `${en['pay.checkYourPhoneBody']} (RW)`,
  'pay.ussdMomo': `${en['pay.ussdMomo']} (RW)`,
  'pay.ussdAirtel': `${en['pay.ussdAirtel']} (RW)`,
  'pay.leavingNote': `${en['pay.leavingNote']} (RW)`,
  'pay.waitingLabel': `${en['pay.waitingLabel']} (RW)`,
  'pay.confirmedTitle': `${en['pay.confirmedTitle']} (RW)`,
  'pay.reference': `${en['pay.reference']} (RW)`,
  'pay.referenceHint': `${en['pay.referenceHint']} (RW)`,
  'pay.copyReference': `${en['pay.copyReference']} (RW)`,
  'pay.referenceCopied': `${en['pay.referenceCopied']} (RW)`,
  'pay.stillConfirming': `${en['pay.stillConfirming']} (RW)`,
  'pay.unknownBody': `${en['pay.unknownBody']} (RW)`,
  'pay.checkAgain': `${en['pay.checkAgain']} (RW)`,
  'pay.checkingAgain': `${en['pay.checkingAgain']} (RW)`,
  'pay.refusedTitle': `${en['pay.refusedTitle']} (RW)`,
  'pay.refusedByCustomer': `${en['pay.refusedByCustomer']} (RW)`,
  'pay.nextRefused': `${en['pay.nextRefused']} (RW)`,
  'pay.insufficientFunds': `${en['pay.insufficientFunds']} (RW)`,
  'pay.nextInsufficient': `${en['pay.nextInsufficient']} (RW)`,
  'pay.expiredTitle': `${en['pay.expiredTitle']} (RW)`,
  'pay.promptExpired': `${en['pay.promptExpired']} (RW)`,
  'pay.nextExpired': `${en['pay.nextExpired']} (RW)`,
  'pay.tryAgain': `${en['pay.tryAgain']} (RW)`,
  'pay.resumeTitle': `${en['pay.resumeTitle']} (RW)`,
  'pay.resumeBody': `${en['pay.resumeBody']} (RW)`,
  'pay.resumeOpen': `${en['pay.resumeOpen']} (RW)`,
  'pay.offlineTitle': `${en['pay.offlineTitle']} (RW)`,
  'pay.offlineBody': `${en['pay.offlineBody']} (RW)`,
  'pay.a11yState': `${en['pay.a11yState']} (RW)`,
  'pay.mockAdapter': `${en['pay.mockAdapter']} (RW)`,
  'pay.mockAdapterHint': `${en['pay.mockAdapterHint']} (RW)`,
  'queue.waitingOne': `${en['queue.waitingOne']} (RW)`,
  'queue.waitingMany': `${en['queue.waitingMany']} (RW)`,
  'queue.willSend': `${en['queue.willSend']} (RW)`,
  'queue.sendFailed': `${en['queue.sendFailed']} (RW)`,
  'queue.refused': `${en['queue.refused']} (RW)`,
  'queue.noHandler': `${en['queue.noHandler']} (RW)`,
  'queue.retry': `${en['queue.retry']} (RW)`,
  'queue.cancelOne': `${en['queue.cancelOne']} (RW)`,
  'queue.queued': `${en['queue.queued']} (RW)`,
  'queue.sending': `${en['queue.sending']} (RW)`,
  'queue.sent': `${en['queue.sent']} (RW)`,
  'queue.failed': `${en['queue.failed']} (RW)`,
  'queue.submittedWhenOnline': `${en['queue.submittedWhenOnline']} (RW)`,
  'queue.a11yPending': `${en['queue.a11yPending']} (RW)`,
};
