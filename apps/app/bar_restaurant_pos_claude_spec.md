# Bar & Restaurant POS — Product & Implementation Specification

## Instructions to the coding agent

Build a complete, polished Bar & Restaurant Point of Sale (POS) and management application based on this specification.

- First inspect the existing repository, project conventions, dependencies, and current implementation. Reuse the existing stack and established patterns. **Do not change or prescribe a programming language or framework.**
- Use **dummy/demo data only**. Do not connect to real RRA systems, EBM/VSDC, MTN MoMo, Airtel Money, banks, email/SMS providers, or any external production service.
- Make the application functional end-to-end with realistic seeded data and simulated integrations. Clearly label simulated payments, fiscal documents, and other demo-only behavior.
- Do not stop after producing a plan or static mockups. Implement the working application, including screens, navigation, interactions, validation, persistence supported by the existing project, and tests where practical.
- If a feature requires credentials, regulatory approval, hardware, or external service access, implement a safe demo adapter and document what would be required for production.
- Do not claim that demo receipts are legally valid Rwandan tax invoices or that simulated payment transactions move real money.
- Keep the UI responsive, accessible, consistent, and suitable for use on desktop POS terminals, tablets, and mobile devices.

## 1. Product vision

Create a comprehensive POS and management system for bars, restaurants, cafés, and hospitality businesses operating in Rwanda. The system should support day-to-day service and give managers a clear view of sales, inventory, staff activity, expenses, and business performance.

The application should be designed with multi-branch and multi-tenant concepts in mind, even if the demo starts with one fictional organization and a few branches.

Default locale and demo conventions:
- Country: Rwanda
- Currency: RWF (Rwandan franc)
- Time zone: Africa/Kigali
- Date/time and number formatting should be appropriate for Rwanda.
- Use believable fictional names, products, prices, supplier records, staff, orders, and reports.
- Use fictional TINs and payment references that are unmistakably demo data; do not use real people's personal information.

## 2. Main user roles and access

Implement role-aware navigation and permissions for:
- **Platform administrator:** demo tenant management, plan/status overview, support/audit visibility.
- **Business owner:** all business data, reports, branch settings, staff and financial summaries.
- **Branch manager:** branch operations, approvals, staff, menu, stock and reports.
- **Cashier:** register, orders, payment simulation, receipts and own shift.
- **Waiter/server:** tables, orders, item modifiers, order notes and order status.
- **Bartender:** bar preparation queue and beverage ticket statuses.
- **Kitchen staff:** kitchen preparation queue and item statuses.
- **Stock controller:** inventory, stock counts, receiving, transfers and waste records.
- **Accountant:** expenses, supplier balances, accounting reports and fiscal-demo reconciliation.

Use demo login/role switching if no authentication system exists. Clearly identify it as demo access. If authentication already exists, seed demo accounts and preserve the existing auth architecture. Enforce permissions in the application logic, not only by hiding UI controls.

## 3. Navigation and main screens

Create a clear application shell with a sidebar or responsive navigation, branch selector, current user/role, notifications, search where useful, and clear page titles.

Required modules and screens:

1. Dashboard
2. POS / New Sale
3. Tables and Dining Areas
4. Orders
5. Kitchen Display
6. Bar Display
7. Menu and Products
8. Categories, Variants and Add-ons
9. Inventory and Stock Movements
10. Recipes and Ingredients
11. Suppliers and Purchasing
12. Goods Receiving
13. Stock Counts and Transfers
14. Customers and Loyalty
15. Payments and Refunds
16. Cash Registers and Shifts
17. Fiscal Documents (demo simulator)
18. Expenses
19. Accounting and Financial Reports
20. Employees and Roles
21. Sales and Operational Reports
22. Branch Management
23. Settings
24. Audit Log
25. Demo Platform Administration, if multi-tenant UI is included

Every listed module should have a meaningful working screen. Avoid dead navigation items, empty buttons, or controls that do nothing. Where a complete production integration is outside the demo scope, implement a working simulation and label it.

## 4. Dashboard

