"use client";

import { COUNTRIES } from "@injishi/contracts";
import type { SelectOption } from "./wizard-ui";

/**
 * The country list, as `SelectField` options.
 *
 * Two selects in this wizard offer the same list — the address country in
 * `AddressPicker` and the issuing country in `StepAboutYou` — and they were
 * writing the same map twice. A second copy is how the two drift: one gets a
 * placeholder row or a sort and the other does not, and the same person sees a
 * different list on two steps of one form.
 *
 * It was a component rendering `<option>` elements. HeroUI's Select is a
 * listbox, and React Aria has to READ the collection to size the popover, work
 * out the typeahead and find the selected row — it cannot do any of that
 * through an opaque child component. So the shared thing is now the data, which
 * is what it always should have been: each caller still owns its own value and
 * change handler, and only the list is shared.
 */
export const COUNTRY_OPTIONS: readonly SelectOption[] = COUNTRIES.map((c) => ({
  value: c.code,
  label: c.name,
}));
