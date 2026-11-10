import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PosOrder } from "@/server/pos";

const attach = vi.fn();
const search = vi.fn();
const create = vi.fn();
vi.mock("@/features/pos/actions", () => ({
  attachCustomerAction: (...a: unknown[]) => attach(...a),
  searchCustomersAction: (...a: unknown[]) => search(...a),
  createCustomerAction: (...a: unknown[]) => create(...a),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

import {
  type CustomerForm,
  customerFormProblem,
  customerPayload,
  emptyCustomerForm,
  storedPhone,
} from "@/features/pos/customer-form";
import { OrderCustomer } from "@/features/pos/pos-customer-picker";

const filled = (over: Partial<CustomerForm> = {}): CustomerForm => ({
  ...emptyCustomerForm,
  fullName: "Jean Bosco",
  phone: "0788 123 456",
  ...over,
});

describe("the customer form's rules", () => {
  test("every way a Rwandan writes a mobile number shows the one stored form", () => {
    for (const raw of ["0788123456", "788123456", "250788123456", "+250788123456", "0788 123 456", "(078) 812-3456"]) {
      expect(storedPhone(raw), raw).toBe("+250788123456");
    }
  });

  test("a visitor's number keeps its country code, and rubbish is refused", () => {
    expect(storedPhone("+44 7911 123456")).toBe("+447911123456");
    expect(storedPhone("0044 7911 123456")).toBe("+447911123456");
    for (const raw of ["", "abc", "0700000001", "0788 12", "+250 700 000 001", "1234"]) {
      expect(storedPhone(raw), raw).toBeNull();
    }
  });

  test("a name and a phone are enough to save", () => {
    expect(customerFormProblem(filled())).toBeNull();
  });

  test("says what is wrong, one thing at a time, in a sentence", () => {
    expect(customerFormProblem(filled({ fullName: "A" }))).toMatch(/name/i);
    expect(customerFormProblem(filled({ phone: "" }))).toMatch(/Rwandan mobile/);
    expect(customerFormProblem(filled({ phone: "12345" }))).toMatch(/Rwandan mobile/);
    expect(customerFormProblem(filled({ email: "nope" }))).toMatch(/email/i);
    expect(customerFormProblem(filled({ notes: "x".repeat(501) }))).toMatch(/500/);
  });

  test("a blank email is fine, a real one is fine", () => {
    expect(customerFormProblem(filled({ email: "" }))).toBeNull();
    expect(customerFormProblem(filled({ email: "  " }))).toBeNull();
    expect(customerFormProblem(filled({ email: "jean@example.com" }))).toBeNull();
  });

  test("what is sent is trimmed, with blanks as null", () => {
    expect(customerPayload(filled({ fullName: "  Jean Bosco ", email: "", notes: "  " }))).toEqual({
      fullName: "Jean Bosco",
      phone: "0788 123 456",
      email: null,
      marketingConsent: false,
      notes: null,
    });
  });
});

function order(over: Partial<PosOrder> = {}): PosOrder {
  return {
    id: "o1",
    orderNumber: "POS-261107-0042",
    outletId: "out1",
    orderType: "dine_in",
    status: "submitted",
    tableSessionId: "s1",
    tableLabel: "T4",
    waiterName: "Jean",
    guestNote: null,
    taxMode: "inclusive",
    grossRwf: 0,
    discountRwf: 0,
    taxRwf: 0,
    totalRwf: 0,
    settlement: {} as PosOrder["settlement"],
    lines: [],
    discounts: [],
    payments: [],
    cancelReason: null,
    createdAt: "2026-11-07T12:00:00.000Z",
    settledAt: null,
    ...over,
  };
}
const withCustomer = { customer: { id: "c1", fullName: "Anna Uwase", phoneMasked: "+250******456" } };
const CASHIER = ["pos.sell", "customer.view", "customer.manage"];
const WAITER = ["pos.sell", "customer.view"];

beforeEach(() => {
  attach.mockReset().mockResolvedValue({ ok: true, value: order(withCustomer) });
  search.mockReset().mockResolvedValue({
    ok: true,
    value: {
      customers: [
        {
          id: "c1",
          fullName: "Anna Uwase",
          phone: "+250******456",
          email: null,
          contactHidden: true,
          marketingConsent: false,
          source: "pos",
          visitCount: 0,
          lifetimeSpendRwf: 0,
          lastVisitAt: null,
          createdAt: "2026-11-01T00:00:00.000Z",
        },
      ],
      total: 1,
      limit: 8,
      offset: 0,
      searchRequired: false,
      contactHidden: true,
    },
  });
  create.mockReset();
});

describe("who this bill is for", () => {
  test("an order with no customer says so and offers to add one", () => {
    render(<OrderCustomer order={order()} can={CASHIER} editable />);
    expect(screen.getByText("No customer on this bill")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add customer" })).toBeInTheDocument();
  });

  test("a customer on the order shows their name and only a masked number", () => {
    render(<OrderCustomer order={order(withCustomer)} can={CASHIER} editable />);
    expect(screen.getByText("Anna Uwase")).toBeInTheDocument();
    expect(screen.getByText("+250******456")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\+250788/);
  });

  test("taking the customer off the bill asks the API to detach them", async () => {
    render(<OrderCustomer order={order(withCustomer)} can={WAITER} editable />);
    await userEvent.click(screen.getByRole("button", { name: "Remove the customer from this bill" }));
    expect(attach).toHaveBeenCalledWith("o1", null);
  });

  test("the kitchen sees nothing at all, because it may not look customers up", () => {
    const { container } = render(<OrderCustomer order={order()} can={["kitchen.work"]} editable />);
    expect(container).toBeEmptyDOMElement();
  });

  test("a bill that is already closed shows the customer but cannot change them", () => {
    render(<OrderCustomer order={order({ ...withCustomer, status: "completed" })} can={CASHIER} editable={false} />);
    expect(screen.getByText("Anna Uwase")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("someone who cannot take orders cannot change the customer either", () => {
    render(<OrderCustomer order={order(withCustomer)} can={["customer.view"]} editable />);
    expect(screen.getByText("Anna Uwase")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("finding a customer", () => {
  async function open(can = CASHIER) {
    render(<OrderCustomer order={order()} can={can} editable />);
    await userEvent.click(screen.getByRole("button", { name: "Add customer" }));
    return screen.getByRole("dialog");
  }

  test("asks for three characters before it searches", async () => {
    const dialog = await open();
    expect(within(dialog).getByText(/at least 3 letters/i)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole("searchbox"), "an");
    await new Promise((r) => setTimeout(r, 450));
    expect(search).not.toHaveBeenCalled();
  });

  test("searches as the person types, shows the match with a masked number, and puts them on the bill when chosen", async () => {
    const dialog = await open(WAITER);
    await userEvent.type(within(dialog).getByRole("searchbox"), "Anna");
    const hit = await within(dialog).findByRole("button", { name: /Anna Uwase/ });
    expect(search).toHaveBeenCalledWith("Anna");
    expect(hit).toHaveTextContent("+250******456");
    await userEvent.click(hit);
    await waitFor(() => expect(attach).toHaveBeenCalledWith("o1", "c1"));
  });

  test("says when no one matches", async () => {
    search.mockResolvedValue({
      ok: true,
      value: { customers: [], total: 0, limit: 8, offset: 0, searchRequired: false, contactHidden: true },
    });
    const dialog = await open();
    await userEvent.type(within(dialog).getByRole("searchbox"), "Zzz");
    expect(await within(dialog).findByText("No customer found.")).toBeInTheDocument();
  });

  test("shows the API's own sentence when the search fails", async () => {
    search.mockResolvedValue({ ok: false, error: "The Injishi service did not answer. Try again." });
    const dialog = await open();
    await userEvent.type(within(dialog).getByRole("searchbox"), "Anna");
    expect(await within(dialog).findByText("The Injishi service did not answer. Try again.")).toBeInTheDocument();
  });

  test("only someone who may register customers is offered to register one", async () => {
    const waiterDialog = await open(WAITER);
    expect(within(waiterDialog).queryByRole("button", { name: /Register a new customer/ })).toBeNull();
  });

  test("a cashier registers a new customer from the bill, and the phone is previewed as it will be stored", async () => {
    create.mockResolvedValue({ ok: true, value: { id: "c9", fullName: "Eric N" } });
    attach.mockResolvedValue({ ok: true, value: order(withCustomer) });
    const dialog = await open();
    await userEvent.type(within(dialog).getByRole("searchbox"), "Eric");
    await userEvent.click(within(dialog).getByRole("button", { name: /Register a new customer/ }));
    const form = screen.getByRole("dialog");
    expect(within(form).getByLabelText(/Name/)).toHaveValue("Eric");
    const save = within(form).getByRole("button", { name: "Register and add" });
    expect(save).toBeDisabled();
    await userEvent.type(within(form).getByLabelText(/Phone/), "0788 123 456");
    expect(within(form).getByText("Will be saved as +250788123456")).toBeInTheDocument();
    expect(save).toBeEnabled();
    await userEvent.click(save);
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ fullName: "Eric", phone: "0788 123 456", email: null });
    await waitFor(() => expect(attach).toHaveBeenCalledWith("o1", "c9"));
  });

  test("a number that is not a number keeps Register disabled and says why", async () => {
    const dialog = await open();
    await userEvent.type(within(dialog).getByRole("searchbox"), "Eric");
    await userEvent.click(within(dialog).getByRole("button", { name: /Register a new customer/ }));
    const form = screen.getByRole("dialog");
    await userEvent.type(within(form).getByLabelText(/Phone/), "12345");
    expect(within(form).getByText(/Not a valid number/)).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Register and add" })).toBeDisabled();
  });

  test("a number already held offers the customer who holds it, instead of a dead end", async () => {
    create.mockResolvedValue({
      ok: false,
      error: "Anna Uwase is already registered with this phone number.",
      existingCustomerId: "c1",
    });
    const dialog = await open();
    await userEvent.type(within(dialog).getByRole("searchbox"), "0788 123 456");
    await userEvent.click(within(dialog).getByRole("button", { name: /Register a new customer/ }));
    const form = screen.getByRole("dialog");
    expect(within(form).getByLabelText(/Phone/)).toHaveValue("0788 123 456"); // typed phone carried over
    await userEvent.type(within(form).getByLabelText(/Name/), "Anna");
    await userEvent.click(within(form).getByRole("button", { name: "Register and add" }));
    const notice = await within(form).findByRole("alert");
    expect(notice).toHaveTextContent("already registered");
    await userEvent.click(within(notice).getByRole("button", { name: "Use that customer" }));
    await waitFor(() => expect(attach).toHaveBeenCalledWith("o1", "c1"));
  });
});
