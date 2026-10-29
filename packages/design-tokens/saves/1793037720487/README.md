# HeroUI Pro save 1793037720487

The four exports of the saved HeroUI Pro Design System "Injishi", kept verbatim.
They are the source `src/heroui.ts` is transcribed from (ADR-068). Never edit
them: a new save gets its own folder, and its values are read as a diff against
`src/heroui.ts`, never pasted over it.

| Field | Value |
| --- | --- |
| Design system | `de231dfa-8a53-40c9-ba3b-cd9d5a93685b` ("Injishi") |
| `updatedAt` | `1793037720487` (2026-10-26 18:02 UTC) |
| Read on | 2026-10-28 |
| Read through | the HeroUI Pro MCP (`https://mcp.heroui.pro/mcp`), `get_design_system_manifest` then `get_design_system_export` with all four outputs |
| Theme | `mouve`, base tone neutral, hue 177.90, lightness 0.488, chroma 0.212, radius small, field radius none, vibrant palette on |

| File | MCP output | What it is |
| --- | --- | --- |
| `globals.css` | `css` | The web theme: the variables the save changes over the `mouve` Pro theme |
| `DESIGN.md` | `design` | The resolved tokens as hex, plus the design notes |
| `PRODUCT.md` | `product` | The brand and product notes |
| `global.css` | `native-css` | The HeroUI Native theme (`mouve` is web only, so it carries the compatible tokens only) |

Where the outputs disagree, `globals.css` wins over `DESIGN.md`. Where
`globals.css` is silent, the `mouve` theme's own rule applies (most text roles
are `var(--foreground)` or `var(--eclipse)`), and `DESIGN.md` resolves
`--eclipse`. The save's manifest also stores an `accentHex` of `#008160`, which
neither generated output renders.
