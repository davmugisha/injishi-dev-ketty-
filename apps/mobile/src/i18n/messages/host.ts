/**
 * `host` — the Host desk: Today, Bookings, the booking detail, the staffed
 * check-in capture and the payouts row. Optional Session A owns this file.
 *
 * The canvas draws no Host frame (decision D5), so the English is the operator
 * web app's own wherever that app has a sentence for the same thing
 * (`apps/app/src/pms/screens/{today,reservations,reservation,stay}.tsx`), and
 * F-B06, F-B07, F-B08, F-B17 or FL08/FL09/FL12's where it does not. The desk
 * vocabulary is deliberately the operator's, not a phone dialect of it: a
 * receptionist moving between the web desk and the phone should meet one set
 * of words.
 *
 * **Keys this surface does NOT define, and reads from elsewhere:**
 *   - `status.booking.*` — `StatusBadge`'s own. A booking that reads
 *     "Confirmed" to the guest must not read "Reserved" to the host.
 *   - `calendar.*` — the month names, the night counts and the range control's.
 *   - `state.*` — the four list states the whole app shares.
 *   - `picker.*` — the photo picker's permission copy.
 *   - `checkin.doc*` — the two document types, from Session 5's self check-in.
 *     A national ID is a national ID at the desk too.
 *
 * The Injishi word is **Booking**, never Reservation (ui-glossary.md). The
 * ROUTE keeps `reservation/` because the operator app already addresses it that
 * way and Session 0 registered the tab as `reservations`; every LABEL below
 * says Booking.
 */

