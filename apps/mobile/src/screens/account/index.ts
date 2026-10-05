/**
 * Account, for every seat — one screen that branches on surface, plus the eight
 * places its rows go.
 *
 * Route files stay one line each, which is what lets `app/` read as a route
 * table rather than as a second place screens live.
 *
 * Everything in `src/components` that this surface needed and did not find is
 * now IN `src/components`: Session 11 owns that lift, so unlike every other
 * surface this one built nothing shared inside its own folder. What is here is
 * Account's own — the per-seat fixtures, the formatters, and the screens.
 */

/* The tab */
export { Account } from './account';
export { IdentityCard } from './identity-card';

/* Where its rows go */
export { PayoutAccountSheet } from './payout-account';
export { OrganisationScreen } from './organisation';
export { StaffScreen } from './staff';
export { SubscriptionScreen } from './subscription';
export { RevealCreditsScreen } from './reveal-credits';
export { PersonalDetailsScreen } from './personal-details';
export { SecurityScreen } from './security';
export { PrivacyScreen, useCrashReportingChoice } from './privacy';
export { DiagnosticsScreen } from './diagnostics';
export { AppearanceSheet, APPEARANCE_GLYPH } from './appearance';
export { SignOutSheet } from './sign-out';

/* Reached from the switcher rather than from Account */
export { CreateWorkspaceSheet, ONBOARDING_URL, openOnboarding } from './create-workspace';

/* The state and its vocabulary, for a test */
export * from './account-fixtures';
export * from './account-format';
export * from './account-store';
