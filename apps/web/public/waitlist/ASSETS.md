# Waitlist images: what is here and where it came from

Ten files, named by
[ADR-048 copy.md §11](../../../../injishi.context/dox/adrs/048-waitlist-mode/copy.md).
All ten are committed (2026-09-13). They are freely licensed photographs from
Wikimedia Commons, chosen as stand ins so that nothing blocked, and `copy.md`
calls them "the weakest part of the page and the first thing to replace once
real photography exists". Treat a real photograph of a real Rwandan property,
used with permission, as the goal rather than the bonus.

`WaitlistImage` (`src/components/waitlist/waitlist-image.tsx`) renders each one
and still falls back to a quiet token ground if a file 404s, so replacing a
file at the same path is the whole change. If you change these paths, change
them there too.

## The files

| Path, relative to `public/waitlist/` | Purpose | Shape | Shows |
|---|---|---|---|
| `hero.jpg` | hero band | 2400 by 1485 | the hills above Karongi, Western Province |
| `og.jpg` | Open Graph card | 1200 by 630 exactly | a crop of `hero.jpg`; same photograph, same credit |
| `traveller.jpg` | traveller band | 1600 by 1200 | a guest room at Forest of Hope Guest House |
| `owner.jpg` | owner band | 1600 by 1200 | a hotel building in Kigali |
| `districts/gasabo.jpg` | district tile | 1000 square | Kigali Convention Centre from the air |
| `districts/kicukiro.jpg` | district tile | 1000 square | Kigali International Airport |
| `districts/nyarugenge.jpg` | district tile | 1000 square | central Kigali |
| `districts/musanze.jpg` | district tile | 1000 square | Musanze town under the Virunga volcanoes |
| `districts/rubavu.jpg` | district tile | 1000 square | Lake Kivu from the Rubona peninsula |
| `districts/rusizi.jpg` | district tile | 1000 square | Lake Kivu at Kamembe |

Nobody in any of them is close enough to be identified. That rule is not a
style note: these are stock photographs of a country the product has not
launched in, and a recognisable person on a page implying they use Injishi is a
claim nobody agreed to.

## Credits live in the manifest, not here

Each photograph has a `"group": "waitlist"` entry in
`scripts/photo-manifest.json` carrying the author, the licence and the Commons
page it came from, exactly as the marketplace's own photographs do. Nine
entries, because `og.jpg` is a crop of the hero and shares its credit.
`scripts/generate-photo-credits.mjs` turns the manifest into
`src/data/generated/photo-credits.ts`, which `/legal/photo-credits` renders.
Eight of the nine are CC BY-SA and oblige us to name the author wherever the
work appears, so run the script after any change to the manifest rather than
editing either file by hand. Every entry has `depicts_actual_property: false`:
none of these is an Injishi listing, and saying otherwise on a pre launch page
is a claim about a business that does not exist yet.

The Commons originals are not committed. To re-derive a file, the manifest's
`source_url` names the page; crop with `sharp` to the shape above.

## Replacing one

Drop the new file at the same path and shape, replace its manifest entry, and
re-run the credits script. Nothing else changes. The whole folder is on
`WAITLIST-REMOVAL.md`, so on launch day it goes with the page.