Show realistic demo metrics such as:
- Today's gross sales, discounts, refunds, net sales and estimated tax.
- Orders, average order value and active tables.
- Sales split by cash, simulated MTN MoMo, simulated Airtel Money, card and bank transfer.
- Best-selling menu items and food-versus-drink sales.
- Low-stock alerts, wastage, pending purchase orders and supplier balances.
- Open cashier shifts and cash variances.
- Kitchen/bar queue and average preparation time.
- Fiscal demo documents: accepted, pending, failed and needing reconciliation.
- Recent orders, payments and audit events.
- Date-range and branch filters.

Metrics must derive from seeded application data and update after demo actions; do not hardcode dashboard numbers that contradict the displayed records.

## 5. POS workflow

Build a fast, touch-friendly POS interface.

### Product selection
- Browse/search menu categories and products.
- Show product image placeholders or locally available assets, price, availability and category.
- Support variants (for example, small/large), add-ons, modifier groups, quantities and item notes.
- Prevent selling unavailable products unless a permitted override is explicitly implemented.
- Support configurable menu prices by branch.
- Allow dine-in, takeaway, delivery and optional room-service/event-catering order types.

### Cart and order creation
- Add, update and remove cart lines.
- Apply authorized item/order discounts with a reason and approval flow when over a configured threshold.
- Calculate subtotal, discount, tax and total using a centralized, tested calculation service.
- Support tax-inclusive and tax-exclusive price configuration, with clear demo tax settings.
- Store order-line snapshots of product name, SKU, quantity, unit price, discounts and tax so future menu edits do not rewrite historical orders.
- Save drafts, submit orders, add items later, and track status changes.
- Show clear confirmation for destructive actions and require cancellation reasons.
- Support order notes and customer association without requiring customer data for walk-in orders.

### Tables and service
- Display a visual table layout grouped by dining area.
- Table states: available, occupied, reserved, bill requested and cleaning (or similar).
- Open/close table sessions; assign a waiter; add orders; transfer orders; merge/split bills where appropriate.
- Support multiple orders during a table session.
- Avoid treating a table as the order itself.
- Make state changes visible across relevant screens using the app's existing state/realtime patterns.

### Checkout and split bills
- Show a detailed bill with items, modifiers, discounts, tax, total and payments.
- Support partial payments, split bills and multiple payment methods on one order.
- Demo methods: cash, simulated MTN MoMo, simulated Airtel Money, card, bank transfer, voucher and customer credit where enabled.
- Record each payment separately with a unique demo reference and explicit status.
- Mark an order paid only when settlement rules are satisfied.
- Support receipt preview and print-friendly output. Clearly label all demo fiscal content.
- Simulate provider pending/success/failure outcomes. Never call an actual provider.
- Make retry actions idempotent so they do not duplicate payments.

## 6. Kitchen and bar displays

Implement separate kitchen and bar preparation screens:
- Group tickets by preparation station.
- Show order/ticket number, elapsed time, items, quantities, modifiers, allergies/notes if entered, and waiter/table.
- Status flow should support queued, preparing, ready, served/completed, and cancelled where appropriate.
- Allow staff to start, mark ready, and complete tickets.
- Route products to a station using configurable product-to-station mappings.
- A single order can generate tickets for multiple stations.
- Show visual urgency for long-waiting tickets.
- Keep item status history.
- Simulate printer jobs and reprints without requiring physical hardware.
- Reprinting must never create another order or consume inventory twice.

## 7. Menu and product catalog

Support:
- Categories and nested categories.
- Products, SKU, description, product type, active/available status and optional image.
- Variants and branch-specific prices.
- Add-ons and modifier groups with minimum/maximum selections.
- Combos/bundles.
- Units of measure.
- Product tax category and effective-dated tax rules.
- Preparation station routing.
- Search, filtering, sorting, pagination where useful, and create/edit/archive actions.
- Validation against invalid prices, duplicate SKU rules, invalid modifier limits and incompatible units.

Use fictional menu data such as brochettes, grilled fish, chips, rice, beans, burgers, coffee, juice, soda, bottled water and beer. Use reasonable demo prices in RWF and mark tax configuration as illustrative.

## 8. Inventory, ingredients and recipes

Model inventory with a stock movement ledger rather than relying solely on an editable stock quantity.

