/**
 * Money, formatted the one way.
 *
 * Lifted out of the registration wizard because `/host/start` needs the same
 * string and that page is a Server Component: importing it from `wizard-ui.tsx`
 * would pull a `"use client"` module into a server render to borrow one pure
 * function, and would tie a marketplace page to a file inside the `(app)`
 * route group.
 *
 * Amounts are whole Rwandan francs. There are no minor units to guess at, and
 * no currency to pick — so this takes a number and never an options object.
 */
export function formatRwf(amount: number): string {
  return `RWF ${amount.toLocaleString("en-RW")}`;
}
