/**
 * The licence chain — the highest-stakes invariant in the data layer.
 *
 * These are not style tests. Most of the 25 photographs are CC BY or CC BY-SA,
 * which require the credit to travel with the work, and ADR-015 call 5 requires
 * a photograph that does not depict its own property to carry a VISIBLE credit
 * where it appears. Shipping a photograph whose author or licence the project
 * cannot state is a licence breach, not a rendering bug.
 *
 * So the rule is asserted structurally: **every photograph in `PHOTOS` has a
 * row in `PHOTO_CREDITS`, and every row is complete.** Both files are generated
 * from the manifest by `scripts/import-photos.mjs`, which walks the manifest
 * rather than the asset folder — this is the test that says the generator's
 * contract still holds after someone edits either file by hand.
 *
 * The 23 `stay-NN` tiles in `apps/web` are deliberately absent from both, and
 * the last test says so, because "why are there no house photos" is a question
 * someone will ask and the answer is that they carry no licence row at all.
 */
import { PHOTOS, PHOTO_STEMS } from './photos';
import { PHOTO_CREDITS, creditFor, needsVisibleCredit } from './photo-credits';

describe('the licence chain', () => {
  it('ships at least one photograph', () => {
    expect(PHOTO_STEMS.length).toBeGreaterThan(0);
  });

  it('has a credit row for every photograph, with no orphan on either side', () => {
    const assets = [...PHOTO_STEMS].sort();
    const credits = PHOTO_CREDITS.map((c) => c.stem).sort();
    expect(credits).toEqual(assets);
  });

  it.each(PHOTO_CREDITS.map((c) => [c.stem, c] as const))(
    '%s carries a complete credit',
    (_stem, credit) => {
      // Every one of these is a field a licence asks for. A blank is a credit
      // that cannot be printed, which is the same as no credit at all.
      expect(credit.subject.trim()).not.toBe('');
      expect(credit.author.trim()).not.toBe('');
      expect(credit.licence.trim()).not.toBe('');
      expect(credit.attribution.trim()).not.toBe('');
      expect(credit.sourceUrl).toMatch(/^https:\/\//);
      expect(credit.licenceUrl).toMatch(/^https?:\/\//);
    },
  );

  it('keeps every credit on one line', () => {
    // A raw newline in a credit is a syntax error in the generated file and a
    // two-line chip on a card. Wikimedia's derivative-work attributions carry
    // one, which is how this was found; the generator collapses them.
    for (const credit of PHOTO_CREDITS) {
      expect(credit.author).not.toMatch(/[\r\n]/);
      expect(credit.attribution).not.toMatch(/[\r\n]/);
    }
  });

  it('gives every photograph a placeholder colour and real dimensions', () => {
    for (const stem of PHOTO_STEMS) {
      const asset = PHOTOS[stem];
      expect(asset.placeholder).toMatch(/^#[0-9A-F]{6}$/);
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
    }
  });

  it('flags the stand-ins as owing a visible credit and the rest as not', () => {
    const standIns = PHOTO_CREDITS.filter((c) => !c.depictsActualProperty);
    const own = PHOTO_CREDITS.filter((c) => c.depictsActualProperty);

    // The manifest's own split: 22 stand-ins, 3 that show their property.
    expect(standIns.length).toBeGreaterThan(own.length);
    for (const credit of standIns) expect(needsVisibleCredit(credit.stem)).toBe(true);
    for (const credit of own) expect(needsVisibleCredit(credit.stem)).toBe(false);
  });

  it('answers false, never true, for a stem it has never heard of', () => {
    // The failure mode that matters is the opposite one: a stem with no row
    // must not be treated as needing no credit BECAUSE it has no row. It
    // cannot reach a screen at all — the importer never copies it — and
    // `creditFor` returning undefined is what makes `PhotoCredit` render
    // nothing rather than render a blank chip.
    expect(creditFor('stay-01')).toBeUndefined();
    expect(needsVisibleCredit('stay-01')).toBe(false);
    expect(PHOTOS['stay-01']).toBeUndefined();
  });

  it('ships none of the unattributed stay-NN tiles', () => {
    // They are an international stock set inherited from the donor site with
    // no manifest row, no generated credit row and no script that emits them.
    // Their licence cannot be stated, so they are not imported. See
    // `scripts/import-photos.mjs` for the evidence.
    const stayTiles = PHOTO_STEMS.filter((stem) => /^stay-\d+$/.test(stem));
    expect(stayTiles).toEqual([]);
  });
});
