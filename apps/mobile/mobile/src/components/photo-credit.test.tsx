/**
 * PhotoCredit — a licence obligation with a render method.
 *
 * The tests that matter are the two the component decides for itself, because
 * a caller cannot be trusted to remember either:
 *
 *   1. A stand-in photograph MUST carry a visible credit (ADR-015 call 5).
 *   2. A photograph that shows its own property must NOT — a "Not this
 *      property" tag on a photograph of the property is a lie.
 *
 * The third is the fixed-foreground rule: the scrim is drawn from ink at alpha
 * and the type on it is fixed white in BOTH schemes, because a photograph does
 * not invert with the theme and neither may what sits on it (design brief §8.7).
 * A palette key here would go pale in dark and take the credit with it.
 */
import { screen } from '@testing-library/react-native';
import { PhotoCredit } from './photo-credit';
import { SCHEMES, flattenStyle, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import { PHOTO_CREDITS } from '@/data/photo-credits';
import { onPhoto } from '@/theme/tokens';

const standIn = PHOTO_CREDITS.find((c) => !c.depictsActualProperty)!;
const ownProperty = PHOTO_CREDITS.find((c) => c.depictsActualProperty)!;

/** The credit sentence, as `photo.credit` composes it. */
const line = en['photo.credit']
  .replace('{author}', standIn.author)
  .replace('{licence}', standIn.licence);

describe.each(SCHEMES)('PhotoCredit in the %s scheme', (scheme) => {
  it('credits a stand-in, by author and licence', () => {
    renderInScheme(<PhotoCredit stem={standIn.stem} />, scheme);
    expect(screen.getByText(line)).toBeTruthy();
  });

  it('says a stand-in is not the property, in words', () => {
    // Colour alone could not carry this, and neither could omission: a card
    // that shows a Rwandan landscape without saying so implies the guest is
    // looking at the place they would book.
    renderInScheme(<PhotoCredit stem={standIn.stem} />, scheme);
    expect(screen.getByText(en['photo.standIn'])).toBeTruthy();
  });

  it('renders nothing at all for a photograph that shows its own property', () => {
    // A "Not this property" tag on a photograph OF the property is a lie, and
    // the three that depict their own subject owe no stand-in notice.
    renderInScheme(<PhotoCredit stem={ownProperty.stem} />, scheme);
    expect(screen.queryByText(en['photo.standIn'])).toBeNull();
    expect(screen.queryByText(new RegExp(ownProperty.licence))).toBeNull();
  });

  it('renders nothing for a stem it has no row for', () => {
    // Such a stem cannot reach a screen — the importer never copies one — but
    // a blank chip would be worse than nothing if it ever did.
    renderInScheme(<PhotoCredit stem="stay-01" />, scheme);
    expect(screen.queryByText(en['photo.standIn'])).toBeNull();
  });

  it('reads as one sentence, not as three separate stops', () => {
    renderInScheme(<PhotoCredit stem={standIn.stem} />, scheme);
    expect(screen.getByLabelText(`${en['photo.standIn']}. ${line}`)).toBeTruthy();
  });

  it('takes a FIXED foreground on the scrim, identical in both schemes', () => {
    renderInScheme(<PhotoCredit stem={standIn.stem} />, scheme);
    const tag = screen.getByText(en['photo.standIn']);
    // Not a palette key: the ground is a photograph and does not invert.
    // Asserted against the token rather than the hex, so this proves the
    // component reads `onPhoto` AND that `onPhoto` is scheme-independent —
    // the loop around this test runs it in both schemes.
    expect(flattenStyle(tag.props.style).color).toBe(onPhoto);
  });

  it('drops to a quiet line under the frame where an overlay would cover it', () => {
    // Under the frame the credit is the whole line; the stand-in tag is off by
    // default there, because a small thumbnail has room for one of the two and
    // the credit is the one the licence asks for.
    renderInScheme(<PhotoCredit stem={standIn.stem} placement="under" />, scheme);
    expect(screen.getByText(line)).toBeTruthy();
  });

  it('can carry the stand-in tag under the frame too, when asked', () => {
    renderInScheme(<PhotoCredit stem={standIn.stem} placement="under" showStandIn />, scheme);
    expect(screen.getByText(`${en['photo.standIn']} · ${line}`)).toBeTruthy();
  });
});
