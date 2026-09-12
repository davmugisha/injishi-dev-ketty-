/**
 * `search` - the Explore search sheet, and the facet vocabulary Explore's
 * filter rail shares with it. Session 2 owns this file.
 *
 * The class labels are here rather than read from `ACCOMMODATION_CLASS_LABEL`
 * in `@injishi/contracts`. The contract owns the VALUES, which is where drift
 * actually happens and where `src/data/search.ts` still types against it; its
 * label map is English-only, and code-standards allows no display string
 * without a Kinyarwanda one beside it.
 *
 * The `dim*` keys name a filter inside a sentence ("Nothing matches the price
 * band"), so they are lower case and read as a noun phrase, not as a heading.
 */

export const en = {
  'search.title': 'Search stays',
  'search.subtitle': 'Where, when and who. Availability is confirmed when you book.',
  'search.open': 'Open search',
  'search.summary': 'Your search: {summary}',

  /* Where */
  'search.where': 'Where',
  'search.whereLabel': 'Property or place',
  'search.wherePlaceholder': 'Umurage, Kimihurura, Lake Kivu…',
  'search.whereHelper': 'Matches a property name or a neighbourhood.',
  'search.districts': 'Districts',
  'search.districtKigali': 'Kigali',
  'search.districtRubavu': 'Rubavu',
  'search.districtKarongi': 'Karongi',
  'search.districtRusizi': 'Rusizi',
  'search.districtMusanze': 'Musanze',
  'search.districtNyamasheke': 'Nyamasheke',
  'search.districtNyagatare': 'Nyagatare',

  /* When */
  'search.when': 'When',
  'search.whenNote':
    'Your dates travel with you to the listing and the booking, so nobody asks twice. Availability is confirmed there — this list is the full catalogue.',

  /* Who */
  'search.who': 'Who',
  'search.adults': 'Adults',
  'search.adultsNote': '13 and over',
  'search.children': 'Children',
  'search.childrenNote': 'Ages 2 to 12',
  'search.infants': 'Infants',
  'search.infantsNote': 'Under 2 — they do not take a bed',
  'search.partyCap': 'The largest room anyone lists sleeps {count}.',
  'search.partyAtCap': 'That is the largest room in the catalogue.',
  'search.increment': 'One more, {label}',
  'search.decrement': 'One fewer, {label}',
  'search.stepperValue': '{label}, {count}',

  /* Narrowing */
  'search.refine': 'Narrow it down',
  'search.propertyType': 'Property type',
  'search.priceBand': 'Price per night',
  'search.bandAny': 'Any price',
  'search.bandUnder100k': 'Under RWF 100,000',
  'search.band100kTo200k': 'RWF 100,000 to 200,000',
  'search.bandOver200k': 'Over RWF 200,000',
  'search.classHotel': 'Hotel',
  'search.classMotel': 'Motel',
  'search.classTentedCamp': 'Tented camp',
  'search.classGuestHouse': 'Guest house',
  'search.classApartment': 'Apartment',
  'search.classLodge': 'Lodge',
  'search.classVilla': 'Villa',
  'search.classOther': 'Other',
  'search.instantBook': 'Instant book only',
  'search.instantBookNote': 'Confirms straight away, with no host approval to wait for.',
  'search.sort': 'Order them by',
  'search.sortRecommended': 'Recommended',
  'search.sortPriceLow': 'Price, lowest first',
  'search.sortPriceHigh': 'Price, highest first',
  'search.sortScore': 'Guest score',

  /* The footer */
  'search.apply': 'Search',
  'search.applyCount': 'Show {count} stays',
  'search.applyOne': 'Show 1 stay',
  'search.applyNone': 'Nothing matches yet',
  'search.applying': 'Searching…',
  'search.clearAll': 'Clear all',
  'search.cleared': 'Search cleared',
  'search.applied': 'Showing {count} stays',
  'search.appliedOne': 'Showing 1 stay',

  /* What a filter is called inside a sentence */
  'search.dimWhere': 'the name you typed',
  'search.dimDistrict': 'the districts',
  'search.dimClass': 'the property type',
  'search.dimPrice': 'the price band',
  'search.dimInstant': 'instant book',
  'search.dimGuests': 'the number of guests',

  /* Counts */
  'search.placesCount': '{count} places',
  'search.guestCount': '{count} guests',
  'search.oneGuest': '1 guest',
} as const;

/**
 * Parity is a type error here, not a review note: `rw` is keyed off this
 * file's own `en`, so a key added to one and not the other fails `tsc` in
 * this file rather than in the merge.
 */
