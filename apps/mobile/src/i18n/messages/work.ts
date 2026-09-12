/**
 * `work` - the Housekeeping surface (frames W1 to W8).
 *
 * Session 10 adds here. Frame W8 draws the whole Queue screen in Kinyarwanda,
 * so the RW column for this namespace has real copy to start from rather than
 * a placeholder - use it, and keep the note that it still needs a native
 * review pass before it ships.
 *
 * **State of the RW column, written by Session 10.** Frame W8's own strings are
 * transcribed verbatim where the frame gives them: the title, the sync line,
 * the floor tabs, the task kinds, the row meta and the primary. Everything
 * short enough to translate confidently from the vocabulary already in
 * `common.ts` is translated. The long explanatory paragraphs - the reconnect
 * card, the "clean is not sellable" card, the compliance footnote, the empty
 * bodies - carry the English with a trailing ` (RW)`, which is this repo's
 * marker for "no Kinyarwanda yet". Session 11's audit and a native speaker
 * finish them; the report lists every one.
 *
 * The surface is read one-handed, gloved, standing in a corridor, so the copy
 * is short on purpose. RW runs longer than EN (ui-rules.md), and frame W8's own
 * note is the layout contract: rows grow, labels drop to 11px, buttons wrap,
 * nothing truncates.
 */

