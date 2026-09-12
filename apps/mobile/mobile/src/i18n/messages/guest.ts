/**
 * `guest` - Explore, Saved, Trips, trip detail and listing detail.
 *
 * Sessions 2, 3 and 5 add here. Booking lives in `book`, self check-in in
 * `checkin`, and the search sheet in `search`, so a session touches one file.
 */

export const en = {
  'explore.greeting': 'Muraho, {name}',
  'explore.title': 'Where to?',
  'explore.searchPlaceholder': 'Where · When · Who',
  'explore.searchHint': 'Search stays by place, dates and guests',
  'explore.filters': 'Filters',
  'explore.sectionStays': 'Stays in Rwanda',
  'explore.filterAnywhere': 'Anywhere',
  'explore.filterKigali': 'Kigali',
  'explore.filterLakeside': 'Lakeside',
  'explore.filterParks': 'Parks',
  'explore.filterUnder100k': 'Under 100K',
  'explore.emptyTitle': 'No stays match',
  'explore.emptyBody': 'Nothing in this filter yet. Widen it, or look at everywhere.',
  'explore.emptyAction': 'Show everywhere',
  'explore.listLabel': 'stays',

  /* The rail, the count line and the two views (Session 2) */
  'explore.openStay': 'Open {title}',
  'explore.filtersChip': 'Filters',
  'explore.filtersActive': 'Filters, {count} on',
  'explore.quickFilters': 'Quick filters',
  'explore.instantBook': 'Instant book',
  'explore.activeFilters': 'Filters you have set',
  'explore.removeFilter': 'Remove {filter}',
  'explore.view': 'How the results are shown',
  'explore.viewList': 'List',
  'explore.viewMap': 'Map',
  'explore.resultsCount': '{count} stays',
  'explore.resultsOne': '1 stay',
  'explore.perNight': 'night',

  /* Saving from the tile */
  'explore.savedToast': 'Saved — it is on your Saved tab',
  'explore.unsavedToast': 'Removed from Saved',

  /* Per-filter empty states. Which filter emptied the list is computed, not guessed */
  'explore.emptyFilterTitle': 'Nothing matches {filter}',
  'explore.emptyFilterBody':
    'Every other part of your search has stays behind it. This one is what emptied the list.',
  'explore.emptyFilterAction': 'Clear {filter}',
  'explore.emptyAllTitle': 'No stay matches all of that',
  'explore.emptyAllBody':
    'Nothing in the catalogue satisfies every one of your filters at once. Clearing one or two brings results back.',
  'explore.emptyAllAction': 'Clear every filter',

  /* The map view, which is a placed-pin diagram until the search endpoint lands */
  'explore.mapNoteTitle': 'Map view arrives with the API',
  'explore.mapNoteBody':
    'The pins are placed from each stay’s own coordinates and move with your filters, but the ground under them is drawn, not a real map. A pannable map lands with the search endpoint; which provider draws it is still an open question on F-B04.',
  'explore.mapLabel': 'Map of Rwanda showing {count} stays',
  'explore.mapPin': '{title} in {location}',
  'explore.mapLake': 'Lake Kivu',
  'explore.mapSelectedHint': 'Open the card below for the full listing.',
  'explore.mapPick': 'Pick a pin',
  'explore.mapPickBody': 'Tap any pin to see the stay behind it.',

  /* Saved */
  'saved.greeting': 'Stays you kept',
  'saved.title': 'Saved',
  'saved.emptyTitle': 'Nothing saved yet',
  'saved.emptyBody': 'Tap the heart on a stay and it waits for you here, on this phone and the next one.',
  'saved.emptyAction': 'Find a stay',
  'saved.listLabel': 'your saved stays',

  /* Trips — the tab, its two segments and their four states */
  'trips.greeting': 'Bookings and stays',
  'trips.title': 'Trips',
  'trips.tabUpcoming': 'Upcoming',
  'trips.tabPast': 'Past',
  'trips.emptyUpcomingTitle': 'No trips booked',
  'trips.emptyUpcomingBody': 'A stay appears here as soon as you book it.',
  'trips.emptyUpcomingAction': 'Find a stay',
  'trips.emptyPastTitle': 'No past trips',
  'trips.emptyPastBody': 'Stays move here once you have checked out.',
  'trips.night': '1 night',
  'trips.nights': '{count} nights',
  'trips.listLabel': 'your trips',
  'trips.open': 'Open {property}',

  /* The hero card: the next stay, and the countdown to its arrival. Singular
     and plural are separate keys because RW does not inflect as EN does. */
  'trips.heroLabel': 'Your next stay',
  'trips.heroInHouseLabel': 'You are staying here',
  'trips.countdownNow': 'Arriving today',
  'trips.countdownMinute': 'Arriving in 1 minute',
  'trips.countdownMinutes': 'Arriving in {count} minutes',
  'trips.countdownHour': 'Arriving in 1 hour',
  'trips.countdownHours': 'Arriving in {count} hours',
  'trips.countdownDay': 'Arriving tomorrow',
  'trips.countdownDays': 'Arriving in {count} days',
  'trips.heroCheckedIn': 'Checked in · your arrival guide is open',
  'trips.heroFrom': 'Check-in from {time}',
  'trips.a11yHero': 'Your next stay, {property}. {when}',

  /* The two segments under it */
  'trips.sectionUpcoming': 'Also coming up',
  'trips.sectionPast': 'Past stays',
  'trips.onePlanned': '1 more stay planned',
  'trips.morePlanned': '{count} more stays planned',

  /* The review row on a completed stay (F-B14) */
  'trips.leaveReview': 'Leave a review',
  'trips.reviewPrompt': 'How was {property}?',
  'trips.reviewDay': '1 day left to write it',
  'trips.reviewDays': '{count} days left to write it',
  'trips.reviewed': 'You rated this stay {score}',
  'trips.reviewPending': 'Waiting on the host. Neither review shows until both are in.',
  'trips.reviewPublished': 'Both reviews are published.',
  'trips.reviewClosed': 'The review window has closed.',

  /* Trip detail */
  'trip.notFound': 'Trip not found.',
  'trip.notFoundBody': 'This booking is not on your account, or it has been removed.',
  'trip.backToTrips': 'Back to Trips',
  'trip.stay': 'Your stay',
  'trip.checkIn': 'Check-in',
  'trip.checkOut': 'Check-out',
  'trip.dayFromTime': '{day}, from {time}',
  'trip.dayByTime': '{day}, by {time}',
  'trip.guests': 'Guests',
  'trip.oneGuest': '1 guest',
  'trip.guestsCount': '{count} guests',
  'trip.confirmation': 'Confirmation',
  'trip.price': 'Price',
  'trip.nightlyRate': 'Nightly rate',
  'trip.serviceAndTaxes': 'Service and taxes',
  'trip.totalPaid': 'Total paid',
  'trip.mockAdapter': 'Mock adapter',
  'trip.mockAdapterNote':
    'No real money moves. Payments and the e-invoice run on the mock adapter.',

  /* The host, and the thread the booking was written with (ADR-032) */
  'trip.host': 'Your host',
  'trip.messageHost': 'Message {host}',
  'trip.messageHostHint': 'Opens the conversation for this booking',
  'trip.threadActive': 'Usually answers within an hour',
  'trip.threadArchived': 'Read-only — this booking has ended',

  /* Getting there */
  'trip.gettingThere': 'Getting there',
  'trip.address': 'Address',
  'trip.getDirections': 'Get directions',
  'trip.directionsHint': 'Opens {property} in your maps app',
  'trip.directionsFailed': 'No maps app answered. The address above can be copied.',

  /* The arrival-guide gate. One sentence per answer of `checkInGate` (F-B18) */
  'trip.arrival': 'Arrival guide',
  'trip.arrivalLocked': 'Wifi, the door code and directions unlock once you have checked in.',
  'trip.arrivalUnlocked': 'Wifi, the door code and the directions are ready for you.',
  'trip.arrivalEarly':
    'Self check-in opens 24 hours before you arrive, and the guide unlocks with it.',
  'trip.arrivalStaffed':
    'The front desk checks you in at this property. The guide unlocks once they have.',
  'trip.arrivalAwaiting':
    'The host has not answered this request yet. Check-in opens once they do.',
  'trip.arrivalClosed': 'This stay is over, so the arrival details are closed.',
  'trip.startCheckIn': 'Start self check-in',
  'trip.openArrivalGuide': 'Open the arrival guide',
  'trip.wifi': 'Wifi',
  'trip.access': 'Access',
  'trip.directions': 'Directions',
  'trip.cancelledNote': 'This booking was cancelled. Nothing further is owed on it.',
  'trip.leaveReview': 'Leave a review',

  /* Leaving a review — two-sided and double-blind (F-B14, FL15) */
  'review.title': 'Rate your stay',
  'review.subtitle': '{property} · {dates}',
  'review.cleanliness': 'Cleanliness',
  'review.accuracy': 'Accuracy',
  'review.checkIn': 'Check-in',
  'review.communication': 'Communication',
  'review.location': 'Location',
  'review.value': 'Value',
  'review.commentLabel': 'Anything the next guest should know?',
  'review.commentPlaceholder': 'What stood out, good or bad.',
  'review.doubleBlindTitle': 'Neither review shows yet',
  'review.doubleBlindBody':
    'Your host writes one about you at the same time. Neither is published until both are in, or the 14-day window closes.',
  'review.nameShown': 'Yours appears as {name}.',
  'review.submit': 'Submit review',
  'review.submitting': 'Sending',
  'review.blockedOne': '1 category still needs a rating.',
  'review.blockedMany': '{count} categories still need a rating.',
  'review.outOfFive': '{score} of 5',
  'review.a11yRated': '{category}, {count} of 5 stars',
  'review.a11yUnrated': '{category}, not rated yet',
  'review.a11ySetStars': 'Rate {category} {count} of 5',
  'review.doneToast': 'Review sent — it publishes when your host writes theirs',
  'review.alreadyTitle': 'You have already reviewed this stay',
  'review.alreadyBody': 'One review per stay, per side. Yours went in on {date}.',
  'review.notFoundTitle': 'There is nothing to review here',
  'review.notFoundBody': 'A review opens once a stay is completed, and closes 14 days later.',

  /* Listing detail */
  'listing.notFound': 'Listing not found.',
  'listing.verifiedHost': 'Verified host · responds in 1h',
  'listing.verifiedBroker': 'Verified broker · responds in 2h',
  'listing.reserve': 'Reserve',
  'listing.proposeLease': 'Propose lease',
  'listing.perUnit': '/ {unit}',
  'listing.ratingOf': 'Rated {rating} out of 5',

  /* Property detail page — F-B15, FL06, Guest canvas artboard 4.
     The glossary calls this surface the Property detail page, never the
     listing detail. The route keeps the `listing/[id]` path Session 0 gave it. */
  'listing.loading': 'Loading this property',
  'listing.notFoundTitle': 'This property is not here',
  'listing.notFoundBody':
    'It may have been taken down, or the link may be an old one. Everything else is still on Explore.',
  'listing.notFoundAction': 'Back to Explore',
  'listing.errorTitle': 'That did not load',
  'listing.errorBody': 'We could not read this property just now. It is worth another try.',
  'listing.inactiveTitle': 'Not taking bookings',
  'listing.inactiveBody':
    'The host has taken this property off Explore for now. You can still read it; you cannot book it.',
  'listing.reviews': '{count} reviews',
  'listing.noReviews': 'No reviews yet',
  'listing.hostedBy': 'Hosted by {name}',
  'listing.hostMeta': 'TIN on file · usually replies within an hour',
  'listing.about': 'About this place',

  /* Amenities */
  'listing.amenities': 'What this place offers',
  'listing.amenitiesShowAll': 'Show all {count}',
  'listing.amenitiesSheetSubtitle': 'Everything {property} lists for its rooms and shared spaces.',
  'listing.amenitiesDone': 'Done',
  'listing.amenity.wifi': 'Wifi throughout',
  'listing.amenity.fibre': 'Fibre internet',
  'listing.amenity.breakfast': 'Breakfast included',
  'listing.amenity.breakfastRoom': 'Breakfast room',
  'listing.amenity.earlyBreakfast': 'Early breakfast on trek days',
  'listing.amenity.halfBoard': 'Half board',
  'listing.amenity.fullBoard': 'Full board',
  'listing.amenity.restaurant': 'Restaurant',
  'listing.amenity.kitchen': 'Full kitchen',
  'listing.amenity.cookOnRequest': 'Cook on request',
  'listing.amenity.garden': 'Garden',
  'listing.amenity.courtyard': 'Walled courtyard',
  'listing.amenity.terrace': 'Shared terrace',
  'listing.amenity.rooftopTerrace': 'Rooftop terrace',
  'listing.amenity.lakeView': 'Lake view',
  'listing.amenity.riverView': 'River view',
  'listing.amenity.cityView': 'City view',
  'listing.amenity.volcanoView': 'Volcano view',
  'listing.amenity.privateJetty': 'Private jetty',
  'listing.amenity.boatTransfer': 'Boat transfer on request',
  'listing.amenity.beachNearby': 'Two minutes to the beach',
  'listing.amenity.gameDrives': 'Game drives included',
  'listing.amenity.guidedTreks': 'Guided treks',
  'listing.amenity.estateWalk': 'Estate walk before breakfast',
  'listing.amenity.workspace': 'Dedicated workspace',
  'listing.amenity.standbyPower': 'Standby power',
  'listing.amenity.reception24h': '24-hour reception',
  'listing.amenity.hotWater': 'Hot water in the mornings',
  'listing.amenity.laundry': 'Laundry',
  'listing.amenity.airportPickup': 'Airport pickup',
  'listing.amenity.parking': 'Free parking',
  'listing.amenity.lift': 'Lift',
  'listing.amenity.fireplace': 'Working fireplace',
  'listing.amenity.lateCheckout': 'Late checkout on request',
  'listing.amenity.selfCheckIn': 'Self check-in',

  /* Room types */
  'listing.rooms': 'Room types',
  'listing.roomsSubtitle': 'Pick one. The bar at the foot of the page follows your choice.',
  'listing.sleeps': 'Sleeps {count}',
  'listing.perNight': '/ night',
  'listing.remainingLast': 'Last one at this rate',
  'listing.remainingFew': 'Only {count} left',
  'listing.remainingMany': '{count} rooms left',
  'listing.remainingNone': 'Not available for these dates',
  'listing.roomSelected': 'Selected',
  'listing.roomChoose': 'Choose {room}',
  'listing.beds.oneDouble': '1 double bed',
  'listing.beds.oneQueen': '1 queen bed',
  'listing.beds.oneKing': '1 king bed',
  'listing.beds.twoTwin': '2 twin beds',
  'listing.beds.twoQueen': '2 queen beds',
  'listing.beds.threeDouble': '3 double beds',
  'listing.beds.oneKingOneSofa': '1 king bed and a sofa bed',
  'listing.beds.oneKingTwoTwin': '1 king bed and 2 twin beds',
  'listing.beds.twoQueenOneSofa': '2 queen beds and a sofa bed',

  /* Booking mode and cancellation tiers — F-B03, F-B11 */
  'listing.mode.instant_book': 'Book now',
  'listing.mode.request_to_book': 'Request to book',
  'listing.tier.flexible': 'Flexible',
  'listing.tier.moderate': 'Moderate',
  'listing.tier.limited': 'Limited',
  'listing.tier.firm': 'Firm',
  'listing.tier.strict_extended_stay': 'Strict, extended stay',
  'listing.tier.none': 'Set by the room',
  'listing.tierBody.flexible': 'Free cancellation up to 24 hours before check-in.',
  'listing.tierBody.moderate':
    'Free cancellation up to 5 days before check-in, then 50% refundable.',
  'listing.tierBody.limited':
    'Free cancellation up to 14 days before check-in, then 50% refundable up to 7 days.',
  'listing.tierBody.firm':
    'Free cancellation up to 30 days before check-in. Inside 30 days, the first night is held.',
  'listing.tierBody.strict_extended_stay':
    'Free cancellation up to 30 days before check-in. Inside 30 days, 30 nights are held.',
  'listing.tierBody.none':
    'The tier belongs to the room type, not to the property. Choose a room and it is shown here.',

  /* Cancellation policy sheet — Guest canvas artboard 6a */
  'listing.policy': 'Cancellation policy',
  'listing.policyOpen': 'Read the cancellation policy',
  'listing.policyForRoom': 'For {room}',
  'listing.policyNonRefundableTitle': 'If you take the non-refundable rate',
  'listing.policyNonRefundableBody':
    'Non-refundable — full forfeit on cancellation, whatever the tier says.',
  'listing.policyToggle': 'Take the non-refundable rate',
  'listing.policyToggleHint': '{percent}% off the room rate, and nothing back if you cancel.',
  'listing.policyIneligible': '{room} does not sell a non-refundable rate.',
  'listing.policyNoRoom':
    'Choose a room type first. The tier belongs to the room, not to the property.',
  'listing.policyLocked':
    'The tier is locked at booking time. A later change to the room type policy does not move your booking.',
  'listing.policyHostCancels': 'If the host cancels or declines, you are refunded in full. Always.',
  'listing.policyWhatYouPay': 'What you would pay',
  'listing.policyOneNight': 'One night, until you add your dates.',
  'listing.policyNights': '{count} nights',
  'listing.policyAccommodation': 'Accommodation',
  'listing.policyDiscount': 'Non-refundable discount',
  'listing.policyFee': 'Guest service fee',
  'listing.policyTotal': 'Total',
  'listing.policyDone': 'Done',

  /* House rules, check-in, and why this is safe to book */
  'listing.houseRules': 'House rules',
  'listing.checkIn': 'Check-in',
  'listing.checkInFrom': 'Check-in from',
  'listing.checkOutBy': 'Check-out by',
  'listing.checkInNoteSelf':
    'Self check-in from your phone. Wifi, the door code and directions unlock once you are checked in.',
  'listing.checkInNoteStaffed':
    'Front desk check-in. Wifi, the door code and directions unlock once you are checked in.',
  'listing.trust': 'Why this is safe to book',
  'listing.trustEscrow': 'Escrow-backed booking',
  'listing.trustEscrowBody':
    'Your money is held in escrow and released to the host after you arrive, not before.',
  'listing.trustRra': 'RRA-compliant host',
  'listing.trustRraBody':
    'This host files with the Rwanda Revenue Authority, and your booking emits an EBM e-invoice.',
  'listing.trustSelfCheckIn': 'Self check-in',
  'listing.trustSelfCheckInBody': 'Check in from your phone before you arrive. No queue at a desk.',
  'listing.trustStaffedCheckIn': 'Staffed check-in',
  'listing.trustStaffedCheckInBody':
    'Someone meets you and checks you in. Bring the ID you booked with.',

  /* Location */
  'listing.where': 'Where you will be',
  'listing.mapApprox': 'Approximate location',
  'listing.mapLabel': 'Map showing {district}',
  'listing.mapPrivacy':
    'The pin sits on the district. The exact address is shared once your booking is confirmed.',

  /* The sticky bar */
  'listing.chooseRoom': 'Choose a room type',
  'listing.from': 'From',
  'listing.addDates': 'Add dates',
  'listing.changeDates': 'Change your dates',
  'listing.blockedDates': 'Add your dates to book.',
  'listing.blockedRoom': 'Choose a room type to book.',
  'listing.blockedBoth': 'Add your dates and choose a room type to book.',
  'listing.blockedSoldOut': 'Every room is taken for these dates. Try different ones.',
  'listing.blockedInactive': 'This property is not taking bookings.',
  'listing.nonRefundableOn': 'Non-refundable rate',

  /* The dates sheet */
  'listing.datesTitle': 'When are you staying?',
  'listing.datesSubtitle': 'Availability and the total follow your dates.',
  'listing.datesUse': 'Use these dates',
  'listing.datesClear': 'Clear',
  'listing.datesPrompt': 'Pick your arrival, then your departure.',

  /* The full-screen photo viewer */
  'listing.viewerOpen': 'Open the photos full screen',
  'listing.viewerClose': 'Close the photos',
  'listing.viewerCounter': '{index} of {total}',

  /* Saving */
  'listing.savedToast': 'Saved — it is on your Saved tab',
  'listing.unsavedToast': 'Removed from Saved',

  /* Spoken labels this page builds itself */
  'listing.a11yRoom': '{name}. {sleeps}, {beds}. {rate} per night. {availability}',
  'listing.a11yDates': '{dates}, {nights}. Tap to change them.',
  'listing.a11yNoDates': 'No dates chosen. Tap to add them.',
  'listing.a11yScoreRow': 'Guest score {score} out of 10, {word}, from {reviews}',
  /* Leases (tenant) */

  /* ------------------------- the amenities sheet (gaps.md B7) ------------- */
  // The only route in the v1.0 cut scoring zero on all five production
  // properties: no load, no error, no empty, no accessibility labels. It is
  // deep-linkable, so every one of them is reachable.
  'listing.amenitiesErrorTitle': 'We could not load the amenities',
  'listing.amenitiesErrorBody': 'Nothing is wrong with the stay. Try again, or go back to the property.',
  'listing.amenitiesEmptyTitle': 'No amenities listed yet',
  'listing.amenitiesEmptyBody': 'This host has not listed what the stay includes. Message them and ask.',
  'listing.amenitiesA11y': '{count} amenities at {property}',
  'listing.amenitiesLoading': 'Loading amenities',
} as const;

