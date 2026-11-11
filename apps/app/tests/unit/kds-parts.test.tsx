import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { DEFAULT_LIMITS } from "@/features/pos/kds";
import { EmptyColumn, TicketCard } from "@/features/pos/kds-parts";
import type { PosTicket } from "@/server/pos";

const NOW = Date.parse("2026-11-07T12:00:00.000Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

function ticket(over: Partial<PosTicket> = {}): PosTicket {
  return {
    id: "t1",
    ticketNumber: "K-1",
    orderId: "o1",
    orderNumber: "POS-261107-0042",
    stationId: "s1",
    stationName: "Main kitchen",
    stationKind: "kitchen",
    status: "queued",
    tableLabel: "T4",
    waiterName: "Jean",
    orderType: "dine_in",
    guestNote: "Anna (birthday)",
    guestCount: 3,
    items: [
      {
        id: "i1",
        orderItemId: "l1",
        name: "Margherita",
        quantity: 2,
        options: ["Crust: Thin", "Side: Chips, Salad", "Extra cheese"],
        note: "No onions, allergy",
        status: "queued",
      },
      { id: "i2", orderItemId: "l2", name: "Tiramisu", quantity: 1, options: [], note: null, status: "cancelled" },
    ],
    createdAt: ago(3),
    startedAt: null,
    readyAt: null,
    servedAt: null,
    elapsedMinutes: 3,
    late: false,
    printCount: 1,
    ...over,
  };
}

function card(t: PosTicket, over: Partial<Parameters<typeof TicketCard>[0]> = {}) {
  const onAdvance = vi.fn();
  const onReprint = vi.fn();
  render(
    <TicketCard
      t={t}
      nowMs={NOW}
      limits={DEFAULT_LIMITS}
      fresh={false}
      upNext={false}
      cook
      pass
      busy={false}
      onAdvance={onAdvance}
      onReprint={onReprint}
      {...over}
    />,
  );
  return { onAdvance, onReprint, article: screen.getByRole("article") };
}

describe("an order card", () => {
  test("shows the number, the table, the order type and the guest at a glance", () => {
    const { article } = card(ticket());
    expect(within(article).getByText("#42")).toBeInTheDocument();
    expect(article.querySelector("[data-field=where]")?.textContent).toBe("T4");
    expect(article.querySelector("[data-field=order-type]")?.textContent).toBe("Dine in");
    expect(article.querySelector("[data-field=guest]")?.textContent).toBe("Guest: Anna (birthday)");
    expect(article.querySelector("[data-field=party]")?.textContent).toBe("3");
    expect(article).toHaveAttribute("data-urgency", "normal");
  });

  test("a modifier is a label and a value, an option with no label is just a value, a note stands apart", () => {
    const { article } = card(ticket());
    const mods = [...article.querySelectorAll("[data-field=modifiers] .kds-mod")].map((m) => m.textContent);
    expect(mods).toEqual(["CrustThin", "SideChips, Salad", "Extra cheese"]);
    // The note mentions an allergy, so it is flagged as one (red, labelled ALLERGY), not a mere instruction.
    const note = article.querySelector("[data-field=note]");
    expect(note?.textContent).toContain("ALLERGY");
    expect(note?.textContent).toContain("No onions, allergy");
    expect(note).toHaveAttribute("data-allergy", "true");
  });

  test("a note with no allergy in it stays a special instruction", () => {
    const base = ticket();
    const items = base.items.map((i) => (i.note ? { ...i, note: "Well done, no salt" } : i));
    const { article } = card({ ...base, items });
    const note = article.querySelector("[data-field=note]");
    expect(note?.textContent).toContain("SPECIAL INSTRUCTION");
    expect(note).toHaveAttribute("data-allergy", "false");
  });

  test("a voided line says so and is struck through; the quantity is large and separate", () => {
    const { article } = card(ticket());
    expect(within(article).getByText("VOIDED · DO NOT MAKE")).toBeInTheDocument();
    expect(article.querySelector("[data-item=Tiramisu]")).toHaveAttribute("data-voided", "true");
    expect(article.querySelector("[data-item=Margherita] [data-field=qty]")?.textContent).toBe("2×");
  });

  test("a takeaway has no table and says Takeaway once", () => {
    const { article } = card(ticket({ tableLabel: null, orderType: "takeaway", guestCount: null }));
    expect(article.querySelector("[data-field=where]")?.textContent).toBe("Takeaway");
    expect(article.querySelector("[data-field=order-type]")).toBeNull();
    expect(article.querySelector("[data-field=party]")).toBeNull();
  });

  test("urgency follows the clock: green, amber, red, with a tag only when it matters", () => {
    expect(card(ticket({ createdAt: ago(3) })).article).toHaveAttribute("data-urgency", "normal");
    document.body.innerHTML = "";
    const warn = card(ticket({ createdAt: ago(11) })).article;
    expect(warn).toHaveAttribute("data-urgency", "warning");
    expect(within(warn).getByText("ALMOST LATE")).toBeInTheDocument();
    document.body.innerHTML = "";
    const late = card(ticket({ createdAt: ago(16) })).article;
    expect(late).toHaveAttribute("data-urgency", "late");
    expect(within(late).getByText("OVERDUE")).toBeInTheDocument();
  });

  test("a ticket at the pass is timed from when it became ready", () => {
    const { article } = card(ticket({ status: "ready", createdAt: ago(30), readyAt: ago(2) }));
    expect(article.querySelector("[data-field=timer]")).toHaveAttribute("data-seconds", "120");
    expect(within(article).getByText("waiting at the pass")).toBeInTheDocument();
    expect(article).toHaveAttribute("data-urgency", "normal");
  });
});

describe("what each person can press", () => {
  test("a cook starts or readies a new order", async () => {
    const t = ticket();
    const { onAdvance } = card(t);
    await userEvent.click(screen.getByRole("button", { name: "START" }));
    expect(onAdvance).toHaveBeenCalledWith(t, "preparing", "#42 started");
    await userEvent.click(screen.getByRole("button", { name: "READY" }));
    expect(onAdvance).toHaveBeenLastCalledWith(t, "ready", "#42 ready for collection");
    expect(screen.queryByRole("button", { name: "COLLECTED BY WAITER" })).toBeNull();
  });

  test("a ticket being prepared offers MARK READY only", async () => {
    const t = ticket({ status: "preparing" });
    const { onAdvance } = card(t);
    expect(screen.queryByRole("button", { name: "START" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /MARK READY/ }));
    expect(onAdvance).toHaveBeenCalledWith(t, "ready", "#42 ready for collection");
  });

  test("the waiter collects from the pass, and cannot start or ready", async () => {
    const queued = card(ticket(), { cook: false, pass: true });
    expect(screen.queryByRole("button", { name: "START" })).toBeNull();
    expect(screen.queryByRole("button", { name: /MARK READY/ })).toBeNull();
    expect(queued.article.textContent).not.toContain("View only");
    document.body.innerHTML = "";
    const t = ticket({ status: "ready", readyAt: ago(1) });
    const { onAdvance } = card(t, { cook: false, pass: true });
    await userEvent.click(screen.getByRole("button", { name: /COLLECTED BY WAITER/ }));
    expect(onAdvance).toHaveBeenCalledWith(t, "served", "#42 collected by the waiter");
  });

  test("someone with neither permission only looks", () => {
    const { article } = card(ticket({ status: "ready" }), { cook: false, pass: false });
    expect(within(article).getByText("View only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /COLLECTED BY WAITER/ })).toBeNull();
  });

  test("while a press is being handled every button on the card is off (no double press)", () => {
    card(ticket(), { busy: true });
    for (const name of ["START", "READY", "Reprint"]) expect(screen.getByRole("button", { name })).toBeDisabled();
  });

  test("a reprint asks for a copy of this ticket", async () => {
    const t = ticket();
    const { onReprint } = card(t);
    await userEvent.click(screen.getByRole("button", { name: "Reprint" }));
    expect(onReprint).toHaveBeenCalledWith(t);
  });
});

describe("loading and empty states", () => {
  test("each empty area says what is missing and what to do", () => {
    const { rerender } = render(<EmptyColumn status="queued" />);
    expect(screen.getByText("No new orders")).toBeInTheDocument();
    rerender(<EmptyColumn status="preparing" />);
    expect(screen.getByText("Nothing in preparation")).toBeInTheDocument();
    rerender(<EmptyColumn status="ready" />);
    expect(screen.getByText("Nothing waiting")).toBeInTheDocument();
  });
});
