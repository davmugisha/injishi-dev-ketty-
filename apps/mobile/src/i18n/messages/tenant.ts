/**
 * `tenant` - the Residence Personal seat: leases, rent, signing, move-out,
 * renewal, the visitor log and maintenance. Frames R11, R12, R15 to R20.
 *
 * Session 7 owns this file. The landlord's view of the same aggregate is
 * `landlord`: one lease, two seats, two vocabularies, and a tenant screen must
 * never render a landlord's sentence. "Your landlord" and "your lease" are the
 * tell - a string here is addressed to the person who lives in the unit.
 *
 * Two naming rules the glossary (ui-rules.md, design brief section 8.5) fixes
 * and this file follows: the deposit is a **Caution**, never a security
 * deposit, and the agreement is a **Lease**, never a tenancy agreement.
 */

export const en = {
  /* Shared captions - dates and adapter provenance (frames R12, R15, R17, R18) */
  'tenant.dueToday': 'due today',
  'tenant.dueInDay': 'in {count} day',
  'tenant.dueInDays': 'in {count} days',
  'tenant.dueInWeeks': 'in {count} weeks',
  'tenant.overdueDay': '{count} day overdue',
  'tenant.overdueDays': '{count} days overdue',
  'tenant.noticeDay': '{count} day',
  'tenant.noticeDays': '{count} days',
  'tenant.noticeMet': '{given} notice, which meets your contract',
  'tenant.noticeShort': '{given} notice, and your contract asks for {required}',
  'tenant.mockAdapter': 'mock adapter',
  'tenant.goBack': 'Go back',

  /* R11 My leases */
  'leases.title': 'My leases',
  'leases.listLabel': 'your leases',
  'leases.open': 'Open the lease for {unit}',
  'leases.openInbox': 'Open your inbox',
  'leases.rent': 'Rent',
  'leases.nextDue': 'Next due',
  'leases.upToDate': 'Up to date',
  'leases.past': 'Past',
  'leases.endedOn': 'ended {date}',
  'leases.tenureLong': 'long-term',
  'leases.tenureShort': 'short-term',
  'leases.noticeFiled': 'Move-out filed for {date}',
  'leases.renewalPending': 'Renewal requested, waiting on your landlord',
  'leases.unsignedBody':
    '{org} has sent you a contract for {start} to {end}. Rent and the rest of this tenancy stay locked until you sign.',
  'leases.reviewAndSign': 'Review and sign',
  'leases.details': 'Details',
  'leases.emptyTitle': 'No lease yet',
  'leases.emptyBody':
    'A lease appears here once a landlord registers you as the tenant of a unit and sends you the contract.',
  'leases.emptyActiveTitle': 'No lease running',
  'leases.emptyActiveBody':
    'Nothing is active right now. Your past tenancies are below and stay downloadable.',

  /* R15 Lease detail, tenant seat */
  'lease.notFound': 'Lease not found.',
  'lease.listLabel': 'this lease',
  'lease.rent': 'Rent',
  'lease.ends': 'Ends',
  'lease.landlord': 'Landlord',
  'lease.contract': 'Contract',
  'lease.contractMeta': 'Download, EN and RW',
  'lease.contractLocked': 'Unlocks once both parties have signed',
  'lease.visitors': 'Visitor log',
  'lease.visitorsCount': '{count} entries',
  'lease.visitorsNone': 'No entries yet',
  'lease.logMaintenance': 'Log maintenance',
  'lease.openTicketCount': '{count} open',
  'lease.noTickets': 'Report something broken',
  'lease.requestRenewal': 'Request renewal',
  'lease.fileMoveOut': 'File move-out',
  'lease.rentHistory': 'Rent history',
  'lease.paidToDate': 'Paid to date',
  'lease.documents': 'Documents',
  'lease.compliance': 'Compliance',
  'lease.contractFiled': 'Contract auto-filed',
  'lease.rentalIncome': 'Rental income',
  'lease.complianceNote':
    'Your landlord files this contract with the tax administration within 15 days of signature. A lease never emits an EBM invoice.',
  'lease.unsignedNote':
    'This lease is waiting for your signature. Rent, documents and the move-out notice stay locked until both parties have signed.',
  'lease.awaitingSignature': 'Awaiting your signature',
  'lease.payRent': 'Pay rent',
  'lease.dueMonth': '{month} · Due',
  'lease.overdueMonth': '{month} · Overdue',
  'lease.downloadDocument': 'Download {document}',
  'lease.documentLocked': '{document} unlocks once the lease is signed',
  'lease.noticeFiledTitle': 'Move-out notice filed',
  'lease.noticeFiledBody':
    'This lease runs to {date}. You owe rent up to and including that day, and the Caution settles after the final inspection.',
  'lease.renewalPendingTitle': 'Renewal requested',
  'lease.renewalPendingBody':
    'You asked to renew to {date}. {landlord} has not decided yet, and the lease is unchanged until they do.',
  'lease.endedTitle': 'This tenancy has ended',
  'lease.endedBody':
    'It is kept as a record. The contract and the Caution settlement stay downloadable, and the visitor log is read-only history.',

  /* R12 Rent */
  'rent.title': 'Rent',
  'rent.listLabel': 'your rent history',
  'rent.nextPayment': 'Next payment',
  'rent.due': 'Due {date}',
  'rent.payRent': 'Pay rent',
  'rent.settledVia': 'Settles via MTN MoMo, {adapter}',
  'rent.switchLease': 'Which lease',
  'rent.history': 'History',
  'rent.paidOn': 'Paid {date}',
  'rent.mockSettled': 'Settled on this device, no money moved',
  'rent.paidToDate': 'Paid to date',
  'rent.upToDate': 'Rent up to date',
  'rent.upToDateBody':
    'Every period on this lease is settled. The next charge is raised on the first of the month.',
  'rent.cautionHeld': 'Caution held',
  'rent.cautionNote':
    'Held in escrow for the term. It is not rent and cannot be set off against rent; it settles when the lease closes, less any agreed deduction.',
  'rent.noneTitle': 'No rent due',
  'rent.noneBody':
    'A rent schedule starts the day your lease is signed. Until then there is nothing to pay.',
  'rent.emptyHistoryTitle': 'No payments yet',
  'rent.emptyHistoryBody':
    'The first charge is raised on the first of the month after your lease starts.',
  'rent.openLease': 'Open lease detail',
  'rent.commissionNote': 'Rent never carries a platform commission.',

  /* Pay rent sheet (frame R12) */
  'payRent.title': 'Pay rent',
  'payRent.subtitle': '{month} · {unit}',
  'payRent.method': 'How would you like to pay?',
  'payRent.mtn': 'MTN MoMo',
  'payRent.mtnMeta': 'To the number on your account · instant',
  'payRent.airtel': 'Airtel Money',
  'payRent.airtelMeta': 'To the number on your account · instant',
  'payRent.mockTitle': 'Nothing leaves your account',
  'payRent.mockBody':
    'This build settles through a mock adapter. The period is stamped mock, no money moves, and a live payment would never carry a platform commission on rent.',
  'payRent.action': 'Pay now',
  'payRent.paying': 'Paying',
  'payRent.cancel': 'Not now',
  'payRent.toast': '{month} settled, stamped mock. No money moved.',
  'payRent.nothingDueTitle': 'Nothing to pay',
  'payRent.nothingDueBody': 'Every period on this lease is settled.',
  'payRent.amount': 'Amount',

  /* R16 e-Sign lease */
  'sign.title': 'Sign your lease',
  'sign.summaryOf': '{unit} · {org}',
  'sign.rent': 'Rent',
  'sign.cautionCol': 'Caution',
  'sign.termCol': 'Term',
  'sign.termMonths': '{count} months',
  'sign.readContract': 'Read full contract',
  'sign.readContractMeta': 'EN · RW',
  'sign.yourSignature': 'Your signature',
  'sign.consent': 'I agree to the terms and Law 058/2021 e-signature.',
  'sign.consentLabel': 'Agree to the terms and to the e-signature law',
  'sign.consentHint':
    'Law 058/2021 gives an electronic signature the same force as one on paper. Your name, the moment you signed and this device are recorded with the contract.',
  'sign.action': 'Sign & activate lease',
  'sign.needSignature': 'Sign in the box above',
  'sign.needConsent': 'Tick the agreement below',
  'sign.ready': 'Ready to sign',
  'sign.signing': 'Activating',
  'sign.toast': 'Lease active. Rent starts {date}.',
  'sign.signedTitle': 'Lease active',
  'sign.signedBody':
    'Both parties have now signed. The rent schedule starts on {date}, and the contract is queued to file with the tax administration within 15 days.',
  'sign.notWired':
    'Not yet wired to the backend, so this build stores the signature on the device only.',
  'sign.alreadyActiveTitle': 'Already signed',
  'sign.alreadyActiveBody': 'You signed this lease on {date}. Nothing further is needed from you.',
  'sign.openLease': 'Open the lease',
  'sign.padHint': 'Draw your signature with a finger or a stylus.',
  'sign.padPrompt': 'Sign here with your finger',
  'sign.padCaptured': 'Signature captured',
  'sign.padClear': 'Clear',
  'sign.padLabel': 'Signature pad',

  /* R17 Move-out notice */
  'moveOut.title': 'Move-out notice',
  'moveOut.rule': 'Your lease requires {days} days notice.',
  'moveOut.earliest': 'Earliest move-out: {date}',
  'moveOut.dateLabel': 'Move-out date',
  'moveOut.datePlaceholder': 'Pick a date',
  'moveOut.pickDate': 'Pick a move-out date',
  'moveOut.calendarTitle': 'Choose your move-out date',
  'moveOut.calendarBody':
    'Dates before {date} are closed because of the notice your contract asks for.',
  'moveOut.useDate': 'Use this date',
  'moveOut.messageLabel': 'Message to landlord',
  'moveOut.messagePlaceholder':
    "Thank you for the stay. I'll be relocating for work and would like to arrange the final inspection.",
  'moveOut.messageHelper': 'Optional. It goes to {landlord} with the notice.',
  'moveOut.cautionTitle': 'Caution refund follows',
  'moveOut.cautionBody': 'Settled after the final inspection, less any agreed deduction.',
  'moveOut.action': 'File move-out notice',
  'moveOut.confirmTitle': 'File this notice?',
  'moveOut.confirmBody':
    'Filing ends this lease on {date}. It cannot be withdrawn from the app, so changing the date afterwards is a conversation with {landlord}.',
  'moveOut.confirmAction': 'Yes, file it',
  'moveOut.confirmCancel': 'Go back',
  'moveOut.filing': 'Filing',
  'moveOut.toast': 'Notice filed. The lease ends {date}.',
  'moveOut.filedTitle': 'Notice filed',
  'moveOut.filedBody':
    '{landlord} has been notified. The lease runs to {date} and the unit is now flagged as coming available on it.',
  'moveOut.next': 'What happens next',
  'moveOut.nextRentTitle': 'Rent continues',
  'moveOut.nextRentBody': 'You owe rent for every period up to and including the move-out date.',
  'moveOut.nextCautionTitle': 'Caution settles at close',
  'moveOut.nextCautionBody':
    'The Caution held in escrow is settled when the lease ends, less any agreed deduction.',
  'moveOut.nextDisputeTitle': 'Disputes go through messaging',
  'moveOut.nextDisputeBody':
    'If your landlord disagrees with the date, resolve it directly. There is no arbitration in this version.',
  'moveOut.notWired':
    'Not yet wired to the backend, so this build records the notice on the device only.',
  'moveOut.done': 'Done',
  'moveOut.alreadyFiledTitle': 'A notice is already filed',
  'moveOut.unavailableTitle': 'Not available on this lease',
  'moveOut.unavailableBody': 'A move-out notice can only be filed on a lease that is running.',

  /* R18 Request renewal */
  'renew.title': 'Request renewal',
  'renew.current': 'Current lease',
  'renew.currentEnds': 'Ends {date}',
  'renew.newTerm': 'Proposed new term',
  'renew.term6': '6 mo',
  'renew.term12': '12 mo',
  'renew.term24': '24 mo',
  'renew.newStart': 'New start',
  'renew.newEnd': 'New end',
  'renew.rent': 'Proposed rent',
  'renew.rentLocked':
    'Carried forward unchanged. A rent change needs a new lease rather than a renewal, so this request only moves the end date.',
  'renew.note': 'Note to landlord',
  'renew.notePlaceholder':
    "I'd love to renew at the same rate. The unit has been great.",
  'renew.action': 'Send renewal request',
  'renew.sending': 'Sending',
  'renew.toast': 'Renewal request sent to {landlord}.',
  'renew.sentTitle': 'Request sent',
  'renew.sentBody':
    '{landlord} decides next. If they approve, the lease keeps running to {date} at the same rent and you are both notified.',
  'renew.notWired':
    'Not yet wired to the backend, so this build records the request on the device only.',
  'renew.done': 'Done',
  'renew.pendingTitle': 'A request is already with your landlord',
  'renew.pendingBody': 'You asked on {on} to renew to {date}. They have not decided yet.',
  'renew.unavailableTitle': 'Not available on this lease',
  'renew.unavailableBody': 'A renewal can only be requested on a lease that is running.',
  'renew.endingNote':
    'A move-out notice is already filed on this lease. Sending a renewal asks your landlord to set that notice aside.',

  /* R19 Visitor log */
  'visitors.title': 'Visitor log',
  'visitors.listLabel': 'your visitor log',
  'visitors.add': 'Log a visitor',
  'visitors.thisMonth': 'This month',
  'visitors.earlier': 'Earlier',
  'visitors.overnight': 'overnight',
  'visitors.day': 'day visit',
  'visitors.stillIn': 'still in unit',
  'visitors.relationFamily': 'Family',
  'visitors.relationGuest': 'Guest',
  'visitors.relationWork': 'Work',
  'visitors.relationOther': 'Other',
  'visitors.footnote':
    'Oversight can read this log. Your landlord cannot browse it: they have to ask about a particular day, and the request is recorded.',
  'visitors.emptyTitle': 'No visitors logged',
  'visitors.emptyBody':
    'Log the people who stay with you. It is your record of who was in the unit, and it is what oversight reads if they ever ask.',
  'visitors.readOnlyTitle': 'This log is read-only',
  'visitors.readOnlyBody':
    'The lease has ended, so the log is kept as history and takes no new entries.',
  'visitors.nameLabel': "Visitor's name",
  'visitors.namePlaceholder': 'Marie Keza',
  'visitors.relationLabel': 'Relation',
  'visitors.stayLabel': 'How long',
  'visitors.arrivedLabel': 'Arrived',
  'visitors.save': 'Save entry',
  'visitors.saving': 'Saving',
  'visitors.cancel': 'Cancel',
  'visitors.needName': 'Add a name first',
  'visitors.toast': '{name} logged.',
  'visitors.entry': '{name}, {relation}, {stay}, {date}',

  /* R20 Report an issue */
  'issue.title': 'Report an issue',
  'issue.goesTo': 'Goes to {org}',
  'issue.whatLabel': "What's wrong?",
  'issue.whatPlaceholder': 'Leaking kitchen tap',
  'issue.detailLabel': 'Details',
  'issue.detailPlaceholder': 'Water pooling under the sink since this morning, getting worse.',
  'issue.detailHelper': 'What you can see, and since when.',
  'issue.photos': 'Photos',
  'issue.photoHint': 'It leads the ticket',
  'issue.priority': 'Priority',
  'issue.priorityUrgent': 'Urgent',
  'issue.priorityNormal': 'Normal',
  'issue.priorityLow': 'Low',
  'issue.urgentNote':
    'Urgent is for a safety risk or something that stops you using the unit: water, power, the door lock.',
  'issue.action': 'Submit ticket',
  'issue.submitting': 'Filing',
  'issue.needTitle': 'Say what is wrong first',
  'issue.toast': '{ref} filed. {org} sees it now.',
  'issue.filedTitle': 'Ticket {ref} filed',
  'issue.filedBody':
    '{org} sees it on their Maintenance tab. You get a message here when someone is assigned to it.',
  'issue.notWired':
    'Not yet wired to the backend, so the photographs stay on this device and the ticket lives in this session.',
  'issue.done': 'Done',
  'issue.openOnLease': 'Open tickets on this lease',
  'issue.ticketRef': '{ref} · {state}',
  'issue.closedTitle': 'This lease has ended',
  'issue.closedBody':
    'A ticket can only be filed against a lease that is running. Contact {landlord} directly.',

  /* Contract viewer, opened from R15 and R16 */
  'contract.title': 'Lease contract',
  'contract.en': 'English',
  'contract.rw': 'Kinyarwanda',
  'contract.parties': 'Parties and terms',
  'contract.clauses': 'Clauses',
  'contract.landlord': 'Landlord',
  'contract.tenant': 'Tenant',
  'contract.room': 'Room',
  'contract.term': 'Term',
  'contract.rent': 'Monthly rent',
  'contract.caution': 'Caution, held in escrow',
  'contract.download': 'Download PDF',
  'contract.downloadToast': 'Download is mocked in this build. The PDF arrives when storage is wired.',
  'contract.bilingual': 'The English and Kinyarwanda texts are equally authoritative.',
  'contract.emptyTitle': 'No clause text on this lease',
  'contract.emptyBody':
    'This tenancy predates the in-app contract. The signed PDF is on the lease detail screen.',
  'contract.language': 'Contract language',

  /* ------------------------------- pay rent: the async rail (gaps.md B2) --- */
  // The sheet used to collect a method and settle. Both Rwandan rails answer
  // out of the app, so it now collects the HANDSET the prompt goes to and hands
  // the rest to the shared payment machine (`data/payment-attempt.ts`), whose
  // words live in the `pay.*` namespace so this sheet and the guest checkout
  // cannot describe the same rail differently.
  'payRent.handset': 'Mobile money number',
  'payRent.handsetPlaceholder': '788 123 456',
  'payRent.handsetHelp': 'The prompt goes to this phone.',
  'payRent.handsetInvalid': 'Nine digits, starting 78, 79, 72 or 73.',
  'payRent.handsetWrongNetwork': 'That is not an {network} number. Pick the other one above, or change the number.',
  'payRent.errorTitle': 'We could not start the payment',
  'payRent.errorBody': 'Nothing has been charged. Check the number and try again.',
  'payRent.stillOwed': 'Still owed',
} as const;