export const en = {
  /* Frame W1 / W2 / W8 - the queue */
  'work.queue.title': 'Queue',
  'work.queue.listLabel': 'your queue',
  'work.queue.syncOnline': 'Synced · {count} tasks · {time}',
  'work.queue.syncOffline': 'Offline · {count} saved on this phone',
  'work.queue.tabAll': 'All',
  'work.queue.tabFloor': 'Floor {floor}',
  'work.queue.sectionFloor': 'Floor {floor}',
  'work.queue.sectionDone': 'Finished this shift',
  'work.queue.sectionQueued': 'Done — waiting to sync',
  'work.queue.sectionTodo': 'Still to do',
  'work.queue.takeNext': 'Take next task',
  'work.queue.nothingPending': 'Nothing pending',
  'work.queue.takeNextHint': 'Starts the next room waiting and opens it',
  'work.queue.caughtUpToast': 'Nothing pending — you are caught up',
  'work.queue.emptyTitle': 'All caught up',
  'work.queue.emptyAll':
    'No rooms waiting. New checkouts land here the second the desk taps Check out.',
  'work.queue.emptyFloor': 'Nothing waiting on floor {floor}. Try All.',
  'work.queue.openTask': 'Room {room}, {type}, {task}',
  'work.queue.metaGuest': 'Guest {time}',
  'work.queue.metaPending': 'Pending · {time}',
  'work.queue.metaHighPriority': 'High priority',
  'work.queue.metaBlocked': 'Blocked · {ref}',
  'work.queue.doneQueued': 'Done · Queued',
  'work.queue.doneSynced': 'Done · Synced',
  'work.queue.swipeStart': 'Start',
  'work.queue.swipeBlock': 'Block',
  'work.queue.arrivalTitle': 'Room {room} just checked out',
  'work.queue.arrivalAgoSeconds': 'Added to your queue {seconds}s ago',
  'work.queue.arrivalAgoMinutes': 'Added to your queue {minutes} min ago',
  'work.queue.arrivalOpen': 'Open room {room}',
  'work.queue.arrivalToast': 'Room {room} checked out — task added live',
  'work.queue.inspectionTitle': '{count} rooms marked done, waiting on you',
  'work.queue.inspectionOne': '1 room marked done, waiting on you',
  'work.queue.inspectionOpen': 'Inspect',

  /* F-P04 task_type */
  'work.kind.checkoutClean': 'Checkout clean',
  'work.kind.stayoverClean': 'Stayover clean',
  'work.kind.turndown': 'Turndown',
  'work.kind.deepClean': 'Deep clean',

  /* Frame W2 - offline, and the Account switch that fakes it */
  'work.offline.bannerTitle': 'No signal — working offline',
  'work.offline.bannerCount': '{count} changes waiting to sync',
  'work.offline.bannerCountOne': '1 change waiting to sync',
  'work.offline.bannerNone': 'Nothing waiting yet',
  'work.offline.connected': 'Connected · nothing waiting',
  'work.offline.reconnect': 'Reconnect',
  'work.offline.cardTitle': 'What happens on reconnect',
  'work.offline.cardBody':
    'Your {count} changes replay in order with their idempotency keys, so nothing double-posts. The rooms you finished turn green on the front desk grid. If the desk changed a room while you were dark, you get one conflict card — never a silent overwrite.',
  'work.offline.cardBodyEmpty':
    'Nothing is waiting. A room you finish without signal is saved here with its idempotency key, replays in order when you reconnect, and cannot double-post.',
  'work.offline.replayTitle': 'Waiting to replay, in order',
  'work.offline.queuedRoom': 'Room {room} · {what}',
  'work.offline.changeClean': 'marked clean',
  'work.offline.changeStarted': 'started',
  'work.offline.changeBlocked': 'blocked',
  'work.offline.changeStatus': 'status set',
  'work.offline.changeTicket': 'fault filed',
  'work.offline.syncedToast': '{count} changes synced, in order, no duplicates',
  'work.offline.syncedToastOne': '1 change synced, in order, no duplicates',
  'work.offline.backOnlineToast': 'Back online',
  'work.offline.lostToast': 'Signal lost — your work is saved on this phone',
  'work.offline.savedToast': 'Saved on this phone — will sync when you have signal',
  'work.offline.title': 'Connection',
  'work.offline.simulateLabel': 'Simulate no signal',
  'work.offline.simulateHint':
    'Drops this phone off the network so you can walk the corridor case. Your real connection still counts: lose signal for real and the same banner appears.',
  'work.offline.realOffline': 'This phone has no connection right now.',

  /* Frame W3 - task detail */
  'work.task.eyebrow': 'Floor {floor} · {type}',
  'work.task.back': 'Queue',
  'work.task.stepPending': 'Pending',
  'work.task.stepProgress': 'In progress',
  'work.task.stepDone': 'Done',
  'work.task.elapsed': 'Elapsed',
  'work.task.startedAt': 'Started {time} · your average is {minutes} min',
  'work.task.notStarted': 'Not started · your average is {minutes} min',
  'work.task.notesTitle': 'Notes from the desk',
  'work.task.noNotes': 'The desk left no note on this room.',
  'work.task.start': 'Start cleaning',
  'work.task.markDone': 'Mark done',
  'work.task.blocked': 'Blocked — waiting on Maintenance',
  'work.task.doneWaiting': 'Done — waiting on sign-off',
  'work.task.blockedTitle': 'This room is blocked',
  'work.task.blockedBody':
    'Ticket {ref} is open. The room is out of order and the front desk cannot sell it.',
  'work.task.reportFault': 'Report a fault',
  'work.task.requestCheck': 'Request check',
  'work.task.startedToast': 'Room {room} started',
  'work.task.cleanToast': 'Room {room} is clean — the front desk sees it live',
  'work.task.checkToast':
    'Sent to {name} for sign-off — desk stays blocked until it passes',
  'work.task.consequenceDone': 'Marking done releases {room} to the front desk.',
  'work.task.notFoundTitle': 'This task is not on your queue',
  'work.task.notFoundBody':
    'It was finished, signed off, or it belongs to another attendant. The queue below is yours.',
  'work.task.backToQueue': 'Back to the queue',

  /* Frame W4 - the floor board */
  'work.rooms.title': 'Rooms',
  'work.rooms.listLabel': 'the floor board',
  'work.rooms.eyebrow': '{count} rooms',
  'work.rooms.filterAll': 'All',
  'work.rooms.tileYou': '· you',
  'work.rooms.infoTitle': 'Clean is not the same as sellable',
  'work.rooms.infoBody':
    'Housekeeping status is its own axis. A room can be spotless and still be out of service — Maintenance owns that call and a ticket holds it. You will never see a room here that the front desk can quietly re-sell behind your back.',
  'work.rooms.open': 'Room {room}, {type}, {status}',
  'work.rooms.openHint': 'Opens the housekeeping status sheet',
  'work.rooms.emptyTitle': 'Nothing in this state',
  'work.rooms.emptyBody': 'No room on this board is {status} right now. Try All.',
  'work.rooms.sheetTitle': 'Set housekeeping status',
  'work.rooms.sheetSubtitle': 'Room {room} · {type} · Floor {floor}',
  'work.rooms.reportIssue': 'Report an issue in this room',
  'work.rooms.setToast': 'Room {room} · {status}',
  'work.rooms.now': 'Now',
  'work.rooms.notFoundTitle': 'That room is not on this board',
  'work.rooms.notFoundBody': 'It may be on another floor. Go back and pick a tile.',

  /* The Tickets tab - F-P05 from the reporter's side */
  'work.tickets.title': 'Tickets',
  'work.tickets.listLabel': 'your tickets',
  'work.tickets.subtitle': 'Faults you sent to Engineering',
  'work.tickets.emptyTitle': 'Nothing broken',
  'work.tickets.emptyBody':
    'No fault has been reported from this phone. File one and it lands on the Engineering board, and stays here until they close it.',
  'work.tickets.report': 'Report a fault',
  'work.tickets.explainTitle': 'What filing a fault does',
  'work.tickets.explainBody':
    'The ticket goes to Engineering with your photo. The room goes out of order, its cleaning task blocks, and the front desk cannot sell it until Maintenance closes the ticket.',
  'work.tickets.room': 'Room {room}',
  'work.tickets.filed': 'Filed {age}',
  'work.tickets.justNow': 'just now',
  'work.tickets.minutesAgo': '{minutes} min ago',
  'work.tickets.hoursAgo': '{hours} h ago',
  'work.tickets.photos': '{count} photos',
  'work.tickets.photosOne': '1 photo',
  'work.tickets.noPhoto': 'No photo',
  'work.tickets.card': 'Ticket {ref}, room {room}, {status}',
  'work.tickets.blocks': 'Room out of order · task blocked',

  /* Frame W6 - what is wrong, and how bad */
  'work.fault.electrical': 'Electrical',
  'work.fault.plumbing': 'Plumbing',
  'work.fault.furniture': 'Furniture',
  'work.fault.other': 'Other',
  'work.severity.low': 'Low',
  'work.severity.normal': 'Normal',
  'work.severity.high': 'High',
  'work.severity.urgent': 'Urgent',

  /* Frame W6 - report a fault */
  'work.report.title': 'Report a fault',
  'work.report.eyebrow': 'Goes to Maintenance',
  'work.report.photoLegend': 'Photo',
  'work.report.roomLegend': 'Room',
  'work.report.faultLegend': 'What is wrong',
  'work.report.severityLegend': 'How bad',
  'work.report.lineLegend': 'One line',
  'work.report.linePlaceholder': 'Bedside lamp does not switch on',
  'work.report.lineHint': 'One line is enough. The photo does the rest.',
  'work.report.send': 'Send to Maintenance',
  'work.report.needBoth': 'Pick a fault and severity',
  'work.report.consequence': 'Room {room} goes out of order · its task blocks',
  'work.report.consequenceNoTask': 'Room {room} goes out of order',
  'work.report.filedToast': '{ref} filed · room {room} out of order, task blocked',
  'work.report.cancel': 'Not now',
  'work.report.roomHint': 'The room you are standing in',
  'work.report.roomOption': 'Room {room}',

  /* Frame W5 - inspection */
  'work.inspection.title': 'Inspection',
  'work.inspection.listLabel': 'rooms awaiting sign-off',
  'work.inspection.eyebrow': '{name} · Housekeeping supervisor',
  'work.inspection.lead': '{count} rooms marked done, waiting on you.',
  'work.inspection.leadOne': '1 room marked done, waiting on you.',
  'work.inspection.doneAt': 'Done {time} · {minutes} min',
  'work.inspection.pass': 'Pass',
  'work.inspection.fail': 'Fail',
  'work.inspection.blockNote': 'Front desk cannot re-sell {room} until this passes.',
  'work.inspection.passToast': 'Room {room} inspected — the front desk can sell it',
  'work.inspection.failTitle': 'Send {room} back',
  'work.inspection.failBody':
    '{name} gets the room again with your reason. The task returns to pending; the desk stays blocked.',
  'work.inspection.failLegend': 'What failed',
  'work.inspection.failReturn': 'Return to {name}',
  'work.inspection.failNeedReason': 'Pick at least one reason',
  'work.inspection.failToast': 'Room {room} returned to {name}',
  'work.inspection.footnote':
    'Where inspection is required, done is not sellable — only inspected is. You cannot sign off a room you cleaned yourself, so your own finished rooms go to another supervisor.',
  'work.inspection.emptyTitle': 'Nothing waiting on you',
  'work.inspection.emptyBody':
    'Every room marked done today has been signed off. New ones appear here the moment an attendant finishes.',
  'work.reason.bathroom': 'Bathroom',
  'work.reason.linen': 'Linen',
  'work.reason.dusting': 'Dusting',
  'work.reason.bin': 'Bin not emptied',

  /* Frame W7 - the shift summary, on the Work Account section */
  'work.shift.eyebrow': '{name} · {start} – {end}',
  'work.shift.title': 'Your shift',
  'work.shift.cleaned': 'Rooms cleaned',
  'work.shift.average': 'Average per room',
  'work.shift.left': 'Tasks left',
  'work.shift.minutes': 'min',
  'work.shift.finishedTitle': 'Rooms you finished',
  'work.shift.footnote':
    'Only you and your supervisor see this. It is not ranked against anyone.',
  'work.shift.noneYet': 'Nothing finished yet this shift.',

  /* --------------------- the Work surface's failures (gaps.md §5.3) ------- */
  // Three P1s on this surface were the same hole: `task/[taskId]`,
  // `room-status` and `report-fault` all wrote and then reported success
  // whether or not the write landed. On a surface used gloved and standing,
  // "did that go through" is a question somebody has to answer by walking back
  // to the room.
  'work.writeFailedTitle': 'That did not save',
  'work.writeFailedBody': 'The room is unchanged and nobody has been told. Try again.',
  'work.faultFailedTitle': 'The fault was not filed',
  'work.faultFailedBody': 'Nothing was sent and no ticket was opened. Try again — your photos and notes are still here.',
  // The queue tab's own accessibility. gaps.md: "a11y=0 on the home screen of a
  // gloved, one-handed surface", which is the surface where a screen reader and
  // a large target matter most.
  'work.queue.a11yList': '{count} rooms on your list, {done} done',
  'work.queue.a11yHeader': 'Your queue for this shift',
  'work.queue.a11yProgress': '{done} of {total} rooms finished',
} as const;

