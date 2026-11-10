import tseslint from 'typescript-eslint';

import injishi from '../../tools/eslint-rules/index.mjs';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { injishi },
    rules: {
      // ADR-074 D-f. The server never imports a product: a shape both sides
      // need belongs in `@injishi/contracts`. Nor the demo's fixtures.
      'injishi/product-boundaries': 'error',
      'injishi/no-demo-data': 'error',
      /**
       * ADR-012, AC-1. A mutating route behind `WorkspaceGuard` or
       * `StaffGuard` must say which power it needs, or every member
       * of the workspace may run it — a housekeeper approving a booking looks
       * exactly like a correct route in review.
       *
       * The allowlist holds the exceptions the ADR names, and only those. Each
       * one has to be typed here, where a reviewer sees it, so a fifth cannot
       * appear by accident.
       */
      'injishi/require-permission-on-guarded-route': [
        'error',
        {
          allow: [
            // `POST /api/v1/me/active-workspace`. The guard IS the whole check
            // here: switching into a workspace needs only that you hold it,
            // and there is no power to name. Demanding a permission would mean
            // inventing one that grants nothing.
            'MeController.setActiveWorkspace',
            // Every route of `/api/v1/ops/broker` (2026-10-25): the homes,
            // reveals and placements, the plan and its checkout, and the reads
            // beside them.
            //
            // `permissionsForWorkspace` returns an EMPTY array for any
            // workspace whose kind is not `business`, and a broker workspace is
            // kind `broker`. So there is no permission that a broker holds:
            // declaring any would refuse the one person the route exists for.
            // The workspace has a single holder, and `BrokerService` refuses
            // anything that is not an active broker's own workspace, which is
            // the whole check.
            //
            // The reads are listed because audit H1 extended this rule from
            // mutations to every verb; before that they needed no entry.
            'OpsBrokerController.summary',
            'OpsBrokerController.list',
            'OpsBrokerController.home',
            'OpsBrokerController.reveal',
            'OpsBrokerController.startPlacement',
            'OpsBrokerController.placements',
            'OpsBrokerController.earnings',
            'OpsBrokerController.reviews',
            'OpsBrokerController.plan',
            'OpsBrokerController.checkout',
            'OpsBrokerController.payment',
            'OpsBrokerController.change',
            'OpsBrokerController.cancel',
            'OpsBrokerController.homeDistrict',
            // The hotel deals (0124, 2026-11-02), for the same reason: the service refuses
            // anything that is not an active broker's own workspace, and a hotel outside the
            // plan or a deal that is not theirs is not found.
            'OpsBrokerController.hotels',
            'OpsBrokerController.brokerDeals',
            'OpsBrokerController.proposeDeal',
            'OpsBrokerController.withdrawDeal',
            'OpsBrokerController.endDeal',
            // Bookings under a running deal (0125), for the same reason.
            'OpsBrokerController.rooms',
            'OpsBrokerController.createBooking',
            'OpsBrokerController.brokerBookings',
            'OpsBrokerController.brokerBooking',
            // Commission and the payout number (0127), for the same reason.
            'OpsBrokerController.commissions',
            'OpsBrokerController.payoutAccount',
            'OpsBrokerController.setPayoutAccount',
            // `/api/v1/ops/broker/messages` (2026-10-26), for the same reason:
            // `PlacementMessagesService` refuses a workspace that is not a
            // broker's own (403) and a placement that is not theirs (404).
            'OpsBrokerMessagesController.list',
            'OpsBrokerMessagesController.unread',
            'OpsBrokerMessagesController.thread',
            'OpsBrokerMessagesController.send',
            'OpsBrokerMessagesController.read',
            'OpsBrokerMessagesController.file',
          ],
          /**
           * ADR-076 G10: the business controllers that answer to no one
           * product yet. Each names its owner and the ADR-074 stage that
           * decides its product (3 hr, 4 pms with property, 5 outlets and pos,
           * 6 finance, pay and fiscal, 7 account, residence, marketplace).
           * Every other `WorkspaceGuard` route that declares a permission
           * declares `@RequireProduct` or `@RequireAnyProduct`.
           */
          productAllow: [
            // The support assistant's operator tools (ADR-061), which edit a
            // listing for the person who approves it. Its own product, or
            // property's, is decided with the access model (stage 8).
            'AssistantController',
            // A host deciding a booking request: PMS's, outside `ops/`, so not
            // in slice G's table. Decided when PMS moves (stage 4).
            'BookingDecisionsController',
            // The business's licences and registrations on file:
            // platform/compliance, read by listings and money. Stage 7.
            'OpsCertificatesController',
            // Fiscal (EBM and the RRA item codes), a platform capability whose
            // product set ADR-074 does not name. Moves to platform/fiscal at
            // stage 6, which names it.
            'OpsEbmController',
            'OpsRraController',
            // Communications (the guest inbox and the desk's reply templates),
            // a platform capability whose product set ADR-074 does not name.
            // Named when PMS moves (stage 4).
            'OpsThreadsController',
            'OpsMessageTemplatesController',
            // Saved list views (058-list-framework): HR's lists and the owner's
            // Reports tabs share the route. Decided when HR moves (stage 3).
            'OpsListViewsController',
            // The owner's home and Reports, which read across every product.
            // Account's or Finance's: stage 6 or 7.
            'OpsOwnerDashboardController',
            'OpsReportsController',
            // Revenue: Finance's (`finance.money.view`). Stage 6.
            'OpsRevenueController',
            // The POS back office (dashboard, reports, stock, expenses): POS's
            // or Finance's. The money reads declare Finance's keys
            // (`finance.shift.review`, `finance.money.view`) and an expense is
            // money out, so like Revenue and Reports above it stays open where
            // POS is off until Finance moves. Stage 6 (5 for the stock routes).
            'OpsPosBackOfficeController',
            // Offers and refund requests: PMS's by their new keys
            // (`pms.offer.manage`, `pms.refund.decide`), outside slice G's
            // table. Stage 4.
            'OpsOffersController',
            'OpsRefundRequestsController',
            // Maintenance work orders and condition signals: PMS's by their new
            // key (`pms.ticket.advance`), outside slice G's table. Stage 4.
            'OpsWorkOrdersController',
            'OpsConditionSignalsController',
            // The staff phone. Slice G's table puts `staff-phone` under HR, but
            // these two serve housekeeping and maintenance work (cleaning
            // steps, minibar counts, found items, work order timers) and
            // declare PMS's permissions. Neither product is enforced until
            // `/architect` settles which; by content it is PMS (stage 4).
            'OpsHousekeepingPhoneController',
            'OpsWorkOrderTimeController',
          ],
        },
      ],
    },
  },
);