Required features:
- Inventory items, units, conversion factors, branch stock levels and reorder thresholds.
- Opening stock, purchase receipts, sales consumption, returns, transfers, wastage, staff consumption, complimentary items and adjustments.
- Recipe definitions and versioning for menu products.
- Recipe ingredients and required quantities.
- Bottle, crate, glass, gram, kilogram, millilitre and litre use cases where relevant.
- Support fractional stock quantities where units require them.
- Stock count sessions with expected quantity, counted quantity, variance, reason and approval.
- Low-stock alerts and stock valuation.
- Supplier records, purchase orders, partial receiving, goods receipts and supplier invoices.
- Inter-branch transfers with requested, approved, dispatched and received states.
- Expiry/batch tracking for applicable items; support FEFO where practical.
- Waste records with reasons such as expired, damaged, spillage, preparation error and staff consumption.
- Inventory movement history with actor, source, timestamp and quantity delta.

Important rules:
- A completed sale consumes recipe ingredients once, according to a clear configured business event. Do not deduct the same stock at both order submission and payment.
- Cancelled/voided items should create appropriate compensating movements if stock was already consumed.
- Prevent duplicate inventory consumption when a request is retried.
- Keep stock balance summaries reconcilable to movement records.
- Record adjustments; do not silently overwrite quantities.
- Use a documented costing approach in demo reports, such as weighted average, and keep it consistent.

Demo example: a crate of 24 beers purchased for RWF 18,000 has a cost of RWF 750 per bottle before other costs. Seed stock movements and sales that make stock reports internally consistent.

## 9. Payments, registers and cashier shifts

Required features:
- Registers per branch/device.
- Opening cash float, cashier shift opening and closing.
- Expected cash calculation, actual cash count, variance and manager review.
- Cash paid-in/paid-out with reasons and authorization.
- Multiple payment records per order.
- Payment transaction/provider references and reconciliation status.
- Refund requests with reason, amount validation and permission checks.
- Payment reconciliation for simulated provider settlement.
- Tips and optional allocations to staff.
- Clear separation of payment status from order status and fiscal document status.

Demo payment states can include initiated, pending, successful, failed, cancelled, expired and refunded. Make all demo provider responses visibly simulated. A screenshot or user-provided reference must not be treated as proof of a real payment.

## 10. Rwanda tax and fiscal-document demo

This project must **not** connect to live RRA/EBM/VSDC systems. Build a clearly labeled **Fiscal Demo Simulator** behind an adapter interface so a future approved integration can replace it.

The simulator should:
- Create a demo fiscal document from a settled or otherwise eligible order according to configurable demo rules.
- Store an immutable snapshot of line descriptions, quantities, prices, discounts, tax categories/rates, totals and currency.
- Simulate accepted, pending, rejected and unknown/timeout outcomes.
- Store demo request references, response references, timestamps, error codes and sanitized demo response details.
- Allow safe retry/reconciliation without duplicate document creation.
- Show a fiscal health panel and lists for accepted, pending, rejected and unreconciled documents.
- Link any demo credit note/correction to its original document.
- Clearly stamp previews and printouts: **“DEMO ONLY — NOT A VALID RRA/EBM TAX INVOICE.”**
- Never generate a real-looking fiscal signature, claim official acceptance, or imply legal validity.

Tax requirements:
- Make tax rules configurable and effective-dated.
- Distinguish tax-inclusive and tax-exclusive prices.
- Preserve tax snapshots on orders and fiscal documents.
- Use decimal-safe money calculations and an explicit rounding policy.
- Seed an illustrative 18% VAT example only as demo configuration, not as a universal rule for all products/businesses.
- Show a disclaimer that real tax rates, classifications, invoice rules, VSDC specifications and certification must be confirmed with RRA before production.
- Do not label ordinary receipts as legally compliant EBM invoices.

## 11. Customers and loyalty

Support optional customer profiles with:
- Name, phone, email, optional TIN and notes.
- Order history and customer search.
- Loyalty account, points earned/redeemed and transaction ledger.
- Optional customer credit account and ledger if enabled.
- Consent/preferences for communications where relevant.

Walk-in orders must work without collecting customer details. Use fictional demo identities and phone numbers. Avoid using actual personal data.

## 12. Purchasing and suppliers

Support:
- Suppliers, contact details and fictional demo TINs.
- Purchase order creation, approval, cancellation and receiving.
- Partial receipts and discrepancy tracking.
- Supplier invoices and due dates.
- Supplier returns.
- Supplier balances and payment records.
- Purchase price history.
- Inventory updates only on the correct receiving/adjustment event.
- Audit trail for purchase and receiving changes.

