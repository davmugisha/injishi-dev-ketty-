import {
  GUEST_PLACE_TYPE_LABEL,
  type GuestPlaceType,
  ID_KIND_LABEL,
  type LeaderAudience,
  type LeaderGuest,
  RWANDA_CODE,
} from '@injishi/contracts';

/**
 * The guest list as a file (P5, 2026-11-02): which columns each audience gets and in what order the rows
 * come, the summary that heads the file, all pure so the Excel, CSV and PDF writers share one shape.
 *
 * Local government sees Rwandans and foreigners, so its rows are grouped (Rwandan guests first, then those
 * from abroad by nationality) under a Group column it can filter. DGIE sees only guests from abroad, so it
 * has no such column: its rows go by nationality, with the document, the check in and the length of stay
 * near the name.
 */

/** How a cell is written: text stays text (phones, ID numbers), days and times are real dates. */
export type CellKind = 'text' | 'date' | 'datetime' | 'int';
export type CellValue = string | number | null;

export interface SheetColumn {
  key: string;
  header: string;
  kind: CellKind;
}

export interface Sheet {
  name: string;
  columns: SheetColumn[];
  rows: CellValue[][];
}

/** A titled block of lines, for the summary at the top of a file: a label, then one value or a few. */
export interface SummarySection {
  title: string;
  /** Column headings when a line has more than one value ("Guests", "Foreign"…). */
  head?: string[];
  rows: [string, ...CellValue[]][];
}

export interface Workbook {
  title: string;
  /** Who, where, which filters, when: one line each. */
  meta: [string, string][];
  summary: SummarySection[];
  sheets: Sheet[];
}

const STATUS_WORDS: Record<LeaderGuest['stay'], string> = { arriving: 'Arriving', staying: 'Staying', left: 'Left' };

export function statusWords(g: Pick<LeaderGuest, 'stay' | 'flagged'>): string {
  return g.flagged ? `${STATUS_WORDS[g.stay]}, flagged` : STATUS_WORDS[g.stay];
}

/** Who hosted the guest, in words: the business for a hotel, the tenant or the landlord for a residence. */
export function hostWords(g: Pick<LeaderGuest, 'host'>): string {
  if (g.host.kind === 'tenant') return `${g.host.name} (tenant)`;
  if (g.host.kind === 'landlord') return `${g.host.name} (landlord)`;
  return g.host.name;
}

/** Every flag on the guest, step by step. */
function flagNotes(g: LeaderGuest): string {
  return g.chain
    .filter((c) => c.flag)
    .map((c) => `${c.roleLabel}: ${c.flag?.note}`)
    .join(' | ');
}

/** The rows in the order a file reads them. */
export function exportOrder(guests: readonly LeaderGuest[], audience: LeaderAudience): LeaderGuest[] {
  const byArrival = (a: LeaderGuest, b: LeaderGuest): number =>
    a.arrivalOn.localeCompare(b.arrivalOn) || a.fullName.localeCompare(b.fullName);
  return [...guests].sort((a, b) => {
    if (audience === 'local' && a.fromAbroad !== b.fromAbroad) return a.fromAbroad ? 1 : -1;
    if (a.fromAbroad && b.fromAbroad) {
      const n = a.nationalityName.localeCompare(b.nationalityName);
      if (n !== 0) return n;
    }
    return byArrival(a, b);
  });
}

type Column = SheetColumn & { value: (g: LeaderGuest) => CellValue };

const col = (key: string, header: string, kind: CellKind, value: (g: LeaderGuest) => CellValue): Column => ({ key, header, kind, value });

const NAME = col('guest', 'Guest', 'text', (g) => g.fullName);
const NATIONALITY = col('nationality', 'Nationality', 'text', (g) => g.nationalityName);
const PHONE = col('phone', 'Phone', 'text', (g) => g.phone || null);
const ORIGIN = col('origin', 'Coming from', 'text', (g) => g.originWords);
const ARRIVES = col('arrives', 'Arrives', 'date', (g) => g.arrivalOn);
const LEAVES = col('leaves', 'Leaves', 'date', (g) => g.departureOn);
const NIGHTS = col('nights', 'Nights', 'int', (g) => g.nights);
const STATUS = col('status', 'Status', 'text', statusWords);
const PLACE_TYPE = col('placeType', 'Type of place', 'text', (g) => g.place.kindLabel);
const PLACE = col('place', 'Place', 'text', (g) => g.place.name);
const HOST = col('host', 'Host', 'text', hostWords);
const ROOM = col('room', 'Room or unit', 'text', (g) => g.place.room);
const HOST_PHONE = col('hostPhone', 'Host phone', 'text', (g) => g.host.phone);
const VILLAGE = col('village', 'Village', 'text', (g) => g.home.villageName);
const CELL = col('cell', 'Cell', 'text', (g) => g.home.cellName);
const ADDRESS = col('address', 'Address', 'text', (g) => g.home.address);
const REPORTED = col('reported', 'Reported', 'datetime', (g) => g.createdAt);
const CHECKED_IN = col('checkedIn', 'Checked in', 'datetime', (g) => g.checkedInAt);
const OPENED = col('opened', 'Opened by you', 'text', (g) => (g.seenByMe ? 'Yes' : 'No'));
const FLAGS = col('flags', 'Flag notes', 'text', (g) => flagNotes(g) || null);

