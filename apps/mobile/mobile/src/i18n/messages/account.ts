/**
 * `account` — Account for every seat, the workspace switcher, and the ten
 * places Account's rows go.
 *
 * Session 0 seeded the switcher and a two-domain Account; **Session 11 wrote
 * the rest** when it built the per-seat screen. The prefixes are one per
 * destination — `payout`, `org`, `staff`, `plan`, `subscription`, `credits`,
 * `personal`, `security`, `appearance`, `signOut`, `createWorkspace` — rather
 * than everything under `account.`, because a hundred and eighty keys under one
 * prefix is a file nobody can find anything in.
 *
 * ## The Kinyarwanda here is written rather than stubbed
 *
 * Session 11's audit brief asks for every ` (RW)` placeholder to be replaced
 * where possible and the rest listed for native review. This namespace carries
 * no placeholders: every key below has Kinyarwanda. It is working translation
 * for LAYOUT — the point of having it is that switching language stresses the
 * lines — and it still wants a native pass before it ships. Two habits it
 * follows, both from `ui-rules.md`: the RW runs longer than the EN and nothing
 * may truncate, so no string here is written to fit a fixed width; and a
 * borrowed technical term ("TIN", "MoMo", "2FA") stays in its borrowed form
 * rather than being invented, because a reader looking for it on a document
 * will be looking for the borrowed word.
 */

