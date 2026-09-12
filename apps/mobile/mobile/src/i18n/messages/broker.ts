/**
 * `broker` — the Directory, the unit detail, the reveal sheet, Placements and
 * Earnings. Frames B21 to B24. Session 9 owns this file.
 *
 * The copy follows two rules the frames state and the corpus enforces:
 *
 *   - **A consequence is printed under the button, not discovered after it.**
 *     `directory.revealConsequence` and `directory.revealCredits` sit with the
 *     reveal action rather than in a terms page, because spending a credit and
 *     putting the broker's name on a placement are both things that happen the
 *     moment the button is pressed.
 *   - **Money is never a bare number.** Amounts render through `MoneyAmount`
 *     (RWF 320,000); the only compacted figures are the ceiling the reader
 *     themselves chose ("≤ 350K") and a chart bound, and both say so.
 *
 * The RW column is a working translation for layout, not a reviewed one: RW
 * runs longer than EN and nothing may truncate, so having it here is what
 * stresses the layout. A value ending ' (RW)' is one this session had no
 * Kinyarwanda for and is the audit's work list.
 */

export const en = {
  /* ── B21 · Directory ─────────────────────────────────────────────────── */
  'directory.greeting': 'Private inventory · brokers only',
  'directory.title': 'Directory',
  'directory.listLabel': 'directory units',
  'directory.privateNote':
    'These units are never public. A tenant reaches them through you, which is what the placement fee pays for.',
  'directory.searchPlaceholder': 'Anywhere · any size · any rent',
  'directory.searchOpen': 'Opens the directory filters',
  'directory.searchSummary': 'Current search: {summary}',

  'directory.chipAll': 'All',
  'directory.chipVacantNow': 'Vacant now',
  'directory.chipVacantSoon': 'Vacant soon',
  'directory.chipLongTerm': 'Long-term',
  'directory.chipShortTerm': 'Short-term',
  'directory.chipFilters': 'Filters',
  'directory.railLabel': 'Availability',
  'directory.tenureLabel': 'Tenure',

  'directory.resultsCount': '{count} units',
  'directory.resultsOne': '1 unit',
  'directory.sectionUnits': 'Units',

  'directory.vacantNow': 'vacant now',
  'directory.vacantFrom': 'vacant {day}',
  'directory.leased': 'let',
  'directory.perMonth': '/ month',
  'directory.bedCount': '{count} bed',
  'directory.bathCount': '{count} bath',
  'directory.bedPlus': '{count} bed +',
  'directory.sizeAndPlace': '{beds} · {district}',
  'directory.feePercent': 'Fee: {percent}% of first month',
  'directory.feeFlat': 'Fee: {amount} flat',
  'directory.feeLabel': 'Placement fee',
  'directory.viewUnit': 'View unit',
  'directory.openUnit': 'Open {title}',
  'directory.cardSummary': '{title}, {place}, {rent} a month, {vacancy}',

  'directory.emptyFilterTitle': 'Nothing matches that {filter}',
  'directory.emptyFilterBody':
    'The directory has units, just none on those terms. Lift this one filter and the rest of your search stays as it is.',
  'directory.emptyFilterAction': 'Clear the {filter}',
  'directory.emptyAllTitle': 'No unit matches all of that',
  'directory.emptyAllBody':
    'No single filter explains it — it is the combination. Start again and narrow one axis at a time.',
  'directory.emptyAllAction': 'Clear every filter',
  'directory.emptyTitle': 'The directory is empty',
  'directory.emptyBody':
    'No landlord in your districts has published a unit yet. Registered landlords publish here first, so this fills before anything reaches a tenant.',
  'directory.emptyAction': 'Reload the directory',

  /* ── The search sheet ────────────────────────────────────────────────── */
  'directory.filtersTitle': 'Narrow the directory',
  'directory.filtersSubtitle': 'Where your client wants to live, how big, and the most they will pay.',
  'directory.sectionWhere': 'Where',
  'directory.whereLabel': 'Property or district',
  'directory.wherePlaceholder': 'Umurava, Kimihurura…',
  'directory.sectionSize': 'How big',
  'directory.sectionCeiling': 'Most they will pay',
  'directory.sectionAvailability': 'When',
  'directory.bedroomsAny': 'Any size',
  'directory.ceilingAny': 'Any rent',
  'directory.ceilingChip': '≤ {amount}',
  'directory.ceilingShort': '≤ {amount}',
  'directory.ceilingNote':
    'A ceiling, not a bracket: everything at or under it stays in the list.',
  'directory.districtCount': '{count} districts',
  'directory.filtersApply': 'Show {count} units',
  'directory.filtersApplyOne': 'Show 1 unit',
  'directory.filtersApplyNone': 'No unit matches',
  'directory.filtersClear': 'Clear all',

  'directory.dimWhere': 'name',
  'directory.dimDistrict': 'district',
  'directory.dimBedrooms': 'size',
  'directory.dimCeiling': 'rent ceiling',
  'directory.dimVacancy': 'availability',
  'directory.dimTenure': 'tenure',

  /* ── B22 · Unit detail ───────────────────────────────────────────────── */
  'unit.listLabel': 'this unit',
  'unit.errorTitle': 'This unit did not load',
  'unit.errorBody': 'The directory read failed. Nothing has changed on the unit itself.',
  'unit.notFoundTitle': 'That unit is no longer listed',
  'unit.notFoundBody':
    'The landlord has taken it off the directory, or the link is older than the listing. The rest of the directory is unchanged.',
  'unit.notFoundAction': 'Back to the directory',

  'unit.sectionFacts': 'The terms',
  'unit.factRent': 'Rent',
  'unit.factCaution': 'Caution',
  'unit.factSize': 'Size',
  'unit.factAvailable': 'Available',
  'unit.factTenure': 'Tenure',
  'unit.factFee': 'Your fee',
  'unit.tenureLong': 'Long-term',
  'unit.tenureShort': 'Short-term',
  'unit.availableNow': 'Now',
  'unit.availableFrom': 'From {day}',
  'unit.availableNever': 'Let',
  'unit.cautionNote': 'Held in escrow for the tenancy. It is not rent and cannot be set off against it.',

  'unit.sectionAbout': 'About the unit',
  'unit.sectionLandlord': 'The landlord',
  'unit.landlordHidden': 'Hidden until you reveal it',
  'unit.landlordPhoneLabel': 'Phone',
  'unit.landlordEmailLabel': 'Email',
  'unit.landlordMasked': '+250 ••• ••• •••',
  'unit.landlordMaskedEmail': '•••••••@•••••••',
  'unit.landlordMaskedHint':
    'The number is not on this device until you reveal it. Nothing here is only visually hidden.',
  'unit.revealed': 'Reveal logged',
  'unit.revealedOn': 'Revealed {day}',
  'unit.revealCta': 'Reveal landlord contact',
  'unit.revealCreditsLeft': '{count} reveal credits left this month',
  'unit.revealCreditsOne': '1 reveal credit left this month',
  'unit.revealCreditsNone': 'No reveal credits left this month',
  'unit.callLandlord': 'Call {name}',
  'unit.emailLandlord': 'Email {name}',

  'unit.sectionPlacement': 'Your placement',
  'unit.placementOpen': 'Intent open · expires in {days} days',
  'unit.placementOpenOne': 'Intent open · expires tomorrow',
  'unit.placementLastDay': 'Intent open · expires today',
  'unit.placementNamed': 'Placing {client}',
  'unit.placeTenant': 'Place a tenant',
  'unit.placeTenantHint': 'Hands the lease to the landlord with you recorded on it',
  'unit.viewPlacements': 'See it in Placements',

  'unit.leasedTitle': 'This unit is let',
  'unit.leasedBody':
    'A lease is running on it, so a placement cannot be started against it. It stays listed so an old link still explains itself.',

  /* ── B22 · the reveal sheet ──────────────────────────────────────────── */
  'reveal.title': 'Reveal landlord contact',
  'reveal.body':
    'Revealing marks a placement intent on this unit. If your client signs, the placement fee is recorded on the lease.',
  'reveal.logged': 'Every reveal is logged. That log is what stops landlords having their numbers harvested.',
  'reveal.credits': 'Reveal credits · {count} left this month',
  'reveal.creditsOne': 'Reveal credits · 1 left this month',
  'reveal.confirm': 'Reveal contact · 1 credit',
  'reveal.cancel': 'Not now',
  'reveal.consequence': 'Spends one credit and opens a {days}-day intent on this unit.',
  'reveal.working': 'Revealing…',
  'reveal.toast': 'Contact revealed · placement opened',

  'reveal.spentTitle': 'No credits left this month',
  'reveal.spentBody':
    'Credits reset at the start of the month. An open placement keeps running in the meantime, and a lease that activates still pays its fee.',
  'reveal.spentAction': 'Back to the unit',

  'reveal.alreadyTitle': 'Already revealed',
  'reveal.alreadyBody': 'You revealed this contact on {day}. It costs nothing to look again.',
  'reveal.alreadyAction': 'Show the contact',

  'reveal.unavailableTitle': 'This unit is let',
  'reveal.unavailableBody':
    'A lease is already running on it. Revealing the landlord would spend a credit on a unit nobody can be placed into.',

  /* ── B23 · Placements ────────────────────────────────────────────────── */
  'placements.greeting': 'Every tenant you introduced',
  'placements.title': 'Placements',
  'placements.listLabel': 'placements',
  'placements.note':
    'A fee earns when the lease activates, not when the introduction happens. Injishi takes no cut of it.',

  'placements.bucketActive': 'Active',
  'placements.bucketSigned': 'Signed',
  'placements.bucketExpired': 'Expired',

  'placements.stateActive': 'active',
  'placements.stateSigning': 'signing',
  'placements.stateSigned': 'signed',
  'placements.stateExpired': 'expired',

  'placements.toUnit': '{client} → {unit}',
  'placements.noClient': 'No tenant named yet',
  'placements.eventRevealed': 'Revealed {day} · contact revealed',
  'placements.eventViewing': 'Revealed {day} · viewing booked',
  'placements.eventDrafted': 'Revealed {day} · lease drafted',
  'placements.eventAwaiting': 'Revealed {day} · awaiting the landlord',
  'placements.eventSigned': 'Signed {day} · fee paid',
  'placements.eventNoResponse': 'Revealed {day} · no response',

  'placements.feeOnSigning': 'Fee on signing',
  'placements.feeReceived': 'Fee received',
  'placements.feeLapsed': 'No fee earned',
  'placements.intentExpires': 'Intent expires',
  'placements.intentDays': '{count} days',
  'placements.intentTomorrow': 'tomorrow',
  'placements.intentToday': 'today',
  'placements.intentLapsed': 'Intent lapsed {day}',
  'placements.cardSummary': '{client} at {unit}, {state}. {event}',

  'placements.emptyActiveTitle': 'No live placements',
  'placements.emptyActiveBody':
    'Reveal a landlord in the Directory and an intent opens here for {days} days. That intent is what records you on the lease.',
  'placements.emptyActiveAction': 'Open the directory',
  'placements.emptySignedTitle': 'Nothing signed yet',
  'placements.emptySignedBody':
    'A placement lands here the day its lease activates, and the fee disburses in full on the same day.',
  'placements.emptyExpiredTitle': 'Nothing has lapsed',
  'placements.emptyExpiredBody':
    'An intent lapses after {days} days with no lease. None of yours has, which is the reading you want.',

  /* ── B24 · Earnings ──────────────────────────────────────────────────── */
  'earnings.greeting': 'Placement fees, in full',
  'earnings.title': 'Earnings',
  'earnings.listLabel': 'recent fees',
  'earnings.mock': 'mock',
  'earnings.mockHint': 'Figures are fixtures. No payout adapter is wired yet.',

  'earnings.heroLabel': '{year} to date',
  'earnings.heroMeta': '{count} placements signed',
  'earnings.heroMetaOne': '1 placement signed',
  'earnings.heroAverage': 'Average fee',
  'earnings.heroPending': 'Pending · earns when the lease activates',

  'earnings.chartTitle': 'Last six months',
  'earnings.chartBar': '{month}: {amount}',
  'earnings.chartEmptyBar': '{month}: nothing disbursed',
  'earnings.chartThisMonth': 'This month',
  'earnings.chartNothing': 'Nothing has disbursed in the last six months.',

  'earnings.sectionRecent': 'Recent fees',
  'earnings.paidOn': 'Paid {day} · MoMo',
  'earnings.pendingSignature': 'Pending signature',
  'earnings.pendingIntent': 'Intent open',
  'earnings.rowSummary': '{client} at {unit}, {amount}, {state}',
  'earnings.noCut': 'Placement fees disburse in full to your mobile money. Injishi takes no cut of them.',

  'earnings.emptyTitle': 'Nothing earned yet',
  'earnings.emptyBody':
    'A fee appears here the moment the lease behind a placement activates. Start one from the Directory.',
  'earnings.emptyAction': 'Open the directory',

  /* ------------------------ the reveal failing (gaps.md §5.2) ------------- */
  // The one screen in the app where a failure the person cannot see costs them
  // money directly. It says the credit is intact, because that is the fact the
  // broker needs before deciding whether to press again.
  'reveal.failedTitle': 'The contact was not revealed',
  'reveal.failedBody': 'Your credit has not been spent and no placement was opened. Nothing has changed.',
  'reveal.balanceBefore': 'Reveal credits',
  'reveal.balanceAfter': '{before} → {after} after this reveal',
} as const;