const LOCAL_COLUMNS: Column[] = [
  col('group', 'Group', 'text', (g) => (g.fromAbroad ? 'Foreign' : 'Rwandan')),
  NAME,
  NATIONALITY,
  col('idType', 'ID type', 'text', (g) => (g.idKind ? ID_KIND_LABEL[g.idKind] : null)),
  col('idNumber', 'ID number', 'text', (g) => g.idNumber),
  PHONE,
  col('relationship', 'Who they are to the host', 'text', (g) => g.relationshipLabel),
  ORIGIN,
  PLACE_TYPE,
  PLACE,
  HOST,
  ROOM,
  HOST_PHONE,
  VILLAGE,
  CELL,
  ADDRESS,
  ARRIVES,
  LEAVES,
  NIGHTS,
  STATUS,
  REPORTED,
  CHECKED_IN,
  OPENED,
  FLAGS,
];

const DGIE_COLUMNS: Column[] = [
  NAME,
  NATIONALITY,
  col('nationalityCode', 'Country code', 'text', (g) => g.nationality),
  col('document', 'Document', 'text', (g) => (g.idKind ? ID_KIND_LABEL[g.idKind] : null)),
  col('documentNumber', 'Document number', 'text', (g) => g.idNumber),
  PHONE,
  ORIGIN,
  ARRIVES,
  LEAVES,
  NIGHTS,
  STATUS,
  CHECKED_IN,
  REPORTED,
  PLACE_TYPE,
  PLACE,
  HOST,
  ROOM,
  HOST_PHONE,
  VILLAGE,
  CELL,
  ADDRESS,
  OPENED,
  FLAGS,
];

/** The guest list as one sheet, in the audience's columns and order. */
export function guestSheet(guests: readonly LeaderGuest[], audience: LeaderAudience): Sheet {
  const columns = audience === 'dgie' ? DGIE_COLUMNS : LOCAL_COLUMNS;
  return {
    name: audience === 'dgie' ? 'Foreign guests' : 'Guests',
    columns: columns.map(({ key, header, kind }) => ({ key, header, kind })),
    rows: exportOrder(guests, audience).map((g) => columns.map((c) => c.value(g))),
  };
}

function tally<K extends string>(guests: readonly LeaderGuest[], key: (g: LeaderGuest) => K, label: (g: LeaderGuest) => string): [string, number][] {
  const m = new Map<K, { label: string; n: number }>();
  for (const g of guests) {
    const k = key(g);
    const hit = m.get(k);
    if (hit) hit.n += 1;
    else m.set(k, { label: label(g), n: 1 });
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).map((x) => [x.label, x.n]);
}

/** Mean nights, one decimal, or null with nobody. */
function meanNights(guests: readonly LeaderGuest[]): number | null {
  if (guests.length === 0) return null;
  return Math.round((guests.reduce((n, g) => n + g.nights, 0) / guests.length) * 10) / 10;
}

/**
 * The counts that head the file: how many, Rwandan and foreign (local government), where the stays are,
 * the types of place and the nationalities.
 */
export function guestSummary(guests: readonly LeaderGuest[], audience: LeaderAudience): SummarySection[] {
  const foreign = guests.filter((g) => g.fromAbroad).length;
  const count = (stay: LeaderGuest['stay']): number => guests.filter((g) => g.stay === stay).length;
  const totals: [string, CellValue][] =
    audience === 'dgie'
      ? [
          ['Foreign guests', guests.length],
          ['Nationalities', new Set(guests.map((g) => g.nationality)).size],
        ]
      : [
          ['Guests', guests.length],
          ['Rwandan', guests.length - foreign],
          ['Foreign', foreign],
        ];
  const avg = meanNights(guests);
  const sections: SummarySection[] = [
    {
      title: 'In this file',
      rows: [
        ...totals,
        ['Staying now', count('staying')],
        ['Arriving', count('arriving')],
        ['Left', count('left')],
        ['Flagged', guests.filter((g) => g.flagged).length],
        ['Average stay (nights)', avg],
      ],
    },
    {
      title: 'By type of place',
      rows: tally(guests, (g) => g.place.type, (g) => GUEST_PLACE_TYPE_LABEL[g.place.type as GuestPlaceType]),
    },
    {
      title: audience === 'dgie' ? 'By nationality' : 'Foreign guests by nationality',
      rows: tally(
        guests.filter((g) => g.nationality !== RWANDA_CODE),
        (g) => g.nationality,
        (g) => g.nationalityName,
      ),
    },
  ];
  return sections.filter((s) => s.rows.length > 0);
}
