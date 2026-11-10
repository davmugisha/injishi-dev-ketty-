/**
 * One locale's messages: namespaces of message keys to sentences.
 *
 * A catalog is a tree, not a flat map, so a screen asks for the namespace it
 * owns (`home`, `register`) and translation review can be handed to somebody
 * one namespace at a time. The leaves are ICU MessageFormat strings, which is
 * what lets a sentence carry `{count, plural, ...}` and placeholders without
 * being built by concatenation in code.
 */
export type Catalog = {
  readonly [key: string]: string | Catalog;
};

/**
 * The shape of the English catalog with every sentence widened to `string`.
 *
 * `en` is authored `as const`, which makes each leaf a literal type. A French
 * catalog typed as `Shape<typeof en>` therefore has to carry every key English
 * has, and may say anything it likes in each one. Parity is a compile error,
 * not a missing label a user finds in production.
 */
export type Shape<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : Shape<T[K]>;
};