export const rw: Record<keyof typeof en, string> = {
  'search.title': 'Shakisha aho kuraramo',
  'search.subtitle': 'Ahantu, igihe n’abantu. Kuboneka bwemezwa igihe wandika.',
  'search.open': 'Fungura ishakisha',
  'search.summary': 'Ishakisha ryawe: {summary}',

  /* Where */
  'search.where': 'Ahantu',
  'search.whereLabel': 'Izina ry’inzu cyangwa ahantu',
  'search.wherePlaceholder': 'Umurage, Kimihurura, Ikiyaga cya Kivu…',
  'search.whereHelper': 'Bihuza n’izina ry’inzu cyangwa iry’agace.',
  'search.districts': 'Uturere',
  'search.districtKigali': 'Kigali',
  'search.districtRubavu': 'Rubavu',
  'search.districtKarongi': 'Karongi',
  'search.districtRusizi': 'Rusizi',
  'search.districtMusanze': 'Musanze',
  'search.districtNyamasheke': 'Nyamasheke',
  'search.districtNyagatare': 'Nyagatare',

  /* When */
  'search.when': 'Igihe',
  'search.whenNote':
    'Amatariki yawe akujyana ku rupapuro rw’inzu no mu kwandika, ntawe wongera kukubaza. Kuboneka bwemezwa aho — uru rutonde ni urw’ibiri byose.',

  /* Who */
  'search.who': 'Abantu',
  'search.adults': 'Abakuru',
  'search.adultsNote': 'Imyaka 13 kuzamura',
  'search.children': 'Abana',
  'search.childrenNote': 'Imyaka 2 kugeza kuri 12',
  'search.infants': 'Uduhinja',
  'search.infantsNote': 'Munsi y’imyaka 2 — ntibafata ibitanda',
  'search.partyCap': 'Icyumba kinini gicururizwa cyakira abantu {count}.',
  'search.partyAtCap': 'Icyo ni cyo cyumba kinini kiri ku rutonde.',
  'search.increment': 'Ongeraho umwe, {label}',
  'search.decrement': 'Kuramo umwe, {label}',
  'search.stepperValue': '{label}, {count}',

  /* Narrowing */
  'search.refine': 'Yigereranye neza',
  'search.propertyType': 'Ubwoko bw’inzu',
  'search.priceBand': 'Igiciro cy’ijoro',
  'search.bandAny': 'Igiciro icyo ari cyo cyose',
  'search.bandUnder100k': 'Munsi ya RWF 100,000',
  'search.band100kTo200k': 'RWF 100,000 kugeza 200,000',
  'search.bandOver200k': 'Hejuru ya RWF 200,000',
  'search.classHotel': 'Hoteri',
  'search.classMotel': 'Moteli',
  'search.classTentedCamp': 'Inkambi y’amahema',
  'search.classGuestHouse': 'Inzu y’abashyitsi',
  'search.classApartment': 'Apatema',
  'search.classLodge': 'Loji',
  'search.classVilla': 'Villa',
  'search.classOther': 'Ibindi',
  'search.instantBook': 'Ibyandikwa ako kanya gusa',
  'search.instantBookNote': 'Byemezwa ako kanya, nta kwemererwa na nyir’inzu.',
  'search.sort': 'Bitondekanye ku',
  'search.sortRecommended': 'Ibyifuzwa',
  'search.sortPriceLow': 'Igiciro, gito mbere',
  'search.sortPriceHigh': 'Igiciro, kinini mbere',
  'search.sortScore': 'Amanota y’abashyitsi',

  /* The footer */
  'search.apply': 'Shakisha',
  'search.applyCount': 'Erekana aho kuraramo {count}',
  'search.applyOne': 'Erekana hamwe',
  'search.applyNone': 'Nta kintu kirahuza',
  'search.applying': 'Birashakishwa…',
  'search.clearAll': 'Siba byose',
  'search.cleared': 'Ishakisha ryasibwe',
  'search.applied': 'Twerekana aho kuraramo {count}',
  'search.appliedOne': 'Twerekana hamwe',

  /* What a filter is called inside a sentence */
  'search.dimWhere': 'izina wanditse',
  'search.dimDistrict': 'uturere',
  'search.dimClass': 'ubwoko bw’inzu',
  'search.dimPrice': 'urwego rw’igiciro',
  'search.dimInstant': 'kwandika ako kanya',
  'search.dimGuests': 'umubare w’abantu',

  /* Counts */
  'search.placesCount': 'ahantu {count}',
  'search.guestCount': 'abantu {count}',
  'search.oneGuest': 'umuntu 1',
};
