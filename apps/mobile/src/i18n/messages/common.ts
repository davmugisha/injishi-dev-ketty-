/**
 * `common` - the strings the shell and the shared kit own.
 *
 * Navigation labels, the cross-cutting list states, the three status maps, the
 * photo-credit vocabulary, the picker, the calendar, and the ComingSoon stub.
 * A screen namespace never redefines one of these; it reads it.
 *
 * Session 0 renamed two nav keys per decision D3: `nav.profile` became
 * `nav.account` and `nav.messages` became `nav.inbox`, because the prototype
 * names the fifth tab Account in every set and the message tab Inbox.
 * Reversing D3 is an edit to these two values and nothing else.
 */

export const en = {
  'nav.explore': 'Explore',
  'nav.saved': 'Saved',
  'nav.trips': 'Trips',
  'nav.inbox': 'Messages',
  'nav.leases': 'Leases',
  'nav.rent': 'Rent',
  'nav.account': 'Profile',
  'nav.portfolio': 'Portfolio',
  'nav.directory': 'Directory',
  'a11y.back': 'Go back',
  'a11y.close': 'Close',
  'a11y.decorativeMedia': 'Decorative image',

  /* Cross-cutting states */
  'state.loading': 'Loading',
  'state.loadingList': 'Loading {label}',
  'state.errorTitle': 'That did not load',
  'state.errorBody': 'Something went wrong reading {label}. It is worth another try.',
  'state.retry': 'Try again',
  'state.offlineTitle': 'You are offline',
  'state.offlineBody': 'Showing what was already loaded. New reads resume when the connection is back.',
  'state.notFoundTitle': 'This page does not exist',
  'state.notFoundBody': 'There is nothing at the link you followed. It may have moved.',
  'state.notFoundAction': 'Go to the start',
  'state.crashTitle': 'The app hit an error',
  'state.crashBody':
    'This screen stopped rather than showing you something wrong. Reload it to carry on.',
  // ADR-063: the reference a release build shows in place of the message.
  'state.crashRef': 'Reference {ref}',
  'state.crashRefHint': 'If you contact support, quote this reference.',
  'state.crashOffline': 'If you are offline, the report is sent once you are back online.',
  'state.crashNoReport': 'No report was sent.',
  'state.crashRetry': 'Reload the screen',

  /* Session: said once on the sign-in screen after a session ends, so nobody
     lands there wondering what happened (mobile audit SA-34). */
  'session.signedOutTitle': 'You were signed out',
  'session.signedOutBody': 'Your session ended. Sign in again to carry on.',
  'session.signedOutOffline':
    'Signed out on this phone. Injishi could not be reached, so the session may still be open elsewhere until it expires.',

  /* The shell, while it learns which seats this person holds. */
  'shell.opening': 'Opening your account',
  'shell.loadErrorTitle': 'Your account did not load',
  'shell.loadErrorBody': 'Injishi did not answer. Check your connection, then try again.',

  /* Identity: an account the server has no name for (mobile audit SA-01). */
  'identity.unnamed': 'Name not added yet',

  /* Explore */
  'status.booking.pending_approval': 'Pending approval',
  'status.booking.confirmed': 'Confirmed',
  'status.booking.arriving': 'Arriving today',
  'status.booking.checked_in': 'Checked in',
  'status.booking.completed': 'Completed',
  'status.booking.declined': 'Declined',
  'status.booking.cancelled': 'Cancelled',
  'status.booking.no_show': 'No-show',
  'status.lease.draft': 'Draft',
  'status.lease.pending_signature': 'Pending signature',
  'status.lease.active': 'Active',
  'status.lease.ending': 'Ending',
  'status.lease.ended': 'Ended',
  'status.lease.cancelled': 'Cancelled',
  'status.rent.paid': 'Paid',
  'status.rent.due': 'Due',
  'status.rent.overdue': 'Overdue',
  'status.caution.held': 'Held',
  'status.caution.refunded': 'Refunded',
  'status.caution.forfeited': 'Forfeited',
  'status.identity.verified': 'Verified',
  'status.identity.unverified': 'Unverified',
  'status.filing.pending': 'Filing pending',
  'status.filing.filed': 'Filed',
  'status.filing.failed': 'Filing failed',

  /* Payment lifecycle — the second, separate map (design brief §4.1) */
  'payment.paid': 'Paid',
  'payment.cleared': 'Cleared',
  'payment.scheduled': 'Scheduled',
  'payment.pending': 'Pending',
  'payment.due': 'Due',
  'payment.overdue': 'Overdue',
  'payment.failed': 'Failed',
  'payment.refunded': 'Refunded',
  'payment.partial': 'Part-paid',

  /* Tax compliance — the third map (design brief §4.2) */
  'tax.compliant': 'RRA compliant',
  'tax.due': 'RRA filing due',
  'tax.overdue': 'RRA overdue',
  'tax.exempt': 'Tax exempt',

  /* Domains */
  'domain.hospitality': 'Hospitality',
  'domain.residence': 'Residence',

  /* Tab labels the prototype adds: the five tab sets of frames.md "Shell" */
  'nav.rentRoll': 'Rent roll',
  'nav.repairs': 'Maintenance',
  'nav.placements': 'Placements',
  'nav.earnings': 'Earnings',
  'nav.queue': 'Queue',
  'nav.rooms': 'Rooms',
  'nav.tickets': 'Maintenance',
  'nav.today': 'Today',
  // "Bookings", the word every Host screen uses (the route's own rule; mobile
  // audit HO-16). The route keeps its `reservations` name.
  'nav.reservations': 'Bookings',

  /* What assistive tech hears on the shared kit */
  'a11y.dismiss': 'Dismiss',
  'a11y.photoOf': 'Photograph of {subject}',
  'a11y.pageOf': 'Photo {index} of {total}',
  'a11y.save': 'Save this stay',
  'a11y.unsave': 'Remove from saved',
  'a11y.stepOf': 'Step {index} of {total}, {label}',
  'a11y.selected': 'Selected',
  'a11y.swipeRow': 'Swipe right to {right}, left to {left}',
  'a11y.timer': '{label}, {time}',
  'a11y.pauseTimer': 'Pause the timer',
  'a11y.resumeTimer': 'Resume the timer',
  'a11y.removePhoto': 'Remove photo {index}',
  'a11y.score': 'Guest score {score} out of 10, {word}',
  'a11y.openGallery': 'Open the photo gallery',

  /* States the shared kit renders */
  'state.offlineLastList': 'Showing the last list that loaded. It refreshes on its own when the connection is back.',
  'state.toastRegion': 'Notification',
  /* The kit's UndoBar, lifted by Session 11 out of two surfaces that each had
     their own word for the same control. */
  'state.undo': 'Undo',
  /**
   * The way OUT of an empty list.
   *
   * Session 11's list-states audit found twenty-one empty states with a reason
   * and no action, several of them arguing — correctly — that no action would
   * make the list fill. That is true and it is not the point: the action an
   * empty state owes is a way somewhere else, not a way to conjure a row. This
   * is the label for it, one key rather than one per screen, because "Open
   * Rooms" and "Open the Directory" are the same sentence with the tab's own
   * name in it.
   */
  'state.emptyGoTo': 'Open {tab}',

  /* The registered-but-unbuilt stub. The frame and the session are printed so a reviewer can find both */
  'comingSoon.eyebrow': 'Prototype stub',
  'comingSoon.title': 'Not built yet',
  'comingSoon.body': 'This screen is drawn as frame {frame} in the prototype canvas and is built in session {session}. The tab is registered now so the bar is complete and a tap never dead-ends.',
  'comingSoon.bodyUndrawn': 'The prototype canvas does not draw this surface. It is built in session {session}, off the critical path, and the tab is registered now so the route resolves and a tap never dead-ends.',
  'comingSoon.frame': 'Frame {frame}',
  'comingSoon.session': 'Session {session}',
  'comingSoon.action': 'Back to the start',

  /* Photo credits. ADR-015 call 5: a stand-in photograph carries a VISIBLE credit where it appears */
  'photo.credit': '{author} - {licence}',
  'photo.standIn': 'Not this property',
  'photo.standInWhy': 'A Rwandan photograph standing in for a property whose own pictures we do not hold.',
  'photo.creditsTitle': 'Photo credits',
  'photo.creditsGreeting': 'Every photograph, and where it came from',
  'photo.creditsIntro': 'Most of these are Rwandan landscape and city photography standing in for a property whose own pictures the project does not hold. Where that is so, the photograph says so on the screen it appears on, not only here.',
  'photo.creditsListLabel': 'photo credits',
  'photo.viewSource': 'Open the source page',
  'photo.actualProperty': 'Shows this property',
  'photo.licence': 'Licence',
  'photo.creditsEmptyTitle': 'No photographs to credit',
  'photo.creditsEmptyBody': 'None of the photographs here needs a credit line.',

  /* PhotoPicker, including the permission-denied state */
  'picker.addPhoto': 'Add photo',
  'picker.leadHint': 'It leads the ticket',
  'picker.camera': 'Take a photo',
  'picker.library': 'Choose from library',
  'picker.cancel': 'Cancel',
  'picker.photoIndex': 'Photo {index}',
  'picker.cameraDeniedTitle': 'Camera access is off',
  'picker.cameraDeniedBody': 'Injishi needs the camera to put a photo on this report. Turn it on in Settings, or pick one from your library instead.',
  'picker.libraryDeniedTitle': 'Photo access is off',
  'picker.libraryDeniedBody': 'Injishi needs your photo library to attach a picture. Turn it on in Settings, or take a new photo instead.',
  'picker.openSettings': 'Open Settings',

  /* CalendarRange. Month and weekday names are data, not chrome, so they are keys like anything else */
  'calendar.m1': 'January',
  'calendar.m2': 'February',
  'calendar.m3': 'March',
  'calendar.m4': 'April',
  'calendar.m5': 'May',
  'calendar.m6': 'June',
  'calendar.m7': 'July',
  'calendar.m8': 'August',
  'calendar.m9': 'September',
  'calendar.m10': 'October',
  'calendar.m11': 'November',
  'calendar.m12': 'December',
  'calendar.d0': 'Sun',
  'calendar.d1': 'Mon',
  'calendar.d2': 'Tue',
  'calendar.d3': 'Wed',
  'calendar.d4': 'Thu',
  'calendar.d5': 'Fri',
  'calendar.d6': 'Sat',
  'calendar.prevMonth': 'Previous month',
  'calendar.nextMonth': 'Next month',
  'calendar.checkIn': 'Check-in',
  'calendar.checkOut': 'Check-out',
  'calendar.pickStart': 'Pick your arrival',
  'calendar.pickEnd': 'Pick your departure',
  'calendar.nights': '{count} nights',
  'calendar.oneNight': '1 night',
  'calendar.clear': 'Clear dates',
  'calendar.unavailable': 'Not available',
  'calendar.dayAvailable': '{day}, available',
  'calendar.dayUnavailable': '{day}, not available',
  'calendar.daySelected': '{day}, selected',

  /* The formSheet scaffold */
  'sheet.close': 'Close this sheet',

  /* Guest score bands (ADR-022). The word derives from the score, never stored beside it */
  'score.exceptional': 'Exceptional',
  'score.excellent': 'Excellent',
  'score.veryGood': 'Very good',
  'score.good': 'Good',
  'score.pleasant': 'Pleasant',

  /* Three status domains the prototype adds: task, housekeeping and ticket (frames.md "Interactive twin") */
  'status.task.pending': 'Needs cleaning',
  'status.task.in_progress': 'In progress',
  'status.task.done': 'Done',
  'status.task.inspected': 'Inspected',
  'status.task.blocked': 'Blocked',
  'status.housekeeping.clean': 'Clean',
  'status.housekeeping.dirty': 'Dirty',
  'status.housekeeping.in_progress': 'In progress',
  'status.housekeeping.inspected': 'Inspected',
  'status.housekeeping.out_of_order': 'Out of order',
  'status.ticket.open': 'Open',
  'status.ticket.assigned': 'Assigned',
  'status.ticket.resolved': 'Resolved',

  /* ------------------------------ a write that did not happen ------------- */
  // Shared by the seven screens gaps.md §7 groups as "err=0 on a write that
  // moves money or creates a legal record". The first sentence is the one that
  // matters: someone whose save failed does not know whether it half-happened,
  // and what they do next depends entirely on that.
  'write.failedTitle': 'That did not save',
  'write.failedBody': 'Nothing was recorded. Nothing has changed, and nothing was sent. Try again.',
  'write.retry': 'Try again',
  'write.goBack': 'Go back',
  'write.failedMoneyBody': 'Nothing was recorded and no money moved. Try again, or go back and check the amount.',
  'write.failedLegalBody': 'Nothing was signed and nothing was filed. The document is unchanged. Try again.',
} as const;

