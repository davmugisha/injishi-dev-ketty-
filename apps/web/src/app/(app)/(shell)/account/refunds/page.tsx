import { RefundsScreen } from "@/components/app/refunds-screen";

export const metadata = { title: "Refunds" };

/**
 * A guest's refunds (073-gtbank-payments AC-12, AC-12a): what is owed back to
 * them, in plain words, and the form the bank's payee details go through when
 * their account holds no verified identity. Behind the `/account` gate in
 * `middleware.ts`; the API scopes every row to the session's own payments.
 */
export default function Page() {
  return <RefundsScreen />;
}
