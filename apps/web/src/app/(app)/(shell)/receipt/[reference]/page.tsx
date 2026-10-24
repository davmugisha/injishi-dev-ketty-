import { ReceiptScreen } from "@/components/receipt/receipt-screen";
import { ReceiptCancel } from "./receipt-cancel";

/**
 * `/receipt/<booking reference>` — the RRA EBM receipt for one stay (C8, C9).
 *
 * The URL shape is a contract, not a preference: the confirmation screen
 * (`components/book/checkout-outcome.tsx`) links to `/receipt/${reference}`,
 * and the reference is the code the guest was already shown, so a person can
 * type this address from a printed confirmation. Renaming the segment breaks
 * that link and every one already sent.
 *
 * It sits under `(shell)`, so the sidebar and topbar frame it like any other
 * personal screen. Neither prints: the print rules in
 * `components/receipt/receipt.module.css` reduce the page to the paper.
 *
 * This file does nothing but read the segment. The work is in
 * `<ReceiptScreen>`, which has to run in the browser — the API guards the
 * receipt with `SessionGuard`, and the Better Auth cookie belongs to the API
 * origin, so a server component would ask as nobody and be answered 401.
 *
 * NOT GATED BY `proxy.ts`, on purpose, and it does not need to be. The
 * matcher there is an allowlist of private PREFIXES; this route renders no
 * booking data of its own, and the receipt itself is refused by the API to
 * anyone who does not own it. What a signed-out visitor gets here is the
 * screen's own "sign in to see this receipt" state, which is the same outcome
 * a redirect would produce with one fewer round trip.
 */
export const metadata = { title: "Receipt" };

export default async function Page({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return (
    <>
      <ReceiptScreen reference={reference} />
      <ReceiptCancel reference={reference} />
    </>
  );
}
