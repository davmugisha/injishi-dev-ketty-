/**
 * The marketplace listing a demo workspace's outlets hang off, said in words.
 *
 * `DEMO_PMS_PROPERTY_SLUG` gives the four operator screens a slug and nothing
 * else, and a slug on screen ("kigali-serena-hotel") reads as a bug. Derived
 * from the slug rather than kept as a second table, because a table would be
 * one more place the two halves could disagree about what a property is called
 * — and the guest app already renders the listing's real name from its own
 * catalogue.
 *
 * The small-word list is what stops "Hotel des Mille Collines" from being
 * shouted as "Hotel Des Mille Collines". It is presentation, not data: nothing
 * routes on the output.
 */

/** Words that stay lower case unless they open the name. */
const SMALL = new Set(["and", "de", "des", "du", "la", "le", "of", "the"]);

export function marketplaceName(propertySlug: string): string {
  return propertySlug
    .split("-")
    .map((word, index) =>
      index > 0 && SMALL.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}
