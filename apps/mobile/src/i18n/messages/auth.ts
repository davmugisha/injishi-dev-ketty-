/**
 * `auth` - sign in, verify code, activate (frames X1 to X3). Session 1 owns it.
 *
 * ## The identifier is an email address (ADR-038 child 1b)
 *
 * It used to be a phone number, because frames X1 to X3 draw one. Nothing
 * behind those frames ever agreed: the login has been an email since F-S01,
 * `users_email_lower_uk` enforces one account per address,
 * `lease_invitations.email` keys the invitation, and `packages/auth` registers
 * exactly one plugin, `emailOTP`. X1's footnote also named an "SMS adapter
 * mock" that has no counterpart in the codebase, the schema, or any feature
 * spec. So the phone keys are gone from this block, and `phone.ts` survives for
 * `pay-rent` and Account, where a phone number is genuinely what is meant.
 *
 * Two vocabulary notes, because both are refusals rather than preferences:
 *
 *   - **The frames print arrows and dingbats** - "Continue ->", "Activate &
 *     review lease ->", "rayan@example.rw [tick]". None of them is here. Design
 *     brief 8.1 bans an emoji or a dingbat glyph in an icon slot or in copy, so
 *     the arrow is dropped and the tick is drawn as an `Icon`, which is what
 *     the rule asks for and what a screen reader can actually name.
 *   - **`auth.demoCode` and `auth.googleNotWired` say out loud what is and is
 *     not wired.** The canvas rule is that consequences are printed rather than
 *     discovered later. `auth.demoCode` is now shown only where the API reports
 *     the demo environment (AC-E14), never unconditionally.
 *
 * ## The `rw` column
 *
 * **`rw` entries are placeholders that keep the record complete and the build
 * compiling. They are not translations.** Kinyarwanda is not in v1.0
 * (`mobile-v1/gaps.md` X6), so nothing here is translated, verified on a
 * device, or gated on a native review. The type is what forces a value to
 * exist; it can never prove the value is right. Every label slot tolerates a
 * string about 40% longer than its English text, which is the standing rule
 * that keeps the later translation from forcing a re-layout.
 *
 * A value ending in ` (RW)` is explicitly untranslated. The rest are working
 * placement copy from Session 11's pass and are under the same warning.
 */