/**
 * Parity is a type error here, not a review note: `rw` is keyed off this
 * file's own `en`, so a key added to one and not the other fails `tsc` in
 * this file rather than in the merge.
 */
export const rw: Record<keyof typeof en, string> = {
  'explore.greeting': 'Muraho, {name}',
  'explore.title': 'Ujya he?',
  'explore.searchPlaceholder': 'Ahantu · Igihe · Abantu',
  'explore.searchHint': 'Shakisha aho kuraramo ukurikije ahantu, itariki n’umubare w’abantu',
  'explore.filters': 'Muyunguruzi',
  'explore.sectionStays': 'Aho kuraramo mu Rwanda',
  'explore.filterAnywhere': 'Ahantu hose',
  'explore.filterKigali': 'Kigali',
  'explore.filterLakeside': 'Ku nkombe z’ikiyaga',
  'explore.filterParks': 'Pariki',
  'explore.filterUnder100k': 'Munsi ya 100K',
  'explore.emptyTitle': 'Nta hantu bihuye',
  'explore.emptyBody': 'Nta kintu kiri muri iyi muyunguruzi. Yagure, cyangwa urebe ahantu hose.',
  'explore.emptyAction': 'Erekana ahantu hose',
  'explore.listLabel': 'aho kuraramo',

  /* The rail, the count line and the two views (Session 2) */
  'explore.openStay': 'Fungura {title}',
  'explore.filtersChip': 'Muyunguruzi',
  'explore.filtersActive': 'Muyunguruzi, {count} zikora',
  'explore.quickFilters': 'Muyunguruzi zihuse',
  'explore.instantBook': 'Kwandika ako kanya',
  'explore.activeFilters': 'Muyunguruzi washyizeho',
  'explore.removeFilter': 'Kuraho {filter}',
  'explore.view': 'Uko ibisubizo byerekanwa',
  'explore.viewList': 'Urutonde',
  'explore.viewMap': 'Ikarita',
  'explore.resultsCount': 'aho kuraramo {count}',
  'explore.resultsOne': 'hantu 1',
  'explore.perNight': 'ijoro',

  /* Saving from the tile */
  'explore.savedToast': 'Byabitswe — biri ku ikadiri y’Ibyabitswe',
  'explore.unsavedToast': 'Byakuwe mu byabitswe',

  /* Per-filter empty states. Which filter emptied the list is computed, not guessed */
  'explore.emptyFilterTitle': 'Nta kintu gihuye na {filter}',
  'explore.emptyFilterBody':
    'Ibindi byose wasabye bifite aho kuraramo inyuma yabyo. Iki ni cyo cyasibye urutonde.',
  'explore.emptyFilterAction': 'Siba {filter}',
  'explore.emptyAllTitle': 'Nta hantu huzuza ibyo byose',
  'explore.emptyAllBody':
    'Nta hantu ho kuraramo huzuza muyunguruzi zawe zose icyarimwe. Gusiba imwe cyangwa ebyiri bigarura ibisubizo.',
  'explore.emptyAllAction': 'Siba muyunguruzi zose',

  /* The map view, which is a placed-pin diagram until the search endpoint lands */
  'explore.mapNoteTitle': 'Ikarita izaza n’API',
  'explore.mapNoteBody':
    'Utudomo dushyirwa ahantu hakurikije aho buri hantu heri, kandi tugendana na muyunguruzi zawe, ariko ikarita iri munsi yatwo yarashushanyijwe, si iy’ukuri. Ikarita nyayo izaza n’aho gushakira; uzayishushanya ntiragenwa kuri F-B04.',
  'explore.mapLabel': 'Ikarita y’u Rwanda yerekana aho kuraramo {count}',
  'explore.mapPin': '{title} i {location}',
  'explore.mapLake': 'Ikiyaga cya Kivu',
  'explore.mapSelectedHint': 'Fungura ikarita iri hasi urebe byose.',
  'explore.mapPick': 'Hitamo akadomo',
  'explore.mapPickBody': 'Kanda ku kadomo kose urebe ahantu kari inyuma.',

  /* Saved */
  'saved.greeting': 'Aho wabitse',
  'saved.title': 'Ibyabitswe',
  'saved.emptyTitle': 'Nta kintu kirabikwa',
  'saved.emptyBody': 'Kanda ku mutima ku hantu ho kuraramo, hazagutegereza hano, kuri iyi telefone n’iyindi.',
  'saved.emptyAction': 'Shaka aho kuraramo',
  'saved.listLabel': 'aho wabitse',

  /* Trips */
  'trips.greeting': 'Ibyanditswe n’aho waraye',
  'trips.title': 'Ingendo',
  'trips.tabUpcoming': 'Iziri imbere',
  'trips.tabPast': 'Izashize',
  'trips.emptyUpcomingTitle': 'Nta rugendo rwanditswe',
  'trips.emptyUpcomingBody': 'Aho uzararamo hazagaragara hano ako kanya umaze kwandika.',
  'trips.emptyUpcomingAction': 'Shaka aho kuraramo',
  'trips.emptyPastTitle': 'Nta ngendo zashize',
  'trips.emptyPastBody': 'Aho waraye hazimukira hano numara gusohoka.',
  'trips.night': 'ijoro rimwe',
  'trips.nights': 'amajoro {count}',
  'trips.listLabel': 'ingendo zawe',
  'trips.open': 'Fungura {property}',

  /* Ikarita y’urugendo rukurikira */
  'trips.heroLabel': 'Urugendo rwawe rukurikira',
  'trips.heroInHouseLabel': 'Uri kuraramo hano',
  'trips.countdownNow': 'Ugera uyu munsi',
  'trips.countdownMinute': 'Ugera mu munota 1',
  'trips.countdownMinutes': 'Ugera mu minota {count}',
  'trips.countdownHour': 'Ugera mu isaha 1',
  'trips.countdownHours': 'Ugera mu masaha {count}',
  'trips.countdownDay': 'Ugera ejo',
  'trips.countdownDays': 'Ugera mu minsi {count}',
  'trips.heroCheckedIn': 'Wamaze kwinjira · ubuyobozi bwo kugera burafunguye',
  'trips.heroFrom': 'Kwinjira guhera saa {time}',
  'trips.a11yHero': 'Urugendo rwawe rukurikira, {property}. {when}',

  /* Ibice bibiri biri munsi yayo */
  'trips.sectionUpcoming': 'Ibindi biri imbere',
  'trips.sectionPast': 'Aho waraye mbere',
  'trips.onePlanned': 'Hari urundi rugendo rumwe ruteganyijwe',
  'trips.morePlanned': 'Hari izindi ngendo {count} ziteganyijwe',

  /* Umurongo wo gutanga isuzuma ku rugendo rwarangiye (F-B14) */
  'trips.leaveReview': 'Tanga isuzuma',
  'trips.reviewPrompt': 'Byagenze bite muri {property}?',
  'trips.reviewDay': 'Hasigaye umunsi 1 wo kuryandika',
  'trips.reviewDays': 'Hasigaye iminsi {count} yo kuryandika',
  'trips.reviewed': 'Wahaye aha hantu amanota {score}',
  'trips.reviewPending':
    'Turategereje nyir’ubwite. Nta suzuma rigaragara kugeza ayombi yatanzwe.',
  'trips.reviewPublished': 'Amasuzuma yombi yatangajwe.',
  'trips.reviewClosed': 'Igihe cyo gutanga isuzuma cyarangiye.',

  /* Amakuru y’urugendo */
  'trip.notFound': 'Urugendo ntirwabonetse.',
  'trip.notFoundBody': 'Uku kwandika ntikuri kuri konti yawe, cyangwa kwarakuweho.',
  'trip.backToTrips': 'Subira ku Ngendo',
  'trip.stay': 'Aho uraramo',
  'trip.checkIn': 'Kwinjira',
  'trip.checkOut': 'Gusohoka',
  'trip.dayFromTime': '{day}, guhera saa {time}',
  'trip.dayByTime': '{day}, mbere ya saa {time}',
  'trip.guests': 'Abashyitsi',
  'trip.oneGuest': 'Umushyitsi 1',
  'trip.guestsCount': 'Abashyitsi {count}',
  'trip.confirmation': 'Inomero y’ubwemeza',
  'trip.price': 'Igiciro',
  'trip.nightlyRate': 'Igiciro cy’ijoro',
  'trip.serviceAndTaxes': 'Serivisi n’imisoro',
  'trip.totalPaid': 'Igiteranyo cyishyuwe',
  'trip.mockAdapter': 'Uburyo bw’igerageza',
  'trip.mockAdapterNote':
    'Nta mafaranga nyayo agenda. Ubwishyu na fagitire bikorwa mu buryo bw’igerageza.',

  /* Nyir’ubwite, n’ikiganiro cyanditswe hamwe n’ubwandikishe (ADR-032) */
  'trip.host': 'Nyir’aho uraramo',
  'trip.messageHost': 'Andikira {host}',
  'trip.messageHostHint': 'Bifungura ikiganiro cy’uku kwandika',
  'trip.threadActive': 'Akenshi asubiza mu isaha imwe',
  'trip.threadArchived': 'Gusoma gusa — uku kwandika kwararangiye',

  /* Uko ugera aho ugiye */
  'trip.gettingThere': 'Uko ugerayo',
  'trip.address': 'Aderesi',
  'trip.getDirections': 'Erekana inzira',
  'trip.directionsHint': 'Bifungura {property} muri porogaramu y’amakarita',
  'trip.directionsFailed': 'Nta porogaramu y’amakarita yitabye. Aderesi iri hejuru irashobora gukoporwa.',

  /* Irembo ry’ubuyobozi bwo kugera (F-B18) */
  'trip.arrival': 'Ubuyobozi bwo kugera',
  'trip.arrivalLocked': 'Wifi, kode y’urugi n’inzira bifungurwa umaze kwinjira.',
  'trip.arrivalUnlocked': 'Wifi, kode y’urugi n’inzira byose birateguye.',
  'trip.arrivalEarly':
    'Kwinjira wenyine bifungurwa amasaha 24 mbere yo kugera, kandi ubuyobozi bufungurwa icyarimwe.',
  'trip.arrivalStaffed':
    'Abakozi bo ku biro ni bo bakwinjiza aha hantu. Ubuyobozi bufungurwa nyuma yabyo.',
  'trip.arrivalAwaiting':
    'Nyir’aho ntarasubiza iki cyifuzo. Kwinjira bifungurwa amaze kugisubiza.',
  'trip.arrivalClosed': 'Uru rugendo rwarangiye, bityo amakuru yo kugera yarafunzwe.',
  'trip.startCheckIn': 'Tangira kwinjira wenyine',
  'trip.openArrivalGuide': 'Fungura ubuyobozi bwo kugera',
  'trip.wifi': 'Wifi',
  'trip.access': 'Uburyo bwo kwinjira',
  'trip.directions': 'Inzira',
  'trip.cancelledNote': 'Uku kwandika kwarahagaritswe. Nta kindi ukibereyemo.',
  'trip.leaveReview': 'Tanga isuzuma',

  /* Gutanga isuzuma — impande zombi, nta n’umwe ubona iry’undi (F-B14, FL15) */
  'review.title': 'Ha amanota aho waraye',
  'review.subtitle': '{property} · {dates}',
  'review.cleanliness': 'Isuku',
  'review.accuracy': 'Ukuri kw’ibyatangajwe',
  'review.checkIn': 'Kwinjira',
  'review.communication': 'Itumanaho',
  'review.location': 'Aho hantu heri',
  'review.value': 'Agaciro k’amafaranga',
  'review.commentLabel': 'Hari icyo undi mushyitsi yakwiye kumenya?',
  'review.commentPlaceholder': 'Icyagaragaye, cyaba cyiza cyangwa kibi.',
  'review.doubleBlindTitle': 'Nta suzuma riragaragara',
  'review.doubleBlindBody':
    'Nyir’aho na we akwandikira irye icyarimwe. Nta na rimwe ritangazwa kugeza ayombi yatanzwe, cyangwa iminsi 14 irangiye.',
  'review.nameShown': 'Iryawe rigaragara nka {name}.',
  'review.submit': 'Ohereza isuzuma',
  'review.submitting': 'Kohereza',
  'review.blockedOne': 'Hari icyiciro 1 gikeneye amanota.',
  'review.blockedMany': 'Hari ibyiciro {count} bikeneye amanota.',
  'review.outOfFive': '{score} kuri 5',
  'review.a11yRated': '{category}, inyenyeri {count} kuri 5',
  'review.a11yUnrated': '{category}, ntiraherwa amanota',
  'review.a11ySetStars': 'Ha {category} amanota {count} kuri 5',
  'review.doneToast': 'Isuzuma ryoherejwe — ritangazwa igihe nyir’aho na we azaryandika',
  'review.alreadyTitle': 'Wamaze gutanga isuzuma kuri uru rugendo',
  'review.alreadyBody': 'Isuzuma rimwe ku rugendo, ku ruhande rumwe. Iryawe ryatanzwe ku {date}.',
  'review.notFoundTitle': 'Nta cyo gusuzuma hano',
  'review.notFoundBody':
    'Isuzuma rifungurwa iyo urugendo rurangiye, rigafungwa nyuma y’iminsi 14.',

  /* Listing detail */
  'listing.notFound': 'Icyatangajwe ntikiboneka.',
  'listing.verifiedHost': 'Nyir’inzu wemejwe · asubiza mu isaha 1',
  'listing.verifiedBroker': 'Umuhuza wemejwe · asubiza mu masaha 2',
  'listing.reserve': 'Fata umwanya',
  'listing.proposeLease': 'Saba amasezerano',
  'listing.perUnit': '/ {unit}',
  'listing.ratingOf': 'Amanota {rating} kuri 5',

  /* Property detail page — F-B15, FL06 */
  'listing.loading': 'Turimo gufungura aha hantu',
  'listing.notFoundTitle': 'Aha hantu ntihaboneka',
  'listing.notFoundBody':
    'Hashobora kuba haravanyweho, cyangwa uyu murongo ushaje. Ibindi byose biracyari kuri Explore.',
  'listing.notFoundAction': 'Subira kuri Explore',
  'listing.errorTitle': 'Ntibyashoboye gufungurwa',
  'listing.errorBody': 'Ntitwashoboye gusoma aha hantu ubu. Birakwiye kongera kugerageza.',
  'listing.inactiveTitle': 'Ntihakira ubwandikishe',
  'listing.inactiveBody':
    'Nyir’inzu yahakuye kuri Explore by’igihe gito. Urashobora guhasoma, ariko ntushobora kwandikisha.',
  'listing.reviews': 'ibitekerezo {count}',
  'listing.noReviews': 'Nta bitekerezo birabaho',
  'listing.hostedBy': 'Hakirwa na {name}',
  'listing.hostMeta': 'TIN yanditse · akunda gusubiza mu isaha imwe',
  'listing.about': 'Ibyerekeye aha hantu',

  /* Amenities */
  'listing.amenities': 'Ibiboneka aha hantu',
  'listing.amenitiesShowAll': 'Erekana byose {count}',
  'listing.amenitiesSheetSubtitle': 'Ibyo {property} itanga mu byumba no mu bibanza rusange.',
  'listing.amenitiesDone': 'Byarangiye',
  'listing.amenity.wifi': 'Wifi hose',
  'listing.amenity.fibre': 'Interineti ya fibre',
  'listing.amenity.breakfast': 'Ifunguro rya mu gitondo ririmo',
  'listing.amenity.breakfastRoom': 'Icyumba cy’ifunguro rya mu gitondo',
  'listing.amenity.earlyBreakfast': 'Ifunguro rya kare ku minsi y’urugendo',
  'listing.amenity.halfBoard': 'Ibyokurya bibiri ku munsi',
  'listing.amenity.fullBoard': 'Ibyokurya byose ku munsi',
  'listing.amenity.restaurant': 'Resitora',
  'listing.amenity.kitchen': 'Igikoni cyuzuye',
  'listing.amenity.cookOnRequest': 'Umutetsi iyo ubisabye',
  'listing.amenity.garden': 'Ubusitani',
  'listing.amenity.courtyard': 'Ikibuga gikikijwe',
  'listing.amenity.terrace': 'Ibaraza rusange',
  'listing.amenity.rooftopTerrace': 'Ibaraza ryo hejuru',
  'listing.amenity.lakeView': 'Kureba ikiyaga',
  'listing.amenity.riverView': 'Kureba uruzi',
  'listing.amenity.cityView': 'Kureba umujyi',
  'listing.amenity.volcanoView': 'Kureba ibirunga',
  'listing.amenity.privateJetty': 'Icyambu cyihariye',
  'listing.amenity.boatTransfer': 'Ubwato iyo ubisabye',
  'listing.amenity.beachNearby': 'Iminota ibiri ku nyanja',
  'listing.amenity.gameDrives': 'Urugendo rwo kureba inyamaswa rurimo',
  'listing.amenity.guidedTreks': 'Urugendo ruyobowe',
  'listing.amenity.estateWalk': 'Kugendera mu birayi by’icyayi mbere y’ifunguro',
  'listing.amenity.workspace': 'Ahantu ho gukorera',
  'listing.amenity.standbyPower': 'Umuriro w’inyongera',
  'listing.amenity.reception24h': 'Bakwakira amasaha 24',
  'listing.amenity.hotWater': 'Amazi ashyushye mu gitondo',
  'listing.amenity.laundry': 'Kumesa',
  'listing.amenity.airportPickup': 'Kukwakira ku kibuga cy’indege',
  'listing.amenity.parking': 'Aho gupaka ku buntu',
  'listing.amenity.lift': 'Ascenseur',
  'listing.amenity.fireplace': 'Iziko rikora',
  'listing.amenity.lateCheckout': 'Gusohoka bwa nyuma iyo ubisabye',
  'listing.amenity.selfCheckIn': 'Kwinjira wenyine',

  /* Room types */
  'listing.rooms': 'Ubwoko bw’ibyumba',
  'listing.roomsSubtitle': 'Hitamo bumwe. Umurongo wo hasi ukurikira icyo watoranyije.',
  'listing.sleeps': 'Bararamo {count}',
  'listing.perNight': '/ ijoro',
  'listing.remainingLast': 'Ni cyo cya nyuma kuri iki giciro',
  'listing.remainingFew': 'Hasigaye {count} gusa',
  'listing.remainingMany': 'Hasigaye ibyumba {count}',
  'listing.remainingNone': 'Ntikiboneka kuri izi tariki',
  'listing.roomSelected': 'Cyatoranyijwe',
  'listing.roomChoose': 'Hitamo {room}',
  'listing.beds.oneDouble': 'Uburiri bunini 1',
  'listing.beds.oneQueen': 'Uburiri bwa queen 1',
  'listing.beds.oneKing': 'Uburiri bwa king 1',
  'listing.beds.twoTwin': 'Uburiri buto 2',
  'listing.beds.twoQueen': 'Uburiri bwa queen 2',
  'listing.beds.threeDouble': 'Uburiri bunini 3',
  'listing.beds.oneKingOneSofa': 'Uburiri bwa king 1 n’intebe iryamwaho',
  'listing.beds.oneKingTwoTwin': 'Uburiri bwa king 1 n’uburiri buto 2',
  'listing.beds.twoQueenOneSofa': 'Uburiri bwa queen 2 n’intebe iryamwaho',

  /* Booking mode and cancellation tiers — F-B03, F-B11 */
  'listing.mode.instant_book': 'Andikisha ubu',
  'listing.mode.request_to_book': 'Saba kwandikisha',
  'listing.tier.flexible': 'Byoroshye',
  'listing.tier.moderate': 'Biringaniye',
  'listing.tier.limited': 'Bigenwe',
  'listing.tier.firm': 'Bikomeye',
  'listing.tier.strict_extended_stay': 'Bikaze, kumara igihe kirekire',
  'listing.tier.none': 'Bigenwa n’icyumba',
  'listing.tierBody.flexible': 'Guhagarika ku buntu mbere y’amasaha 24 utarinjira.',
  'listing.tierBody.moderate':
    'Guhagarika ku buntu mbere y’iminsi 5 utarinjira, hanyuma 50% igasubizwa.',
  'listing.tierBody.limited':
    'Guhagarika ku buntu mbere y’iminsi 14 utarinjira, hanyuma 50% igasubizwa kugeza ku minsi 7.',
  'listing.tierBody.firm':
    'Guhagarika ku buntu mbere y’iminsi 30 utarinjira. Mu minsi 30 ya nyuma, ijoro rya mbere rirafatwa.',
  'listing.tierBody.strict_extended_stay':
    'Guhagarika ku buntu mbere y’iminsi 30 utarinjira. Mu minsi 30 ya nyuma, amajoro 30 arafatwa.',
  'listing.tierBody.none':
    'Aya mabwiriza ni ay’ubwoko bw’icyumba, si ay’aha hantu. Hitamo icyumba maze werekwe ayacyo.',

  /* Cancellation policy sheet — Guest canvas artboard 6a */
  'listing.policy': 'Amabwiriza yo guhagarika',
  'listing.policyOpen': 'Soma amabwiriza yo guhagarika',
  'listing.policyForRoom': 'Kuri {room}',
  'listing.policyNonRefundableTitle': 'Niba ufashe igiciro kidasubizwa',
  'listing.policyNonRefundableBody':
    'Ntigisubizwa — utakaza byose iyo uhagaritse, uko amabwiriza yaba ameze kose.',
  'listing.policyToggle': 'Fata igiciro kidasubizwa',
  'listing.policyToggleHint': '{percent}% ku giciro cy’icyumba, ariko nta kigusubizwa uhagaritse.',
  'listing.policyIneligible': '{room} ntigurisha igiciro kidasubizwa.',
  'listing.policyNoRoom':
    'Banza uhitemo ubwoko bw’icyumba. Aya mabwiriza ni ay’icyumba, si ay’aha hantu.',
  'listing.policyLocked':
    'Aya mabwiriza afatwa igihe wandikisha. Impinduka yaza nyuma ku cyumba ntihindura ubwandikishe bwawe.',
  'listing.policyHostCancels':
    'Niba nyir’inzu ahagaritse cyangwa yanze, usubizwa amafaranga yose. Buri gihe.',
  'listing.policyWhatYouPay': 'Icyo wakwishyura',
  'listing.policyOneNight': 'Ijoro rimwe, kugeza wongeyeho itariki zawe.',
  'listing.policyNights': 'amajoro {count}',
  'listing.policyAccommodation': 'Icumbi',
  'listing.policyDiscount': 'Igabanuka ku kidasubizwa',
  'listing.policyFee': 'Amafaranga ya serivisi y’umushyitsi',
  'listing.policyTotal': 'Igiteranyo',
  'listing.policyDone': 'Byarangiye',

  /* House rules, check-in, and why this is safe to book */
  'listing.houseRules': 'Amategeko y’inzu',
  'listing.checkIn': 'Kwinjira',
  'listing.checkInFrom': 'Kwinjira uhereye',
  'listing.checkOutBy': 'Gusohoka bitarenze',
  'listing.checkInNoteSelf':
    'Winjira wenyine ukoresheje telefone. Wifi, kode y’urugi n’inzira bifungurwa umaze kwinjira.',
  'listing.checkInNoteStaffed':
    'Winjizwa ku biro byakira. Wifi, kode y’urugi n’inzira bifungurwa umaze kwinjira.',
  'listing.trust': 'Impamvu kwandikisha aha ari umutekano',
  'listing.trustEscrow': 'Ubwandikishe burinzwe na escrow',
  'listing.trustEscrowBody':
    'Amafaranga yawe abikwa muri escrow, agahabwa nyir’inzu numara kugera, atari mbere.',
  'listing.trustRra': 'Nyir’inzu wubahiriza RRA',
  'listing.trustRraBody':
    'Uyu munyenzu atanga imisoro muri RRA, kandi ubwandikishe bwawe butanga fagitire ya EBM.',
  'listing.trustSelfCheckIn': 'Kwinjira wenyine',
  'listing.trustSelfCheckInBody':
    'Winjira ukoresheje telefone mbere yo kugera. Nta murongo ku biro byakira.',
  'listing.trustStaffedCheckIn': 'Winjizwa n’umukozi',
  'listing.trustStaffedCheckInBody':
    'Umuntu araguhura akakwinjiza. Zana indangamuntu wakoresheje wandikisha.',

  /* Location */
  'listing.where': 'Aho uzaba uri',
  'listing.mapApprox': 'Hafi aho',
  'listing.mapLabel': 'Ikarita yerekana {district}',
  'listing.mapPrivacy':
    'Akadomo kari ku karere. Aderesi nyayo ihabwa umaze kwemezwa ubwandikishe.',

  /* The sticky bar */
  'listing.chooseRoom': 'Hitamo ubwoko bw’icyumba',
  'listing.from': 'Uhereye kuri',
  'listing.addDates': 'Ongeraho itariki',
  'listing.changeDates': 'Hindura itariki zawe',
  'listing.blockedDates': 'Ongeraho itariki zawe kugira ngo wandikishe.',
  'listing.blockedRoom': 'Hitamo ubwoko bw’icyumba kugira ngo wandikishe.',
  'listing.blockedBoth': 'Ongeraho itariki zawe kandi uhitemo icyumba kugira ngo wandikishe.',
  'listing.blockedSoldOut': 'Ibyumba byose byafashwe kuri izi tariki. Gerageza izindi.',
  'listing.blockedInactive': 'Aha hantu ntihakira ubwandikishe.',
  'listing.nonRefundableOn': 'Igiciro kidasubizwa',

  /* The dates sheet */
  'listing.datesTitle': 'Uzaba uhari ryari?',
  'listing.datesSubtitle': 'Ibiboneka n’igiteranyo bikurikira itariki zawe.',
  'listing.datesUse': 'Koresha izi tariki',
  'listing.datesClear': 'Siba',
  'listing.datesPrompt': 'Hitamo umunsi uzagera, hanyuma uwo uzagenda.',

  /* The full-screen photo viewer */
  'listing.viewerOpen': 'Fungura amafoto ku rupapuro rwose',
  'listing.viewerClose': 'Funga amafoto',
  'listing.viewerCounter': '{index} kuri {total}',

  /* Saving */
  'listing.savedToast': 'Byabitswe — biri ku ikadiri y’Ibyabitswe',
  'listing.unsavedToast': 'Byakuwe mu byabitswe',

  /* Spoken labels this page builds itself */
  'listing.a11yRoom': '{name}. {sleeps}, {beds}. {rate} ku ijoro. {availability}',
  'listing.a11yDates': '{dates}, {nights}. Kanda uhindure.',
  'listing.a11yNoDates': 'Nta tariki zatoranyijwe. Kanda uzongereho.',
  'listing.a11yScoreRow': 'Amanota y’abashyitsi {score} kuri 10, {word}, ava kuri {reviews}',

  /* Leases (tenant) */
  'listing.amenitiesErrorTitle': `${en['listing.amenitiesErrorTitle']} (RW)`,
  'listing.amenitiesErrorBody': `${en['listing.amenitiesErrorBody']} (RW)`,
  'listing.amenitiesEmptyTitle': `${en['listing.amenitiesEmptyTitle']} (RW)`,
  'listing.amenitiesEmptyBody': `${en['listing.amenitiesEmptyBody']} (RW)`,
  'listing.amenitiesA11y': `${en['listing.amenitiesA11y']} (RW)`,
  'listing.amenitiesLoading': `${en['listing.amenitiesLoading']} (RW)`,
};
