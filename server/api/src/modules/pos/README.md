# Bar and restaurant point of sale (phase 1)

The POS described in `apps/app/bar_restaurant_pos_claude_spec.md`, built on the platform's own
outlets, menu (`service_items`), branches (properties) and permissions. Phase 1 covers tables,
orders, kitchen and bar tickets, payments with split bills and refunds, registers and cashier
shifts, with an audit trail. Inventory, purchasing, fiscal documents, accounting and reports are
later phases.

> **Demo only.** Every payment except cash is answered by a simulator. No MTN MoMo, Airtel Money,
> card scheme, bank, RRA, EBM or VSDC system is contacted. Bills are stamped
> **“DEMO ONLY — NOT A VALID RRA/EBM TAX INVOICE.”** The 18% VAT is the illustrative rate in
> `config_entries.tax_rates`; real rates and invoice rules must be confirmed with RRA.

## Run it

```sh
pnpm dev:stack        # Postgres, Redis, Mailpit; migrates, marks sample, seeds (seed-demo-pos.mjs included)
pnpm api:dev          # API on :8000
pnpm dev              # web on :3000, operator app on :3002
```

Open <http://localhost:3002/sign-in> and sign in with one of the accounts below. The code is
**123456** on the demo stack, for both the sign-in and the second factor.

| Account | Role | Lands on | Branches |
|---|---|---|---|
| `owner@pos.demo.injishi.com` | owner | owner workspace (open `/pos/floor`) | all |
| `manager@pos.demo.injishi.com` | manager | manager workspace (open `/pos/floor`) | Kimihurura |
| `cashier1@pos.demo.injishi.com` | cashier | `/pos/floor` | Kimihurura |
| `cashier2@pos.demo.injishi.com` | cashier | `/pos/floor` | both |
| `waiter1@pos.demo.injishi.com` | waiter | `/pos/floor` | Kimihurura |
| `waiter2@pos.demo.injishi.com` | waiter | `/pos/floor` | Rubavu |
| `bartender@pos.demo.injishi.com` | bartender | `/pos/floor` | Kimihurura |
| `kitchen1@pos.demo.injishi.com`, `kitchen2@…` | kitchen | `/pos/stations` | Kimihurura, Rubavu |
| `stock@pos.demo.injishi.com` | stock controller | storekeeper shell (no POS permissions yet) | all |
| `accounts@pos.demo.injishi.com` | finance | finance workspace | all |

Screens: `/pos/floor` (tables), `/pos/till?order=…` (order and checkout), `/pos/stations`
(kitchen and bar), `/pos/shift` (cashier shift and reviews). The older `/pos`, `/pos/payment` and
`/kitchen` prototypes are unchanged and still show sample data.

## Reset the demo data

```sh
cd server/api
DATABASE_URL=postgres://injishi:injishi@localhost:5434/injishi node scripts/seed-demo-pos.mjs --reset
```

`--reset` deletes and reseeds only this group's POS trade (orders, tickets, payments, shifts,
audit rows) in the Ikirezi workspace. It refuses any database that is not marked sample, so it
can never touch production. Without `--reset` the script tops up the group and keeps trade
already there.

## Test it

```sh
pnpm --filter @injishi/contracts test                     # money, settlement, transitions, requests
pnpm --filter @injishi/api exec jest                      # API unit tests
cd server/api && DATABASE_URL=… node scripts/verify-pos.mjs   # end to end over HTTP (then --reset)
pnpm --filter @injishi/app exec tsx --test tests/*.test.ts
```

`verify-pos.mjs` walks the spec's workflow tests against a running API: order to tickets to
served to checkout; split cash and simulated MoMo; failed and pending payments with safe retries;
discounts and approval; voids and cancellation with authorization and audit; refunds; a shift
close with a variance; branch and tenant isolation.

## How it is built

| Layer | Where |
|---|---|
| Money, statuses, request and response shapes | `packages/contracts/src/pos.ts` |
| Tables (migration `0073_pos_floor_orders_payments_shifts`) | `server/api/src/database/drizzle/pos.ts` |
| Services, payment simulator | `server/api/src/modules/pos/` |
| Routes, `/api/v1/ops/pos/*` | `server/api/src/api/public/ops/pos.controller.ts` |
| Demo data | `server/api/scripts/seed-demo-pos.mjs` |
| Screens | `apps/app/src/features/pos/`, `apps/app/src/app/(device)/pos/{floor,till,stations,shift}` |

**Rules the code holds**

- **Money** is whole RWF in integers. Tax is per line, rounded half up, inclusive or exclusive by
  the outlet's `pos_outlet_settings.tax_mode`, copied onto the order when it opens. An order
  discount is shared across lines (largest remainder) before tax. `orderAmounts` in contracts is
  the one calculator; the seed uses it too.
