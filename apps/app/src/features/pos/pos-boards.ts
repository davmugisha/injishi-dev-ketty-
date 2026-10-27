/**
 * The four point of sale boards: the path each one serves and the title its tab carries.
 *
 * The screen registry in `@injishi/data` describes the same boards for the design frames and the persona gate,
 * and `requirePersona` still reads it there. That package is demo data (ADR-074, Import rules) and retires in
 * stage 9, so the POS code reads its own boards from here. `tests/pos-boards.test.ts` fails the moment the two
 * disagree.
 */
export const POS_BOARDS = {
  PosFloor: { href: "/pos/floor", pageTitle: "POS · Floor" },
  PosTill: { href: "/pos/till", pageTitle: "POS · Order" },
  PosStations: { href: "/pos/stations", pageTitle: "POS · Kitchen and bar" },
  PosShift: { href: "/pos/shift", pageTitle: "POS · Cashier shift" },
} as const;

export type PosBoard = keyof typeof POS_BOARDS;
