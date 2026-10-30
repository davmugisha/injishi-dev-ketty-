/**
 * Whether a payment moves real money (mobile spec 0002, D-t). Every build is the beta today, so it
 * is `"sandbox"` and every payment screen wears the test money tag and banner; under `"live"` they
 * render nothing. Feature 24 replaces this constant with the API's answer.
 */
export type PaymentsMode = "sandbox" | "live";

export const paymentsMode: PaymentsMode = "sandbox";