## 13. Expenses and accounting

Implement a useful demo accounting module, not just a collection of totals.

### Expenses
- Categories such as rent, utilities, transport, cleaning, repairs, supplies and other operating costs.
- Amount, date, branch, supplier (optional), payment method, tax amount/category where applicable, attachment placeholder, status and creator.
- Approval where configured.
- Separate paid/unpaid expenses.

### Double-entry accounting foundation
- Chart of accounts.
- Accounting periods and close/reopen permissions.
- Journal entries and journal lines.
- Configurable mappings from business events to accounts.
- Draft, posted and reversed entry states.
- Posted journal entries must balance (total debits equal total credits).
- Posted entries cannot be silently edited or deleted; use reversal/correction entries.
- Idempotent posting to avoid duplicate journals when an event is retried.
- Reports: trial balance, general ledger, profit and loss, balance sheet, cash movement, supplier balances and customer balances where supported.
- Reconcile sales, payments, refunds, inventory consumption, fiscal-demo documents and expenses.

Illustrative example only: for a hypothetical taxable sale totaling RWF 11,800 with an illustrative 18% VAT rate included, a conceptual posting may debit cash/payment clearing RWF 11,800, credit revenue RWF 10,000 and credit VAT payable RWF 1,800. Ensure the implemented calculation agrees with whether the configured price is tax-inclusive or exclusive. Do not apply this example indiscriminately.

Do not calculate accounting profit simply as cash received minus purchases paid. Clearly distinguish sales, collections, taxable turnover, gross profit and net profit.

## 14. Staff, shifts and audit

Support:
- Employee profiles linked optionally to application users.
- Branch assignment, role and active status.
- Attendance clock-in/clock-out demo records.
- Employee shifts and handover notes.
- Tips and optional tip allocation.
- Sales by waiter/cashier and shift variance reporting.
- Permission-controlled actions and approval flows.
- Audit log capturing actor, branch, action, entity, entity ID, timestamp and before/after values for sensitive changes.

Sensitive audited actions should include discounts, voids, cancellations, refunds, stock adjustments, purchase approvals, role changes, fiscal-demo actions, shift closure and accounting postings.

## 15. Reports and analytics

Implement working reports with branch/date filters and sensible empty states:
- Sales summary by day/week/month/custom range.
- Gross sales, discounts, refunds, net sales, tax and total collected.
- Sales by product, category, hour, service type, branch, cashier and waiter.
- Food-versus-drink sales.
- Top and low-performing menu items.
- Average order value, orders per hour and table turnover where the data supports it.
- Cashier expected-versus-counted cash and variances.
- Payment method summary and simulated provider reconciliation.
- Inventory on hand, inventory valuation, low stock, stock movement, wastage and stock-count variance.
- Ingredient consumption and theoretical-versus-actual stock variance where recipes/counts allow it.
- Purchases, supplier balances and expenses.
- Gross margin and estimated profitability based on recorded cost assumptions.
- Fiscal demo document status and reconciliation.
- Accounting trial balance, general ledger and profit/loss where implemented.

Reports must calculate from actual seeded and mutated records. Use consistent definitions and state any limitations of demo costing or accounting.

## 16. Settings and multi-branch readiness

Support:
- Organization profile and branch records.
- Branch timezone, address, phone and currency.
- Configurable receipt header/footer and demo labels.
- Menu price overrides per branch.
- Tax configuration with effective dates.
- Preparation stations and printer routing.
- Discount limits and approval rules.
- Stock thresholds and costing method.
- Payment methods enabled per branch.
- User/role/permission management.
- Audit settings and demo feature toggles.

Include organization and branch IDs in the data model wherever applicable. Every data access path must enforce the selected user's authorized organization and branch scope. If true multi-tenant administration is included, do not expose one tenant's business data to another tenant.

## 17. Suggested data model

Adapt names and types to existing repository conventions. The following entities describe the minimum conceptual schema; normalize where appropriate and add foreign keys, indexes, constraints, timestamps and soft-delete/archive fields where useful.

### Organization and access
- `organizations`
- `branches`
- `business_settings`
- `users`
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- `user_sessions` (if applicable)
- `audit_logs`

