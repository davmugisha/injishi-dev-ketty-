/**
 * How the Roles editor lays out the permissions (ADR-055), as pure functions so
 * a test can hold them without a browser.
 *
 * Nothing here resolves what a role holds. The editor is handed two arrays per
 * role by the server, `basePermissions` and `permissions`, and these only
 * arrange and compare them. `can` and `permissionsForRole` stay unimportable in
 * this app (`injishi/no-client-authz`).
 */

import type { Permission, PermissionArea } from "@injishi/contracts";

/**
 * The order the areas read in, which is the order a shift runs in rather than
 * alphabetical: the desk, the rooms, the outlets, the money, the property, the
 * people. An area with no permission in it renders nothing at all.
 */
export const AREA_ORDER: readonly PermissionArea[] = [
  "front_desk",
  "rooms",
  "services",
  "money",
  "property",
  "people",
];

export interface AreaGroup {
  area: PermissionArea;
  permissions: Permission[];
}

/**
 * Every permission under its area, in the CONTRACT's order (`Permission.options`)
 * rather than by label.
 *
 * Sorting by label used to put "confirm the pay run" at the top of People and
 * "draft the pay run" five rows below it, so the one split ADR-069 D-e made
 * read as two unrelated powers. The contract keeps related permissions next to
 * each other (draft immediately before confirm, check in before check out), and
 * that is the reading order an owner needs.
 */
export function groupByArea(
  order: readonly Permission[],
  areaOf: Readonly<Record<Permission, PermissionArea>>,
  areas: readonly PermissionArea[] = AREA_ORDER,
): AreaGroup[] {
  return areas
    .map((area) => ({ area, permissions: order.filter((p) => areaOf[p] === area) }))
    .filter((group) => group.permissions.length > 0);
}

/**
 * What `held` changes against `from`: what it adds and what it takes away, each
 * in the contract's order.
 *
 * Used twice, for two different questions. Against the platform default it is
 * "what has this business changed" (the badge an owner reviews their policy
 * by). Against the saved set it is "what will Save do", which the editor says
 * before the owner presses it.
 */
export function departures(
  order: readonly Permission[],
  from: Iterable<Permission>,
  held: Iterable<Permission>,
): { granted: Permission[]; withdrawn: Permission[] } {
  const was = new Set(from);
  const now = new Set(held);
  return {
    granted: order.filter((p) => now.has(p) && !was.has(p)),
    withdrawn: order.filter((p) => was.has(p) && !now.has(p)),
  };
}

/**
 * "view money, record payments and close a bill". Every permission label is a
 * verb phrase, so the list reads after "may", "may now" and "may no longer"
 * alike. The labels are passed in rather than imported, so this file stays
 * free of runtime imports and a test can load it as it is.
 */
export function sayPermissions(
  permissions: readonly Permission[],
  label: Readonly<Record<Permission, string>>,
  conjunction: "and" | "or" = "and",
): string {
  const words = permissions.map((p) => label[p]);
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} ${conjunction} ${words[words.length - 1]}`;
}

/** `draft the pay run` as a row label: `Draft the pay run`. */
export function sentenceCase(label: string): string {
  return label.length === 0 ? label : label[0].toUpperCase() + label.slice(1);
}

/**
 * A second line under the permissions whose name alone does not say what an
 * owner is handing over. Most do (`check guests in`); these carry money, tax
 * or a person's private details, and an owner moving one deserves the
 * consequence in front of them.
 *
 * Wording only. What each permission opens is the API's declarations, and
 * `authz.ts` in `@injishi/contracts` is where each one is argued.
 */
export const PERMISSION_HINT: Readonly<Partial<Record<Permission, string>>> = {
  "message.send": "Speaks to guests for the property, in the guest inbox.",
  "money.view": "Opens Finance: bills, revenue and the money every screen shows. Also reads reservations.",
  "folio.close": "Closing a bill signs its sale with RRA.",
  "ebm.manage": "The business's RRA EBM account, and which items its sales are declared against.",
  "ebm.refund": "Withdraws a sale already signed with RRA.",
  "refund.decide": "Approves or refuses a guest's request for money back, goodwill included.",
  "outlet.manage": "Who runs each outlet, and whose TIN signs its sales.",
  "offer.manage": "An offer is a price: whoever holds this can discount.",
  "department.manage": "A department decides where revenue is reported and where orders go.",
  "people.view": "Staff files without date of birth, ID number, RSSB number or wage. Also reads departments.",
  "people.manage": "Files and contracts with their personal fields, and offboarding staff without an account.",
  "attendance.record": "Clocks people in and out at the desk, and registers kiosks.",
  "payroll.draft": "Builds and revises the month's draft, and sees the wages it computes. Never the confirm.",
  "payroll.run":
    "Freezes the month, and everything a confirmed run produces: payslips, bank and MoMo files, RSSB and PAYE declarations.",
};
