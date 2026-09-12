/**
 * The `reason` a staff member gives before reading someone else's record.
 *
 * THE RULE MOVED. It was declared here, floored at four characters, while the
 * users area separately accepted any non-empty string — so `reason=x` was
 * refused on the OBO register and accepted on the user directory, from the same
 * browser, for the same person. It now lives in `@injishi/contracts` as
 * `AdminReasonQuery`, where both areas and the console read the same floor.
 *
 * These re-exports remain so the call sites in this area keep their local
 * names; they are aliases, not a second definition.
 */
export {
  AdminReasonQuery as ReasonQuery,
  AdminPagedReasonQuery as PagedReasonQuery,
} from '@injishi/contracts';