export const en = {
  /* X1 - Sign in */
  'auth.signInTitleA': 'Renting in Rwanda,',
  'auth.signInTitleB': 'done properly.',
  'auth.signInBody': 'Leases, rent and filings, for tenants, landlords and brokers.',
  'auth.emailLabel': 'Email address',
  'auth.emailPlaceholder': 'you@example.rw',
  'auth.emailHint': 'The address you use with Injishi.',
  'auth.emailHintOk': 'Looks right',
  'auth.emailError': 'That does not look like an email address.',
  'auth.continue': 'Continue',
  'auth.sendingCode': 'Sending the code…',
  // The honest footnote. The phone cannot see the API's mail configuration and
  // nothing exposes it, so the split is by environment, not by `RESEND_API_KEY`.
  'auth.emailFootnote': 'We will email you a one-time code.',
  'auth.emailFootnoteDemo': 'Demo: no email is sent. The code is {code}.',
  'auth.noDocuments':
    'Signing in never asks for identity documents. Booking a stay does not need them either.',
  'auth.or': 'or',
  'auth.google': 'Sign in with Google',
  'auth.googleNotWired':
    'Google sign-in is drawn here, not wired. Sign in with your email address.',

  /* X2 - Verify code */
  'auth.verifyTitle': 'Enter the code',
  'auth.verifyBody': 'We sent a 6-digit code to {email}',
  'auth.codeLabel': 'Verification code',
  'auth.codeHint': 'Six digits. Pasting the whole code works.',
  'auth.verifying': 'Verifying…',
  'auth.codeWrong': 'That code is wrong or has expired. Check the newest email, or send a new one.',
  'auth.resendIn': 'Resend code in {time}',
  'auth.resend': 'Resend code',
  'auth.resendDone': 'A new code is on its way.',
  // The app's own words for a 429, deliberately NOT the server's. Better Auth
  // answers in English and an English sentence dropped into a translated screen
  // is the one case where "show the server's own message" has to yield.
  'auth.resendTooSoon': 'That was too quick. Wait a moment before asking for another code.',
  'auth.rateLimit': 'Codes are rate limited per address, so a burst of resends is refused.',
  'auth.demoCode': 'Demo: the code is {code}. No email is sent.',
  'auth.changeEmail': 'Use a different address',
  'auth.signedInToast': 'Signed in as {email}',

  /* X3 - Activate */
  'auth.activateTitle': 'You have been invited',
  'auth.activateBody':
    '{org} registered a lease for you. Activate your account to review and sign it.',
  'auth.inviteLabel': 'The lease waiting for you',
  'auth.unitLine': '{unit} · {org}',
  'auth.perMonth': '/mo',
  'auth.termMonths': '{count} months',
  'auth.nameLabel': 'Your name',
  'auth.nameHint': 'This is the name that goes on the lease.',
  'auth.nameError': 'The lease needs a name on it.',
  'auth.inviteEmailLabel': 'Email, from the invite',
  'auth.inviteEmailHint':
    'Your landlord entered this address. It is how the invite reached you, so it is fixed here.',
  'auth.inviteVerified': 'Verified',
  'auth.activateAction': 'Activate and review lease',
  'auth.activating': 'Activating…',
  'auth.activateConsequence':
    'Next: the lease opens for you to read and sign. Activating signs nothing.',
  'auth.activateFootnote': 'By activating you agree to the Terms and the Privacy Policy.',
  'auth.notYou': 'Not you? Sign in instead',

  /* -------------------------------- the send failing (gaps.md B3) --------- */
  // The entry point to the whole app rendered NO failure state. Every person
  // who ever fails to sign in met a button that stopped saying "Sending" and
  // then did nothing. `verify-otp` already had this; sign-in did not, which is
  // the asymmetry B3 names.
  'auth.sendFailedTitle': 'We could not send your code',
  'auth.sendFailedBody': 'We could not reach Injishi. Nothing has been sent.',
  'auth.sendRetry': 'Try again',
  'auth.sendFailedOffline':
    'You are offline. A sign-in code needs a connection — we cannot send one and hold it for later.',

  /* -------------------------------- the emailed step-up (F-S02, AC-S7) ---- */
  // Asked BEFORE an operator surface renders, never after a refusal. The
  // address is masked because the server masks it and because it was never
  // typed on this screen — unlike sign-in verify, where masking would hide the
  // person's own typo from them.
  'stepUp.title': 'One more code',
  'stepUp.body': 'We emailed a code to {email}',
  'stepUp.why':
    'Operator screens ask for a second code once per sign-in. It lasts as long as this session.',
  'stepUp.done': 'Verified. Opening your workspace.',

  /* -------------------------------- the demo persona picker (AC-S10) ------ */
  // Only rendered where `GET /api/v1/platform` says demo (ADR-043), and the
  // roster then comes from `GET /api/v1/demo/personas`. On any other host the
  // list is ABSENT, not hidden.
  'auth.demoPersonasTitle': 'Demo accounts',
  'auth.demoPersonasHint': 'Tap one to fill the address and the code.',
  'auth.demoPersonaSeats': '{count} seats',
  // When the demo data was last rebuilt (ADR-043, AC-19). `{when}` is Kigali time.
  'auth.demoLastReset': 'Demo data last reset {when}.',
} as const;

/**
 * Parity is a type error here, not a review note: `rw` is keyed off this
 * file's own `en`, so a key added to one and not the other fails `tsc` in
 * this file rather than in the merge.
 *
 * **These are placeholders, not translations** — see the note at the top of
 * this file. Session 11's Kinyarwanda pass wrote working placement copy for
 * the keys that existed then; ADR-038 child 1b's new keys carry ` (RW)`, which
 * marks a sentence no Kinyarwanda was written for. Neither form is reviewed and
 * neither ships as language.
 *
 * Two borrowed words stay borrowed — "email", "Google" — because a reader
 * looking for them on a phone or a screen will be looking for the borrowed
 * form, and an invented Kinyarwanda coinage would be a word nobody uses.
 */