export const en = {
  /* ------------------------------------------------------ the switcher (X4) */
  'switch.title': 'Switch workspace',
  'switch.domain': 'Domain',
  'switch.hospitality': 'Hospitality',
  'switch.residence': 'Residence',
  'switch.hospitalityNote': 'Explore stays, book, and manage your trips.',
  'switch.residenceNote': 'Your leases, rent, and the Caution held against them.',
  'switch.personal': 'Personal',
  'switch.business': 'Business',
  'switch.broker': 'Broker',
  'switch.active': 'Active',
  'switch.isolationNote':
    'One identity, one login. A payout as a host, rent as a tenant and a placement fee as a broker never mix — each stays inside the workspace that earned it.',
  'switch.select': 'Switch to {name}, {role}',
  'switch.open': 'Switch workspace',
  'switch.subtitle': 'One account · the tab bar follows your role.',
  'switch.current': 'Current',
  'switch.currentHint': 'You are already in this workspace.',
  'switch.switched': 'Switched to {name}',
  // The switch is asked of the server first and the app moves only on success
  // (ADR-038 child 0, AC-S6), so a refusal or an unreachable server has to say
  // so rather than leaving a person believing they moved.
  'switch.failed': 'We could not switch workspace. You are still in {name}.',
  'switch.opens': 'Opens on {tab}',
  'switch.asGuest': 'As Guest',
  'switch.asTenant': 'As Tenant',
  'switch.personalSurfaces': 'Which side of Personal to open',
  'switch.create': 'Create a business workspace',
  'switch.createHint': 'Registering a business continues on the web.',
  'switch.note':
    'Switching keeps you on Account, the one tab every workspace has, so the tab you are standing on never disappears under you. Anything half-captured is held, not dropped.',

  /* ------------------------------------------------------------- Account (R5, R14, B25, W7) */
  'account.title': 'Account',
  'account.sectionBusiness': 'Business',
  'account.sectionPreferences': 'Preferences',
  'account.switchHint': 'You are in {name}. Opens the list of your workspaces.',
  'account.isolationNote':
    'Money never crosses a workspace. A payout as a host, rent as a tenant and a placement fee as a broker each stay inside the workspace that earned them.',

  /* The role line, per seat. `{org}` and `{place}` come off the active seat. */
  'account.roleGuest': 'Guest · Personal workspace',
  'account.roleTenant': 'Tenant · Personal workspace',
  'account.roleLandlord': 'Landlord · {org}',
  'account.roleBroker': 'Broker · Kigali City',
  'account.roleWork': 'Housekeeping · {place}',
  'account.roleHost': 'Host · {org}',

  /* What the seat has proved. Four different claims — see account-fixtures.ts. */
  'account.badgeIdVerified': 'ID verified',
  'account.badgeTinVerified': 'TIN verified',
  'account.badgeLicensed': 'Licensed · {licence}',
  'account.badgePersonal': 'Personal workspace',
  'account.badgeStaffSeat': 'Staff seat',

  /* The rows */
  'account.rowCredits': 'Reveal credits',
  'account.creditsLeft': '{count} left',
  'account.creditsHint': '{count} contact reveals left this month.',
  'account.rowPayout': 'Payout account',
  'account.payoutValue': 'MoMo ••{tail}',
  'account.payoutHint': 'Where money owed to this workspace is sent.',
  'account.rowOrganisation': 'Organisation profile',
  'account.organisationHint': 'Legal name, TIN and where the business is registered.',
  'account.rowStaff': 'Staff & invites',
  'account.staffHint': 'Who can act inside this workspace.',
  'account.rowSubscription': 'Subscription',
  'account.subscriptionHint': 'You are on {plan}.',
  'account.rowPersonal': 'Personal details',
  'account.personalHint': 'Your name, phone, email and how you sign in.',
  'account.rowSecurity': 'Security',
  'account.securityHint': 'Two-step sign-in, and the devices signed in as you.',
  'account.twoFactorOn': '2FA · On',
  'account.twoFactorOff': '2FA · Off',
  'account.language': 'Language',
  'account.localeEn': 'EN',
  'account.localeRw': 'RW',
  'account.rowAppearance': 'Appearance',
  'account.appearanceHint': 'Follow the phone, or pick light or dark.',
  'account.photoCredits': 'Photo credits',
  'account.photoCreditsMeta': 'Every photograph and its licence',
  'account.signOut': 'Sign out',
  'account.signOutHint': 'Asks before it signs you out of every workspace.',

  /* ------------------------------------------------------------- Payout */
  'payout.title': 'Payout account',
  'payout.subtitle': 'Where money owed to this workspace is sent.',
  'payout.destination': 'Destination',
  'payout.momo': 'MTN Mobile Money',
  'payout.tail': '•••• {tail}',
  'payout.pending': 'Waiting to be paid out',
  'payout.pendingValue': 'Held',
  'payout.releases': 'Releases on',
  'payout.buffer': 'Dispute window',
  'payout.days': 'days',
  'payout.verified': 'Destination checked',
  'payout.bufferBody':
    'Money is held for {days} days after a stay ends, so a dispute can be settled before it leaves. Nothing has moved in this build.',
  'payout.adapterMock': 'Payments · mock adapter',
  'payout.adapterMockBody': 'Nothing is sent. Amounts are stamped, not settled.',
  'payout.adapterLive': 'Payments · live',
  'payout.adapterLiveBody': 'Payouts are sent to this destination.',
  'payout.change': 'Change destination',
  'payout.changeHint': 'Changing where money goes needs a check we do not run here.',
  'payout.changeToast': 'Changing a payout destination is verified on the web, not on the phone.',

  /* ------------------------------------------------------------- Organisation */
  'org.title': 'Organisation',
  'org.identityTitle': 'Who this business is',
  'org.identityBody': 'What a lease and an RRA filing both quote.',
  'org.legalName': 'Legal name',
  'org.tradingName': 'Trading as',
  'org.tin': 'TIN',
  'org.tinChecked': 'TIN checked',
  'org.regime': 'Tax regime',
  'org.regime.real': 'Real regime',
  'org.regime.flat': 'Flat rate',
  'org.whereTitle': 'Where it is registered',
  'org.whereBody': 'The district and sector on the registration.',
  'org.district': 'District',
  'org.sector': 'Sector',
  'org.contactTitle': 'How to reach it',
  'org.contactBody': 'The number and address on the record, not on your profile.',
  'org.phone': 'Phone',
  'org.email': 'Email',
  'org.edit': 'Change these details',
  'org.editHint': 'Changing them re-opens verification, which happens on the web.',
  'org.editNote':
    'A lease and a filing both quote these, so changing them re-opens verification rather than saving straight away.',
  'org.editToast': 'Business details are re-verified on the web, not on the phone.',

  /* ------------------------------------------------------------- Staff */
  'staff.title': 'Staff & invites',
  'staff.label': 'the staff list',
  'staff.cardTitle': 'Who can act here',
  'staff.cardBody': '{count} working now',
  'staff.since': 'since {day}',
  'staff.invitedOn': 'invited {day}',
  'staff.roleManager': 'Manager',
  'staff.roleCaretaker': 'Caretaker',
  'staff.roleAccounts': 'Accounts',
  'staff.state.active': 'Working',
  'staff.state.invited': 'Invited',
  'staff.state.suspended': 'Revoked',
  'staff.resend': 'Resend',
  'staff.revoke': 'Revoke',
  'staff.restore': 'Restore',
  'staff.resentToast': 'Invitation sent again to {name} by SMS (mock).',
  'staff.revokedToast': '{name} can no longer act in this workspace.',
  'staff.restoredToast': '{name} can act in this workspace again.',
  'staff.invitedToast': 'Invitation sent to {name} by SMS (mock).',
  'staff.invite': 'Invite someone',
  'staff.inviteNote':
    'A revoked seat stays on this list on purpose, so you can still see who used to have access.',
  'staff.inviteTitle': 'Invite someone',
  'staff.inviteSubtitle': 'They get an SMS with a link to accept.',
  'staff.inviteSend': 'Send invitation',
  'staff.inviting': 'Sending',
  'staff.inviteConsequence':
    'Accepting gives them everything a Caretaker can see in this workspace, including tenants and rent. You can revoke it at any time.',
  'staff.fieldName': 'Full name',
  'staff.fieldNamePlaceholder': 'Claudine Uwase',
  'staff.fieldPhone': 'Phone',
  'staff.fieldPhoneHelper': 'Nine digits after the country code.',
  'staff.emptyTitle': 'Nobody else works here yet',
  'staff.emptyBody':
    'You are the only seat in this workspace. Invite a caretaker or a manager and they can act on your behalf.',

  /* ------------------------------------------------------------- Plans */
  'plan.starter': 'Starter',
  'plan.growth': 'Growth',
  'plan.pro': 'Pro',
  'plan.units50': 'Up to 50 units on the rent roll',
  'plan.eSign': 'e-Sign on every lease',
  'plan.rraFiling': 'RRA filing from the app',
  'plan.twoStaff': 'Two staff seats',
  'plan.unlimitedReveals': 'Unlimited contact reveals',
  'plan.placementLedger': 'Placement ledger and fee history',
  'plan.payoutWeekly': 'Weekly payouts',
  'plan.priority': 'Priority in the directory',
  'plan.rooms10': 'Up to 10 rooms',
  'plan.selfCheckIn': 'Self check-in for guests',
  'plan.ebm': 'EBM e-invoice per sale',
  'plan.oneStaff': 'One staff seat',

  /* ------------------------------------------------------------- Subscription */
  'subscription.title': 'Subscription',
  'subscription.current': 'Current plan',
  'subscription.renews': 'Renews {day}',
  'subscription.price': 'Price',
  'subscription.perMonth': 'per month',
  'subscription.includes': 'What it includes',
  'subscription.billingTitle': 'Billing',
  'subscription.nextCharge': 'Next charge',
  'subscription.method': 'Paid with',
  'subscription.invoices': 'Invoices',
  'subscription.onWeb': 'On the web',
  'subscription.adapterMock': 'Billing · mock adapter',
  'subscription.adapterMockBody': 'No card is charged in this build.',
  'subscription.upgradeTitle': 'Move up to {plan}',
  'subscription.upgradeBody.starter': 'Ten rooms, self check-in and one staff seat.',
  'subscription.upgradeBody.growth':
    'Fifty units instead of ten, e-Sign on every lease, RRA filing from the app, and a second staff seat.',
  'subscription.upgradeBody.pro':
    'Unlimited units and staff, priority in the directory, and weekly rather than monthly payouts.',
  'subscription.upgrade': 'Move to {plan}',
  'subscription.upgradeHint': 'Changing a plan is confirmed on the web.',
  'subscription.upgradeToast': 'Plan changes are confirmed on the web, not on the phone.',
  'subscription.topPlan': 'This is the highest plan. There is nothing above it to move to.',

  /* ------------------------------------------------------------- Reveal credits */
  'credits.title': 'Reveal credits',
  'credits.greeting': 'Aline K. Brokerage',
  'credits.left': 'Left this month',
  'credits.spent': 'Spent',
  'credits.ofMonthly': 'of {total} a month',
  'credits.thisMonth': 'this month',
  'credits.whyBody':
    'A landlord’s number is personal data. A credit is a rate limit, not a paywall: it is what stops the directory being scraped and every landlord on it being harvested.',
  'credits.logTitle': 'Contacts you have revealed',
  'credits.logBody': 'Kept for the record. Nothing removes a row.',
  'credits.logUnit': '{property} · {unit}',
  'credits.retentionNote':
    'The log is the security control, so it is kept even after a placement closes. A landlord can ask who has seen their number.',
  'credits.emptyTitle': 'You have not revealed a contact yet',
  'credits.emptyBody':
    'Open a unit in the Directory and reveal its landlord to start a placement. Every reveal is logged here.',
  'credits.emptyAction': 'Open the Directory',

  /* ------------------------------------------------------------- Personal */
  'personal.title': 'Personal details',
  'personal.youTitle': 'You',
  'personal.youBody': 'The same person in every workspace you hold.',
  'personal.name': 'Name',
  'personal.phone': 'Phone',
  'personal.email': 'Email',
  'personal.editName': 'Change name',
  'personal.editNameBody': 'This is what a landlord or a host sees on a booking.',
  'personal.nameHelper': 'Your first and last name.',
  'personal.editEmail': 'Change email',
  'personal.editEmailBody': 'Receipts and lease documents go here.',
  'personal.emailHelper': 'It is never shown on your public profile.',
  'personal.save': 'Save',
  'personal.saving': 'Saving',
  'personal.savedToast': 'Saved.',
  'personal.publicTitle': 'What other people see',
  'personal.publicBody':
    'Reviews and public profiles show your first name and last initial. Your email and phone are never on them.',
  'personal.methodsTitle': 'How you sign in',
  'personal.methodsBody': 'There is no password. Each of these is a way in.',
  'personal.methodPhone': 'Phone number',
  'personal.methodGoogle': 'Google',
  'personal.googleBody': 'Not linked. Linking gives you a second way in.',
  'personal.googleLinkedBody': 'Linked. You can sign in with either.',
  'personal.linked': 'Linked',
  'personal.notLinked': 'Not linked',
  'personal.link': 'Link',
  'personal.unlink': 'Unlink',
  'personal.linkedToast': 'Google linked. You can sign in with either now.',
  'personal.unlinkedToast': 'Google unlinked. Your phone number still signs you in.',
  'personal.lastMethodNote':
    'Your phone number cannot be unlinked while it is your only way in. Link Google first if you want to change it.',

  /* ------------------------------------------------------------- Security */
  'security.title': 'Security',
  'security.label': 'your devices',
  'security.twoFactorTitle': 'Two-step sign-in',
  'security.twoFactorBody': 'A code as well as your number, every time you sign in on a new device.',
  'security.twoFactorLabel': 'Two-step sign-in (2FA)',
  'security.twoFactorOn': 'On. A code is asked for on a new device.',
  'security.twoFactorOff': 'Off. Your number alone signs you in.',
  'security.twoFactorHint': 'Turns the second step on or off for this account.',
  'security.turnOn': 'Turn on',
  'security.turnOff': 'Turn off',
  'security.twoFactorOnToast': 'Two-step sign-in is on.',
  'security.twoFactorOffToast': 'Two-step sign-in is off. Your number alone signs you in.',
  'security.devicesTitle': 'Signed in as you',
  'security.devicesBody': '{count} devices',
  'security.thisDevice': 'This device',
  'security.stale': 'Not used lately',
  'security.seenToday': 'used today',
  'security.seenYesterday': 'used yesterday',
  'security.seenDaysAgo': 'used {days} days ago',
  'security.revoke': 'Sign out',
  'security.revokeOne': 'Sign out {device}',
  'security.revokedToast': '{device} has been signed out.',
  'security.revokeAll': 'Sign out everywhere else',
  'security.revokeAllNote':
    'Signs out {count} other devices. This one stays signed in, and anyone using another will have to sign in again.',
  'security.revokeAllNone': 'Nothing else is signed in as you.',
  'security.revokedAllToast': '{count} other devices signed out.',
  'security.confirmTitle': 'Sign out everywhere else?',
  'security.confirmBody': '{count} devices will be signed out. This one will not.',
  'security.confirmDetail':
    'Use this if you see a device you do not recognise. Anyone using one of them — including you, on your own computer — will have to sign in again.',
  'security.confirmAction': 'Sign the others out',
  'security.confirmCancel': 'Keep them signed in',

  /* ------------------------------------------------------------- Appearance */
  'appearance.title': 'Appearance',
  'appearance.subtitle': 'How the app is drawn on this phone.',
  'appearance.system': 'System',
  'appearance.light': 'Light',
  'appearance.dark': 'Dark',
  'appearance.systemBody': 'Follows the phone. Currently {scheme}.',
  'appearance.lightBody': 'Always light, whatever the phone is set to.',
  // Says what separates it from Light, which is the only question somebody
  // choosing between the two is actually asking (ADR-033).
  'appearance.darkBody': 'Always dark, whatever the phone is set to.',

  /* ------------------------------------------------------------- Sign out */
  'signOut.title': 'Sign out?',
  'signOut.subtitle': 'You are signed in as {name}.',
  'signOut.scope':
    'This signs you out of all {count} of your workspaces, not just this one. Signing back in restores every seat.',
  'signOut.switchInstead':
    'If you only wanted to leave {name}, use Switch workspace instead — it keeps you signed in.',
  'signOut.confirm': 'Sign out',
  'signOut.cancel': 'Stay signed in',

  /* ------------------------------------------------------------- Create workspace */
  'createWorkspace.title': 'This continues on the web',
  'createWorkspace.subtitle': 'Registering a business needs documents a phone cannot check.',
  'createWorkspace.urlLabel': 'Open on a computer',
  'createWorkspace.needsTitle': 'What you will be asked for',
  'createWorkspace.needTin': 'Your RRA taxpayer number (TIN)',
  'createWorkspace.needAddress': 'The district and sector the business is registered in',
  'createWorkspace.needEvidence': 'A photograph of the registration document',
  'createWorkspace.needReview': 'A review, which a verification officer works through',
  'createWorkspace.whyWeb':
    'It is not a screen we have not built yet. Verification is document-heavy and is reviewed by a person, so it lives where documents are easy to attach.',
  'createWorkspace.open': 'Open the web form',
  'createWorkspace.openHint': 'Opens injishi.rw in your browser.',
  'createWorkspace.openFailed': 'No browser on this device. The address above can be copied by hand.',

  /* ------------------- payout-account's states (gaps.md §6, P1) ----------- */
  // The screen that says where money lands had no loading, error or empty
  // state. On this screen the danger is specific: a failed read that showed the
  // last-known destination would tell somebody their rent is going somewhere it
  // may no longer be going, and they would believe it.
  'payout.errorTitle': 'We could not load your payout account',
  'payout.errorBody': 'This is the only screen that says where your money lands, so we will not show you a destination we are not sure of. Try again.',
  'payout.loading': 'Loading your payout account',
  'payout.noneTitle': 'No payout account yet',
  'payout.noneBody': 'Money is being held until you add one. Nothing is lost — it is waiting.',
} as const;

