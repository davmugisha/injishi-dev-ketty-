/**
 * The minimum personal data rule (ADR-061 D-g), as the owner set it.
 *
 * Everything the assistant sends to the model provider passes through
 * `redact` first: the person's own message and every tool result. Contact
 * details and identity numbers never leave, because an answer about Injishi
 * never needs them, and the provider is a third party outside Rwanda (Law
 * 058/2021).
 *
 * Patterns run longest first, so a 16 digit national ID is never half eaten
 * by the 9 digit TIN rule. Amounts are safe by construction: prices are
 * written with separators (`60,000`) or are shorter than any pattern here.
 */
const RULES: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  {
    label: '[email]',
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  // Rwandan national ID: 16 digits, often typed in groups separated by
  // spaces. Not hyphens: a run of ISO dates joined by hyphens and spaces
  // would otherwise read as one.
  {
    label: '[national-id]',
    pattern: /(?<![\d-])\d(?: ?\d){15}(?![\d-])/g,
  },
  // A phone number in international form: + then 8 to 15 digits, grouped.
  {
    label: '[phone]',
    pattern: /\+\d(?:[ ()-]?\d){7,14}(?![\d])/g,
  },
  // A Rwandan mobile in local form: 07 then 8 digits, grouped.
  {
    label: '[phone]',
    pattern: /(?<![\d])07\d(?:[ -]?\d){7}(?![\d])/g,
  },
  // A 9 digit TIN standing alone.
  {
    label: '[tin]',
    pattern: /(?<![\d-])\d{9}(?![\d-])/g,
  },
];

/**
 * Record ids are UUIDs, and a UUID whose hex happens to be mostly decimal
 * digits reads like a phone number or an ID. They are shielded from every
 * rule and put back afterwards, so a citation or a follow up lookup can never
 * be broken by redaction.
 */
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const SHIELD = /\u0000(\d+)\u0000/g;

export function redact(text: string): string {
  const shielded: string[] = [];
  let out = text.replace(UUID, (id) => `\u0000${shielded.push(id) - 1}\u0000`);
  for (const rule of RULES) out = out.replace(rule.pattern, rule.label);
  return out.replace(SHIELD, (_m, i: string) => shielded[Number(i)]);
}