### Catalog
- `product_categories`
- `products`
- `product_variants`
- `product_prices`
- `product_addons`
- `product_addon_groups`
- `product_addon_group_items`
- `units_of_measure`
- `tax_categories`
- `product_tax_rules`
- `combo_products`
- `preparation_stations`
- `product_station_routes`

### Tables, reservations and orders
- `dining_areas`
- `restaurant_tables`
- `table_sessions`
- `reservations`
- `customers`
- `orders`
- `order_items`
- `order_item_addons`
- `order_discounts`
- `order_item_status_history`
- `order_events`
- `order_transfers`

### Kitchen and printing
- `kitchen_tickets`
- `kitchen_ticket_items`
- `kitchen_ticket_events`
- `printers`
- `print_jobs`

### Inventory and purchasing
- `inventory_items`
- `branch_inventory`
- `stock_balances`
- `recipes`
- `recipe_ingredients`
- `inventory_movements`
- `stock_batches`
- `stock_counts`
- `stock_count_lines`
- `stock_transfers`
- `stock_transfer_lines`
- `suppliers`
- `purchase_orders`
- `purchase_order_lines`
- `goods_receipts`
- `goods_receipt_lines`
- `supplier_invoices`
- `waste_records`

### Payments and cash management
- `registers`
- `cashier_shifts`
- `cash_movements`
- `payments`
- `payment_allocations`
- `payment_transactions`
- `payment_refunds`
- `payment_reconciliations`
- `payment_reconciliation_lines`
- `tips`
- `tip_allocations`

### Fiscal demo
- `fiscal_profiles`
- `fiscal_devices`
- `fiscal_documents`
- `fiscal_document_lines`
- `fiscal_submissions`
- `fiscal_responses`
- `fiscal_credit_notes`
- `fiscal_sync_state`

### Finance and accounting
- `expense_categories`
- `expenses`
- `chart_of_accounts`
- `accounting_periods`
- `journal_entries`
- `journal_entry_lines`
- `supplier_bills`
- `supplier_bill_lines`
- `supplier_payments`
- `customer_accounts`
- `customer_ledger_entries`
- `bank_accounts`
- `bank_transactions`
- `accounting_mappings`

### Employees and notifications
- `employees`
- `employee_shifts`
- `attendance_records`
- `payroll_exports` (export/demo only unless payroll is in scope)
- `loyalty_accounts`
- `loyalty_transactions`
- `notifications`
- `notification_jobs`
- `webhook_events` (for simulated events/integration readiness)
- `attachments`

Do not create meaningless tables just to match this list. Implement the relevant relationships and workflows coherently. If the repository already has a schema, inspect and extend it rather than replacing it blindly.

## 18. Important business rules and integrity

- Use decimal-safe arithmetic for all money; never rely on binary floating-point for financial calculations.
- Store currency explicitly on monetary records.
- Store timestamps consistently and display them in the branch timezone.
- Use database transactions for multi-record operations such as checkout, stock consumption and journal posting.
- Use idempotency keys or unique source references for payment simulations, fiscal submissions, stock consumption and accounting postings.
- Enforce valid state transitions server-side/domain-side.
- Keep order, payment, inventory and fiscal-document statuses separate.
- Preserve historical snapshots of sold products, price, discount and tax.
- Prevent duplicate checkout, duplicate stock consumption, duplicate payment records and duplicate accounting entries on retries.
- Never silently delete or rewrite financial history. Use void/reversal/correction records and audit logs.
- Validate all user input and authorization on the server/backend, not only in the UI.
- Use pagination for large lists and indexes for common organization/branch/date/status lookups.
- Handle loading, empty, error, success and retry states in all important screens.
- Use confirmation and a reason for destructive/sensitive actions.
- Seed data must be internally consistent across orders, payments, stock, fiscal demo documents and accounting entries.

## 19. Demo data requirements

Seed a convincing, coherent fictional restaurant group with at least:
- One fictional organization and two branches.
- One owner, one manager, two cashiers, two waiters, one bartender, two kitchen users, one stock controller and one accountant.
- Several dining areas and at least 12 restaurant tables across branches.
- At least 30 menu products across food, drinks, coffee, soft drinks, sides and desserts.
- Multiple product variants, add-ons, combos and preparation stations.
- At least 20 inventory items and 10 recipes with plausible unit conversions.
- At least 5 suppliers and purchase records with receipts.
- Orders in several statuses, including open dine-in orders, preparing/ready tickets, completed orders, cancellations and refunds.
- Successful, pending and failed **simulated** payment transactions.
- Multiple cashier shifts, including one with a cash variance.
- Stock movements, low-stock items, waste, stock counts and a branch transfer.
- Fiscal demo documents in accepted, pending, rejected and unknown/timeout states.
- Expenses, supplier balances, journal entries and reports with consistent calculations.
- Recent activity/audit records.