/**
 * Parity is a type error here, not a review note: `rw` is keyed off this
 * file's own `en`, so a key added to one and not the other fails `tsc` in
 * this file rather than in the merge.
 *
 * This is a working translation for layout purposes. Kinyarwanda runs longer
 * than English and nothing may truncate, so the value of having it now is that
 * switching language stresses every row on these nine screens. Have a
 * Kinyarwanda speaker pass over it before it ships.
 */
export const rw: Record<keyof typeof en, string> = {
  /* Shared captions */
  'tenant.dueToday': 'bigomba kwishyurwa uyu munsi',
  'tenant.dueInDay': 'mu munsi {count}',
  'tenant.dueInDays': 'mu minsi {count}',
  'tenant.dueInWeeks': 'mu byumweru {count}',
  'tenant.overdueDay': 'harengeje umunsi {count}',
  'tenant.overdueDays': 'harengeje iminsi {count}',
  'tenant.noticeDay': 'umunsi {count}',
  'tenant.noticeDays': 'iminsi {count}',
  'tenant.noticeMet': 'kumenyesha {given}, bihuje n’amasezerano yawe',
  'tenant.noticeShort': 'kumenyesha {given}, naho amasezerano yawe asaba {required}',
  'tenant.mockAdapter': 'ikigereranyo',
  'tenant.goBack': 'Subira inyuma',

  /* R11 */
  'leases.title': 'Amasezerano yanjye',
  'leases.listLabel': 'amasezerano yawe',
  'leases.open': 'Fungura amasezerano ya {unit}',
  'leases.openInbox': 'Fungura ubutumwa bwawe',
  'leases.rent': 'Ubukode',
  'leases.nextDue': 'Ubukurikira',
  'leases.upToDate': 'Byishyuwe byose',
  'leases.past': 'Ayashize',
  'leases.endedOn': 'yarangiye {date}',
  'leases.tenureLong': 'igihe kirekire',
  'leases.tenureShort': 'igihe gito',
  'leases.noticeFiled': 'Ubutumwa bwo kwimuka ku {date}',
  'leases.renewalPending': 'Wasabye kongera igihe, utegereje nyir’inzu',
  'leases.unsignedBody':
    '{org} yakoherereje amasezerano ya {start} kugeza {end}. Ubukode n’ibisigaye by’ubu bukode bizakomeza gufunga kugeza usinye.',
  'leases.reviewAndSign': 'Reba usinye',
  'leases.details': 'Ibisobanuro',
  'leases.emptyTitle': 'Nta masezerano arahaba',
  'leases.emptyBody':
    'Amasezerano azagaragara hano nyir’inzu amaze kukwandika nk’ukodesha akakoherereza amasezerano.',
  'leases.emptyActiveTitle': 'Nta masezerano akora',
  'leases.emptyActiveBody':
    'Nta na kimwe kirimo gukora ubu. Ubukode bwawe bwashize buri hepfo kandi buracyashobora gukurwamo.',

  /* R15 */
  'lease.notFound': 'Amasezerano ntiyabonetse.',
  'lease.listLabel': 'aya masezerano',
  'lease.rent': 'Ubukode',
  'lease.ends': 'Birangira',
  'lease.landlord': 'Nyir’inzu',
  'lease.contract': 'Amasezerano',
  'lease.contractMeta': 'Kuramo, mu Cyongereza no mu Kinyarwanda',
  'lease.contractLocked': 'Bifungurwa impande zombi zimaze gusinya',
  'lease.visitors': 'Urutonde rw’abashyitsi',
  'lease.visitorsCount': 'ibyanditswe {count}',
  'lease.visitorsNone': 'Nta cyanditswe',
  'lease.logMaintenance': 'Menyesha ikibazo',
  'lease.openTicketCount': '{count} bifunguye',
  'lease.noTickets': 'Menyesha ikimeneka cyangwa kitakora',
  'lease.requestRenewal': 'Saba kongera igihe',
  'lease.fileMoveOut': 'Tanga ubutumwa bwo kwimuka',
  'lease.rentHistory': 'Amateka y’ubukode',
  'lease.paidToDate': 'Byishyuwe kugeza ubu',
  'lease.documents': 'Inyandiko',
  'lease.compliance': 'Kubahiriza amategeko',
  'lease.contractFiled': 'Amasezerano yohererejwe',
  'lease.rentalIncome': 'Amafaranga y’ubukode',
  'lease.complianceNote':
    'Nyir’inzu ashyikiriza aya masezerano ubuyobozi bw’imisoro mu minsi 15 nyuma yo gusinya. Amasezerano y’ubukode ntasohora fagitire ya EBM.',
  'lease.unsignedNote':
    'Aya masezerano ategereje umukono wawe. Ubukode, inyandiko n’ubutumwa bwo kwimuka bizakomeza gufunga kugeza impande zombi zisinye.',
  'lease.awaitingSignature': 'Bitegereje umukono wawe',
  'lease.payRent': 'Ishyura ubukode',
  'lease.dueMonth': '{month} · Bigomba kwishyurwa',
  'lease.overdueMonth': '{month} · Byarengeje igihe',
  'lease.downloadDocument': 'Kuramo {document}',
  'lease.documentLocked': '{document} bifungurwa amasezerano amaze gusinywa',
  'lease.noticeFiledTitle': 'Ubutumwa bwo kwimuka bwatanzwe',
  'lease.noticeFiledBody':
    'Aya masezerano akomeza kugeza {date}. Ugomba ubukode kugeza kuri uwo munsi urimo, kandi ingwate itangwa nyuma yo kugenzura bwa nyuma.',
  'lease.renewalPendingTitle': 'Wasabye kongera igihe',
  'lease.renewalPendingBody':
    'Wasabye kongera kugeza {date}. {landlord} ntarafata icyemezo, kandi amasezerano ntahinduka kugeza abifashe.',
  'lease.endedTitle': 'Ubu bukode bwarangiye',
  'lease.endedBody':
    'Bubitswe nk’inyandiko. Amasezerano n’icyemezo cy’ingwate biracyashobora gukurwamo, kandi urutonde rw’abashyitsi rusigaye ari amateka gusa.',

  /* R12 */
  'rent.title': 'Ubukode',
  'rent.listLabel': 'amateka y’ubukode bwawe',
  'rent.nextPayment': 'Kwishyura gukurikira',
  'rent.due': 'Bigomba kwishyurwa {date}',
  'rent.payRent': 'Ishyura ubukode',
  'rent.settledVia': 'Byishyurwa kuri MTN MoMo, {adapter}',
  'rent.switchLease': 'Ni ayahe masezerano',
  'rent.history': 'Amateka',
  'rent.paidOn': 'Byishyuwe {date}',
  'rent.mockSettled': 'Byemejwe kuri iyi telefone, nta mafaranga yagenze',
  'rent.paidToDate': 'Byishyuwe kugeza ubu',
  'rent.upToDate': 'Ubukode bwishyuwe',
  'rent.upToDateBody':
    'Ibihe byose by’aya masezerano byishyuwe. Ikindi kiguzi gitangwa ku itariki ya mbere y’ukwezi.',
  'rent.cautionHeld': 'Ingwate ibitswe',
  'rent.cautionNote':
    'Ibitswe mu bubiko mu gihe cyose cy’amasezerano. Si ubukode kandi ntishobora gukurwa ku bukode; itangwa amasezerano arangiye, hakurwaho ibyumvikanyweho.',
  'rent.noneTitle': 'Nta bukode bugomba kwishyurwa',
  'rent.noneBody':
    'Gahunda y’ubukode itangira umunsi amasezerano yawe asinywe. Kugeza ubwo nta kigomba kwishyurwa.',
  'rent.emptyHistoryTitle': 'Nta bwishyu burahaba',
  'rent.emptyHistoryBody':
    'Ikiguzi cya mbere gitangwa ku itariki ya mbere y’ukwezi gukurikira itangira ry’amasezerano.',
  'rent.openLease': 'Fungura ibisobanuro by’amasezerano',
  'rent.commissionNote': 'Ubukode nta na rimwe bufatirwaho amafaranga na porogaramu.',

  /* Pay rent */
  'payRent.title': 'Ishyura ubukode',
  'payRent.subtitle': '{month} · {unit}',
  'payRent.method': 'Wifuza kwishyura ute?',
  'payRent.mtn': 'MTN MoMo',
  'payRent.mtnMeta': 'Kuri nimero iri kuri konti yawe · ako kanya',
  'payRent.airtel': 'Airtel Money',
  'payRent.airtelMeta': 'Kuri nimero iri kuri konti yawe · ako kanya',
  'payRent.mockTitle': 'Nta mafaranga akurwa kuri konti yawe',
  'payRent.mockBody':
    'Iyi verisiyo ikoresha ikigereranyo cyo kwishyura. Ukwezi kwandikwaho ikigereranyo, nta mafaranga agenda, kandi no mu buryo nyakuri ubukode ntibufatirwaho amafaranga na porogaramu.',
  'payRent.action': 'Ishyura ubu',
  'payRent.paying': 'Kwishyura',
  'payRent.cancel': 'Si ubu',
  'payRent.toast': '{month} kwemejwe nk’ikigereranyo. Nta mafaranga yagenze.',
  'payRent.nothingDueTitle': 'Nta kigomba kwishyurwa',
  'payRent.nothingDueBody': 'Ibihe byose by’aya masezerano byishyuwe.',
  'payRent.amount': 'Umubare',

  /* R16 */
  'sign.title': 'Sinya amasezerano yawe',
  'sign.summaryOf': '{unit} · {org}',
  'sign.rent': 'Ubukode',
  'sign.cautionCol': 'Ingwate',
  'sign.termCol': 'Igihe',
  'sign.termMonths': 'amezi {count}',
  'sign.readContract': 'Soma amasezerano yose',
  'sign.readContractMeta': 'EN · RW',
  'sign.yourSignature': 'Umukono wawe',
  'sign.consent': 'Nemera amasezerano n’Itegeko 058/2021 ku mukono wa elegitoroniki.',
  'sign.consentLabel': 'Emera amasezerano n’itegeko ku mukono wa elegitoroniki',
  'sign.consentHint':
    'Itegeko 058/2021 riha umukono wa elegitoroniki agaciro kangana n’uwo ku rupapuro. Izina ryawe, igihe wasinyiye n’iyi telefone bibikwa hamwe n’amasezerano.',
  'sign.action': 'Sinya utangize amasezerano',
  'sign.needSignature': 'Sinya mu kazu kari hejuru',
  'sign.needConsent': 'Shyira akamenyetso ku cyemezo kiri hepfo',
  'sign.ready': 'Byiteguye gusinywa',
  'sign.signing': 'Gutangiza',
  'sign.toast': 'Amasezerano arakora. Ubukode butangira {date}.',
  'sign.signedTitle': 'Amasezerano arakora',
  'sign.signedBody':
    'Impande zombi zamaze gusinya. Gahunda y’ubukode itangira ku {date}, kandi amasezerano ari ku rutonde rwo kohererezwa ubuyobozi bw’imisoro mu minsi 15.',
  'sign.notWired':
    'Ntibirahuzwa na seriveri, bityo iyi verisiyo ibika umukono kuri iyi telefone gusa.',
  'sign.alreadyActiveTitle': 'Byamaze gusinywa',
  'sign.alreadyActiveBody': 'Wasinye aya masezerano ku {date}. Nta kindi gisabwa.',
  'sign.openLease': 'Fungura amasezerano',
  'sign.padHint': 'Shushanya umukono wawe ukoresheje urutoki cyangwa ikaramu.',
  'sign.padPrompt': 'Sinya hano ukoresheje urutoki',
  'sign.padCaptured': 'Umukono wafashwe',
  'sign.padClear': 'Siba',
  'sign.padLabel': 'Ahantu ho gusinyira',

  /* R17 */
  'moveOut.title': 'Ubutumwa bwo kwimuka',
  'moveOut.rule': 'Amasezerano yawe asaba kumenyesha iminsi {days}.',
  'moveOut.earliest': 'Itariki ya mbere yo kwimuka: {date}',
  'moveOut.dateLabel': 'Itariki yo kwimuka',
  'moveOut.datePlaceholder': 'Hitamo itariki',
  'moveOut.pickDate': 'Hitamo itariki yo kwimuka',
  'moveOut.calendarTitle': 'Hitamo itariki yo kwimuka',
  'moveOut.calendarBody':
    'Amatariki abanziriza {date} yafunzwe kubera igihe cyo kumenyesha amasezerano yawe asaba.',
  'moveOut.useDate': 'Koresha iyi tariki',
  'moveOut.messageLabel': 'Ubutumwa kuri nyir’inzu',
  'moveOut.messagePlaceholder':
    'Murakoze kunyakira. Ngiye kwimukira ku kazi kandi nifuza gutegura igenzura rya nyuma.',
  'moveOut.messageHelper': 'Si ngombwa. Bujyana n’ubutumwa kuri {landlord}.',
  'moveOut.cautionTitle': 'Ingwate igarurwa nyuma',
  'moveOut.cautionBody': 'Itangwa nyuma yo kugenzura bwa nyuma, hakurwaho ibyumvikanyweho.',
  'moveOut.action': 'Tanga ubutumwa bwo kwimuka',
  'moveOut.confirmTitle': 'Gutanga ubu butumwa?',
  'moveOut.confirmBody':
    'Kubutanga birangiza aya masezerano ku {date}. Ntibishobora gukurwaho muri porogaramu, bityo guhindura itariki nyuma bisaba kuganira na {landlord}.',
  'moveOut.confirmAction': 'Yego, butange',
  'moveOut.confirmCancel': 'Subira inyuma',
  'moveOut.filing': 'Gutanga',
  'moveOut.toast': 'Ubutumwa bwatanzwe. Amasezerano arangira {date}.',
  'moveOut.filedTitle': 'Ubutumwa bwatanzwe',
  'moveOut.filedBody':
    '{landlord} yamenyeshejwe. Amasezerano akomeza kugeza {date} kandi icyumba cyanditsweho ko kizaboneka kuri iyo tariki.',
  'moveOut.next': 'Ibikurikiraho',
  'moveOut.nextRentTitle': 'Ubukode burakomeza',
  'moveOut.nextRentBody': 'Ugomba ubukode bw’ibihe byose kugeza ku munsi wo kwimuka urimo.',
  'moveOut.nextCautionTitle': 'Ingwate itangwa igihe cyo gusoza',
  'moveOut.nextCautionBody':
    'Ingwate ibitswe mu bubiko itangwa amasezerano arangiye, hakurwaho ibyumvikanyweho.',
  'moveOut.nextDisputeTitle': 'Amakimbirane anyura mu butumwa',
  'moveOut.nextDisputeBody':
    'Niba nyir’inzu atemeranya n’itariki, mubikemure mwembi. Nta bukemurampaka muri iyi verisiyo.',
  'moveOut.notWired':
    'Ntibirahuzwa na seriveri, bityo iyi verisiyo ibika ubutumwa kuri iyi telefone gusa.',
  'moveOut.done': 'Byarangiye',
  'moveOut.alreadyFiledTitle': 'Ubutumwa bwamaze gutangwa',
  'moveOut.unavailableTitle': 'Ntibishoboka kuri aya masezerano',
  'moveOut.unavailableBody':
    'Ubutumwa bwo kwimuka butangwa gusa ku masezerano akora.',

  /* R18 */
  'renew.title': 'Saba kongera igihe',
  'renew.current': 'Amasezerano ariho',
  'renew.currentEnds': 'Arangira {date}',
  'renew.newTerm': 'Igihe gishya usaba',
  'renew.term6': 'amezi 6',
  'renew.term12': 'amezi 12',
  'renew.term24': 'amezi 24',
  'renew.newStart': 'Itangira rishya',
  'renew.newEnd': 'Irangira rishya',
  'renew.rent': 'Ubukode usaba',
  'renew.rentLocked':
    'Bukomeza uko buri. Guhindura ubukode bisaba amasezerano mashya aho kongera igihe, bityo ubu busabe buhindura itariki yo kurangira gusa.',
  'renew.note': 'Ubutumwa kuri nyir’inzu',
  'renew.notePlaceholder':
    'Nifuza gukomeza ku giciro kimwe. Icyumba cyaranshimishije.',
  'renew.action': 'Ohereza ubusabe',
  'renew.sending': 'Kohereza',
  'renew.toast': 'Ubusabe bwo kongera igihe bwoherejwe kuri {landlord}.',
  'renew.sentTitle': 'Ubusabe bwoherejwe',
  'renew.sentBody':
    '{landlord} ni we ufata icyemezo. Nabyemera, amasezerano akomeza kugeza {date} ku bukode bumwe kandi mwembi murabimenyeshwa.',
  'renew.notWired':
    'Ntibirahuzwa na seriveri, bityo iyi verisiyo ibika ubusabe kuri iyi telefone gusa.',
  'renew.done': 'Byarangiye',
  'renew.pendingTitle': 'Hari ubusabe busanzwe kuri nyir’inzu',
  'renew.pendingBody': 'Ku {on} wasabye kongera kugeza {date}. Ntarafata icyemezo.',
  'renew.unavailableTitle': 'Ntibishoboka kuri aya masezerano',
  'renew.unavailableBody': 'Kongera igihe bisabwa gusa ku masezerano akora.',
  'renew.endingNote':
    'Hari ubutumwa bwo kwimuka bwatanzwe kuri aya masezerano. Kohereza ubusabe bisaba nyir’inzu kubuvanaho.',

  /* R19 */
  'visitors.title': 'Urutonde rw’abashyitsi',
  'visitors.listLabel': 'urutonde rw’abashyitsi bawe',
  'visitors.add': 'Andika umushyitsi',
  'visitors.thisMonth': 'Uku kwezi',
  'visitors.earlier': 'Mbere',
  'visitors.overnight': 'yararaye',
  'visitors.day': 'yaje ku manywa',
  'visitors.stillIn': 'aracyari mu cyumba',
  'visitors.relationFamily': 'Umuryango',
  'visitors.relationGuest': 'Umushyitsi',
  'visitors.relationWork': 'Akazi',
  'visitors.relationOther': 'Ikindi',
  'visitors.footnote':
    'Ubugenzuzi bushobora gusoma uru rutonde. Nyir’inzu ntashobora kurureba uko ashaka: agomba kubaza ku munsi runaka, kandi ubwo busabe burandikwa.',
  'visitors.emptyTitle': 'Nta mushyitsi wanditswe',
  'visitors.emptyBody':
    'Andika abantu baguma iwawe. Ni inyandiko yawe y’abari mu cyumba, kandi ni yo ubugenzuzi busoma nibubaza.',
  'visitors.readOnlyTitle': 'Uru rutonde rusomwa gusa',
  'visitors.readOnlyBody':
    'Amasezerano yarangiye, bityo urutonde rubitswe nk’amateka kandi ntirwakira ibindi.',
  'visitors.nameLabel': 'Izina ry’umushyitsi',
  'visitors.namePlaceholder': 'Marie Keza',
  'visitors.relationLabel': 'Isano',
  'visitors.stayLabel': 'Igihe kingana iki',
  'visitors.arrivedLabel': 'Yageze',
  'visitors.save': 'Bika icyanditswe',
  'visitors.saving': 'Kubika',
  'visitors.cancel': 'Reka',
  'visitors.needName': 'Banza wandike izina',
  'visitors.toast': '{name} yanditswe.',
  'visitors.entry': '{name}, {relation}, {stay}, {date}',

  /* R20 */
  'issue.title': 'Menyesha ikibazo',
  'issue.goesTo': 'Bijya kuri {org}',
  'issue.whatLabel': 'Ni iki kitagenda?',
  'issue.whatPlaceholder': 'Robine yo mu gikoni iravira',
  'issue.detailPlaceholder': 'Amazi arunda munsi y’ibikoresho kuva mu gitondo, biriyongera.',
  'issue.detailLabel': 'Ibisobanuro',
  'issue.detailHelper': 'Ibyo ubona, n’igihe byatangiriye.',
  'issue.photos': 'Amafoto',
  'issue.photoHint': 'Ni yo aza imbere ku cyemezo',
  'issue.priority': 'Uburemere',
  'issue.priorityUrgent': 'Byihutirwa',
  'issue.priorityNormal': 'Bisanzwe',
  'issue.priorityLow': 'Byoroheje',
  'issue.urgentNote':
    'Byihutirwa ni ibyangiza umutekano cyangwa bikubuza gukoresha icyumba: amazi, amashanyarazi, ingufuri.',
  'issue.action': 'Ohereza icyemezo',
  'issue.submitting': 'Kohereza',
  'issue.needTitle': 'Banza uvuge icyo kitagenda',
  'issue.toast': '{ref} cyoherejwe. {org} irabibona ubu.',
  'issue.filedTitle': 'Icyemezo {ref} cyoherejwe',
  'issue.filedBody':
    '{org} irabibona ku gice cy’ibisanwa. Uzabona ubutumwa hano igihe umuntu azashingwa kubikora.',
  'issue.notWired':
    'Ntibirahuzwa na seriveri, bityo amafoto asigara kuri iyi telefone kandi icyemezo kibaho muri iki gihe cyo gukoresha gusa.',
  'issue.done': 'Byarangiye',
  'issue.openOnLease': 'Ibyemezo bifunguye kuri aya masezerano',
  'issue.ticketRef': '{ref} · {state}',
  'issue.closedTitle': 'Aya masezerano yarangiye',
  'issue.closedBody':
    'Icyemezo gitangwa gusa ku masezerano akora. Vugana na {landlord} ku giti cye.',

  /* Contract */
  'contract.title': 'Amasezerano y’ubukode',
  'contract.en': 'Icyongereza',
  'contract.rw': 'Ikinyarwanda',
  'contract.parties': 'Impande n’amasezerano',
  'contract.clauses': 'Ingingo',
  'contract.landlord': 'Nyir’inzu',
  'contract.tenant': 'Ukodesha',
  'contract.room': 'Icyumba',
  'contract.term': 'Igihe',
  'contract.rent': 'Ubukode bw’ukwezi',
  'contract.caution': 'Ingwate, ibitswe mu bubiko',
  'contract.download': 'Kuramo PDF',
  'contract.downloadToast':
    'Gukuramo ni ikigereranyo muri iyi verisiyo. PDF izaza igihe ububiko buzahuzwa.',
  'contract.bilingual':
    'Inyandiko y’Icyongereza n’iy’Ikinyarwanda zifite agaciro kangana.',
  'contract.emptyTitle': 'Nta ngingo ziri kuri aya masezerano',
  'contract.emptyBody':
    'Ubu bukode bwabayeho mbere y’amasezerano ari muri porogaramu. PDF yasinywe iri ku rupapuro rw’ibisobanuro by’amasezerano.',
  'contract.language': 'Ururimi rw’amasezerano',
  'payRent.handset': `${en['payRent.handset']} (RW)`,
  'payRent.handsetPlaceholder': `${en['payRent.handsetPlaceholder']} (RW)`,
  'payRent.handsetHelp': `${en['payRent.handsetHelp']} (RW)`,
  'payRent.handsetInvalid': `${en['payRent.handsetInvalid']} (RW)`,
  'payRent.handsetWrongNetwork': `${en['payRent.handsetWrongNetwork']} (RW)`,
  'payRent.errorTitle': `${en['payRent.errorTitle']} (RW)`,
  'payRent.errorBody': `${en['payRent.errorBody']} (RW)`,
  'payRent.stillOwed': `${en['payRent.stillOwed']} (RW)`,
};
