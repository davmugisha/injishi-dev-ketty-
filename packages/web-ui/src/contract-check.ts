/**
 * This package satisfies `@injishi/ui-contract` for component NAMES (ADR-040
 * call 4). Variant and size names are satisfied where they are used, in each
 * component's own `Record` over the contract's union; this file covers the one
 * thing no component can check for itself, which is that the package exports a
 * component under every name the contract lists.
 *
 * Types only and imported by nothing, so it never reaches a bundle. It exists
 * for `tsc --noEmit`: rename `Tabs` in the contract, or drop the `Tabs` export
 * from `index.ts`, and this package's typecheck fails naming the missing name.
 */
import type { ComponentName } from "@injishi/ui-contract";
import type * as Package from "./index";

type Expect<T extends true> = T;
type Missing = Exclude<ComponentName, keyof typeof Package>;

// When this fails, hover `Missing`: it names the component the contract lists
// and `index.ts` does not export.
type _EveryContractNameIsExported = Expect<[Missing] extends [never] ? true : false>;