/**
 * Parity is a type error here, not a review note: `rw` is keyed off this
 * file's own `en`, so a key added to one and not the other fails `tsc` in
 * this file rather than in the merge.
 */
export const rw: Record<keyof typeof en, string> = {
  /* ------------------------------------------------------ the switcher (X4) */
  'switch.title': 'Hindura urwego',
  'switch.domain': 'Urwego',
  'switch.hospitality': 'Ubukerarugendo',
  'switch.residence': 'Ubukode',
  'switch.hospitalityNote': 'Shakisha aho kuraramo, wandike, ucunge ingendo zawe.',
  'switch.residenceNote': 'Amasezerano yawe, ubukode, n’ingwate ibitswe.',
  'switch.personal': 'Bwite',
  'switch.business': 'Ubucuruzi',
  'switch.broker': 'Umuhuza',
  'switch.active': 'Irakora',
  'switch.isolationNote':
    'Umuntu umwe, kwinjira rimwe. Amafaranga nk’umucuruzi, ubukode nk’ukodesha n’ikiguzi cy’umuhuza ntibivangwa — buri kimwe gisigara mu rwego cyakivuyemo.',
  'switch.select': 'Simbukira kuri {name}, {role}',
  'switch.open': 'Hindura urwego',
  'switch.subtitle': 'Konti imwe · urutonde rw’amasakoshi rukurikira uruhare rwawe.',
  'switch.current': 'Iriho',
  'switch.currentHint': 'Uri muri uru rwego ubu.',
  'switch.switched': 'Wahinduriye kuri {name}',
  'switch.failed': `${en['switch.failed']} (RW)`,
  'switch.opens': 'Ifungura kuri {tab}',
  'switch.asGuest': 'Nk’umushyitsi',
  'switch.asTenant': 'Nk’umukode',
  'switch.personalSurfaces': 'Uruhande rw’urwego bwite rwo gufungura',
  'switch.create': 'Fungura urwego rw’ubucuruzi',
  'switch.createHint': 'Kwiyandikisha nk’ubucuruzi bikomerezwa ku rubuga.',
  'switch.note':
    'Guhindura bigusigira kuri Konti, isakoshi rimwe buri rwego rufite, bityo isakoshi uhagazeho ntirizigera ribura. Ibyari byatangiye bibikwa, ntibitakara.',

  /* ------------------------------------------------------------- Account */
  'account.title': 'Konti',
  'account.sectionBusiness': 'Ubucuruzi',
  'account.sectionPreferences': 'Ibyo wihitiyemo',
  'account.switchHint': 'Uri muri {name}. Bifungura urutonde rw’inzego zawe.',
  'account.isolationNote':
    'Amafaranga ntiyambuka urwego. Ayo wahembwe nk’umucuruzi, ubukode nk’ukodesha n’ikiguzi cy’umuhuza buri kimwe gisigara mu rwego cyakivuyemo.',

  'account.roleGuest': 'Umushyitsi · Urwego bwite',
  'account.roleTenant': 'Ukodesha · Urwego bwite',
  'account.roleLandlord': 'Nyir’inzu · {org}',
  'account.roleBroker': 'Umuhuza · Umujyi wa Kigali',
  'account.roleWork': 'Isuku · {place}',
  'account.roleHost': 'Uwakira · {org}',

  'account.badgeIdVerified': 'Indangamuntu yemejwe',
  'account.badgeTinVerified': 'TIN yemejwe',
  'account.badgeLicensed': 'Uruhushya · {licence}',
  'account.badgePersonal': 'Urwego bwite',
  'account.badgeStaffSeat': 'Umwanya w’umukozi',

  'account.rowCredits': 'Amanota yo kubona aderesi',
  'account.creditsLeft': 'Asigaye {count}',
  'account.creditsHint': 'Hasigaye kubona aderesi {count} muri uku kwezi.',
  'account.rowPayout': 'Konti yo kwishyurirwaho',
  'account.payoutValue': 'MoMo ••{tail}',
  'account.payoutHint': 'Aho amafaranga y’uru rwego yoherezwa.',
  'account.rowOrganisation': 'Umwirondoro w’ubucuruzi',
  'account.organisationHint': 'Izina ryemewe, TIN, n’aho ubucuruzi bwanditswe.',
  'account.rowStaff': 'Abakozi n’ubutumire',
  'account.staffHint': 'Abashobora gukora muri uru rwego.',
  'account.rowSubscription': 'Ifatabuguzi',
  'account.subscriptionHint': 'Uri kuri gahunda ya {plan}.',
  'account.rowPersonal': 'Umwirondoro wawe',
  'account.personalHint': 'Amazina, telefoni, imeyili, n’uko winjira.',
  'account.rowSecurity': 'Umutekano',
  'account.securityHint': 'Kwinjira mu ntambwe ebyiri, n’ibyuma byinjiye nka wowe.',
  'account.twoFactorOn': '2FA · Birafunguye',
  'account.twoFactorOff': '2FA · Bifunze',
  'account.language': 'Ururimi',
  'account.localeEn': 'EN',
  'account.localeRw': 'RW',
  'account.rowAppearance': 'Isura',
  'account.appearanceHint': 'Gukurikira telefoni, cyangwa guhitamo urumuri cyangwa umwijima.',
  'account.photoCredits': 'Aho amafoto avuye',
  'account.photoCreditsMeta': 'Buri foto n’uruhushya rwayo',
  'account.signOut': 'Sohoka',
  'account.signOutHint': 'Irabanza ikakubaza mbere yo kugusohora mu nzego zose.',

  /* ------------------------------------------------------------- Payout */
  'payout.title': 'Konti yo kwishyurirwaho',
  'payout.subtitle': 'Aho amafaranga y’uru rwego yoherezwa.',
  'payout.destination': 'Aho yoherezwa',
  'payout.momo': 'MTN Mobile Money',
  'payout.tail': '•••• {tail}',
  'payout.pending': 'Ategereje kwishyurwa',
  'payout.pendingValue': 'Abitswe',
  'payout.releases': 'Azarekurwa',
  'payout.buffer': 'Igihe cyo kujuririra',
  'payout.days': 'iminsi',
  'payout.verified': 'Aho yoherezwa hemejwe',
  'payout.bufferBody':
    'Amafaranga abikwa iminsi {days} nyuma y’uko kuraramo birangiye, kugira ngo ikibazo gishobore gukemuka mbere y’uko asohoka. Muri iki cyitegererezo nta yimuwe.',
  'payout.adapterMock': 'Kwishyura · icyitegererezo',
  'payout.adapterMockBody': 'Nta kintu cyoherezwa. Amafaranga arandikwa, ntiyimurwa.',
  'payout.adapterLive': 'Kwishyura · nyakuri',
  'payout.adapterLiveBody': 'Amafaranga yoherezwa kuri iyi konti.',
  'payout.change': 'Hindura aho yoherezwa',
  'payout.changeHint': 'Guhindura aho amafaranga ajya bisaba isuzuma tudakora hano.',
  'payout.changeToast': 'Guhindura konti yo kwishyurirwaho bisuzumirwa ku rubuga, atari kuri telefoni.',

  /* ------------------------------------------------------------- Organisation */
  'org.title': 'Ubucuruzi',
  'org.identityTitle': 'Uyu mucuruzi ni nde',
  'org.identityBody': 'Ibyo amasezerano n’imenyekanisha rya RRA byombi bikoresha.',
  'org.legalName': 'Izina ryemewe',
  'org.tradingName': 'Izina rikoreshwa',
  'org.tin': 'TIN',
  'org.tinChecked': 'TIN yemejwe',
  'org.regime': 'Uburyo bw’imisoro',
  'org.regime.real': 'Uburyo busanzwe',
  'org.regime.flat': 'Igipimo kimwe',
  'org.whereTitle': 'Aho bwanditswe',
  'org.whereBody': 'Akarere n’umurenge biri ku cyemezo.',
  'org.district': 'Akarere',
  'org.sector': 'Umurenge',
  'org.contactTitle': 'Uko bugerwaho',
  'org.contactBody': 'Nimero na aderesi biri ku cyemezo, atari ku mwirondoro wawe.',
  'org.phone': 'Telefoni',
  'org.email': 'Imeyili',
  'org.edit': 'Hindura ibi byanditse',
  'org.editHint': 'Kubihindura bisubiza isuzuma, rikorerwa ku rubuga.',
  'org.editNote':
    'Amasezerano n’imenyekanisha byombi bikoresha ibi, bityo kubihindura bisubiza isuzuma aho kubika ako kanya.',
  'org.editToast': 'Amakuru y’ubucuruzi yongera gusuzumwa ku rubuga, atari kuri telefoni.',

  /* ------------------------------------------------------------- Staff */
  'staff.title': 'Abakozi n’ubutumire',
  'staff.label': 'urutonde rw’abakozi',
  'staff.cardTitle': 'Abashobora gukora hano',
  'staff.cardBody': '{count} bakora ubu',
  'staff.since': 'kuva {day}',
  'staff.invitedOn': 'yatumiwe {day}',
  'staff.roleManager': 'Umuyobozi',
  'staff.roleCaretaker': 'Umurinzi',
  'staff.roleAccounts': 'Ibaruramari',
  'staff.state.active': 'Arakora',
  'staff.state.invited': 'Yatumiwe',
  'staff.state.suspended': 'Yakuweho',
  'staff.resend': 'Ongera wohereze',
  'staff.revoke': 'Mukureho',
  'staff.restore': 'Mugarureho',
  'staff.resentToast': 'Ubutumire bwongeye koherezwa kuri {name} kuri SMS (icyitegererezo).',
  'staff.revokedToast': '{name} ntagishobora gukora muri uru rwego.',
  'staff.restoredToast': '{name} yongeye kubasha gukora muri uru rwego.',
  'staff.invitedToast': 'Ubutumire bwoherejwe kuri {name} kuri SMS (icyitegererezo).',
  'staff.invite': 'Tumira umuntu',
  'staff.inviteNote':
    'Umwanya wakuweho usigara kuri uru rutonde ku bushake, kugira ngo ubashe kubona uwahoze afite uburenganzira.',
  'staff.inviteTitle': 'Tumira umuntu',
  'staff.inviteSubtitle': 'Abona SMS irimo umurongo wo kwemera.',
  'staff.inviteSend': 'Ohereza ubutumire',
  'staff.inviting': 'Kohereza',
  'staff.inviteConsequence':
    'Nemera, abona ibyo Umurinzi wese abona muri uru rwego, harimo abakode n’ubukode. Ushobora kubimukuraho igihe cyose.',
  'staff.fieldName': 'Amazina yombi',
  'staff.fieldNamePlaceholder': 'Claudine Uwase',
  'staff.fieldPhone': 'Telefoni',
  'staff.fieldPhoneHelper': 'Imibare icyenda nyuma y’ikimenyetso cy’igihugu.',
  'staff.emptyTitle': 'Nta wundi urakora hano',
  'staff.emptyBody':
    'Ni wowe wenyine uri muri uru rwego. Tumira umurinzi cyangwa umuyobozi maze abashe gukora mu izina ryawe.',

  /* ------------------------------------------------------------- Plans */
  'plan.starter': 'Intangiriro',
  'plan.growth': 'Ikura',
  'plan.pro': 'Umwuga',
  'plan.units50': 'Kugeza ku nzu 50 ku rutonde rw’ubukode',
  'plan.eSign': 'Gushyira umukono kuri buri masezerano',
  'plan.rraFiling': 'Kumenyekanisha kuri RRA uhereye muri porogaramu',
  'plan.twoStaff': 'Imyanya y’abakozi ibiri',
  'plan.unlimitedReveals': 'Kubona aderesi nta mubare ntarengwa',
  'plan.placementLedger': 'Igitabo cy’abashyizwe mu nzu n’amafaranga',
  'plan.payoutWeekly': 'Kwishyurwa buri cyumweru',
  'plan.priority': 'Kubanza ku rutonde rw’inzu',
  'plan.rooms10': 'Kugeza ku byumba 10',
  'plan.selfCheckIn': 'Umushyitsi yiyinjiza ubwe',
  'plan.ebm': 'Fagitire ya EBM kuri buri cyagurishijwe',
  'plan.oneStaff': 'Umwanya w’umukozi umwe',

  /* ------------------------------------------------------------- Subscription */
  'subscription.title': 'Ifatabuguzi',
  'subscription.current': 'Gahunda iriho',
  'subscription.renews': 'Yisubiramo {day}',
  'subscription.price': 'Igiciro',
  'subscription.perMonth': 'ku kwezi',
  'subscription.includes': 'Ibyo ikubiyemo',
  'subscription.billingTitle': 'Kwishyura',
  'subscription.nextCharge': 'Kwishyura gukurikira',
  'subscription.method': 'Yishyuwe na',
  'subscription.invoices': 'Fagitire',
  'subscription.onWeb': 'Ku rubuga',
  'subscription.adapterMock': 'Kwishyura · icyitegererezo',
  'subscription.adapterMockBody': 'Nta karita yishyuzwa muri iki cyitegererezo.',
  'subscription.upgradeTitle': 'Zamukira kuri {plan}',
  'subscription.upgradeBody.starter': 'Ibyumba icumi, kwiyinjiza, n’umwanya w’umukozi umwe.',
  'subscription.upgradeBody.growth':
    'Inzu mirongo itanu aho kuba icumi, gushyira umukono kuri buri masezerano, kumenyekanisha kuri RRA uhereye muri porogaramu, n’umwanya wa kabiri w’umukozi.',
  'subscription.upgradeBody.pro':
    'Inzu n’abakozi nta mubare ntarengwa, kubanza ku rutonde, no kwishyurwa buri cyumweru aho kuba buri kwezi.',
  'subscription.upgrade': 'Jya kuri {plan}',
  'subscription.upgradeHint': 'Guhindura gahunda byemezwa ku rubuga.',
  'subscription.upgradeToast': 'Guhindura gahunda byemezwa ku rubuga, atari kuri telefoni.',
  'subscription.topPlan': 'Iyi ni gahunda yo hejuru. Nta yindi iri hejuru yayo.',

  /* ------------------------------------------------------------- Reveal credits */
  'credits.title': 'Amanota yo kubona aderesi',
  'credits.greeting': 'Aline K. Brokerage',
  'credits.left': 'Asigaye muri uku kwezi',
  'credits.spent': 'Yakoreshejwe',
  'credits.ofMonthly': 'kuri {total} ku kwezi',
  'credits.thisMonth': 'muri uku kwezi',
  'credits.whyBody':
    'Nimero ya nyir’inzu ni amakuru ye bwite. Inota ni urugero rw’umubare, si urugomero rw’amafaranga: ni rwo rubuza ko urutonde rwibwa n’uko nimero za ba nyir’inzu zose zikusanywa.',
  'credits.logTitle': 'Aderesi wamaze kubona',
  'credits.logBody': 'Bibikwa nk’inyandiko. Nta kintu gikuraho umurongo.',
  'credits.logUnit': '{property} · {unit}',
  'credits.retentionNote':
    'Iki gitabo ni cyo kirinda, bityo kibikwa n’ubwo gushyira mu nzu byarangiye. Nyir’inzu ashobora kubaza abamaze kubona nimero ye.',
  'credits.emptyTitle': 'Nta aderesi urabona',
  'credits.emptyBody':
    'Fungura inzu ku rutonde maze werekane nyirayo kugira ngo utangire gushyira umuntu mu nzu. Buri kubona kwandikwa hano.',
  'credits.emptyAction': 'Fungura urutonde rw’inzu',

  /* ------------------------------------------------------------- Personal */
  'personal.title': 'Umwirondoro wawe',
  'personal.youTitle': 'Wowe',
  'personal.youBody': 'Umuntu umwe muri buri rwego ufite.',
  'personal.name': 'Amazina',
  'personal.phone': 'Telefoni',
  'personal.email': 'Imeyili',
  'personal.editName': 'Hindura amazina',
  'personal.editNameBody': 'Ni yo nyir’inzu cyangwa uwakira abona ku ifatabuguzi.',
  'personal.nameHelper': 'Izina ryawe n’irya nyuma.',
  'personal.editEmail': 'Hindura imeyili',
  'personal.editEmailBody': 'Inyemezabwishyu n’inyandiko z’amasezerano bijya hano.',
  'personal.emailHelper': 'Ntiyigera igaragara ku mwirondoro rusange.',
  'personal.save': 'Bika',
  'personal.saving': 'Kubika',
  'personal.savedToast': 'Byabitswe.',
  'personal.publicTitle': 'Ibyo abandi babona',
  'personal.publicBody':
    'Ibitekerezo n’imyirondoro rusange byerekana izina ryawe n’inyuguti ya mbere y’irya nyuma. Imeyili na telefoni ntibigaragara.',
  'personal.methodsTitle': 'Uko winjira',
  'personal.methodsBody': 'Nta ijambobanga rihari. Buri kimwe muri ibi ni inzira yo kwinjira.',
  'personal.methodPhone': 'Nimero ya telefoni',
  'personal.methodGoogle': 'Google',
  'personal.googleBody': 'Ntibihujwe. Guhuza bikuha inzira ya kabiri yo kwinjira.',
  'personal.googleLinkedBody': 'Byahujwe. Ushobora kwinjira ukoresheje iyo ari yo yose.',
  'personal.linked': 'Byahujwe',
  'personal.notLinked': 'Ntibihujwe',
  'personal.link': 'Huza',
  'personal.unlink': 'Tandukanya',
  'personal.linkedToast': 'Google yahujwe. Ubu ushobora kwinjira ukoresheje iyo ari yo yose.',
  'personal.unlinkedToast': 'Google yatandukanyijwe. Nimero yawe iracyagushobozа kwinjira.',
  'personal.lastMethodNote':
    'Nimero yawe ntishobora gutandukanywa igihe ari yo nzira yonyine yo kwinjira. Banza uhuze Google niba ushaka kuyihindura.',

  /* ------------------------------------------------------------- Security */
  'security.title': 'Umutekano',
  'security.label': 'ibyuma byawe',
  'security.twoFactorTitle': 'Kwinjira mu ntambwe ebyiri',
  'security.twoFactorBody': 'Kode hamwe na nimero yawe, buri gihe winjiye ku gikoresho gishya.',
  'security.twoFactorLabel': 'Kwinjira mu ntambwe ebyiri (2FA)',
  'security.twoFactorOn': 'Birafunguye. Kode isabwa ku gikoresho gishya.',
  'security.twoFactorOff': 'Bifunze. Nimero yawe yonyine irakwinjiza.',
  'security.twoFactorHint': 'Bifungura cyangwa bifunga intambwe ya kabiri kuri iyi konti.',
  'security.turnOn': 'Fungura',
  'security.turnOff': 'Funga',
  'security.twoFactorOnToast': 'Kwinjira mu ntambwe ebyiri birafunguye.',
  'security.twoFactorOffToast': 'Kwinjira mu ntambwe ebyiri bifunze. Nimero yawe yonyine irakwinjiza.',
  'security.devicesTitle': 'Ibyinjiye nka wowe',
  'security.devicesBody': 'Ibikoresho {count}',
  'security.thisDevice': 'Iki gikoresho',
  'security.stale': 'Ntikoreshejwe vuba',
  'security.seenToday': 'cyakoreshejwe uyu munsi',
  'security.seenYesterday': 'cyakoreshejwe ejo',
  'security.seenDaysAgo': 'cyakoreshejwe hashize iminsi {days}',
  'security.revoke': 'Gisohore',
  'security.revokeOne': 'Sohora {device}',
  'security.revokedToast': '{device} cyasohowe.',
  'security.revokeAll': 'Sohora ibindi byose',
  'security.revokeAllNote':
    'Bisohora ibindi bikoresho {count}. Iki gisigara cyinjiye, naho ukoresha ikindi azasabwa kongera kwinjira.',
  'security.revokeAllNone': 'Nta kindi kiriho cyinjiye nka wowe.',
  'security.revokedAllToast': 'Ibindi bikoresho {count} byasohowe.',
  'security.confirmTitle': 'Gusohora ibindi byose?',
  'security.confirmBody': 'Ibikoresho {count} bizasohorwa. Iki ntikizasohorwa.',
  'security.confirmDetail':
    'Bikoreshe niba ubonye igikoresho utazi. Uwo ari we wese ukoresha kimwe muri byo — nawe ubwawe, kuri mudasobwa yawe — azasabwa kongera kwinjira.',
  'security.confirmAction': 'Sohora ibindi',
  'security.confirmCancel': 'Bisige byinjiye',

  /* ------------------------------------------------------------- Appearance */
  'appearance.title': 'Isura',
  'appearance.subtitle': 'Uko porogaramu igaragara kuri iyi telefoni.',
  'appearance.system': 'Iya telefoni',
  'appearance.light': 'Urumuri',
  'appearance.dark': 'Umwijima',
  'appearance.systemBody': 'Ikurikira telefoni. Ubu ni {scheme}.',
  'appearance.lightBody': 'Buri gihe urumuri, uko telefoni yaba iteye kose.',
  'appearance.darkBody': 'Buri gihe umwijima, uko telefoni yaba iteye kose.',

  /* ------------------------------------------------------------- Sign out */
  'signOut.title': 'Gusohoka?',
  'signOut.subtitle': 'Winjiye nka {name}.',
  'signOut.scope':
    'Ibi bigusohora mu nzego zawe zose {count}, atari muri uru rwonyine. Kongera kwinjira bigarura buri mwanya.',
  'signOut.switchInstead':
    'Niba washakaga gusa kuva muri {name}, koresha Hindura urwego — bigusigira winjiye.',
  'signOut.confirm': 'Sohoka',
  'signOut.cancel': 'Guma winjiye',

  /* ------------------------------------------------------------- Create workspace */
  'createWorkspace.title': 'Ibi bikomerezwa ku rubuga',
  'createWorkspace.subtitle': 'Kwiyandikisha nk’ubucuruzi bisaba inyandiko telefoni idashobora gusuzuma.',
  'createWorkspace.urlLabel': 'Fungura kuri mudasobwa',
  'createWorkspace.needsTitle': 'Ibyo uzasabwa',
  'createWorkspace.needTin': 'Nomero y’umusoreshwa ya RRA (TIN)',
  'createWorkspace.needAddress': 'Akarere n’umurenge ubucuruzi bwanditsemo',
  'createWorkspace.needEvidence': 'Ifoto y’icyemezo cy’iyandikwa',
  'createWorkspace.needReview': 'Isuzuma, rikorwa n’umukozi ushinzwe kwemeza',
  'createWorkspace.whyWeb':
    'Si urupapuro tutarubaka. Isuzuma risaba inyandiko nyinshi kandi rikorwa n’umuntu, bityo ribera aho inyandiko zoroshye gushyirwaho.',
  'createWorkspace.open': 'Fungura ifishi yo ku rubuga',
  'createWorkspace.openHint': 'Ifungura injishi.rw muri mushakisha yawe.',
  'createWorkspace.openFailed': 'Nta mushakisha iri kuri iki gikoresho. Aderesi iri hejuru ishobora kwandikwa n’intoki.',
  'payout.errorTitle': `${en['payout.errorTitle']} (RW)`,
  'payout.errorBody': `${en['payout.errorBody']} (RW)`,
  'payout.loading': `${en['payout.loading']} (RW)`,
  'payout.noneTitle': `${en['payout.noneTitle']} (RW)`,
  'payout.noneBody': `${en['payout.noneBody']} (RW)`,
};