Use RWF values that look realistic for a demo. Avoid implausibly huge numbers. Seed data should produce useful charts and reports on first launch.

Provide a safe, clearly named **Reset Demo Data** action. It must warn that local demo changes will be reset and must never delete production data. If the environment has no production mode, still implement the reset carefully within the demo data boundary.

## 20. UI and UX quality

- Modern hospitality-focused visual design with a clear visual hierarchy.
- POS optimized for touch, quick product search and minimal checkout steps.
- Clear status chips, useful empty states, confirmation dialogs and inline validation.
- Consistent tables, forms, drawers/modals and page spacing.
- Responsive layouts for wide screens, tablets and phones.
- Accessible contrast, keyboard navigation, labels and focus states.
- Search, sorting and filters on long lists.
- Toasts or clear feedback for successful/failed actions.
- Avoid excessive gradients, unnecessary decoration and overcomplicated dashboards.
- Use realistic sample data, not lorem ipsum.
- Make the most frequent tasks easy to access.
- Keep dangerous actions (refund, void, stock adjustment, reset) clearly separated and protected.

## 21. Testing and acceptance criteria

Add or update tests according to the existing project conventions. At minimum verify:

### Calculation tests
- Item totals, modifiers, discounts, tax-inclusive and tax-exclusive calculations.
- Rounding behavior and multiple quantities.
- Split payments and outstanding balances.

### Workflow tests
- Create order → submit → kitchen/bar ticket → ready/served → checkout.
- Split payment across cash and a simulated mobile-money transaction.
- Failed/pending payment and safe retry without duplicates.
- Order cancellation and refund with authorization and audit record.
- Purchase order → goods receipt → stock movement.
- Recipe consumption exactly once for the chosen business event.
- Stock count variance and approved adjustment.
- Fiscal simulator accepted, pending, rejected and timeout outcomes.
- Fiscal retry/reconciliation without duplicate document.
- Balanced journal posting and prevention of duplicate posting.
- Cashier shift close and variance calculation.
- Tenant/branch permission isolation.

### UI acceptance
- Every navigation item opens a useful screen.
- Every primary button has a working action.
- Forms validate and provide success/error feedback.
- Dashboard/report metrics change when demo data changes.
- Empty/loading/error states are handled.
- The app remains usable at desktop POS, tablet and mobile widths.
- No real external service calls or credentials are required.

## 22. Implementation order

Work in this order unless the existing repository makes a different order clearly safer:

1. Inspect repository and summarize the current architecture briefly.
2. Identify the existing entry points, styling system, routing, data access, authentication and tests.
3. Build or extend the shared domain/data model and seed consistent demo data.
4. Implement application shell, role-aware navigation and dashboard.
5. Implement catalog, tables and end-to-end POS order workflow.
6. Implement kitchen/bar displays and simulated printing.
7. Implement payments, shifts, split bills and refunds using simulated providers.
8. Implement inventory, recipes, purchasing and stock counts.
9. Implement fiscal demo simulator and reconciliation.
10. Implement expenses, accounting foundation and reports.
11. Implement settings, audit logs and permission enforcement.
12. Add tests, fix errors, verify the main workflows and document how to run/reset the demo.

Do not replace working parts of the repository unnecessarily. Keep changes incremental and follow existing conventions.

## 23. Final deliverables

When implementation is complete:
- Provide the working application in the repository.
- Provide seeded dummy data and a documented demo login/role-switching method.
- Document setup, running, testing and resetting demo data.
- Document implemented modules and any intentionally simplified behavior.
- Document the simulated payment and fiscal adapters and how real providers could be integrated later.
- List any remaining limitations honestly.
- Confirm which tests/build checks were actually run and their outcomes.
- Do not claim production tax compliance, real payment capability, or regulatory approval.

**Priority:** Build a coherent, working end-to-end demo, not just a large set of disconnected screens. Keep all demo financial and inventory data internally consistent.
