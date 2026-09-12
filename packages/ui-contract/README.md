# @injishi/ui-contract

The one definition of the component vocabulary: component names, variant names and
size names. Types only, zero dependencies, nothing to bundle (ADR-040 call 4).

Two implementations satisfy it:

- `@injishi/ui`, the web components all three Next apps import
- `apps/mobile`, which renders no DOM and can never import `@injishi/ui`

Both import their unions from here rather than declaring them, so a rename on one
side fails the other side's typecheck.

```ts
import type { ButtonVariant, ButtonSize } from "@injishi/ui-contract";

type Variant = ButtonVariant<"native">; // the core plus mobile's extensions
```

Each axis is a **core** set both platforms must implement, plus **extensions** one
platform adds and the other has no use for. The core set and the reasons behind it
are recorded in `injishi.context/dox/adrs/040-one-component-vocabulary-everywhere/040-mobile-vocabulary-contract.md`.

A rename lands on both platforms in one change, or it does not land.