export const en = {
  /* ------------------------------------------------------------ the shell */
  'host.today': 'Today',
  'host.todayGreeting': 'Front desk',
  'host.bookings': 'Reservations',
  'host.bookingsGreeting': 'Every booking',
  'host.timezone': '{date} · Africa/Kigali',
  'host.desk': '{property} · front desk',

  /* ------------------------------------------------------- today's groups */
  'host.groupRequests': 'Requests to approve',
  'host.groupArriving': 'Arriving today',
  'host.groupDeparting': 'Departing today',
  'host.groupInHouse': 'In house tonight',
  'host.emptyRequests':
    'No requests waiting. A new booking request appears here the moment it arrives.',
  'host.emptyArriving': 'Nobody is arriving today. Tomorrow’s arrivals are under Reservations.',
  'host.emptyDeparting': 'Nobody is leaving today.',
  'host.emptyInHouse': 'No guests in house tonight.',
  'host.emptyToday': 'Nothing needs you today',
  'host.emptyTodayBody':
    'No requests, no arrivals, no departures and nobody in house. Reservations has the whole book.',
  'host.emptyTodayAction': 'Open Reservations',
  'host.errorTitle': 'The desk would not load',
  'host.errorBody':
    'This is a connection problem, not an empty desk. Your bookings are still there.',
  'host.offlineNote': 'Showing the last list. Decisions you make now are kept and sent on.',

  /* ------------------------------------------------------- the count chips */
  'host.countAll': 'All',
  'host.countRequests': 'Requests',
  'host.countArriving': 'Arriving',
  'host.countDeparting': 'Departing',
  'host.countInHouse': 'In house',
  'host.countHint': 'Show only {label}',

  /* ---------------------------------------------------------- the filters */
  'host.filterAll': 'All',
  'host.filterPending': 'Requests',
  'host.filterUpcoming': 'Upcoming',
  'host.filterInHouse': 'In house',
  'host.filterCheckedOut': 'Checked out',
  'host.filterDeclined': 'Declined',
  'host.emptyAll': 'No bookings yet. A request lands here the moment a guest sends one.',
  'host.emptyUpcoming': 'Nothing booked ahead. Confirmed stays in the future appear here.',
  'host.emptyCheckedOut': 'Nobody has checked out yet.',
  'host.emptyDeclined': 'Nothing has been declined.',
  'host.emptySearch': 'No booking matches “{query}”.',
  'host.emptySearchBody': 'Search looks at the guest, the reference and the room number.',
  'host.clearSearch': 'Clear the search',
  'host.searchLabel': 'Search bookings',
  'host.searchPlaceholder': 'Guest, reference or room',
  'host.listLabel': 'Reservations',
  'host.resultCount': '{count} bookings',
  'host.resultOne': '1 booking',

  /* ------------------------------------------------------------- the rows */
  'host.roomAnd': 'Room {room} · {type}',
  'host.noRoomYet': 'No room assigned',
  'host.assignAtCheckIn': 'Pick a room at check-in.',
  'host.oneGuest': '1 guest',
  'host.guestCount': '{count} guests',
  'host.nightOf': 'Night {night} of {nights}',
  'host.arrivesAt': 'Arrives {time}',
  'host.arrivesUnknown': 'No arrival time given',
  'host.checkoutBy': 'Checkout by {time}',
  'host.returning': 'Stayed here {count} times before',
  'host.firstStay': 'First stay here',
  'host.balanceDue': '{amount} due',
  'host.settled': 'Settled',
  'host.selfCheckedIn': 'Checked themselves in',
  'host.openBooking': 'Open {guest}’s booking',
  'host.a11yRow': '{guest}. {room}. {stay}. {status}',

  /* ------------------------------------------------------- approve/decline */
  'host.approve': 'Approve',
  'host.decline': 'Decline',
  'host.expiresMinutes': 'Auto-declines in {count} min',
  'host.expiresHour': 'Auto-declines in 1 hour',
  'host.expiresHours': 'Auto-declines in {count} hours',
  'host.expired': 'This request has expired',
  'host.expiryRule':
    'A request answers itself after 24 hours, or at check-in, whichever comes first.',
  'host.approvedToast': '{guest} is confirmed. Assign a room before they arrive.',
  'host.declinedToast': '{guest} was declined and refunded in full.',
  'host.undo': 'Undo',
  'host.undoAnnounce': '{text} Undo is available for a few seconds.',
  'host.undoneToast': 'Put back. {guest} is waiting on you again.',
  'host.staleTitle': 'That request has already been answered',
  'host.staleBody':
    'It expired and was refunded in full before this tap landed. Nothing was charged twice.',
  'host.staleResolved': 'That request has already been answered on another screen.',
  'host.declineTitle': 'Decline this request',
  'host.declineSubtitle': '{guest} is refunded in full, whatever the cancellation tier says.',
  'host.declineReason': 'Why are you declining?',
  'host.reasonDates': 'Those dates are not free',
  'host.reasonRoom': 'That room is not available',
  'host.reasonParty': 'Too many guests for the room',
  'host.reasonOther': 'Another reason',
  'host.declineNote': 'What should the guest be told?',
  'host.declineNotePlaceholder': 'One line, in your own words',
  'host.declineNoteRequired': 'Write a line so the guest knows why.',
  'host.declineConfirm': 'Decline and refund',
  'host.declineCancel': 'Keep the request',
  'host.declineWireNote':
    'Every host decline is recorded as one reason on the wire. Your words go to the guest, not to the record.',

  /* ---------------------------------------------------------- the detail */
  'host.bookingTitle': 'Booking',
  'host.notFoundTitle': 'That booking is not on this desk',
  'host.notFoundBody':
    'The reference belongs to another property, or the booking has been removed.',
  'host.notFoundAction': 'Back to Reservations',
  'host.stay': 'The stay',
  'host.factGuest': 'Guest',
  'host.factReference': 'Reference',
  'host.factRoom': 'Room',
  'host.factRoomType': 'Room type',
  'host.factDates': 'Dates',
  'host.factNights': 'Nights',
  'host.factGuests': 'Guests',
  'host.factArrival': 'Arrival',
  'host.factSource': 'Source',
  'host.sourceBooked': 'Booked ahead',
  'host.sourceWalkIn': 'Walk-in',
  'host.factCheckIn': 'Checked in',
  'host.factCheckOut': 'Checked out',
  'host.checkInStaffed': 'At the desk, {time}',
  'host.checkInSelf': 'By the guest, {time}',
  'host.money': 'Money',
  'host.lineAccommodation': 'Accommodation',
  'host.lineFee': 'Guest service fee',
  'host.lineTotal': 'Guest paid',
  'host.yourShare': 'Your share',
  'host.noCommission': 'The full accommodation amount. Injishi takes no commission.',
  'host.escrowHeld': 'Held in escrow until the guest checks in.',
  'host.escrowReleased': 'Released. The payout clock is running.',
  'host.escrowRefunded': 'Refunded in full to the guest.',
  'host.invoice': 'Tax invoice',
  'host.invoiceAtCheckout': 'Issued at checkout',
  'host.balance': 'Balance',
  'host.balanceNone': 'Nothing outstanding',
  'host.guestSection': 'The guest',
  'host.callGuest': 'Call {guest}',
  'host.callFailed': 'This device cannot place a call.',
  'host.messageGuest': 'Message the guest',
  'host.messageHint': 'Opens the booking’s thread in Inbox',
  'host.history': 'What has happened',
  'host.eventRequested': 'Requested',
  'host.eventConfirmed': 'Confirmed',
  'host.eventDeclined': 'Declined and refunded',
  'host.eventCheckedIn': 'Checked in',
  'host.eventCheckedOut': 'Checked out, invoice issued',

  /* --------------------------------------------------------- what is elsewhere */
  'host.onTheWeb': 'On the web desk',
  'host.folioTitle': 'The folio',
  'host.folioBody':
    'Posting charges, splitting a bill and taking a part payment stay on the operator web app. The phone shows what is owed and settles it at checkout.',
  'host.tapeChartTitle': 'The tape chart',
  'host.tapeChartBody':
    'Moving a booking between rooms and reading the whole month at once needs a screen this size cannot give it. It stays on the web desk.',
  'host.walkInTitle': 'Walk-in capture',
  'host.walkInBody':
    'Opening a stay with no booking behind it stays on the web desk, where the bill can be opened in the same step.',

  /* -------------------------------------------------------------- check-in */
  'host.checkIn': 'Check in',
  'host.checkInTitle': 'Check in {guest}',
  'host.stepIdentity': 'Document',
  'host.stepPhoto': 'Photo',
  'host.stepRoom': 'Room',
  'host.identityTitle': 'What did they hand you?',
  'host.identityBody': 'Read the number off the document itself, not off the booking.',
  'host.nameLabel': 'Full name',
  'host.namePlaceholder': 'As written on the document',
  'host.nameHelper': 'The booking says {name}. Change it if the document disagrees.',
  'host.numberLabel': 'Document number',
  'host.numberHelperNid': 'Sixteen digits on a Rwandan national ID.',
  'host.numberHelperPassport': 'As printed, including any letters.',
  'host.photoTitle': 'Photograph the document',
  'host.photoBody':
    'One clear photograph of the page with the number on it. It stays on this device in the prototype.',
  'host.photoHint': 'Hold the document flat and fill the frame.',
  'host.roomTitle': 'Which room are they in?',
  'host.roomBody': 'Only rooms that are free tonight are offered.',
  'host.roomClean': 'Room {room} · {type}',
  'host.roomNeedsCleaning': 'Needs cleaning',
  'host.roomBeingCleaned': 'Being cleaned',
  'host.roomOutOfOrder': 'Out of order',
  'host.roomOccupied': 'Occupied',
  'host.roomFree': 'Ready',
  'host.noRoomsFree': 'Every room is taken tonight',
  'host.noRoomsFreeBody':
    'Nothing on the floor board is free. Free one on the web desk, or check the guest in once housekeeping releases a room.',
  'host.checkInContinue': 'Continue',
  'host.checkInBack': 'Back',
  'host.checkInFinish': 'Check in',
  'host.checkInFinishing': 'Opening the stay…',
  'host.checkInAutosaved': 'What you have typed is kept if you step away.',
  'host.checkInVerified':
    'A desk check-in is verified: you have seen the document. A guest checking themselves in is not.',
  'host.blockedName': 'Write the name as the document has it.',
  'host.blockedNumber': 'Enter the document number.',
  'host.blockedNid': 'A Rwandan national ID is sixteen digits.',
  'host.blockedPassportShort': 'That passport number looks too short.',
  'host.blockedPhoto': 'Photograph the document to carry on.',
  'host.blockedRoom': 'Pick the room they are staying in.',
  'host.checkedInToast': '{guest} is in room {room}. The stay is open.',
  'host.checkInClosedTitle': 'There is nothing to check in',
  'host.checkInClosedBody':
    'This booking is not a confirmed stay waiting at the door. Reservations has the current state.',

  /* -------------------------------------------------------------- checkout */
  'host.checkOut': 'Check out',
  'host.checkOutTitle': 'Check {guest} out?',
  'host.checkOutBody':
    'This closes the stay, issues the tax invoice and hands room {room} to housekeeping. There is no undo.',
  'host.checkOutBalance':
    '{amount} is still on the folio. Checking out settles it and marks it paid on the mock adapter.',
  'host.checkOutEarly':
    'They are leaving {count} nights early. The stay closes tonight and the nights actually stayed are what is invoiced.',
  'host.checkOutConfirm': 'Check out and invoice',
  'host.checkOutCancel': 'Not yet',
  'host.checkOutWorking': 'Closing the stay…',
  'host.checkedOutToast': '{guest} is out. Invoice {invoice}. Room {room} goes to housekeeping.',
  'host.checkedOutNoRoom': '{guest} is out. Invoice {invoice} issued.',
  'host.viewBill': 'View bill',

  /* -------------------------------------------------------------- payouts */
  'host.payouts': 'Payouts',
  'host.payoutsSubtitle': 'The full amount, with no commission taken.',
  'host.payoutsOpen': 'See every payout',
  'host.payoutsTitle': 'Your payouts',
  'host.payoutsEmpty': 'No payout yet',
  'host.payoutsEmptyBody': 'A payout is scheduled the moment a guest checks out.',
  'host.payoutScheduled': 'Scheduled',
  'host.payoutQueued': 'Waiting on you',
  'host.payoutPaidLabel': 'Paid',
  'host.payoutHeld': 'Held',
  'host.payoutReleasesHour': 'Releases in about an hour',
  'host.payoutReleasesHours': 'Releases in about {count} hours',
  'host.payoutReleasing': 'Releasing now',
  'host.payoutPaid': 'Sent to your MoMo account',
  'host.payoutQueuedNote': 'Add a payout account and this is sent. Nothing is lost while it waits.',
  'host.payoutHeldNote': 'A dispute is open on this stay. It stays held until that is settled.',
  'host.payoutBuffer':
    'Every payout waits out a dispute buffer after checkout before it is released.',
  'host.payoutTo': 'To {destination}',
  'host.destinationMomo': 'MTN MoMo',
  'host.destinationBank': 'Bank transfer',
  'host.payoutFor': 'For {guest}, {reference}',
  'host.addPayoutAccount': 'Add a payout account',
  'host.payoutAccountNote': 'Setting up where money lands is on the web desk.',

  /* ---------------------------------------------------------- the adapter */
  'host.mockAdapter': 'Mock adapter',
  'host.mockAdapterNote':
    'No real money moves. Refunds, invoices and payouts run on the mock adapter.',

  /* ------------------ the check-in capture failing (gaps.md §6) ----------- */
  // `err=0` on identity capture. A front desk told the guest is checked in when
  // the capture did not save has given away a room and has no record of who
  // took it.
  'host.checkInFailedTitle': 'The check-in did not save',
  'host.checkInFailedBody': 'The guest is not checked in and no room has been assigned. Your photos are still here — try again.',
  'host.checkInQueued': 'Saved on this phone. It will be submitted when you reconnect.',
} as const;

