/**
 * `book` — the booking stepper (Guest canvas artboards 5, 6 and 7) and the
 * confirmed screen (artboard 8). Session 4 owns this file.
 *
 * Copy is the canvas's own wherever the canvas wrote one, including the four
 * handset notes in `bookPay`'s logic block, which are the most carefully
 * written strings on that artboard: each says what is wrong AND what to do
 * about it, and the cross-network case names the method to pick rather than
 * telling the guest their number is invalid when it is simply on the other
 * network.
 *
 * Keys the stepper deliberately does NOT define, and reads from elsewhere:
 *   - `listing.tier.*`, `listing.tierBody.*`, `listing.policy*` — F-B11's
 *     vocabulary, owned by Session 3, whose policy sheet this screen reopens.
 *     Two spellings of one cancellation tier is the drift the corpus's
 *     one-fact-one-owner rule exists to stop.
 *   - `search.adults|children|infants` and their notes — Session 2's party
 *     steppers say the same three things about the same three fields.
 *   - `calendar.*` — the range control's own.
 *   - `status.booking.*` — `StatusBadge` reads them; the confirmed screen never
 *     writes a status word itself.
 */

export const en = {
  /* ------------------------------------------------------------- the shell */
  'book.step1': 'Dates and guests',
  'book.step2': 'Your booking',
  'book.step3': 'Confirm and pay',
  'book.stepShort1': 'Dates',
  'book.stepShort2': 'Booking',
  'book.stepShort3': 'Pay',
  'book.back': 'Back',
  'book.backToStep': 'Back to {step}',
  'book.notFoundTitle': 'That room is no longer bookable',
  'book.notFoundBody':
    'The room type behind this link has been withdrawn, or the link is older than the listing. Explore has what is open now.',
  'book.notFoundAction': 'Back to Explore',

  /* ----------------------------------------------- step 1, dates and guests */
  'book.roomAt': '{room} · {place}',
  'book.perNight': '/ night',
  'book.when': 'When',
  'book.who': 'Who is coming',
  'book.pickDates': 'Pick your check-in and check-out.',
  'book.timezoneNote': 'Dates are read in the property timezone, Africa/Kigali.',
  'book.partyAtRoomCap': '{room} sleeps {count}. Infants do not take a bed.',
  'book.partyOverCap':
    'That is {count} too many for {room}. Book a second room, or pick a larger one.',
  'book.increment': 'One more {label}',
  'book.decrement': 'One fewer {label}',
  'book.stepperValue': '{label}: {count}',
  'book.rateTimesNights': '{rate} × {nights}',
  'book.runningTotal': 'Accommodation so far',
  'book.totalLabel': 'Total',
  'book.beforeFees': 'Fees are added at the next step.',

  /* --------------------------------------------------- step 2, your booking */
  'book.factRoom': 'Room type',
  'book.factDates': 'Dates',
  'book.factGuests': 'Guests',
  'book.factParty': '{guests} · {nights}',
  'book.factHost': 'Hosted by',
  'book.price': 'Price',
  'book.accommodation': 'Accommodation',
  'book.discount': 'Non-refundable discount',
  'book.fee': 'Guest service fee',
  'book.nonRefundableTitle': 'Non-refundable rate',
  'book.nonRefundableBody': 'About {percent}% cheaper. Cancelling forfeits the whole amount.',
  'book.nonRefundableOn': 'Non-refundable rate taken',
  'book.readPolicy': 'Read the full policy',
  'book.houseRulesTitle': 'House rules',
  'book.houseRulesAck': 'I have read the house rules and the cancellation policy',
  'book.houseRulesNone': 'This host has published no house rules.',
  'book.checkInFrom': 'Check-in from {from}, check-out by {until}.',
  'book.mockAdapter': 'Mock adapter',
  'book.mockAdapterBody':
    'No real money moves. Payments and the e-invoice run on the mock adapter.',

  /* ------------------------------------------------- step 3, confirm and pay */
  'book.howYouPay': 'How you pay',
  'book.method.momo': 'MTN MoMo',
  'book.method.airtel': 'Airtel Money',
  'book.methodHint.momo': 'Approve the prompt on your handset',
  'book.methodHint.airtel': 'Approve the prompt on your handset',
  'book.mobileNumber': 'Mobile number',
  'book.mobilePlaceholder': '78X XXX XXX',
  'book.phoneNineDigits': 'A Rwandan mobile number is nine digits, like 0788 123 456.',
  'book.phoneWrongNetwork': '{network} numbers start {prefixes}.',
  // No article: "a Airtel Money" is wrong and "a/an" cannot be chosen from an
  // interpolated name. The canvas branches on the index to pick one, which
  // breaks the moment a fourth method is added and has no meaning in
  // Kinyarwanda, which has no articles at all.
  'book.phoneOtherNetwork': 'That number is on {network}. Pick {network} above.',
  'book.phonePrompt': 'We will send the prompt to {number}.',
  'book.or': 'or',
  'book.escrowTitle': 'Accommodation and fee',
  'book.escrowBody':
    'Paid into escrow at booking and released to the host after check-in. Nothing is stored for a future charge.',
  'book.requestNote':
    'This room is request to book. The money is held now and refunded in full if the host declines or lets the request expire.',

  /* ------------------------------------------------------------ the actions */
  'book.continue': 'Continue',
  'book.continueToPay': 'Continue to pay',
  'book.confirmAndPay': 'Confirm and pay',
  'book.requestAndPay': 'Request and pay',
  'book.paying': 'Taking payment',
  'book.blockedDates': 'Pick your check-in and check-out to continue.',
  'book.blockedParty': 'Too many guests for this room type.',
  'book.blockedRules': 'Tick the house rules to continue.',
  'book.blockedHandset': 'Enter the number the payment prompt goes to.',
  'book.blockedSoldOut': 'This room type is gone for those dates.',
  'book.blockedOffline': 'You are offline. Paying needs a connection, and your choices are kept until you have one.',
  'book.payFailedTitle': 'The payment did not go through',
  'book.payFailedBody': 'Nothing was charged. Check the details and try again.',

  /* ----------------------------------------------------------- 8. confirmed */
  'book.confirmedTitle': 'Booking confirmed',
  'book.requestedTitle': 'Request sent',
  'book.confirmedBody': '{property} has your room. The host has been notified.',
  'book.requestedBody':
    '{property} has your request. The host has 24 hours to answer, and you are refunded in full if they do not.',
  'book.reference': 'Reference',
  'book.a11yReference': 'Booking reference {reference}',
  'book.paidIntoEscrow': 'Paid into escrow',
  'book.heldInEscrow': 'Held in escrow',
  'book.invoiceNote': 'An EBM e-invoice has been issued under the host’s TIN.',
  'book.invoicePending': 'An EBM e-invoice is issued under the host’s TIN once the host accepts.',
  'book.viewTrip': 'View trip',
  'book.backToExplore': 'Back to Explore',
  'book.confirmedNotFoundTitle': 'We cannot find that booking',
  'book.confirmedNotFoundBody':
    'The booking this link points at is not on this device. Your Trips tab has every booking you have made.',
  'book.confirmedNotFoundAction': 'Open Trips',
} as const;