- **Three statuses.** An order's status (where the food is), its payment state (derived by
  `settlementOf` from its payments, never stored) and, in a later phase, its fiscal status.
- **Snapshots.** A line keeps the name, item code, unit price, options, tax code and rate it was
  added with.
- **Idempotency.** Creating an order (`Idempotency-Key` header), taking a payment and refunding
  (`idempotencyKey` in the body) replay the first result. A line can sit on one kitchen ticket
  only. A reprint is a new print job and never a ticket.
- **Refunds** correct a settled bill. They reduce net sales and the drawer and never reopen the
  bill.
- **Shifts.** Cash needs the cashier's own open shift. At close the expected cash
  (float + cash sales + cash tips − cash refunds + paid in − approved paid out), the count and the
  variance are frozen. A paid out waits for `shift.review` unless its author holds it. Nobody
  reviews their own shift or approves their own paid out.
- **Permissions** are checked on every route and again in the services where a permission is not
  enough (a sent line needs `pos.override`). Every read is filtered by workspace and branch scope.
- **Audit.** Voids, cancellations, discounts, payments, refunds, cash movements, shift close and
  review, table moves and settings changes write `pos_audit_events` in the same transaction.

## Roles and permissions added

Roles `cashier`, `waiter`, `bartender`, `kitchen` and `stock_controller` (database enum
`org_role`; Postgres cannot drop an enum value, so these stay). Permissions in the services and
money areas: `pos.sell`, `pos.checkout`, `pos.discount`, `pos.override`, `pos.refund`,
`table.manage`, `kitchen.work`, `register.operate`, `shift.review`. Owners and managers hold them
all; `finance` keeps exactly its ADR-069 seven, and a business can grant it more (ADR-055).

## Replacing the simulator with a real provider

`domain/payment-simulator.ts` defines `PosPaymentPort` (`start`, `resolve`). `pos.module.ts`
binds it to `DemoPaymentSimulator` and nothing else. A production adapter would need:
merchant credentials and a signed agreement with MTN, Airtel or the card acquirer; callbacks
(webhooks) verified by signature that call the same transition `resolve` uses; reconciliation
against settlement reports; and a deliberate change to `pos.module.ts`. Fiscal documents need RRA
VSDC certification; the platform's `ebm` module is the place for that, and phase 4 adds the
demo fiscal simulator behind its own port.

## Back office (dashboard, reports, stock, expenses)

Added after phase 1, on the existing tables and with no migration:

| Screen | API | Needs |
|---|---|---|
| `/pos/dashboard` | `GET /ops/pos/dashboard` | `shift.review` or `money.view` |
| `/pos/reports` | `GET /ops/pos/reports?from&to&outletId` | `shift.review` or `money.view` |
| `/pos/stock` | `GET /ops/pos/stock`, `POST /ops/pos/stock/adjust` | `stock.manage` (read: or `shift.review`) |
| `/pos/menu` | `GET /ops/pos/outlets/:id/menu` (existing) | any floor permission |
| expenses panel on Reports | `POST /ops/pos/expenses`, `POST /ops/pos/expenses/:id/void` | `expense.manage` |

- **Stock** is `service_items.stock_qty` (`null` = not tracked). Sending an order takes stock out, once, in the
  same transaction; a void or a cancellation puts back what was never served; people record damaged, broken,
  expired, spilled, staff use, received and counted stock with a reason. Every change is a `pos_audit_events`
  row (`stock.*`), which is the movement history. A sale that would take stock below zero is refused.
- **Expenses** reuse the platform's `expenses` table (categories, methods, void with a reason).
- **Reports** are computed from the POS tables on every request. A day is a Kigali calendar day; sales are
  orders *completed* in the window, collections are payments *settled* in it.
- `stock.manage` is a new permission: owner, manager and the stock controller.
- **Cost of goods is an estimate** (`COST_OF_GOODS_RATIO`, 35% of selling price) because no cost price is stored
  per item, and "low stock" is a fixed `LOW_STOCK_AT` (10). Per-item cost and reorder level need a migration.

## Known limitations of phase 1

- Stock has no cost, supplier, purchase-order or recipe model yet (valuation and profit use the estimate above).
- No fiscal document is raised for a POS sale yet (phase 4), and no journal is posted (phase 5).
- Customer credit is listed as a method but refused until customer accounts exist.
- Split bills move whole lines and only before the first payment; a line cannot be split by
  quantity.
- The demo outlets price VAT inclusive and are not offered to the guest app, whose ordering
  reads every price as exclusive; enabling guest ordering on an inclusive outlet would price the
  same item two ways.
- Floor and board screens refresh by polling (every 15 and 10 seconds), not by push.
- Menu editing, table and station setup, settings screens and the audit log screen are later phases;
  their API reads (`GET /ops/pos/audit`, `PATCH /ops/pos/outlets/:id/settings`) exist already.
