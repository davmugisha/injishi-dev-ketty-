"use client";

import { Person, Plus, Xmark } from "@gravity-ui/icons";
import { Button, SearchField } from "@heroui/react";
import { useEffect, useRef, useState, useTransition } from "react";
import type { PosCustomerList, PosCustomerSummary, PosOrder } from "@/server/pos";
import { attachCustomerAction, createCustomerAction, searchCustomersAction } from "./actions";
import { type CustomerForm, customerFormProblem, customerPayload, emptyCustomerForm } from "./customer-form";
import { CustomerFormFields } from "./pos-customer-form";
import { PosDialog, usePosAction } from "./shared";

const MIN_SEARCH = 3;

/**
 * Who this bill is for, on the till's order panel (CRM, phase 1). A waiter or cashier finds the customer by name or by
 * their whole phone number and puts them on the order; a cashier who may register customers can add a new one
 * without leaving the bill. The API decides what each person may see (a waiter's results show a masked number), and
 * what the order remembers is only a name and a masked number, so the till never shows a phone it should not.
 */
export function OrderCustomer({ order, can, editable }: { order: PosOrder; can: string[]; editable: boolean }) {
  const { run, pending } = usePosAction();
  const [open, setOpen] = useState(false);
  const mayFind = can.includes("customer.view") || can.includes("customer.manage");
  const customer = order.customer ?? null;

  if (!mayFind && !customer) return null;
  const canChange = editable && mayFind && can.includes("pos.sell");

  return (
    <div
      className="flex items-center gap-2 border-b border-separator px-4 py-2 text-[13px]"
      data-field="order-customer"
    >
      <Person className="size-4 shrink-0 text-muted" aria-hidden />
      {customer ? (
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate font-medium" data-field="customer-name">
            {customer.fullName}
          </span>
          <span className="truncate text-[12px] text-muted tabular">{customer.phoneMasked}</span>
        </span>
      ) : (
        <span className="flex-1 text-muted">No customer on this bill</span>
      )}
      {canChange ? (
        <>
          <Button size="sm" variant="secondary" isDisabled={pending} onPress={() => setOpen(true)}>
            {customer ? "Change" : "Add customer"}
          </Button>
          {customer ? (
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              aria-label="Remove the customer from this bill"
              isDisabled={pending}
              onPress={() => run(() => attachCustomerAction(order.id, null), "Customer removed from the bill")}
            >
              <Xmark className="size-4" />
            </Button>
          ) : null}
        </>
      ) : null}
      {open ? (
        <CustomerPickerDialog
          orderId={order.id}
          canRegister={can.includes("customer.manage")}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function CustomerPickerDialog({
  orderId,
  canRegister,
  onClose,
}: {
  orderId: string;
  canRegister: boolean;
  onClose: () => void;
}) {
  const { run, pending } = usePosAction();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<PosCustomerList | null>(null);
  const [searching, startSearch] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyCustomerForm);
  const [existing, setExisting] = useState<{ id: string; message: string } | null>(null);
  const latest = useRef(0);

  // Search as the person types, a moment after they stop. A slow answer to an old query never overwrites a newer one.
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_SEARCH) {
      setResult(null);
      setProblem(null);
      return;
    }
    const ticket = ++latest.current;
    const timer = setTimeout(() => {
      startSearch(async () => {
        const r = await searchCustomersAction(q);
        if (ticket !== latest.current) return;
        if (r.ok) {
          setResult(r.value);
          setProblem(null);
        } else {
          setProblem(r.error);
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const put = (c: Pick<PosCustomerSummary, "id" | "fullName">) =>
    run(
      () => attachCustomerAction(orderId, c.id),
      `${c.fullName} is on the bill`,
      () => onClose(),
    );

  const formProblem = customerFormProblem(form);

  function register() {
    setExisting(null);
    run(
      async () => {
        const r = await createCustomerAction(customerPayload(form), "PosFloor");
        if (!r.ok) {
          if (r.existingCustomerId) setExisting({ id: r.existingCustomerId, message: r.error });
          return r;
        }
        // Registered: put them straight on the bill.
        return attachCustomerAction(orderId, r.value.id);
      },
      "Customer registered and added to the bill",
      () => onClose(),
    );
  }

  return (
    <PosDialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={registering ? "Register a customer" : "Add a customer to this bill"}
      subtitle={registering ? "Name and phone are enough." : "Find them by name, or by their whole phone number."}
      footer={
        registering ? (
          <>
            <Button variant="secondary" onPress={() => setRegistering(false)}>
              Back to search
            </Button>
            <Button isDisabled={pending || formProblem !== null} onPress={register}>
              Register and add
            </Button>
          </>
        ) : (
          <Button variant="secondary" onPress={onClose}>
            Close
          </Button>
        )
      }
      onEnter={registering && formProblem === null && !pending ? register : undefined}
    >
      {registering ? (
        <>
          <CustomerFormFields value={form} onChange={setForm} withNotes={false} disabled={pending} />
          {existing ? (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-[13px]"
            >
              <span>{existing.message}</span>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={pending}
                onPress={() => put({ id: existing.id, fullName: "Customer" })}
              >
                Use that customer
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <SearchField aria-label="Find a customer" value={query} onChange={setQuery} fullWidth autoFocus>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Name or phone number" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <div aria-live="polite" className="flex min-h-[120px] flex-col gap-1.5">
            {problem ? <p className="text-[13px] text-danger">{problem}</p> : null}
            {!problem && query.trim().length < MIN_SEARCH ? (
              <p className="text-[13px] text-muted">
                Type at least {MIN_SEARCH} letters of a name, or a whole phone number.
              </p>
            ) : null}
            {!problem && result && result.customers.length === 0 && !searching ? (
              <p className="text-[13px] text-muted">No customer found.</p>
            ) : null}
            {!problem && result
              ? result.customers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={pending}
                    onClick={() => put(c)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-separator px-3 py-2 text-left transition enabled:hover:border-accent disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <span className="min-w-0 truncate font-medium">{c.fullName}</span>
                    <span className="shrink-0 text-[12px] text-muted tabular">{c.phone}</span>
                  </button>
                ))
              : null}
          </div>
          {canRegister ? (
            <Button
              variant="secondary"
              onPress={() => {
                // Carry what was typed over: a phone number or a name, whichever it looks like.
                const typed = query.trim();
                const looksLikePhone = /^[\d\s\-+().]{6,}$/.test(typed);
                setForm({ ...emptyCustomerForm, ...(looksLikePhone ? { phone: typed } : { fullName: typed }) });
                setExisting(null);
                setRegistering(true);
              }}
            >
              <Plus className="size-4" />
              Register a new customer
            </Button>
          ) : null}
        </>
      )}
    </PosDialog>
  );
}
