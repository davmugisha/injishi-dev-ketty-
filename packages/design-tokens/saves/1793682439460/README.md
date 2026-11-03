# HeroUI Pro save 1793682439460

The four exports of the saved HeroUI Pro Design System "Injishi.hs", kept
verbatim. They are the source `src/heroui.ts` is transcribed from (ADR-068).
Never edit them: a new save gets its own folder, and its values are read as a
diff against `src/heroui.ts`, never pasted over it.

| Field | Value |
| --- | --- |
| Design system | `989b3560-28bd-4ec7-8cba-f6e90c10991e` ("Injishi.hs"); it replaces `de231dfa-8a53-40c9-ba3b-cd9d5a93685b` ("Injishi"), last read at 1793037720487 |
| `updatedAt` | `1793682439460` (manifest and all four exports agreed, so no refetch was owed) |
| Read on | 2026-11-03 |
| Read through | the HeroUI Pro MCP, `get_design_system_manifest` then `get_design_system_export` with all four outputs |
| Theme | `mouve`, base tone neutral, hue 150.84 (light background 154.55), lightness 0.733, chroma 0.193, accent `#17C964`, radius and field radius 0.5rem, spacing scale 1.12, type scale 1.1, letter spacing 0, Outfit for body and headings, vibrant palette off |

| File | MCP output | What it is |
| --- | --- | --- |
| `globals.css` | `css` | The web theme: the variables the save changes over the `mouve` Pro theme |
| `DESIGN.md` | `design` | The resolved tokens as hex, plus the design notes |
| `PRODUCT.md` | `product` | The brand and product notes (every brand field is empty in the design system) |
| `global.css` | `native-css` | The HeroUI Native theme (`mouve` is web only, so it carries the compatible tokens only) |

Where the outputs disagree, `globals.css` wins over `DESIGN.md`. Where
`globals.css` is silent, `DESIGN.md` fills the gap (ADR-068 D-n): `--eclipse`,
the status fills, the light segment and the 1px field border width.

The save paints the dark `background` and `surface`, and the labels on the
accent and on the success and warning fills, pure black. The owner chose on
2026-11-03 to ship that as saved, lifting ADR-068 D-h for those roles only;
the `black` primitive stays the ink.

Sixteen values failed a contrast floor and were corrected in
`src/heroui.ts` by ADR-025's rule (each marked CORRECTED there): the light
`muted`, `focus`, `field-border`, `danger` and four text roles, the dark
`danger`, `danger` text, `field-border` and `chart-1`, and four light soft
labels.