/**
 * Parity is a type error here, not a review note: `rw` is keyed off this
 * file's own `en`, so a key added to one and not the other fails `tsc` in
 * this file rather than in the merge.
 */
export const rw: Record<keyof typeof en, string> = {
  'nav.explore': 'Shakisha',
  'nav.saved': 'Ibyabitswe',
  'nav.trips': 'Ingendo',
  'nav.inbox': 'Ubutumwa',
  'nav.leases': 'Amasezerano',
  'nav.rent': 'Ubukode',
  'nav.account': 'Umwirondoro',
  'nav.portfolio': 'Imitungo',
  'nav.directory': 'Urutonde',
  'a11y.back': 'Subira inyuma',
  'a11y.close': 'Funga',
  'a11y.decorativeMedia': 'Ishusho y’imitako',

  /* Cross-cutting states */
  'state.loading': 'Biratangira',
  'state.loadingList': 'Gutegura {label}',
  'state.errorTitle': 'Ntibyakunze gutangira',
  'state.errorBody': 'Hari ikitagenze neza mu gusoma {label}. Birakwiye kongera kugerageza.',
  'state.retry': 'Ongera ugerageze',
  'state.offlineTitle': 'Nta murandasi ufite',
  'state.offlineBody':
    'Twerekana ibyari byamaze gutangira. Gusoma bishya bizakomeza umurandasi ugarutse.',
  'state.notFoundTitle': 'Uru rupapuro ntiruhari',
  'state.notFoundBody':
    'Aho wakanze hajya ku rupapuro iyi porogaramu idafite. Rushobora kuba rwarimutse, cyangwa rutarigeze rusohorwa.',
  'state.notFoundAction': 'Subira ku ntangiriro',
  'state.crashTitle': 'Porogaramu yagize ikibazo',
  'state.crashBody':
    en['state.crashBody'],
  // ADR-063: English until Kinyarwanda work starts. The body above changed
  // with it: its old translation described details a release build no longer shows.
  'state.crashRef': en['state.crashRef'],
  'state.crashRefHint': en['state.crashRefHint'],
  'state.crashOffline': en['state.crashOffline'],
  'state.crashNoReport': en['state.crashNoReport'],
  'state.crashRetry': 'Ongera utangire urupapuro',

  /* Session: English until Kinyarwanda work starts (v1 is English only). */
  'session.signedOutTitle': en['session.signedOutTitle'],
  'session.signedOutBody': en['session.signedOutBody'],
  'session.signedOutOffline': en['session.signedOutOffline'],
  'shell.opening': en['shell.opening'],
  'shell.loadErrorTitle': en['shell.loadErrorTitle'],
  'shell.loadErrorBody': en['shell.loadErrorBody'],
  'identity.unnamed': en['identity.unnamed'],

  /* Explore */
  'status.booking.pending_approval': 'Bitegereje kwemezwa',
  'status.booking.confirmed': 'Byemejwe',
  'status.booking.arriving': 'Uraza uyu munsi',
  'status.booking.checked_in': 'Yinjiye',
  'status.booking.completed': 'Byarangiye',
  'status.booking.declined': 'Byanzwe',
  'status.booking.cancelled': 'Byahagaritswe',
  'status.booking.no_show': 'Ntiyaje',
  'status.lease.draft': 'Umushinga',
  'status.lease.pending_signature': 'Bitegereje umukono',
  'status.lease.active': 'Arakora',
  'status.lease.ending': 'Arangira',
  'status.lease.ended': 'Yarangiye',
  'status.lease.cancelled': 'Yahagaritswe',
  'status.rent.paid': 'Bwishyuwe',
  'status.rent.due': 'Bugomba kwishyurwa',
  'status.rent.overdue': 'Bwarengeje igihe',
  'status.caution.held': 'Ibitswe',
  'status.caution.refunded': 'Yasubijwe',
  'status.caution.forfeited': 'Yatakaye',
  'status.identity.verified': 'Byemejwe',
  'status.identity.unverified': 'Bitaremezwa',
  'status.filing.pending': 'Kohereza birategereje',
  'status.filing.filed': 'Byoherejwe',
  'status.filing.failed': 'Kohereza byanze',

  /* Payment lifecycle */
  'payment.paid': 'Bwishyuwe',
  'payment.cleared': 'Byemejwe',
  'payment.scheduled': 'Byateganyijwe',
  'payment.pending': 'Birategereje',
  'payment.due': 'Bigomba kwishyurwa',
  'payment.overdue': 'Byarengeje igihe',
  'payment.failed': 'Byanze',
  'payment.refunded': 'Byasubijwe',
  'payment.partial': 'Byishyuwe igice',

  /* Tax compliance */
  'tax.compliant': 'RRA byubahirijwe',
  'tax.due': 'RRA bigomba koherezwa',
  'tax.overdue': 'RRA byarengeje igihe',
  'tax.exempt': 'Bisonewe imisoro',

  /* Domains */
  'domain.hospitality': 'Ubukerarugendo',
  'domain.residence': 'Ubukode',

  /* Tab labels the prototype adds: the five tab sets of frames.md "Shell" */
  'nav.rentRoll': 'Ubukode bwose',
  'nav.repairs': 'Ibisanwa',
  'nav.placements': 'Abashyizwe',
  'nav.earnings': 'Ibyinjira',
  'nav.queue': 'Imirimo',
  'nav.rooms': 'Ibyumba',
  'nav.tickets': 'Ibisanwa',
  'nav.today': 'Uyu munsi',
  'nav.reservations': 'Ubwandikishe',

  /* What assistive tech hears on the shared kit */
  'a11y.dismiss': 'Kuraho',
  'a11y.photoOf': 'Ifoto ya {subject}',
  'a11y.pageOf': 'Ifoto {index} kuri {total}',
  'a11y.save': 'Bika iyi nzu',
  'a11y.unsave': 'Kura mu byabitswe',
  'a11y.stepOf': 'Intambwe {index} kuri {total}, {label}',
  'a11y.selected': 'Byatoranyijwe',
  'a11y.swipeRow': 'Sunika iburyo kugira {right}, ibumoso kugira {left}',
  'a11y.timer': '{label}, {time}',
  'a11y.pauseTimer': 'Hagarika igihe',
  'a11y.resumeTimer': 'Komeza igihe',
  'a11y.removePhoto': 'Kura ifoto {index}',
  'a11y.score': 'Amanota y\'abashyitsi {score} kuri 10, {word}',
  'a11y.openGallery': 'Fungura amafoto yose',

  /* States the shared kit renders */
  'state.offlineLastList': 'Twerekana urutonde rwa nyuma rwatangiye. Ruzivugurura ubwarwo umurandasi ugarutse.',
  'state.toastRegion': 'Ubutumwa',
  'state.undo': 'Isubireho',
  'state.emptyGoTo': 'Fungura {tab}',

  /* The registered-but-unbuilt stub. The frame and the session are printed so a reviewer can find both */
  'comingSoon.eyebrow': 'Icyitegererezo',
  'comingSoon.title': 'Ntibirakorwa',
  'comingSoon.body': 'Uru rupapuro rwarashushanyijwe nka {frame} mu cyitegererezo, rukazubakwa mu gice {session}. Aha handitswe kugira ngo urutonde rw\'amasakoshi ruzure kandi ukanda ntahagarare.',
  'comingSoon.bodyUndrawn': 'Icyitegererezo nticyashushanyije uru rupapuro. Ruzubakwa mu gice {session}, rutari mu byihutirwa, kandi aha handitswe kugira ngo ukanda ntahagarare.',
  'comingSoon.frame': 'Ishusho {frame}',
  'comingSoon.session': 'Igice {session}',
  'comingSoon.action': 'Subira ku ntangiriro',

  /* Photo credits. ADR-015 call 5: a stand-in photograph carries a VISIBLE credit where it appears */
  'photo.credit': '{author} - {licence}',
  'photo.standIn': 'Si iyi nzu',
  'photo.standInWhy': 'Ifoto yo mu Rwanda isimbura iy\'inzu tudafite amafoto yayo bwite.',
  'photo.creditsTitle': 'Aho amafoto avuye',
  'photo.creditsGreeting': 'Buri foto n\'aho yavuye',
  'photo.creditsIntro': 'Menshi muri aya ni amafoto y\'ibidukikije n\'imijyi yo mu Rwanda asimbura inzu tudafite amafoto yayo bwite. Iyo ari uko, ifoto ibivuga ku rupapuro iriho, atari hano gusa.',
  'photo.creditsListLabel': 'aho amafoto avuye',
  'photo.viewSource': 'Fungura aho yavuye',
  'photo.actualProperty': 'Yerekana iyi nzu',
  'photo.licence': 'Uruhushya',
  'photo.creditsEmptyTitle': 'Nta mafoto yo kwerekana',
  'photo.creditsEmptyBody': 'Iyi verisiyo nta foto isaba kwerekana aho yavuye ifite.',

  /* PhotoPicker, including the permission-denied state */
  'picker.addPhoto': 'Ongeraho ifoto',
  'picker.leadHint': 'Niyo ibanza ku kibazo',
  'picker.camera': 'Fata ifoto',
  'picker.library': 'Hitamo mu zabitswe',
  'picker.cancel': 'Reka',
  'picker.photoIndex': 'Ifoto {index}',
  'picker.cameraDeniedTitle': 'Kamera ntiyemewe',
  'picker.cameraDeniedBody': 'Injishi ikeneye kamera kugira ngo ishyire ifoto kuri iki kibazo. Yifungure muri Settings, cyangwa uhitemo mu zabitswe.',
  'picker.libraryDeniedTitle': 'Amafoto ntiyemewe',
  'picker.libraryDeniedBody': 'Injishi ikeneye amafoto yawe kugira ngo yomeke ishusho. Yifungure muri Settings, cyangwa ufate ifoto nshya.',
  'picker.openSettings': 'Fungura Settings',

  /* CalendarRange. Month and weekday names are data, not chrome, so they are keys like anything else */
  'calendar.m1': 'Mutarama',
  'calendar.m2': 'Gashyantare',
  'calendar.m3': 'Werurwe',
  'calendar.m4': 'Mata',
  'calendar.m5': 'Gicurasi',
  'calendar.m6': 'Kamena',
  'calendar.m7': 'Nyakanga',
  'calendar.m8': 'Kanama',
  'calendar.m9': 'Nzeri',
  'calendar.m10': 'Ukwakira',
  'calendar.m11': 'Ugushyingo',
  'calendar.m12': 'Ukuboza',
  'calendar.d0': 'Cyu',
  'calendar.d1': 'Mbe',
  'calendar.d2': 'Kab',
  'calendar.d3': 'Gat',
  'calendar.d4': 'Kan',
  'calendar.d5': 'Gtn',
  'calendar.d6': 'Gtd',
  'calendar.prevMonth': 'Ukwezi gushize',
  'calendar.nextMonth': 'Ukwezi gutaha',
  'calendar.checkIn': 'Kwinjira',
  'calendar.checkOut': 'Gusohoka',
  'calendar.pickStart': 'Hitamo umunsi wo kugera',
  'calendar.pickEnd': 'Hitamo umunsi wo kugenda',
  'calendar.nights': 'Amajoro {count}',
  'calendar.oneNight': 'Ijoro 1',
  'calendar.clear': 'Siba amatariki',
  'calendar.unavailable': 'Ntibiboneka',
  'calendar.dayAvailable': '{day}, biraboneka',
  'calendar.dayUnavailable': '{day}, ntibiboneka',
  'calendar.daySelected': '{day}, byatoranyijwe',

  /* The formSheet scaffold */
  'sheet.close': 'Funga iyi paji',

  /* Guest score bands (ADR-022). The word derives from the score, never stored beside it */
  'score.exceptional': 'Byiza cyane',
  'score.excellent': 'Byiza rwose',
  'score.veryGood': 'Byiza',
  'score.good': 'Bihagije',
  'score.pleasant': 'Bishimishije',

  /* Three status domains the prototype adds: task, housekeeping and ticket (frames.md "Interactive twin") */
  'status.task.pending': 'Bikeneye isuku',
  'status.task.in_progress': 'Biragenda',
  'status.task.done': 'Byarangiye',
  'status.task.inspected': 'Byagenzuwe',
  'status.task.blocked': 'Byahagaritswe',
  'status.housekeeping.clean': 'Gisukuye',
  'status.housekeeping.dirty': 'Cyanduye',
  'status.housekeeping.in_progress': 'Kiragenda',
  'status.housekeeping.inspected': 'Cyagenzuwe',
  'status.housekeeping.out_of_order': 'Ntigikoreshwa',
  'status.ticket.open': 'Gifunguye',
  'status.ticket.assigned': 'Cyahawe umuntu',
  'status.ticket.resolved': 'Cyakemuwe',
  'write.failedTitle': `${en['write.failedTitle']} (RW)`,
  'write.failedBody': `${en['write.failedBody']} (RW)`,
  'write.retry': `${en['write.retry']} (RW)`,
  'write.goBack': `${en['write.goBack']} (RW)`,
  'write.failedMoneyBody': `${en['write.failedMoneyBody']} (RW)`,
  'write.failedLegalBody': `${en['write.failedLegalBody']} (RW)`,
};