/**
 * Parity is a type error here, not a review note: `rw` is keyed off this
 * file's own `en`, so a key added to one and not the other fails `tsc` in
 * this file rather than in the merge.
 */
/**
 * **Session 11's Kinyarwanda audit translated the twelve ` (RW)` placeholders
 * in this block.** They were the surface's long consequence sentences — the
 * offline replay explanation, the "done is not sellable" rule, the fault
 * ticket's effect — which is why they were the ones left: they are the strings
 * where a wrong word changes what an attendant believes will happen.
 *
 * They are working translation for layout and they want a native review pass
 * more than anything else in the catalogue does. Frame W8's contract holds:
 * these run longer than the English, and nothing may truncate.
 */
export const rw: Record<keyof typeof en, string> = {
  /* Frame W8 gives this screen verbatim */
  'work.queue.title': 'Imirimo',
  'work.queue.listLabel': 'imirimo yawe',
  'work.queue.syncOnline': 'Byahujwe · Imirimo {count} · {time}',
  'work.queue.syncOffline': 'Nta murandasi · {count} byabitswe kuri iyi telefone',
  'work.queue.tabAll': 'Byose',
  'work.queue.tabFloor': 'Igorofa {floor}',
  'work.queue.sectionFloor': 'Igorofa {floor}',
  'work.queue.sectionDone': 'Byarangiye kuri iyi shifti',
  'work.queue.sectionQueued': 'Byarangiye — bitegereje guhuzwa',
  'work.queue.sectionTodo': 'Bisigaye gukorwa',
  'work.queue.takeNext': 'Fata umurimo ukurikira',
  'work.queue.nothingPending': 'Nta murimo usigaye',
  'work.queue.takeNextHint': 'Itangira icyumba gikurikira kandi ikagifungura',
  'work.queue.caughtUpToast': 'Nta murimo usigaye — wabikoze byose',
  'work.queue.emptyTitle': 'Byose byarangiye',
  'work.queue.emptyAll':
    'Nta cyumba gitegereje. Ibyumba bishya bigaragara hano ako kanya ibiro bikanze Gusohoka.',
  'work.queue.emptyFloor': 'Nta kintu gitegereje ku gorofa {floor}. Gerageza Byose.',
  'work.queue.openTask': 'Icyumba {room}, {type}, {task}',
  'work.queue.metaGuest': 'Umushyitsi {time}',
  'work.queue.metaPending': 'Bitegereje · {time}',
  'work.queue.metaHighPriority': 'Byihutirwa',
  'work.queue.metaBlocked': 'Byahagaritswe · {ref}',
  'work.queue.doneQueued': 'Byarangiye · Bitegereje',
  'work.queue.doneSynced': 'Byarangiye · Byahujwe',
  'work.queue.swipeStart': 'Tangira',
  'work.queue.swipeBlock': 'Hagarika',
  'work.queue.arrivalTitle': 'Icyumba {room} cyasohotse',
  'work.queue.arrivalAgoSeconds': 'Cyongewe ku rutonde hashize amasegonda {seconds}',
  'work.queue.arrivalAgoMinutes': 'Cyongewe ku rutonde hashize iminota {minutes}',
  'work.queue.arrivalOpen': 'Fungura icyumba {room}',
  'work.queue.arrivalToast': 'Icyumba {room} cyasohotse — umurimo wongewe ako kanya',
  'work.queue.inspectionTitle': 'Ibyumba {count} byaranzwe nk’ibyarangiye, bitegereje wowe',
  'work.queue.inspectionOne': 'Icyumba 1 cyaranzwe nk’icyarangiye, gitegereje wowe',
  'work.queue.inspectionOpen': 'Genzura',

  'work.kind.checkoutClean': 'Isuku yo gusohoka',
  'work.kind.stayoverClean': 'Isuku y’uri mu cyumba',
  'work.kind.turndown': 'Gutegura igitanda',
  'work.kind.deepClean': 'Isuku yimbitse',

  'work.offline.bannerTitle': 'Nta murandasi — urakora utawufite',
  'work.offline.bannerCount': 'Impinduka {count} zitegereje guhuzwa',
  'work.offline.bannerCountOne': 'Impinduka 1 itegereje guhuzwa',
  'work.offline.bannerNone': 'Nta kintu gitegereje',
  'work.offline.connected': 'Uhujwe · nta kintu gitegereje',
  'work.offline.reconnect': 'Ongera uhuze',
  'work.offline.cardTitle': 'Ibiba iyo wongeye guhuza',
  'work.offline.cardBody':
    'Impinduka zawe {count} zisubirwamo ku murongo hamwe n’ibimenyetso byazo, bityo nta na kimwe cyandikwa kabiri. Ibyumba wasoje bihinduka icyatsi ku rutonde rw’ibiro. Niba ibiro byahinduye icyumba wari uri hanze y’umuyoboro, uhabwa ikarita imwe y’impaka — nta na rimwe bisimburwa mu ibanga.',
  'work.offline.cardBodyEmpty':
    'Nta kintu gitegereje. Icyumba usoje udafite umuyoboro kibikwa hano n’ikimenyetso cyacyo, kikisubiramo ku murongo iyo wongeye guhuza, kandi ntikishobora kwandikwa kabiri.',
  'work.offline.replayTitle': 'Bitegereje kongera koherezwa, ku murongo',
  'work.offline.queuedRoom': 'Icyumba {room} · {what}',
  'work.offline.changeClean': 'cyaranzwe nk’igisukuye',
  'work.offline.changeStarted': 'cyatangijwe',
  'work.offline.changeBlocked': 'cyahagaritswe',
  'work.offline.changeStatus': 'imiterere yahinduwe',
  'work.offline.changeTicket': 'ikibazo cyatanzwe',
  'work.offline.syncedToast': 'Impinduka {count} zahujwe ku murongo, nta gusubiramo',
  'work.offline.syncedToastOne': 'Impinduka 1 yahujwe ku murongo, nta gusubiramo',
  'work.offline.backOnlineToast': 'Wongeye guhuzwa',
  'work.offline.lostToast': 'Umurandasi wagiye — akazi kawe kabitswe kuri iyi telefone',
  'work.offline.savedToast':
    'Byabitswe kuri iyi telefone — bizahuzwa umurandasi ugarutse',
  'work.offline.title': 'Umurandasi',
  'work.offline.simulateLabel': 'Igerageze nk’aho nta murandasi uhari',
  'work.offline.simulateHint':
    'Bikura iyi telefoni ku muyoboro kugira ngo ugerageze uko bigenda mu nzira. Umuyoboro wawe nyawo uracyabarwa: ubuze umuyoboro by’ukuri, ubu butumwa bumwe buragaragara.',
  'work.offline.realOffline': 'Iyi telefone nta murandasi ifite ubu.',

  'work.task.eyebrow': 'Igorofa {floor} · {type}',
  'work.task.back': 'Imirimo',
  'work.task.stepPending': 'Bitegereje',
  'work.task.stepProgress': 'Biragenda',
  'work.task.stepDone': 'Byarangiye',
  'work.task.elapsed': 'Igihe cyakoreshejwe',
  'work.task.startedAt': 'Byatangiye {time} · impuzandengo yawe ni iminota {minutes}',
  'work.task.notStarted': 'Ntibiratangira · impuzandengo yawe ni iminota {minutes}',
  'work.task.notesTitle': 'Amakuru avuye ku kakiriro',
  'work.task.noNotes': 'Akakiriro nta kintu kanditse kuri iki cyumba.',
  'work.task.start': 'Tangira gusukura',
  'work.task.markDone': 'Menyesha ko byarangiye',
  'work.task.blocked': 'Byahagaritswe — bitegereje abakora ibisanwa',
  'work.task.doneWaiting': 'Byarangiye — bitegereje kwemezwa',
  'work.task.blockedTitle': 'Iki cyumba cyahagaritswe',
  'work.task.blockedBody':
    'Ikibazo {ref} kiracyafunguye. Icyumba ntigikoreshwa kandi akakiriro ntigashobora kukigurisha.',
  'work.task.reportFault': 'Tanga ikibazo',
  'work.task.requestCheck': 'Saba kugenzurwa',
  'work.task.startedToast': 'Icyumba {room} cyatangiye',
  'work.task.cleanToast': 'Icyumba {room} gisukuye — akakiriro karabibona ako kanya',
  'work.task.checkToast':
    'Byoherejwe kuri {name} ngo byemezwe — akakiriro kagumye gahagaze kugeza binyuze',
  'work.task.consequenceDone': 'Kwemeza ko byarangiye bituma {room} kigera ku kakiriro.',
  'work.task.notFoundTitle': 'Uyu murimo ntabwo uri ku rutonde rwawe',
  'work.task.notFoundBody':
    'Cyararangiye, cyaremejwe, cyangwa ni icy’undi mukozi. Urutonde rwo hasi ni urwawe.',
  'work.task.backToQueue': 'Subira ku rutonde',

  'work.rooms.title': 'Ibyumba',
  'work.rooms.listLabel': 'urutonde rw’ibyumba',
  'work.rooms.eyebrow': 'ibyumba {count}',
  'work.rooms.filterAll': 'Byose',
  'work.rooms.tileYou': '· wowe',
  'work.rooms.infoTitle': 'Gisukuye ntibisobanura ko gishobora kugurishwa',
  'work.rooms.infoBody':
    'Uko isuku ihagaze ni ikintu cyihariye. Icyumba gishobora kuba gisukuye cyane ariko kikaba kidakoreshwa — ibyo bikemurwa n’Ubusanigore kandi bifashwe n’ikibazo cyanditswe. Ntuzabona hano icyumba ibiro bishobora kongera kugurisha mu ibanga.',
  'work.rooms.open': 'Icyumba {room}, {type}, {status}',
  'work.rooms.openHint': 'Bifungura urupapuro rwo guhindura imiterere y’isuku',
  'work.rooms.emptyTitle': 'Nta kintu kiri muri iyi miterere',
  'work.rooms.emptyBody': 'Nta cyumba kiri kuri uru rutonde ari {status} ubu. Gerageza Byose.',
  'work.rooms.sheetTitle': 'Shyiraho imiterere y’isuku',
  'work.rooms.sheetSubtitle': 'Icyumba {room} · {type} · Igorofa {floor}',
  'work.rooms.reportIssue': 'Tanga ikibazo cyo muri iki cyumba',
  'work.rooms.setToast': 'Icyumba {room} · {status}',
  'work.rooms.now': 'Ubu',
  'work.rooms.notFoundTitle': 'Icyo cyumba nticyari kuri uru rutonde',
  'work.rooms.notFoundBody': 'Gishobora kuba kiri ku yindi gorofa. Subira inyuma uhitemo ikindi.',

  'work.tickets.title': 'Ibibazo',
  'work.tickets.listLabel': 'ibibazo byawe',
  'work.tickets.subtitle': 'Ibibazo woherereje abakora ibisanwa',
  'work.tickets.emptyTitle': 'Nta kintu cyangiritse',
  'work.tickets.emptyBody':
    'Nta kibazo cyatanzwe kuri iyi telefoni. Tanga kimwe kigere ku rutonde rw’Abatekinisiye, kandi kigume hano kugeza bagifunze.',
  'work.tickets.report': 'Tanga ikibazo',
  'work.tickets.explainTitle': 'Icyo gutanga ikibazo gikora',
  'work.tickets.explainBody':
    'Ikibazo kijya ku Batekinisiye n’ifoto yawe. Icyumba kiba kidakoreshwa, umurimo wo kugisukura urahagarara, kandi ibiro ntibishobora kukigurisha kugeza Ubusanigore bufunze ikibazo.',
  'work.tickets.room': 'Icyumba {room}',
  'work.tickets.filed': 'Cyatanzwe {age}',
  'work.tickets.justNow': 'nonaha',
  'work.tickets.minutesAgo': 'hashize iminota {minutes}',
  'work.tickets.hoursAgo': 'hashize amasaha {hours}',
  'work.tickets.photos': 'amafoto {count}',
  'work.tickets.photosOne': 'ifoto 1',
  'work.tickets.noPhoto': 'Nta foto',
  'work.tickets.card': 'Ikibazo {ref}, icyumba {room}, {status}',
  'work.tickets.blocks': 'Icyumba ntigikoreshwa · umurimo wahagaritswe',

  'work.fault.electrical': 'Amashanyarazi',
  'work.fault.plumbing': 'Amazi',
  'work.fault.furniture': 'Ibikoresho',
  'work.fault.other': 'Ibindi',
  'work.severity.low': 'Bike',
  'work.severity.normal': 'Bisanzwe',
  'work.severity.high': 'Byinshi',
  'work.severity.urgent': 'Byihutirwa',

  'work.report.title': 'Tanga ikibazo',
  'work.report.eyebrow': 'Bijya ku bakora ibisanwa',
  'work.report.photoLegend': 'Ifoto',
  'work.report.roomLegend': 'Icyumba',
  'work.report.faultLegend': 'Ikitagenda neza',
  'work.report.severityLegend': 'Uko bikomeye',
  'work.report.lineLegend': 'Umurongo umwe',
  'work.report.linePlaceholder': 'Itara ryo ku gitanda ntiryaka',
  'work.report.lineHint': 'Umurongo umwe urahagije. Ifoto ivuga ibisigaye.',
  'work.report.send': 'Ohereza ku bakora ibisanwa',
  'work.report.needBoth': 'Hitamo ikibazo n’uko gikomeye',
  'work.report.consequence':
    'Icyumba {room} ntikizakoreshwa · umurimo wacyo urahagarara',
  'work.report.consequenceNoTask': 'Icyumba {room} ntikizakoreshwa',
  'work.report.filedToast':
    '{ref} cyatanzwe · icyumba {room} ntigikoreshwa, umurimo wahagaritswe',
  'work.report.cancel': 'Ubu oya',
  'work.report.roomHint': 'Icyumba urimo ubu',
  'work.report.roomOption': 'Icyumba {room}',

  'work.inspection.title': 'Igenzura',
  'work.inspection.listLabel': 'ibyumba bitegereje kwemezwa',
  'work.inspection.eyebrow': '{name} · Ushinzwe isuku',
  'work.inspection.lead': 'Ibyumba {count} byaranzwe nk’ibyarangiye, bitegereje wowe.',
  'work.inspection.leadOne': 'Icyumba 1 cyaranzwe nk’icyarangiye, gitegereje wowe.',
  'work.inspection.doneAt': 'Byarangiye {time} · iminota {minutes}',
  'work.inspection.pass': 'Byemewe',
  'work.inspection.fail': 'Byanzwe',
  'work.inspection.blockNote':
    'Akakiriro ntigashobora kongera kugurisha {room} kugeza ibi byemewe.',
  'work.inspection.passToast': 'Icyumba {room} cyagenzuwe — akakiriro gashobora kukigurisha',
  'work.inspection.failTitle': 'Subiza icyumba {room}',
  'work.inspection.failBody':
    '{name} yongera guhabwa icyumba n’impamvu yawe. Umurimo usubira mu bitegereje; ibiro bigumana ko kidakoreshwa.',
  'work.inspection.failLegend': 'Ikitagenze neza',
  'work.inspection.failReturn': 'Subiza kuri {name}',
  'work.inspection.failNeedReason': 'Hitamo nibura impamvu imwe',
  'work.inspection.failToast': 'Icyumba {room} cyasubijwe kuri {name}',
  'work.inspection.footnote':
    'Aho isuzuma risabwa, kurangiza ntibihagije ngo icyumba kigurishwe — ni ugusuzumwa gusa. Ntushobora kwemeza icyumba wasukuye ubwawe, bityo ibyumba wasoje bijya ku wundi mugenzuzi.',
  'work.inspection.emptyTitle': 'Nta kintu gitegereje wowe',
  'work.inspection.emptyBody':
    'Buri cyumba cyaranzwe nk’ikirangiye uyu munsi cyaremejwe. Ibishya bigaragara hano ako kanya umukozi arangije.',
  'work.reason.bathroom': 'Ubwiherero',
  'work.reason.linen': 'Impuzu z’igitanda',
  'work.reason.dusting': 'Guhanagura umukungugu',
  'work.reason.bin': 'Agatebo katamenwe',

  'work.shift.eyebrow': '{name} · {start} – {end}',
  'work.shift.title': 'Shifti yawe',
  'work.shift.cleaned': 'Ibyumba wasukuye',
  'work.shift.average': 'Impuzandengo ku cyumba',
  'work.shift.left': 'Imirimo isigaye',
  'work.shift.minutes': 'iminota',
  'work.shift.finishedTitle': 'Ibyumba warangije',
  'work.shift.footnote':
    'Ni wowe n’umugenzuzi wawe gusa mubibona. Ntibigereranywa n’undi muntu.',
  'work.shift.noneYet': 'Nta kintu kirarangira kuri iyi shifti.',
  'work.writeFailedTitle': `${en['work.writeFailedTitle']} (RW)`,
  'work.writeFailedBody': `${en['work.writeFailedBody']} (RW)`,
  'work.faultFailedTitle': `${en['work.faultFailedTitle']} (RW)`,
  'work.faultFailedBody': `${en['work.faultFailedBody']} (RW)`,
  'work.queue.a11yList': `${en['work.queue.a11yList']} (RW)`,
  'work.queue.a11yHeader': `${en['work.queue.a11yHeader']} (RW)`,
  'work.queue.a11yProgress': `${en['work.queue.a11yProgress']} (RW)`,
};