/**
 * Parity is a type error here, not a review note: `rw` is keyed off this
 * file's own `en`, so a key added to one and not the other fails `tsc` in
 * this file rather than in the merge.
 */
export const rw: Record<keyof typeof en, string> = {
  'book.step1': 'Amatariki n’abashyitsi',
  'book.step2': 'Ibyo wafashe',
  'book.step3': 'Emeza wishyure',
  'book.stepShort1': 'Amatariki',
  'book.stepShort2': 'Ibyafashwe',
  'book.stepShort3': 'Kwishyura',
  'book.back': 'Subira inyuma',
  'book.backToStep': 'Subira kuri {step}',
  'book.notFoundTitle': 'Icyo cyumba ntikigifatwa',
  'book.notFoundBody':
    'Ubwoko bw’icyumba buri kuri iyi link bwavanyweho, cyangwa iyi link ni ishaje ku itangazo. Reba ibiri gufatwa ubu.',
  'book.notFoundAction': 'Subira mu gushakisha',

  'book.roomAt': '{room} · {place}',
  'book.perNight': '/ ijoro',
  'book.when': 'Ryari',
  'book.who': 'Abaza',
  'book.pickDates': 'Hitamo itariki wizamo n’iyo uzasohokaho.',
  'book.timezoneNote': 'Amatariki asomwa mu isaha y’aho hantu, Africa/Kigali.',
  'book.partyAtRoomCap': '{room} kiryamamo {count}. Uduhinja ntidufata ibitanda.',
  'book.partyOverCap':
    'Abo ni {count} barenze ku {room}. Fata ikindi cyumba, cyangwa uhitemo kinini.',
  'book.increment': 'Ongeraho {label} umwe',
  'book.decrement': 'Kuraho {label} umwe',
  'book.stepperValue': '{label}: {count}',
  'book.rateTimesNights': '{rate} × {nights}',
  'book.runningTotal': 'Icumbi kugeza ubu',
  'book.totalLabel': 'Igiteranyo',
  'book.beforeFees': 'Amafaranga ya serivisi yiyongera ku ntambwe ikurikira.',

  'book.factRoom': 'Ubwoko bw’icyumba',
  'book.factDates': 'Amatariki',
  'book.factGuests': 'Abashyitsi',
  'book.factParty': '{guests} · {nights}',
  'book.factHost': 'Byakiriwe na',
  'book.price': 'Igiciro',
  'book.accommodation': 'Icumbi',
  'book.discount': 'Igabanuka ry’igiciro kidasubizwa',
  'book.fee': 'Amafaranga ya serivisi y’umushyitsi',
  'book.nonRefundableTitle': 'Igiciro kidasubizwa',
  'book.nonRefundableBody': 'Gihendutse nka {percent}%. Uhagaritse, nta kigusubizwa.',
  'book.nonRefundableOn': 'Wafashe igiciro kidasubizwa',
  'book.readPolicy': 'Soma amabwiriza yose',
  'book.houseRulesTitle': 'Amabwiriza y’urugo',
  'book.houseRulesAck': 'Nasomye amabwiriza y’urugo n’ayo guhagarika',
  'book.houseRulesNone': 'Nyir’aho ntabwo yatangaje amabwiriza y’urugo.',
  'book.checkInFrom': 'Winjira uhereye {from}, usohoka bitarenze {until}.',
  'book.mockAdapter': 'Sisitemu y’igerageza',
  'book.mockAdapterBody':
    'Nta mafaranga nyayo agenda. Kwishyura na fagitire bikorwa kuri sisitemu y’igerageza.',

  'book.howYouPay': 'Uko wishyura',
  'book.method.momo': 'MTN MoMo',
  'book.method.airtel': 'Airtel Money',
  'book.methodHint.momo': 'Emeza ubutumwa buza kuri telefone yawe',
  'book.methodHint.airtel': 'Emeza ubutumwa buza kuri telefone yawe',
  'book.mobileNumber': 'Numero ya telefone',
  'book.mobilePlaceholder': '78X XXX XXX',
  'book.phoneNineDigits': 'Numero yo mu Rwanda igizwe n’imibare icyenda, urugero 0788 123 456.',
  'book.phoneWrongNetwork': 'Numero za {network} zitangira kuri {prefixes}.',
  'book.phoneOtherNetwork': 'Iyo numero iri kuri {network}. Hitamo {network} haruguru.',
  'book.phonePrompt': 'Ubutumwa tuzabwohereza kuri {number}.',
  'book.or': 'cyangwa',
  'book.escrowTitle': 'Icumbi n’amafaranga ya serivisi',
  'book.escrowBody':
    'Ashyirwa mu bubiko bwizewe igihe ufata, agahabwa nyir’aho umaze kwinjira. Nta kintu kibikwa ngo kizishyuzwe ubutaha.',
  'book.requestNote':
    'Iki cyumba gisaba kwemererwa. Amafaranga afatirwa ubu, agasubizwa yose nyir’aho aramutse yanze cyangwa ntasubize.',

  'book.continue': 'Komeza',
  'book.continueToPay': 'Komeza wishyure',
  'book.confirmAndPay': 'Emeza wishyure',
  'book.requestAndPay': 'Saba wishyure',
  'book.paying': 'Kwakira ubwishyu',
  'book.blockedDates': 'Hitamo itariki wizamo n’iyo uzasohokaho kugira ngo ukomeze.',
  'book.blockedParty': 'Abashyitsi barenze ubushobozi bw’iki cyumba.',
  'book.blockedRules': 'Emeza amabwiriza y’urugo kugira ngo ukomeze.',
  'book.blockedHandset': 'Andika numero ubutumwa bwo kwishyura buzagendaho.',
  'book.blockedSoldOut': 'Iki cyumba nticyakiboneka kuri ayo matariki.',
  'book.blockedOffline':
    'Nta murandasi ufite. Kwishyura bisaba umurandasi, kandi ibyo wahisemo birabikwa kugeza ubonye.',
  'book.payFailedTitle': 'Ubwishyu ntibwagenze neza',
  'book.payFailedBody': 'Nta mafaranga yavuyeho. Reba amakuru maze wongere ugerageze.',

  'book.confirmedTitle': 'Ifatabuguzi ryemejwe',
  'book.requestedTitle': 'Icyifuzo cyoherejwe',
  'book.confirmedBody': '{property} ifite icyumba cyawe. Nyir’aho yamenyeshejwe.',
  'book.requestedBody':
    '{property} yakiriye icyifuzo cyawe. Nyir’aho afite amasaha 24 yo gusubiza, kandi usubizwa amafaranga yose nadasubiza.',
  'book.reference': 'Nomero y’ifatabuguzi',
  'book.a11yReference': 'Nomero y’ifatabuguzi {reference}',
  'book.paidIntoEscrow': 'Yashyizwe mu bubiko bwizewe',
  'book.heldInEscrow': 'Afatiriwe mu bubiko bwizewe',
  'book.invoiceNote': 'Fagitire ya EBM yatanzwe kuri TIN ya nyir’aho.',
  'book.invoicePending': 'Fagitire ya EBM itangwa kuri TIN ya nyir’aho ari uko yemeye.',
  'book.viewTrip': 'Reba urugendo',
  'book.backToExplore': 'Subira mu gushakisha',
  'book.confirmedNotFoundTitle': 'Ntitubonye iryo fatabuguzi',
  'book.confirmedNotFoundBody':
    'Ifatabuguzi iyi link yerekeza kuri ryo ntiriri kuri iyi telefone. Igice cy’Ingendo gifite ayo wafashe yose.',
  'book.confirmedNotFoundAction': 'Fungura Ingendo',
};
