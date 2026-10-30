import { describe, expect, test, vi } from "vitest";

// desk.ts reads the board through the request context; the builder under test is pure.
vi.mock("@/server/data", () => ({ requestContext: vi.fn() }));

const { calendarBoard } = await import("@/server/stays/desk");
type Board = Parameters<typeof calendarBoard>[0];

const room = (id: string, label: string, roomTypeId: string) => ({
  id,
  label,
  roomTypeId,
  roomTypeName: roomTypeId,
  status: "available" as const,
  housekeeping: "clean" as const,
  housekeepingUpdatedAt: null,
  occupant: null,
  heldTonightBy: null,
});

const booking = (id: string, extra: Record<string, unknown>) => ({
  id,
  reference: `BK-${id}`,
  guestName: "Ada Uwase",
  guestPhone: null,
  checkIn: "2026-11-02",
  checkOut: "2026-11-05",
  nights: 3,
  guestCount: 2,
  adults: 2,
  children: 0,
  roomTypeId: "double",
  roomTypeName: "Double room",
  status: "confirmed",
  state: "confirmed",
  totalRwf: 210_000,
  paidRwf: 210_000,
  holds: [],
  stay: null,
  folio: null,
  cancellation: null,
  noShow: null,
  ...extra,
});

const board = (bookings: unknown[]): Board =>
  ({
    property: { id: "p", name: "Umuco", checkInTime: null, checkOutTime: null },
    today: "2026-10-30",
    generatedAt: "2026-10-30T08:00:00Z",
    canReadBills: true,
    bookings,
    stays: [],
    rooms: [room("r2", "Room 2", "double"), room("r1", "Room 1", "double")],
    roomTypes: [
      {
        id: "double",
        name: "Double room",
        sleeps: 2,
        rateRwf: 70_000,
        beds: null,
        active: true,
        roomCount: 2,
        freeTonight: 2,
      },
    ],
  }) as unknown as Board;

describe("calendarBoard", () => {
  test("a held booking is a card over its nights in its room, and may move", () => {
    const out = calendarBoard(
      board([booking("a", { holds: [{ roomId: "r1", roomLabel: "Room 1", from: "2026-11-02", to: "2026-11-05" }] })]),
    );
    expect(out.roomTypes[0]?.rooms.map((r) => r.label)).toEqual(["Room 1", "Room 2"]);
    expect(out.stays).toEqual([
      expect.objectContaining({
        roomId: "r1",
        start: "2026-11-02",
        end: "2026-11-04",
        checkOut: "2026-11-05",
        movable: true,
      }),
    ]);
  });

  test("a booking with no room yet sits on a row of its type nothing can be booked into", () => {
    const out = calendarBoard(board([booking("b", { status: "pending_approval", state: "pending" })]));
    expect(out.roomTypes[0]?.rooms.at(-1)).toEqual({ id: "waiting:double", label: "No room yet", bookable: false });
    expect(out.stays[0]).toEqual(
      expect.objectContaining({ kind: "requested", roomId: "waiting:double", movable: false }),
    );
  });

  test("arrivals and departures sit at the guest's time, else the property's check-in and check-out", () => {
    const out = calendarBoard(board([booking("c", { eta: "16:30" }), booking("d", { eta: null })]));
    expect(out.checkInTime).toBe("14:00");
    expect(out.checkOutTime).toBe("11:00");
    expect(out.stays.map((s) => [s.eta, s.roomTypeId])).toEqual([
      ["16:30", "double"],
      [null, "double"],
    ]);
  });
});
