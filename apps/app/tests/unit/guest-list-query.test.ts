import { describe, expect, it } from "vitest";
import { downloadQuery, guestListQuery } from "@/features/oversight/guests/query";

describe("the leader's guest list address", () => {
  it("reads every filter a shared link carries", () => {
    const q = guestListQuery({
      tab: "staying",
      arrived: "last_7_days",
      presentOn: "2026-10-30",
      leaving: "next_7_days",
      length: "week",
      placeType: "guest_house",
      nationality: "ke",
      relationship: "friend",
      villageId: "12",
      q: "John",
      page: "2",
    });
    expect(q).toMatchObject({
      tab: "staying",
      arrived: "last_7_days",
      presentOn: "2026-10-30",
      leaving: "next_7_days",
      length: "week",
      placeType: "guest_house",
      nationality: "KE",
      relationship: "friend",
      villageId: 12,
      q: "John",
      page: 2,
    });
  });

  it("drops only a bad value and keeps the rest of the view", () => {
    const q = guestListQuery({ placeType: "castle", length: "forever", presentOn: "yesterday", leaving: "today" });
    expect(q.placeType).toBeUndefined();
    expect(q.length).toBeUndefined();
    expect(q.presentOn).toBeUndefined();
    expect(q.leaving).toBe("today");
    expect(q.tab).toBe("all");
  });

  it("drops a custom range that ends before it starts", () => {
    const q = guestListQuery({ arrivedFrom: "2026-10-20", arrivedTo: "2026-10-01", length: "under_3" });
    expect(q.arrivedFrom).toBeUndefined();
    expect(q.arrivedTo).toBeUndefined();
    expect(q.length).toBe("under_3");
  });

  it("downloads exactly the view, never the page", () => {
    const files = new URLSearchParams(
      downloadQuery(guestListQuery({ placeType: "hotel", arrived: "today", page: "3" })),
    );
    expect(files.get("placeType")).toBe("hotel");
    expect(files.get("arrived")).toBe("today");
    expect(files.get("tab")).toBe("all");
    expect(files.has("page")).toBe(false);
  });
});
