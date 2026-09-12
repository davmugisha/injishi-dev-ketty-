# @injishi/design-tokens

**This is the source, and it is now source in the full sense.** It used to be a
build-output mirror of `injishi.managed/packages/design-tokens`; that repo was
deleted in September 2026 and this directory is the only copy. There is no sync
script and nothing to sync from. See
[ADR-034](../../../injishi.context/dox/adrs/034-vendor-becomes-source.md).

The TypeScript source and the CSS generator were lost with the repo and have
been **reconstructed from `dist/`** (ADR-034 tasks 1–3). The reconstruction is
not a rewrite that looks close enough — it is proved:

- `src/*.ts` compiles to the **byte-identical** `dist/*.js` and `dist/*.d.ts`
  the deleted repo had shipped. `pnpm check` re-proves it on demand.
- `scripts/emit-css.mjs` produces the three `generated/*.css` files
  **byte-for-byte** as committed, before any value was allowed to move.

## What is in here

| Layer | File | What it owns |
| --- | --- | --- |
| Ramps | `src/ramps.ts` | The two OKLCH-derived 50–950 ramps. Pure black never ships |
| Semantic | `src/semantic.ts` | The pre-HeroUI role set — `fixed`, `light`, `dark`, `aliases` |
| HeroUI | `src/heroui.ts` | The teal HeroUI 3 theme, with ADR-025's five WCAG corrections named at their declarations |
| Layout | `src/layout.ts` | ADR-027's scale: eleven type steps (four authored here, each with its leading), six page widths, three spacing rhythms |
| React Native | `src/rn.ts` | The RN space grid, corners, type steps and leadings. One declaration, since ADR-034 task 6 |

## Commands

```bash
pnpm -F @injishi/design-tokens build          # src/ -> dist/
pnpm -F @injishi/design-tokens generate:css   # dist/ -> generated/*.css
pnpm -F @injishi/design-tokens check          # fail if either is stale
```

`check` is the local replacement for the deleted `pnpm vendor:check`. The drift
it catches is the opposite one: not a mirror falling behind its source, but a
`dist/` hand-edited past what `src/` can build, or a `src/` changed without
regenerating. Both produce a package whose types and values disagree with its
own source, and both fail the same way.

## How to change a colour

1. Edit the role in `src/semantic.ts` or `src/heroui.ts`.
2. `pnpm -F @injishi/design-tokens build`
3. `pnpm -F @injishi/design-tokens generate:css`
4. `node apps/mobile/scripts/derive-palette.mjs` and commit `palette.ts`.

Step 4 is not optional and is enforced: `pnpm -F @injishi/mobile lint` fails on
a stale palette, and `derive-palette.mjs` re-measures every contrast floor and
refuses to write a palette that breaks one.

**Do not** re-export the HeroUI theme from the theme builder to "refresh" the
palette. It silently undoes the five WCAG corrections ADR-025 made, each of
which is named at its own declaration in `src/heroui.ts` for exactly this
reason.
