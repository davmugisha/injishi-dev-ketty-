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
| HeroUI | `src/heroui.ts` | The HeroUI theme from the saved design system, every contrast correction named at its declaration (ADR-068) |
| Saves | `saves/<updatedAt>/` | The design system's four exports, verbatim, one folder per save `src/heroui.ts` was transcribed from |
| Layout | `src/layout.ts` | ADR-027's scale: eleven type steps (four authored here, each with its leading), six page widths, three spacing rhythms |
| React Native | `src/rn.ts` | The RN space grid, corners, type steps and leadings. One declaration, since ADR-034 task 6 |

## Commands

```bash
pnpm -F @injishi/design-tokens build                      # src/ -> dist/
pnpm -F @injishi/design-tokens generate:css               # dist/ -> generated/*
pnpm -F @injishi/design-tokens check                      # fail if anything is stale or drifted
node packages/design-tokens/scripts/emit-css.mjs --report # print every contrast pair
```

`check` runs three things, and CI runs `check`:

- `check-dist.mjs`: `dist/` equals a fresh build of `src/` (a hand edited
  `dist/`, or a `src/` changed without building, fails).
- `emit-css.mjs --check`: the palette clears every floor of the contrast table,
  and every file in `generated/` is current.
- `check-pasted.mjs`: `packages/ui/src/styles/injishi.css`, the sheet apps/app
  pastes over HeroUI Pro's `mouve` theme, carries the same value as
  `src/heroui.ts` for every colour the current save's CSS export defines.

`generated/` holds five files: the ramps, the pre-HeroUI vocabulary, the web's
HeroUI sheet (`./heroui.css`), and the phone's palette as gamut mapped hex, once
as CSS for Uniwind (`./native.css`) and once as JSON (`./native.json`).

## How to change a colour

1. Edit the role in `src/semantic.ts` or `src/heroui.ts`.
2. `pnpm -F @injishi/design-tokens build`
3. `pnpm -F @injishi/design-tokens generate:css`. It measures the contrast
   table first and writes nothing if a pair breaks its floor, naming the pair
   and its ratio. Fix the value by ADR-025's rule (hue and chroma held,
   lightness moved), mark it CORRECTED with its measurement, and run it again.
4. If the role is one the save's CSS export defines, paste the new value into
   `packages/ui/src/styles/injishi.css` under its `mouve` selector.
   `pnpm -F @injishi/design-tokens check` fails until you do.

The web reads the generated sheet directly; `apps/web`'s signed in layer
inlines it, so run `pnpm --filter @injishi/web css:app` as well.

**Do not** re-export the HeroUI theme from the theme builder to "refresh" the
palette. It silently undoes every correction, each of which is named at its own
declaration in `src/heroui.ts` for exactly this reason. A new save goes in its
own `saves/<updatedAt>/` folder, and its values are read as a DIFF against
`src/heroui.ts` (ADR-068).
