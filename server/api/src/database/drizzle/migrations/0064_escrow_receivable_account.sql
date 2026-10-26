-- Money a guest paid online and the platform holds in escrow until payout.
--
-- A booked guest's bill gains a "Paid online, held in escrow" line at check in
-- (front-desk.service.ts). It is not cash in the host's till, so it cannot post
-- to CASH_MOBILE_MONEY like a payment taken at the counter: it is a receivable,
-- owed to the host when the escrow is released. Before this account the bill
-- had no line for the prepayment at all, the night audit's room charges showed
-- as owed, and the desk was prompted to collect a room the guest had paid for.
INSERT INTO "ledger_accounts" ("code", "type", "workspace_id") VALUES
  ('ESCROW_RECEIVABLE', 'asset', NULL)
ON CONFLICT ("code") DO NOTHING;