/**
 * Parity is a type error here, not a review note: `rw` is keyed off this
 * file's own `en`, so a key added to one and not the other fails `tsc` in
 * this file rather than in the merge.
 *
 * A value ending in ` (RW)` is one this session had no confident Kinyarwanda
 * for. Every one of them is a full sentence rather than a label, which is
 * where a wrong translation does the most damage, and they are the audit's
 * work list.
 */
/**
 * **Session 11's Kinyarwanda audit stripped 35 ` (RW)` markers from this
 * block.** They were false positives: Session A wrote real Kinyarwanda for all
 * thirty-five and left the marker on, so the audit's own work list — "a string
 * ending ` (RW)` is one no session had Kinyarwanda for" — was reporting
 * translated copy as untranslated. The strings themselves are unchanged. They
 * still want a native review pass, like the rest of the catalogue.
 */
export const rw: Record<keyof typeof en, string> = {
  'host.today': 'Uyu munsi',
  'host.todayGreeting': 'Akazi ko ku biro',
  'host.bookings': 'Ubwandikishe',
  'host.bookingsGreeting': 'Ubwandikishe bwose',
  'host.timezone': '{date} · Africa/Kigali',
  'host.desk': '{property} · ibiro byakira',

  'host.groupRequests': 'Ubusabe bwo kwemeza',
  'host.groupArriving': 'Abaza uyu munsi',
  'host.groupDeparting': 'Abagenda uyu munsi',
  'host.groupInHouse': 'Abari mu nzu muri iri joro',
  'host.emptyRequests':
    'Nta busabe butegereje. Ubusabe bushya buhita bugaragara hano.',
  'host.emptyArriving': 'Nta muntu uza uyu munsi. Abaza ejo bari muri Ubwandikishe.',
  'host.emptyDeparting': 'Nta muntu ugenda uyu munsi.',
  'host.emptyInHouse': 'Nta bashyitsi bari mu nzu muri iri joro.',
  'host.emptyToday': 'Nta kigukeneye uyu munsi',
  'host.emptyTodayBody':
    'Nta busabe, nta baza, nta bagenda, kandi nta bari mu nzu. Ubwandikishe bufite byose.',
  'host.emptyTodayAction': 'Fungura Ubwandikishe',
  'host.errorTitle': 'Ibiro ntibyafunguye',
  'host.errorBody':
    'Iki ni ikibazo cy’umuyoboro, si ibiro bidafite abantu. Ubwandikishe bwawe buracyahari.',
  'host.offlineNote':
    'Urimo kureba urutonde rwa nyuma. Ibyemezo ufata ubu birabikwa bikazoherezwa.',

  'host.countAll': 'Byose',
  'host.countRequests': 'Ubusabe',
  'host.countArriving': 'Abaza',
  'host.countDeparting': 'Abagenda',
  'host.countInHouse': 'Mu nzu',
  'host.countHint': 'Erekana gusa {label}',

  'host.filterAll': 'Byose',
  'host.filterPending': 'Ubusabe',
  'host.filterUpcoming': 'Biri imbere',
  'host.filterInHouse': 'Mu nzu',
  'host.filterCheckedOut': 'Barasohotse',
  'host.filterDeclined': 'Byanzwe',
  'host.emptyAll': 'Nta bwandikishe burahari. Ubusabe buhita bugaragara hano.',
  'host.emptyUpcoming': 'Nta cyanditswe imbere. Icumbi cyemejwe cy’ejo kizagaragara hano.',
  'host.emptyCheckedOut': 'Nta muntu urasohoka.',
  'host.emptyDeclined': 'Nta cyanzwe.',
  'host.emptySearch': 'Nta bwandikishe buhuye na “{query}”.',
  'host.emptySearchBody':
    'Ishakisha rireba izina ry’umushyitsi, inomero y’ubwandikishe n’inomero y’icyumba.',
  'host.clearSearch': 'Siba ishakisha',
  'host.searchLabel': 'Shakisha ubwandikishe',
  'host.searchPlaceholder': 'Izina, inomero cyangwa icyumba',
  'host.listLabel': 'Ubwandikishe',
  'host.resultCount': 'Ubwandikishe {count}',
  'host.resultOne': 'Ubwandikishe 1',

  'host.roomAnd': 'Icyumba {room} · {type}',
  'host.noRoomYet': 'Nta cyumba cyahawe',
  'host.assignAtCheckIn': 'Uzahitamo icyumba igihe cyo kwinjira.',
  'host.oneGuest': 'Umushyitsi 1',
  'host.guestCount': 'Abashyitsi {count}',
  'host.nightOf': 'Ijoro rya {night} kuri {nights}',
  'host.arrivesAt': 'Aza saa {time}',
  'host.arrivesUnknown': 'Nta saa yatanzwe',
  'host.checkoutBy': 'Asohoka mbere ya {time}',
  'host.returning': 'Yaraye hano inshuro {count} mbere',
  'host.firstStay': 'Ubwa mbere araye hano',
  'host.balanceDue': '{amount} asigaye',
  'host.settled': 'Byishyuwe',
  'host.selfCheckedIn': 'Yiyinjirije ubwe',
  'host.openBooking': 'Fungura ubwandikishe bwa {guest}',
  'host.a11yRow': '{guest}. {room}. {stay}. {status}',

  'host.approve': 'Emeza',
  'host.decline': 'Anga',
  'host.expiresMinutes': 'Byiyanga mu minota {count}',
  'host.expiresHour': 'Byiyanga mu isaha 1',
  'host.expiresHours': 'Byiyanga mu masaha {count}',
  'host.expired': 'Ubu busabe bwarangiye',
  'host.expiryRule':
    'Ubusabe bwisubiza nyuma y’amasaha 24, cyangwa igihe cyo kwinjira, icyabanza.',
  'host.approvedToast': '{guest} yemejwe. Muhe icyumba mbere y’uko aza.',
  'host.declinedToast': '{guest} yanzwe kandi yasubijwe amafaranga yose.',
  'host.undo': 'Subiza',
  'host.undoAnnounce': '{text} Gusubiza birashoboka mu masegonda make.',
  'host.undoneToast': 'Byasubijwe. {guest} aracyagutegereje.',
  'host.staleTitle': 'Ubwo busabe bwamaze gusubizwa',
  'host.staleBody':
    'Bwarangiye kandi amafaranga yasubijwe yose mbere y’uko ukanda. Nta kintu cyishyuwe kabiri.',
  'host.staleResolved': 'Ubwo busabe bwamaze gusubizwa ku rindi paji.',
  'host.declineTitle': 'Anga ubu busabe',
  'host.declineSubtitle':
    '{guest} asubizwa amafaranga yose, uko amasezerano yo guhagarika yaba ateye kose.',
  'host.declineReason': 'Kuki uranga?',
  'host.reasonDates': 'Ayo matariki ntabwo ari masa',
  'host.reasonRoom': 'Icyo cyumba nticyaboneka',
  'host.reasonParty': 'Abashyitsi ni benshi ku cyumba',
  'host.reasonOther': 'Indi mpamvu',
  'host.declineNote': 'Umushyitsi abwirwe iki?',
  'host.declineNotePlaceholder': 'Umurongo umwe, mu magambo yawe',
  'host.declineNoteRequired': 'Andika umurongo kugira ngo umushyitsi amenye impamvu.',
  'host.declineConfirm': 'Anga usubize amafaranga',
  'host.declineCancel': 'Bureke bugume',
  'host.declineWireNote':
    'Ukwanga kwose kwa nyir’inzu kwandikwa nk’impamvu imwe ku rutonde. Amagambo yawe ajya ku mushyitsi, ntajya mu nyandiko.',

  'host.bookingTitle': 'Ubwandikishe',
  'host.notFoundTitle': 'Ubwo bwandikishe ntibubarizwa kuri ibi biro',
  'host.notFoundBody':
    'Iyo nomero ni iy’irindi cumbi, cyangwa ubwandikishe bwakuweho.',
  'host.notFoundAction': 'Subira ku Bwandikishe',
  'host.stay': 'Icumbi',
  'host.factGuest': 'Umushyitsi',
  'host.factReference': 'Inomero',
  'host.factRoom': 'Icyumba',
  'host.factRoomType': 'Ubwoko bw’icyumba',
  'host.factDates': 'Amatariki',
  'host.factNights': 'Amajoro',
  'host.factGuests': 'Abashyitsi',
  'host.factArrival': 'Kugera',
  'host.factSource': 'Aho bwaturutse',
  'host.sourceBooked': 'Byanditswe mbere',
  'host.sourceWalkIn': 'Yaje adafite ubwandikishe',
  'host.factCheckIn': 'Yinjiye',
  'host.factCheckOut': 'Yasohotse',
  'host.checkInStaffed': 'Ku biro, saa {time}',
  'host.checkInSelf': 'Yikoreye, saa {time}',
  'host.money': 'Amafaranga',
  'host.lineAccommodation': 'Icumbi',
  'host.lineFee': 'Amafaranga ya serivisi y’umushyitsi',
  'host.lineTotal': 'Umushyitsi yishyuye',
  'host.yourShare': 'Umugabane wawe',
  'host.noCommission': 'Amafaranga y’icumbi yose. Injishi ntacyo ikuraho.',
  'host.escrowHeld': 'Afatiwe muri escrow kugeza umushyitsi yinjiye.',
  'host.escrowReleased': 'Yarekuwe. Isaha yo kwishyurwa iratangiye.',
  'host.escrowRefunded': 'Yasubijwe yose ku mushyitsi.',
  'host.invoice': 'Fagitire y’umusoro',
  'host.invoiceAtCheckout': 'Itangwa igihe cyo gusohoka',
  'host.balance': 'Asigaye',
  'host.balanceNone': 'Nta kintu gisigaye',
  'host.guestSection': 'Umushyitsi',
  'host.callGuest': 'Hamagara {guest}',
  'host.callFailed': 'Iyi telefoni ntishobora guhamagara.',
  'host.messageGuest': 'Andikira umushyitsi',
  'host.messageHint': 'Bifungura ikiganiro cy’ubu bwandikishe muri Inbox',
  'host.history': 'Ibyabaye',
  'host.eventRequested': 'Byasabwe',
  'host.eventConfirmed': 'Byemejwe',
  'host.eventDeclined': 'Byanzwe, amafaranga asubizwa',
  'host.eventCheckedIn': 'Yinjiye',
  'host.eventCheckedOut': 'Yasohotse, fagitire yatanzwe',

  'host.onTheWeb': 'Ku rubuga rw’akazi',
  'host.folioTitle': 'Fagitire y’icumbi',
  'host.folioBody':
    'Kwandika ibiciro, kugabanya fagitire no kwakira ubwishyu bwa buke bikorerwa ku rubuga. Telefoni yerekana ibisigaye ikanabyishyura igihe cyo gusohoka.',
  'host.tapeChartTitle': 'Ikarita y’ibyumba',
  'host.tapeChartBody':
    'Kwimura ubwandikishe hagati y’ibyumba no kureba ukwezi kose icyarimwe bisaba ecran nini. Bigumaho ku rubuga.',
  'host.walkInTitle': 'Kwakira udafite ubwandikishe',
  'host.walkInBody':
    'Gufungura icumbi nta bwandikishe bubanza bigumaho ku rubuga, aho fagitire ifungurwa icyarimwe.',

  'host.checkIn': 'Mwinjize',
  'host.checkInTitle': 'Injiza {guest}',
  'host.stepIdentity': 'Icyangombwa',
  'host.stepPhoto': 'Ifoto',
  'host.stepRoom': 'Icyumba',
  'host.identityTitle': 'Yaguhaye iki?',
  'host.identityBody':
    'Soma inomero ku cyangombwa ubwacyo, si ku bwandikishe.',
  'host.nameLabel': 'Amazina yose',
  'host.namePlaceholder': 'Nk’uko yanditse ku cyangombwa',
  'host.nameHelper':
    'Ubwandikishe buvuga {name}. Uhindure niba icyangombwa kivuga ukundi.',
  'host.numberLabel': 'Inomero y’icyangombwa',
  'host.numberHelperNid': 'Imibare cumi n’itandatu ku ndangamuntu y’u Rwanda.',
  'host.numberHelperPassport': 'Nk’uko yanditse, hamwe n’inyuguti zose.',
  'host.photoTitle': 'Fata ifoto y’icyangombwa',
  'host.photoBody':
    'Ifoto imwe isobanutse y’urupapuro rufite inomero. Iguma kuri iyi telefoni muri iki gerageza.',
  'host.photoHint': 'Shyira icyangombwa ku buriri usuzume ko cyuzuye mu ifoto.',
  'host.roomTitle': 'Ni ikihe cyumba bagiyemo?',
  'host.roomBody': 'Ibyumba bisa gusa muri iri joro ni byo byerekanwa.',
  'host.roomClean': 'Icyumba {room} · {type}',
  'host.roomNeedsCleaning': 'Gikeneye gusukurwa',
  'host.roomBeingCleaned': 'Kirimo gusukurwa',
  'host.roomOutOfOrder': 'Ntigikoreshwa',
  'host.roomOccupied': 'Kirimo abantu',
  'host.roomFree': 'Cyiteguye',
  'host.noRoomsFree': 'Ibyumba byose birimo abantu muri iri joro',
  'host.noRoomsFreeBody':
    'Nta cyumba gisa ku rutonde. Fungura kimwe ku rubuga, cyangwa utegereze ko abasukura barangiza.',
  'host.checkInContinue': 'Komeza',
  'host.checkInBack': 'Subira inyuma',
  'host.checkInFinish': 'Mwinjize',
  'host.checkInFinishing': 'Gufungura icumbi…',
  'host.checkInAutosaved': 'Ibyo wanditse birabikwa nusohoka.',
  'host.checkInVerified':
    'Kwinjizwa ku biro biremezwa: waraborewe icyangombwa. Uwiyinjiza ubwe ntibyemezwa.',
  'host.blockedName': 'Andika amazina nk’uko icyangombwa kivuga.',
  'host.blockedNumber': 'Andika inomero y’icyangombwa.',
  'host.blockedNid': 'Indangamuntu y’u Rwanda igizwe n’imibare cumi n’itandatu.',
  'host.blockedPassportShort': 'Iyo nomero ya pasiporo isa n’ingufi.',
  'host.blockedPhoto': 'Fata ifoto y’icyangombwa kugira ngo ukomeze.',
  'host.blockedRoom': 'Hitamo icyumba barimo.',
  'host.checkedInToast': '{guest} ari mu cyumba {room}. Icumbi cyafunguwe.',
  'host.checkInClosedTitle': 'Nta kintu cyo kwinjiza',
  'host.checkInClosedBody':
    'Ubu bwandikishe si icumbi cyemejwe gitegereje ku muryango. Ubwandikishe bufite uko bimeze.',

  'host.checkOut': 'Musohore',
  'host.checkOutTitle': 'Gusohora {guest}?',
  'host.checkOutBody':
    'Ibi bifunga icumbi, bigatanga fagitire y’umusoro, kandi bigaha icyumba {room} abasukura. Nta gusubiza inyuma.',
  'host.checkOutBalance':
    '{amount} aracyari kuri fagitire. Gusohora birabyishyura bikabyandika nk’ibyishyuwe ku buryo bw’igerageza.',
  'host.checkOutEarly':
    'Bagenda hasigaye amajoro {count}. Icumbi gifunga iri joro, kandi amajoro baraye ni yo yandikwa.',
  'host.checkOutConfirm': 'Sohora utange fagitire',
  'host.checkOutCancel': 'Ntabwo ari ubu',
  'host.checkOutWorking': 'Gufunga icumbi…',
  'host.checkedOutToast':
    '{guest} yasohotse. Fagitire {invoice}. Icyumba {room} kijya ku basukura.',
  'host.checkedOutNoRoom': '{guest} yasohotse. Fagitire {invoice} yatanzwe.',
  'host.viewBill': 'Reba fagitire',

  'host.payouts': 'Kwishyurwa',
  'host.payoutsSubtitle': 'Amafaranga yose, nta cyakuweho.',
  'host.payoutsOpen': 'Reba ibyishyurwa byose',
  'host.payoutsTitle': 'Ibyishyurwa byawe',
  'host.payoutsEmpty': 'Nta kwishyurwa biraba',
  'host.payoutsEmptyBody': 'Kwishyurwa bitegurwa ako kanya umushyitsi asohotse.',
  'host.payoutScheduled': 'Byateguwe',
  'host.payoutQueued': 'Bigutegereje',
  'host.payoutPaidLabel': 'Byishyuwe',
  'host.payoutHeld': 'Byafashwe',
  'host.payoutReleasesHour': 'Birekurwa mu isaha nka imwe',
  'host.payoutReleasesHours': 'Birekurwa mu masaha nka {count}',
  'host.payoutReleasing': 'Birekurwa ubu',
  'host.payoutPaid': 'Byoherejwe kuri MoMo yawe',
  'host.payoutQueuedNote':
    'Shyiraho konti yo kwishyurirwaho na byo byoherezwe. Nta kizimira mu gihe bitegereje.',
  'host.payoutHeldNote':
    'Hari impaka kuri iki cumbi. Bigumaho bifashwe kugeza zikemutse.',
  'host.payoutBuffer':
    'Buri kwishyurwa gutegereza igihe cy’impaka nyuma yo gusohoka mbere yo kurekurwa.',
  'host.payoutTo': 'Kuri {destination}',
  'host.destinationMomo': 'MTN MoMo',
  'host.destinationBank': 'Kohereza kuri banki',
  'host.payoutFor': 'Kuri {guest}, {reference}',
  'host.addPayoutAccount': 'Shyiraho konti yo kwishyurirwaho',
  'host.payoutAccountNote': 'Gushyiraho aho amafaranga ajya bikorerwa ku rubuga.',

  'host.mockAdapter': 'Uburyo bw’igerageza',
  'host.mockAdapterNote':
    'Nta mafaranga nyayo agenda. Gusubiza, fagitire no kwishyurwa bikoresha uburyo bw’igerageza.',
  'host.checkInFailedTitle': `${en['host.checkInFailedTitle']} (RW)`,
  'host.checkInFailedBody': `${en['host.checkInFailedBody']} (RW)`,
  'host.checkInQueued': `${en['host.checkInQueued']} (RW)`,
};
