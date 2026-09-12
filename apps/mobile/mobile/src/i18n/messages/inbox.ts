/**
 * `inbox` - the Inbox tab and the thread screen. Session 6 owns this file.
 *
 * The keys are still prefixed `messages.` because the screen they belong to
 * was called Messages before decision D3 renamed the TAB to Inbox. The tab
 * label moved (`nav.inbox` in `common`); these did not, because renaming six
 * screen keys buys nothing a reader can see. Session 6 kept them and added
 * `inbox.*` for what the segmented tab and the notification half needed, which
 * is the honest split: `messages.*` is the conversation, `inbox.*` is the
 * container that now holds two of them.
 *
 * **The redaction placeholder is UI copy on purpose.** ADR-032 specifies
 * `scrub.ts` as a pure function and says nothing about what a hidden number
 * looks like to a reader, so `inbox.redacted` lives here where it can be
 * translated, rather than being baked into `src/data/scrub.ts` as a magic
 * string the API would have to match character for character.
 */

export const en = {
  'messages.greeting': 'You and the property',
  'messages.title': 'Messages',
  'messages.emptyTitle': 'No conversations yet',
  'messages.emptyBody':
    'Messaging opens once you have a booking. Book a stay and you can ask the property anything.',
  'messages.emptyAction': 'Find a stay',
  'messages.listLabel': 'your conversations',

  /* The tab, and its two halves */
  'inbox.title': 'Inbox',
  'inbox.greetingGuest': 'You and the property',
  'inbox.greetingTenant': 'You and your landlord',
  'inbox.tabMessages': 'Messages',
  'inbox.tabNotifications': 'Notifications',
  'inbox.segmentLabel': 'Messages or notifications',
  'inbox.badgeLabel': '{count} unread',

  /* Thread rows */
  'inbox.unreadDot': 'Unread',
  'inbox.rowLabel': '{name}, {preview}, {time}',
  'inbox.rowLabelUnread': '{name}, {preview}, {time}, unread',
  'inbox.youPrefix': 'You: ',
  'inbox.archivedTag': 'Closed',

  /* The tenant half of the empty state: a lease, not a booking, opens it */
  'inbox.emptyTenantTitle': 'No conversations yet',
  'inbox.emptyTenantBody':
    'A conversation opens with each lease, so you can reach your landlord without swapping phone numbers.',
  'inbox.emptyTenantAction': 'Go to your leases',

  /* Notifications */
  'inbox.notificationsListLabel': 'your notifications',
  'inbox.emptyNotificationsTitle': 'Nothing to catch up on',
  'inbox.emptyNotificationsBody':
    'Receipts, confirmations and repair updates land here. Nothing is waiting for you right now.',
  'inbox.notificationLabel': '{title}, {body}, {time}',
  'inbox.notificationLabelUnread': '{title}, {body}, {time}, unread',
  'inbox.markedRead': 'Marked as read',

  /* Notification types. The word beside the glyph, so colour is never alone. */
  'inbox.type.bookingConfirmed': 'Booking confirmed',
  'inbox.type.bookingRequest': 'Booking request',
  'inbox.type.stayReminder': 'Your stay',
  'inbox.type.reviewInvite': 'Review',
  'inbox.type.rentReceipt': 'Receipt',
  'inbox.type.rentDue': 'Rent due',
  'inbox.type.ticketProgress': 'Maintenance',
  'inbox.type.leaseSignature': 'Lease',

  /* Relative time, as a thread row and a notification row print it */
  'inbox.timeNow': 'now',
  'inbox.timeMinutes': '{minutes}m',
  'inbox.timeHours': '{hours}h',
  'inbox.timeDays': '{days}d',
  'inbox.timeWeeks': '{weeks}w',

  /* Day separators in a conversation */
  'inbox.dayToday': 'Today',
  'inbox.dayYesterday': 'Yesterday',

  /* The thread screen */
  'inbox.threadLabel': 'the conversation',
  'inbox.threadSubtitleBooking': 'About your booking',
  'inbox.threadSubtitleLease': 'About your lease',
  'inbox.threadStartTitle': 'No messages yet',
  'inbox.threadStartBody': 'Ask anything about your stay. The property answers here.',
  'inbox.threadStartBodyLease': 'Ask anything about the flat. Your landlord answers here.',
  'inbox.notFoundTitle': 'That conversation is not yours',
  'inbox.notFoundBody':
    'It may have been closed, or it belongs to someone else. Your own conversations are in the Inbox.',
  'inbox.notFoundAction': 'Back to Inbox',
  'inbox.sentByYou': 'You',
  'inbox.sending': 'Sending',
  'inbox.sendFailed': 'That message did not send. Tap to try again.',

  /* The composer */
  'inbox.composerPlaceholder': 'Write a message',
  'inbox.composerLabel': 'Your message',
  'inbox.send': 'Send',
  'inbox.sendLabel': 'Send the message',

  /* Archived: the ADR's copy, and the reason under it */
  'inbox.archivedStay': 'This conversation is closed because the stay has ended.',
  'inbox.archivedLease': 'This conversation is closed because the lease has ended.',
  'inbox.archivedKept': 'Everything said here is kept, and stays readable.',
  'inbox.archivedRefused': 'This conversation is closed. Nothing new can be sent.',

  /* Redaction (F-S06, AC-18) */
  'inbox.redacted': 'number hidden',
  'inbox.redactedNote':
    'Phone numbers are hidden so a conversation stays on Injishi, where it is on the record.',
  'inbox.redactedA11y': 'a phone number, hidden',

  /* ------------------- delivery, the three states (gaps.md B4) ------------ */
  // `benchmarks.md` §5: "Show it queued, then sent, then failed-with-retry."
  // `queued` is not a failure and must not read as one — it is a message the
  // app is holding because there is no signal, and it will go.
  'inbox.queued': 'Waiting for signal',
  'inbox.failed': 'Not sent',
  'inbox.retrySend': 'Try again',
  'inbox.discardSend': 'Discard',
  'inbox.failedA11y': 'This message was not sent. Try again, or discard it.',
} as const;

