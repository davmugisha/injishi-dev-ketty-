import { describe, expect, test, vi } from "vitest";

// The rack reads the desk's day; the test hands it one, shaped like Gisele's hotel on 30 Oct 2026.
const board = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/server/sources/frontdesk", () => ({ deskBoard: vi.fn(async () => board.value) }));

const { readRoomRack } = await import("@/server/sources/room-rack");

const room = (id: string, label: string, extra: Record<string, unknown> = {}) => ({
  id,
  label,
  roomTypeId: "single",
  roomTypeName: "Single room",
  status: "available",
  housekeeping: "clean",
  housekeepingUpdatedAt: null,
  occupant: null,
  heldTonightBy: null,
  ...extra,
});

const booking = (id: string, extra: Record<string, unknown>) => ({
  id,
  reference: `BK-${id}`,
  guestName: null,
  roomTypeId: "single",
  status: "confirmed",
  holds: [],
  stay: null,
  ...extra,
});

function day(): unknown {
  return {
    property: { id: "p", name: "Gisele's hotel", checkInTime: "14:00", checkOutTime: "11:00" },
    today: "2026-10-30",
    generatedAt: "2026-10-30T08:00:00Z",
    canReadBills: true,
    roomTypes: [
      {
        id: "single",
        name: "Single room",
        sleeps: 2,
        rateRwf: 60000,
        beds: null,
        active: true,
        roomCount: 4,
        freeTonight: 4,
      },
    ],
    rooms: [
      room("r1", "101", { occupant: { stayId: "s1", guestName: "Ange", plannedExitAt: "2026-11-01T09:00:00Z" } }),
      room("r2", "102"),
      room("r3", "103", { housekeeping: "dirty" }),
      room("r4", "104", { status: "out_of_service" }),
    ],
    stays: [
      {
        id: "s1",
        reference: "ST-1",
        bookingId: "b-in",
        bookingReference: "BK-b-in",
        guestName: "Ange",
        roomId: "r1",
        lifecycle: "open",
        entryAt: "2026-10-29T12:00:00Z",
        plannedExitAt: "2026-11-01T09:00:00Z",
        actualExitAt: null,
        checkIn: "2026-10-29",
        checkOut: "2026-11-01",
      },
    ],
    bookings: [
      // In house already: drawn from its stay, not twice.
      booking("b-in", { guestName: "Ange", checkIn: "2026-10-29", checkOut: "2026-11-01", stay: { id: "s1" } }),
      // The screenshot's booking: confirmed, paid, no room yet.
      booking("VU99", { checkIn: "2026-11-01", checkOut: "2026-11-03" }),
      // Booked into 102, and a second one into 102 on a night it overlaps.
      booking("held", {
        guestName: "Eric",
        checkIn: "2026-11-02",
        checkOut: "2026-11-05",
        holds: [{ roomId: "r2", roomLabel: "102", from: "2026-11-02", to: "2026-11-05" }],
      }),
      booking("clash", {
        guestName: "Diane",
        status: "pending_approval",
        checkIn: "2026-11-04",
        checkOut: "2026-11-06",
        holds: [{ roomId: "r2", roomLabel: "102", from: "2026-11-04", to: "2026-11-06" }],
      }),
      // Cancelled: not on the rack.
      booking("gone", { status: "cancelled", checkIn: "2026-11-01", checkOut: "2026-11-02" }),
    ],
  };
}

const ctx = { now: new Date("2026-10-30T08:30:00Z") } as never;

describe("the room rack on the property's own records (2026-10-30)", () => {
  test("lists every room under its type, then the bookings still needing a room", async () => {
    board.value = day();
    const rack = await readRoomRack(ctx);
    expect(rack.lanes.map((l) => `${l.kind}:${l.label}`)).toEqual([
      "group:Single room",
      "room:101",
      "room:102",
      "room:103",
      "room:104",
      "unassigned:Unnamed guest",
    ]);
    expect(rack.unassigned).toBe(1);
    expect(rack.totalRooms).toBe(4);
    expect(rack.days[0]?.date).toBe("2026-10-29");
    expect(rack.days[1]?.date).toBe("2026-10-30");
  });

  test("draws an in-house guest from the stay, once, and the room's state in words", async () => {
    board.value = day();
    const rack = await readRoomRack(ctx);
    const r101 = rack.lanes.find((l) => l.label === "101");
    expect(r101?.meta).toBe("Occupied");
    expect(r101?.bars).toHaveLength(1);
    expect(r101?.bars[0]).toMatchObject({
      kind: "inhouse",
      guest: "Ange",
      from: 0.5,
      to: 3.5,
      href: "/reservations?booking=BK-b-in",
    });
    expect(rack.lanes.find((l) => l.label === "103")?.meta).toBe("Dirty");
    expect(rack.lanes.find((l) => l.label === "104")?.state).toBe("ooo");
  });

  test("flags a room with two stays on one night, and leaves out cancelled bookings", async () => {
    board.value = day();
    const rack = await readRoomRack(ctx);
    const r102 = rack.lanes.find((l) => l.label === "102");
    expect(r102?.bars.map((b) => b.kind)).toEqual(["booked", "tentative"]);
    expect(r102?.overlap).toBe(true);
    expect(rack.overlaps).toBe(1);
    expect(rack.lanes.flatMap((l) => l.bars).some((b) => b.reference === "BK-gone")).toBe(false);
  });

  test("counts the rooms free each night: sellable rooms less what is in or booked into them", async () => {
    board.value = day();
    const rack = await readRoomRack(ctx);
    const free = Object.fromEntries(rack.days.slice(0, 9).map((d) => [d.date.slice(5), d.free]));
    // 104 is out of service, so three rooms sell. 30 Oct: Ange in 101. 1 Nov: Ange has left; the unassigned
    // booking takes one. 2 Nov: that booking and Eric. 4 Nov: Eric and Diane in 102 (the overlap) take two.
    expect(free).toMatchObject({ "10-30": 2, "11-01": 2, "11-02": 1, "11-04": 1, "11-06": 3 });
    expect(rack.now).toBeCloseTo(1 + 630 / 1440, 5);
  });
});
