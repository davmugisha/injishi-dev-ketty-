import { PRODUCT_LABEL, type ProductId } from '@injishi/contracts';

/**
 * What the owner is told when Injishi staff switch a product on or off for
 * their business (ADR-076 G8, contract section 9): the product, the branches,
 * the new state and the reason, by email and in their in app notifications.
 *
 * In the recipient's language when that catalog exists. Only English exists
 * today (no mail on the platform is translated yet), so every locale reads
 * English until the `rw` and `fr` catalogs land; the locale is taken now so a
 * catalog is all that changes then.
 */
export interface EntitlementNotice {
  /** The in app notice's title and the mail's subject line, without the brand prefix. */
  readonly title: string;
  readonly body: string;
  readonly subject: string;
  readonly text: string;
}

export function entitlementNotice(input: {
  businessName: string;
  productId: ProductId;
  state: 'on' | 'off';
  /** The branch names it changed at, or null for the whole business. */
  branchNames: readonly string[] | null;
  reason: string;
  locale: string;
}): EntitlementNotice {
  const product = PRODUCT_LABEL[input.productId];
  const where =
    input.branchNames === null
      ? 'for the whole business'
      : `at ${listed(input.branchNames)}`;
  const title = `${product} is now ${input.state} ${where}`;
  const body = `Injishi switched ${product} ${input.state} ${where} for ${input.businessName}. Reason: ${input.reason}`;
  return {
    title,
    body,
    subject: `Injishi: ${title}`,
    text: [
      `Hello,`,
      ``,
      `${body}`,
      ``,
      input.state === 'off'
        ? `Its screens close for the people who work there. Nothing already recorded is deleted.`
        : `Its screens open for the people whose roles allow them.`,
      ``,
      `If this looks wrong, reply to this email or contact Injishi support.`,
    ].join('\n'),
  };
}

/** "Remera", "Remera and Rubavu", "Remera, Rubavu and Musanze". */
function listed(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? 'no branch';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