/**
 * Parity is a type error here, not a review note: `rw` is keyed off this
 * file's own `en`, so a key added to one and not the other fails `tsc` in
 * this file rather than in the merge.
 */
export const rw: Record<keyof typeof en, string> = {
  'messages.greeting': 'Wowe n’aho uraramo',
  'messages.title': 'Ubutumwa',
  'messages.emptyTitle': 'Nta kiganiro kirahaba',
  'messages.emptyBody':
    'Ubutumwa butangira umaze kwandika aho uraramo. Andika, ubone uko ubaza aho uraramo icyo ushaka cyose.',
  'messages.emptyAction': 'Shaka aho kuraramo',
  'messages.listLabel': 'ibiganiro byawe',

  'inbox.title': 'Agasanduku',
  'inbox.greetingGuest': 'Wowe n’aho uraramo',
  'inbox.greetingTenant': 'Wowe na nyir’inzu',
  'inbox.tabMessages': 'Ubutumwa',
  'inbox.tabNotifications': 'Amatangazo',
  'inbox.segmentLabel': 'Ubutumwa cyangwa amatangazo',
  'inbox.badgeLabel': '{count} butarasomwa',

  'inbox.unreadDot': 'Ntibwasomwe',
  'inbox.rowLabel': '{name}, {preview}, {time}',
  'inbox.rowLabelUnread': '{name}, {preview}, {time}, ntibwasomwe',
  'inbox.youPrefix': 'Wowe: ',
  'inbox.archivedTag': 'Cyarangiye',

  'inbox.emptyTenantTitle': 'Nta kiganiro kirahaba',
  'inbox.emptyTenantBody':
    'Buri masezerano y’ubukode afungura ikiganiro, kugira ngo ubashe kuvugana na nyir’inzu utagombye guhana nimero za telefone.',
  'inbox.emptyTenantAction': 'Jya ku masezerano yawe',

  'inbox.notificationsListLabel': 'amatangazo yawe',
  'inbox.emptyNotificationsTitle': 'Nta kintu gitegereje',
  'inbox.emptyNotificationsBody':
    'Inyemezabwishyu, kwemeza no kuvugurura ibisanwa bihagera hano. Nta kintu gitegereje ubu.',
  'inbox.notificationLabel': '{title}, {body}, {time}',
  'inbox.notificationLabelUnread': '{title}, {body}, {time}, ntiryasomwe',
  'inbox.markedRead': 'Byashyizwe nk’ibyasomwe',

  'inbox.type.bookingConfirmed': 'Kwandika byemejwe',
  'inbox.type.bookingRequest': 'Gusaba kwandika',
  'inbox.type.stayReminder': 'Aho uraramo',
  'inbox.type.reviewInvite': 'Isuzuma',
  'inbox.type.rentReceipt': 'Inyemezabwishyu',
  'inbox.type.rentDue': 'Ubukode bugomba kwishyurwa',
  'inbox.type.ticketProgress': 'Ibisanwa',
  'inbox.type.leaseSignature': 'Amasezerano',

  'inbox.timeNow': 'ubu',
  'inbox.timeMinutes': 'iminota {minutes}',
  'inbox.timeHours': 'amasaha {hours}',
  'inbox.timeDays': 'iminsi {days}',
  'inbox.timeWeeks': 'ibyumweru {weeks}',

  'inbox.dayToday': 'Uyu munsi',
  'inbox.dayYesterday': 'Ejo hashize',

  'inbox.threadLabel': 'ikiganiro',
  'inbox.threadSubtitleBooking': 'Ku byerekeye aho wandikishije',
  'inbox.threadSubtitleLease': 'Ku byerekeye amasezerano yawe',
  'inbox.threadStartTitle': 'Nta butumwa burahaba',
  'inbox.threadStartBody': 'Baza icyo ushaka cyose ku bijyanye n’aho uraramo. Basubiza hano.',
  'inbox.threadStartBodyLease': 'Baza icyo ushaka cyose ku bijyanye n’inzu. Nyir’inzu asubiza hano.',
  'inbox.notFoundTitle': 'Icyo kiganiro si icyawe',
  'inbox.notFoundBody':
    'Gishobora kuba cyarafunzwe, cyangwa ni icy’undi muntu. Ibiganiro byawe biri mu Gasanduku.',
  'inbox.notFoundAction': 'Subira mu Gasanduku',
  'inbox.sentByYou': 'Wowe',
  'inbox.sending': 'Kohereza',
  'inbox.sendFailed': 'Ubwo butumwa ntibwoherejwe. Kanda wongere ugerageze.',

  'inbox.composerPlaceholder': 'Andika ubutumwa',
  'inbox.composerLabel': 'Ubutumwa bwawe',
  'inbox.send': 'Ohereza',
  'inbox.sendLabel': 'Ohereza ubutumwa',

  'inbox.archivedStay': 'Iki kiganiro cyarafunzwe kuko igihe cyo kuraramo cyarangiye.',
  'inbox.archivedLease': 'Iki kiganiro cyarafunzwe kuko amasezerano y’ubukode yarangiye.',
  'inbox.archivedKept': 'Ibyavuzwe byose birabikwa, kandi bigumaho gusomwa.',
  'inbox.archivedRefused': 'Iki kiganiro cyarafunzwe. Nta bushya bwoherezwa.',

  'inbox.redacted': 'nimero yahishwe',
  'inbox.redactedNote':
    'Nimero za telefone zirahishwa kugira ngo ikiganiro gikomeze kuri Injishi, aho kibikwa mu nyandiko.',
  'inbox.redactedA11y': 'nimero ya telefone, yahishwe',
  'inbox.queued': `${en['inbox.queued']} (RW)`,
  'inbox.failed': `${en['inbox.failed']} (RW)`,
  'inbox.retrySend': `${en['inbox.retrySend']} (RW)`,
  'inbox.discardSend': `${en['inbox.discardSend']} (RW)`,
  'inbox.failedA11y': `${en['inbox.failedA11y']} (RW)`,
};