export const rw: Record<keyof typeof en, string> = {
  /* X1 - Sign in */
  'auth.signInTitleA': 'Gukodesha mu Rwanda,',
  'auth.signInTitleB': 'byakozwe neza.',
  'auth.signInBody': 'Amasezerano, ubukode n’imenyekanisha, ku bakode, ba nyir’inzu n’abahuza.',
  'auth.emailLabel': `${en['auth.emailLabel']} (RW)`,
  'auth.emailPlaceholder': en['auth.emailPlaceholder'],
  'auth.emailHint': `${en['auth.emailHint']} (RW)`,
  'auth.emailHintOk': 'Birasa neza',
  'auth.emailError': `${en['auth.emailError']} (RW)`,
  'auth.continue': 'Komeza',
  'auth.sendingCode': 'Kohereza kode…',
  'auth.emailFootnote': `${en['auth.emailFootnote']} (RW)`,
  'auth.emailFootnoteDemo': `${en['auth.emailFootnoteDemo']} (RW)`,
  'auth.noDocuments':
    'Kwinjira ntibigusaba ibyangombwa by’irangamuntu. No kwandikisha aho kuraramo ntibibisaba.',
  'auth.or': 'cyangwa',
  'auth.google': 'Injira ukoresheje Google',
  'auth.googleNotWired': `${en['auth.googleNotWired']} (RW)`,

  /* X2 - Verify code */
  'auth.verifyTitle': 'Andika kode',
  'auth.verifyBody': 'Twoherereje kode y’imibare 6 kuri {email}',
  'auth.codeLabel': 'Kode yo kwemeza',
  'auth.codeHint': 'Imibare itandatu. Gushyiramo kode yose icyarimwe birakora.',
  'auth.verifying': 'Kwemeza…',
  'auth.codeWrong': `${en['auth.codeWrong']} (RW)`,
  'auth.resendIn': 'Ongera wohereze kode mu {time}',
  'auth.resend': 'Ongera wohereze kode',
  'auth.resendDone': 'Kode nshya iraje.',
  'auth.resendTooSoon': `${en['auth.resendTooSoon']} (RW)`,
  'auth.rateLimit': `${en['auth.rateLimit']} (RW)`,
  'auth.demoCode': `${en['auth.demoCode']} (RW)`,
  'auth.changeEmail': `${en['auth.changeEmail']} (RW)`,
  'auth.signedInToast': 'Winjiye nka {email}',

  /* X3 - Activate */
  'auth.activateTitle': 'Waratumiwe',
  'auth.activateBody':
    '{org} yakwandikiye amasezerano. Fungura konti yawe kugira ngo uyasome kandi uyashyireho umukono.',
  'auth.inviteLabel': 'Amasezerano agutegereje',
  'auth.unitLine': '{unit} · {org}',
  'auth.perMonth': '/ukwezi',
  'auth.termMonths': 'Amezi {count}',
  'auth.nameLabel': 'Amazina yawe',
  'auth.nameHint': 'Aya ni amazina ajya ku masezerano.',
  'auth.nameError': 'Amasezerano akeneye amazina ariho.',
  'auth.inviteEmailLabel': `${en['auth.inviteEmailLabel']} (RW)`,
  'auth.inviteEmailHint': `${en['auth.inviteEmailHint']} (RW)`,
  'auth.inviteVerified': 'Byemejwe',
  'auth.activateAction': 'Emeza hanyuma usome amasezerano',
  'auth.activating': 'Biremezwa…',
  'auth.activateConsequence':
    'Ibikurikira: amasezerano arafunguka kugira ngo uyasome uyashyireho umukono. Gufungura konti nta na kimwe gishyirwaho umukono.',
  'auth.activateFootnote': 'Ufunguye konti wemera Amabwiriza na Politiki y’Ibanga.',
  'auth.notYou': 'Si wowe? Injira',

  'auth.sendFailedTitle': `${en['auth.sendFailedTitle']} (RW)`,
  'auth.sendFailedBody': `${en['auth.sendFailedBody']} (RW)`,
  'auth.sendRetry': `${en['auth.sendRetry']} (RW)`,
  'auth.sendFailedOffline': `${en['auth.sendFailedOffline']} (RW)`,

  'stepUp.title': `${en['stepUp.title']} (RW)`,
  'stepUp.body': `${en['stepUp.body']} (RW)`,
  'stepUp.why': `${en['stepUp.why']} (RW)`,
  'stepUp.done': `${en['stepUp.done']} (RW)`,

  'auth.demoPersonasTitle': `${en['auth.demoPersonasTitle']} (RW)`,
  'auth.demoPersonasHint': `${en['auth.demoPersonasHint']} (RW)`,
  'auth.demoPersonaSeats': `${en['auth.demoPersonaSeats']} (RW)`,
  'auth.demoLastReset': `${en['auth.demoLastReset']} (RW)`,
};