/**
 * Parity is a type error here, not a review note: `rw` is keyed off this file's
 * own `en`, so a key added to one column and not the other fails `tsc` in this
 * file rather than in the merge.
 */
export const rw: Record<keyof typeof en, string> = {
  /* ── B21 · Ububiko ───────────────────────────────────────────────────── */
  'directory.greeting': 'Amazu adasakazwa · ku bahuza gusa',
  'directory.title': 'Urutonde rw’amazu',
  'directory.listLabel': 'amazu ari ku rutonde',
  'directory.privateNote':
    'Aya mazu ntabwo asakazwa ku bantu bose. Ukodesha ayagera binyuze kuri wowe, ni cyo amafaranga y’ubuhuza yishyura.',
  'directory.searchPlaceholder': 'Ahantu hose · ingano iyo ari yo yose · ubukode ubwo ari bwo bwose',
  'directory.searchOpen': 'Bifungura imiyunguruzo y’urutonde',
  'directory.searchSummary': 'Ishakisha rigezweho: {summary}',

  'directory.chipAll': 'Byose',
  'directory.chipVacantNow': 'Ubusa ubu',
  'directory.chipVacantSoon': 'Buzaba ubusa vuba',
  'directory.chipLongTerm': 'Igihe kirekire',
  'directory.chipShortTerm': 'Igihe gito',
  'directory.chipFilters': 'Imiyunguruzo',
  'directory.railLabel': 'Uko aboneka',
  'directory.tenureLabel': 'Igihe cy’ubukode',

  'directory.resultsCount': 'Amazu {count}',
  'directory.resultsOne': 'Inzu 1',
  'directory.sectionUnits': 'Amazu',

  'directory.vacantNow': 'ubusa ubu',
  'directory.vacantFrom': 'ubusa {day}',
  'directory.leased': 'yarakodeshejwe',
  'directory.perMonth': '/ ukwezi',
  'directory.bedCount': 'ibyumba {count}',
  'directory.bathCount': 'ubwiherero {count}',
  'directory.bedPlus': 'ibyumba {count} +',
  'directory.sizeAndPlace': '{beds} · {district}',
  'directory.feePercent': 'Amafaranga: {percent}% by’ukwezi kwa mbere',
  'directory.feeFlat': 'Amafaranga: {amount} ahamye',
  'directory.feeLabel': 'Amafaranga y’ubuhuza',
  'directory.viewUnit': 'Reba inzu',
  'directory.openUnit': 'Fungura {title}',
  'directory.cardSummary': '{title}, {place}, {rent} ku kwezi, {vacancy}',

  'directory.emptyFilterTitle': 'Nta kihuye n’iyo {filter}',
  'directory.emptyFilterBody':
    'Urutonde rufite amazu, ariko nta ryemera ayo mabwiriza. Kuraho iyi miyunguruzo imwe, ibindi wasabye bisigare uko biri.',
  'directory.emptyFilterAction': 'Kuraho {filter}',
  'directory.emptyAllTitle': 'Nta nzu ihuza ibyo byose',
  'directory.emptyAllBody':
    'Nta miyunguruzo imwe ibitera — ni uko zahujwe. Tangira bundi bushya, wongere ugabanye rimwe rimwe.',
  'directory.emptyAllAction': 'Kuraho imiyunguruzo yose',
  'directory.emptyTitle': 'Urutonde ruracyari ubusa',
  'directory.emptyBody':
    'Nta nyir’inzu wo mu turere twawe uratanga inzu. Ba nyir’amazu banditse batangira hano mbere, bityo hano huzura mbere y’uko ikigera ku ukodesha.',
  'directory.emptyAction': 'Ongera usome urutonde',

  /* ── Ipaji y’ishakisha ───────────────────────────────────────────────── */
  'directory.filtersTitle': 'Gabanya urutonde',
  'directory.filtersSubtitle':
    'Aho umukiriya wawe ashaka kuba, ingano y’inzu, n’amafaranga menshi ashobora gutanga.',
  'directory.sectionWhere': 'Ahantu',
  'directory.whereLabel': 'Izina ry’inzu cyangwa agace',
  'directory.wherePlaceholder': 'Umurava, Kimihurura…',
  'directory.sectionSize': 'Ingano',
  'directory.sectionCeiling': 'Amafaranga menshi yatanga',
  'directory.sectionAvailability': 'Igihe',
  'directory.bedroomsAny': 'Ingano iyo ari yo yose',
  'directory.ceilingAny': 'Ubukode ubwo ari bwo bwose',
  'directory.ceilingChip': '≤ {amount}',
  'directory.ceilingShort': '≤ {amount}',
  'directory.ceilingNote':
    'Ni urugero rwo hejuru, si agace: ibiri munsi yarwo cyangwa bingana na rwo bisigara ku rutonde.',
  'directory.districtCount': 'Uturere {count}',
  'directory.filtersApply': 'Erekana amazu {count}',
  'directory.filtersApplyOne': 'Erekana inzu 1',
  'directory.filtersApplyNone': 'Nta nzu ihuye',
  'directory.filtersClear': 'Kuraho byose',

  'directory.dimWhere': 'izina',
  'directory.dimDistrict': 'agace',
  'directory.dimBedrooms': 'ingano',
  'directory.dimCeiling': 'urugero rw’ubukode',
  'directory.dimVacancy': 'uko iboneka',
  'directory.dimTenure': 'igihe cy’ubukode',

  /* ── B22 · Amakuru y’inzu ────────────────────────────────────────────── */
  'unit.listLabel': 'iyi nzu',
  'unit.errorTitle': 'Iyi nzu ntiyashoboye gusomwa',
  'unit.errorBody': 'Gusoma urutonde byanze. Nta kintu cyahindutse ku nzu ubwayo.',
  'unit.notFoundTitle': 'Iyi nzu ntikiri ku rutonde',
  'unit.notFoundBody':
    'Nyir’inzu yayikuye ku rutonde, cyangwa iyi ihuza ni ishaje kuruta itangazo. Urundi rutonde ntirwahindutse.',
  'unit.notFoundAction': 'Subira ku rutonde',

  'unit.sectionFacts': 'Amasezerano',
  'unit.factRent': 'Ubukode',
  'unit.factCaution': 'Ingwate',
  'unit.factSize': 'Ingano',
  'unit.factAvailable': 'Iboneka',
  'unit.factTenure': 'Igihe cy’ubukode',
  'unit.factFee': 'Amafaranga yawe',
  'unit.tenureLong': 'Igihe kirekire',
  'unit.tenureShort': 'Igihe gito',
  'unit.availableNow': 'Ubu',
  'unit.availableFrom': 'Guhera {day}',
  'unit.availableNever': 'Yarakodeshejwe',
  'unit.cautionNote':
    'Ibikwa mu bubiko bw’ingwate mu gihe cy’ubukode. Si ubukode kandi ntishobora kubarirwamo.',

  'unit.sectionAbout': 'Ibyerekeye inzu',
  'unit.sectionLandlord': 'Nyir’inzu',
  'unit.landlordHidden': 'Bihishe kugeza ubigaragaje',
  'unit.landlordPhoneLabel': 'Telefone',
  'unit.landlordEmailLabel': 'Imeyili',
  'unit.landlordMasked': '+250 ••• ••• •••',
  'unit.landlordMaskedEmail': '•••••••@•••••••',
  'unit.landlordMaskedHint':
    'Nimero ntiri kuri iyi telefone kugeza ubigaragaje. Nta kintu hano gihishwe mu maso gusa.',
  'unit.revealed': 'Igaragazwa ryanditswe',
  'unit.revealedOn': 'Byagaragajwe {day}',
  'unit.revealCta': 'Garagaza aderesi ya nyir’inzu',
  'unit.revealCreditsLeft': 'Hasigaye amahirwe {count} yo kugaragaza muri uku kwezi',
  'unit.revealCreditsOne': 'Hasigaye ihirwe 1 ryo kugaragaza muri uku kwezi',
  'unit.revealCreditsNone': 'Nta hirwe ryo kugaragaza risigaye muri uku kwezi',
  'unit.callLandlord': 'Hamagara {name}',
  'unit.emailLandlord': 'Andikira {name}',

  'unit.sectionPlacement': 'Ubuhuza bwawe',
  'unit.placementOpen': 'Icyifuzo gifunguye · kirangira mu minsi {days}',
  'unit.placementOpenOne': 'Icyifuzo gifunguye · kirangira ejo',
  'unit.placementLastDay': 'Icyifuzo gifunguye · kirangira uyu munsi',
  'unit.placementNamed': 'Urimo gushyiraho {client}',
  'unit.placeTenant': 'Shyiramo ukodesha',
  'unit.placeTenantHint': 'Bishyikiriza nyir’inzu amasezerano, izina ryawe riyanditseho',
  'unit.viewPlacements': 'Bireba mu Buhuza',

  'unit.leasedTitle': 'Iyi nzu yarakodeshejwe',
  'unit.leasedBody':
    'Hari amasezerano akora kuri yo, bityo ubuhuza ntibushobora gutangirwa kuri yo. Isigara ku rutonde kugira ngo ihuza rya kera risobanuke.',

  /* ── B22 · Ipaji yo kugaragaza ───────────────────────────────────────── */
  'reveal.title': 'Garagaza aderesi ya nyir’inzu',
  'reveal.body':
    'Kugaragaza bishyira icyifuzo cy’ubuhuza kuri iyi nzu. Umukiriya wawe nasinya, amafaranga y’ubuhuza yandikwa ku masezerano.',
  'reveal.logged':
    'Buri igaragazwa ryandikwa. Urwo rutonde ni rwo rubuza ko nimero za ba nyir’amazu zisahurwa.',
  'reveal.credits': 'Amahirwe yo kugaragaza · hasigaye {count} muri uku kwezi',
  'reveal.creditsOne': 'Amahirwe yo kugaragaza · hasigaye 1 muri uku kwezi',
  'reveal.confirm': 'Garagaza aderesi · ihirwe 1',
  'reveal.cancel': 'Ntabwo ubu',
  'reveal.consequence': 'Bikoresha ihirwe rimwe kandi bifungura icyifuzo cy’iminsi {days} kuri iyi nzu.',
  'reveal.working': 'Biragaragazwa…',
  'reveal.toast': 'Aderesi yagaragajwe · ubuhuza bwafunguwe',

  'reveal.spentTitle': 'Nta hirwe risigaye muri uku kwezi',
  'reveal.spentBody':
    'Amahirwe asubukurwa mu ntangiriro z’ukwezi. Ubuhuza bufunguye bukomeza muri icyo gihe, kandi amasezerano atangiye akora aracyishyura amafaranga yayo.',
  'reveal.spentAction': 'Subira ku nzu',

  'reveal.alreadyTitle': 'Byaramaze kugaragazwa',
  'reveal.alreadyBody': 'Wagaragaje iyi aderesi ku itariki {day}. Kongera kureba nta kiguzi bifite.',
  'reveal.alreadyAction': 'Erekana aderesi',

  'reveal.unavailableTitle': 'Iyi nzu yarakodeshejwe',
  'reveal.unavailableBody':
    'Hari amasezerano asanzwe akora kuri yo. Kugaragaza nyir’inzu byakoresha ihirwe ku nzu nta muntu ushobora gushyirwamo.',

  /* ── B23 · Ubuhuza ───────────────────────────────────────────────────── */
  'placements.greeting': 'Buri ukodesha wamenyekanishije',
  'placements.title': 'Ubuhuza',
  'placements.listLabel': 'ubuhuza',
  'placements.note':
    'Amafaranga yinjira igihe amasezerano atangiye gukora, si igihe cyo kumenyekanisha. Injishi nta kintu ibivanamo.',

  'placements.bucketActive': 'Bikora',
  'placements.bucketSigned': 'Byasinywe',
  'placements.bucketExpired': 'Byarangiye',

  'placements.stateActive': 'birakora',
  'placements.stateSigning': 'birasinywa',
  'placements.stateSigned': 'byasinywe',
  'placements.stateExpired': 'byarangiye',

  'placements.toUnit': '{client} → {unit}',
  'placements.noClient': 'Nta ukodesha uratangwa izina',
  'placements.eventRevealed': 'Byagaragajwe {day} · aderesi yagaragajwe',
  'placements.eventViewing': 'Byagaragajwe {day} · gusura byateguwe',
  'placements.eventDrafted': 'Byagaragajwe {day} · amasezerano yateguwe',
  'placements.eventAwaiting': 'Byagaragajwe {day} · hategerejwe nyir’inzu',
  'placements.eventSigned': 'Byasinywe {day} · amafaranga yishyuwe',
  'placements.eventNoResponse': 'Byagaragajwe {day} · nta gisubizo',

  'placements.feeOnSigning': 'Amafaranga yo ku isinywa',
  'placements.feeReceived': 'Amafaranga yakiriwe',
  'placements.feeLapsed': 'Nta mafaranga yinjiye',
  'placements.intentExpires': 'Icyifuzo kirangira',
  'placements.intentDays': 'iminsi {count}',
  'placements.intentTomorrow': 'ejo',
  'placements.intentToday': 'uyu munsi',
  'placements.intentLapsed': 'Icyifuzo cyarangiye {day}',
  'placements.cardSummary': '{client} kuri {unit}, {state}. {event}',

  'placements.emptyActiveTitle': 'Nta buhuza bukora',
  'placements.emptyActiveBody':
    'Garagaza nyir’inzu ku rutonde, icyifuzo gifungurwe hano mu minsi {days}. Icyo cyifuzo ni cyo kikwandika ku masezerano.',
  'placements.emptyActiveAction': 'Fungura urutonde',
  'placements.emptySignedTitle': 'Nta kirasinywa',
  'placements.emptySignedBody':
    'Ubuhuza bugera hano umunsi amasezerano yabwo atangiye gukora, kandi amafaranga yishyurwa yose uwo munsi.',
  'placements.emptyExpiredTitle': 'Nta kirarangira',
  'placements.emptyExpiredBody':
    'Icyifuzo kirangira nyuma y’iminsi {days} nta masezerano abaye. Nta kimwe cyawe kirangiye, ni byo ushaka kubona.',

  /* ── B24 · Amafaranga yinjiye ────────────────────────────────────────── */
  'earnings.greeting': 'Amafaranga y’ubuhuza, yose uko angana',
  'earnings.title': 'Amafaranga yinjiye',
  'earnings.listLabel': 'amafaranga aheruka',
  'earnings.mock': 'agerageza',
  'earnings.mockHint': 'Imibare ni iy’ikitegererezo. Nta buryo bwo kwishyura buraterwa.',

  'earnings.heroLabel': 'Kuva mu ntangiriro za {year}',
  'earnings.heroMeta': 'Ubuhuza {count} bwasinywe',
  'earnings.heroMetaOne': 'Ubuhuza 1 bwasinywe',
  'earnings.heroAverage': 'Impuzandengo y’amafaranga',
  'earnings.heroPending': 'Ategerejwe · yinjira igihe amasezerano atangiye gukora',

  'earnings.chartTitle': 'Amezi atandatu ashize',
  'earnings.chartBar': '{month}: {amount}',
  'earnings.chartEmptyBar': '{month}: nta yishyuwe',
  'earnings.chartThisMonth': 'Uku kwezi',
  'earnings.chartNothing': 'Nta mafaranga yishyuwe mu mezi atandatu ashize.',

  'earnings.sectionRecent': 'Amafaranga aheruka',
  'earnings.paidOn': 'Yishyuwe {day} · MoMo',
  'earnings.pendingSignature': 'Hategerejwe umukono',
  'earnings.pendingIntent': 'Icyifuzo gifunguye',
  'earnings.rowSummary': '{client} kuri {unit}, {amount}, {state}',
  'earnings.noCut':
    'Amafaranga y’ubuhuza yishyurwa yose kuri telefone yawe. Injishi nta kintu ibivanamo.',

  'earnings.emptyTitle': 'Nta mafaranga arinjira',
  'earnings.emptyBody':
    'Amafaranga agaragara hano ako kanya amasezerano ari inyuma y’ubuhuza atangiye gukora. Tangira bumwe uhereye ku rutonde.',
  'earnings.emptyAction': 'Fungura urutonde',
  'reveal.failedTitle': `${en['reveal.failedTitle']} (RW)`,
  'reveal.failedBody': `${en['reveal.failedBody']} (RW)`,
  'reveal.balanceBefore': `${en['reveal.balanceBefore']} (RW)`,
  'reveal.balanceAfter': `${en['reveal.balanceAfter']} (RW)`,
};
