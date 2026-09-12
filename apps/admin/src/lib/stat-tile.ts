/**
 * The console's stat tile, as classes for `<Card as="dl">` from `@injishi/ui`.
 *
 * `StatCard` used to own these, and it put its `<dt>` and `<dd>` in a `<div>`
 * that leaned on the caller's grid being a `<dl>`. ADR-040 retired it for
 * `Card as="dl"`, which is its own description list, so the grid around a row
 * of tiles is a plain `<div>` now: a `<dl>` directly inside a `<dl>` is not
 * valid HTML.
 *
 *   <Card as="dl" className={STAT_TILE}>
 *     <CardTitle className={STAT_TERM}>TIN</CardTitle>
 *     <CardDescription className={`${STAT_VALUE} text-xl`}>{org.tin}</CardDescription>
 *   </Card>
 *
 * The value carries its size at the call site (`text-3xl` by default, `text-xl`
 * on a record page). `CardDescription` merges with `cn`, so the size and
 * `text-card-foreground` win over its own `text-sm text-muted-foreground`.
 * `figure`, not `money`: a lone value at display size wants proportional
 * digits; tabular ones are for a column of them.
 */
export const STAT_TILE = "p-4";

export const STAT_TERM =
  "text-xs font-bold uppercase tracking-wider text-card-foreground/60";

export const STAT_VALUE = "figure mt-1 font-bold text-card-foreground";

/** A second line under the value: a caption or a badge. */
export const STAT_NOTE = "mt-0.5 text-xs text-card-foreground/60";
