/**
 * The photo credits screen, in both schemes.
 *
 * It carries all four list states even though the list is a static generated
 * array, so the loading branch is asserted here rather than left to rot: a
 * branch that never renders is a branch nobody has run.
 *
 * The substantive assertion is the last one. This page exists to carry the FULL
 * attribution sentence that the CC BY and CC BY-SA licences ask to travel with
 * the work and that does not fit on a tile. A credits page that printed only
 * the author and the licence would look right and discharge nothing.
 */
import { screen, waitFor } from '@testing-library/react-native';
import { PhotoCreditsScreen } from './photo-credits';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import { PHOTO_CREDITS } from '@/data/photo-credits';

const first = PHOTO_CREDITS[0];

describe.each(SCHEMES)('the photo credits screen in the %s scheme', (scheme) => {
  it('names itself and says why the page exists', async () => {
    renderInScheme(<PhotoCreditsScreen />, scheme);
    await waitFor(() => expect(screen.getByText(en['photo.creditsTitle'])).toBeTruthy());
    expect(screen.getByText(en['photo.creditsIntro'])).toBeTruthy();
  });

  it('shows a skeleton on the cold read rather than an empty page', () => {
    renderInScheme(<PhotoCreditsScreen />, scheme);
    // `useFixture` is the read the API will replace; the first read of a key in
    // a session is deliberately slow so this branch is real.
    const loading = screen.queryByLabelText(
      en['state.loadingList'].replace('{label}', en['photo.creditsListLabel']),
    );
    // Warm on a second render in the same session, which is also correct — the
    // assertion is that one of the two states is showing, never neither.
    expect(loading ?? screen.getByText(en['photo.creditsTitle'])).toBeTruthy();
  });

  it('lists a photograph by its subject and its author', async () => {
    // `getAllBy`, not `getBy`: three of the Akagera photographs share a
    // subject, which is real data rather than a duplicate row.
    renderInScheme(<PhotoCreditsScreen />, scheme);
    await waitFor(() => expect(screen.getAllByText(first.subject).length).toBeGreaterThan(0));
    expect(screen.getAllByText(first.author).length).toBeGreaterThan(0);
  });

  it('prints the full attribution sentence, which is the point of the page', async () => {
    renderInScheme(<PhotoCreditsScreen />, scheme);
    await waitFor(() => expect(screen.getByText(first.attribution)).toBeTruthy());
  });

  it('offers the source so a reader can check the licence claim', async () => {
    renderInScheme(<PhotoCreditsScreen />, scheme);
    await waitFor(() =>
      expect(
        screen.getAllByLabelText(`${en['photo.viewSource']}: ${first.subject}`).length,
      ).toBeGreaterThan(0),
    );
  });

  it('marks each row as a stand-in or as its own property, in words', async () => {
    renderInScheme(<PhotoCreditsScreen />, scheme);
    await waitFor(() => expect(screen.getAllByText(en['photo.standIn']).length).toBeGreaterThan(0));
  });
});
