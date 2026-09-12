/**
 * The ComingSoon stub, and the registry behind it.
 *
 * Session 0 registers every route in the pack on day one so the tab bar is
 * complete and a tap never dead-ends. That claim is only true if the stub is a
 * junction rather than a wall, which is what these assert: it names the frame
 * and the session a reviewer needs, and it offers the surface's other tabs so
 * an unbuilt screen is still somewhere you can leave.
 *
 * `STUBS` is also the prototype's progress bar — a session deletes its entries
 * as it builds them, and an empty map means the prototype is done. The registry
 * tests are what keep that readable: no duplicate ids, every session accounted
 * for, and no entry pointing at a message key that does not exist.
 */
import { screen } from '@testing-library/react-native';
import { ComingSoon } from '@/components';
import { STUBS, Stub, stubSpec, type StubId } from './stubs';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import { DomainProvider } from '@/domain';
import type { Surface } from '@/data/rentals';

/**
 * `Stub` reads the active surface to decide which tab set to index, so it needs
 * the domain provider that `renderInScheme` deliberately does not mount — a
 * layout primitive that reaches into providers cannot be rendered in isolation,
 * and `Providers` keeps that line.
 */
const inSurface = (surface: Surface, node: React.ReactElement) => (
  <DomainProvider
    initial={surface === 'guest' ? 'hospitality' : 'residence'}
    initialSurface={surface}
  >
    {node}
  </DomainProvider>
);

const ids = Object.keys(STUBS) as StubId[];

describe('the stub registry', () => {
  /**
   * Session 9 relaxed this from `> 30`, which was the count on the day Session
   * 0 wrote it. The registry is the prototype's PROGRESS BAR — this file's own
   * header says a session deletes its entries as it builds them, and an empty
   * map means the prototype is done — so a floor under the count is an
   * assertion every session in the pack has to break in turn. What is worth
   * holding is that ids are unique and that each one resolves to a spec, which
   * the three tests below and this one now cover between them.
   */
  it('gives every registered route exactly one entry', () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(stubSpec(id)).toBeDefined();
  });

  it('names a real message key for every title', () => {
    for (const id of ids) expect(en[stubSpec(id).title]).toBeTruthy();
  });

  it('points every entry at a session that exists in the pack', () => {
    for (const id of ids) {
      const { session } = stubSpec(id);
      expect(session).toBeGreaterThanOrEqual(1);
      expect(session).toBeLessThanOrEqual(12);
    }
  });

  /**
   * Host was the last frameless pair, and optional Session A has built it, so
   * every entry still registered now names an artboard a reviewer can open.
   *
   * The assertion is written as a property rather than as a list of ids, which
   * is what the previous two versions of it were: it had already been rewritten
   * once when sessions 8 and 10 deleted their entries, and a list is a thing
   * every session in the pack has to come back and edit. A property is not.
   */
  it('names an artboard for every entry that is left', () => {
    const undrawn = ids.filter((id) => !stubSpec(id).frame);
    expect(undrawn).toEqual([]);
  });
});

describe.each(SCHEMES)('ComingSoon in the %s scheme', (scheme) => {
  it('prints the frame and the session a reviewer needs', () => {
    renderInScheme(<ComingSoon frame="W3" session={10} title="Queue" />, scheme);
    expect(screen.getByText(en['comingSoon.frame'].replace('{frame}', 'W3'))).toBeTruthy();
    expect(screen.getByText(en['comingSoon.session'].replace('{session}', '10'))).toBeTruthy();
  });

  it('keeps the page title, so the tab reads as a real tab with nothing in it', () => {
    renderInScheme(<ComingSoon frame="R1" session={8} title="Rent roll" />, scheme);
    expect(screen.getByText('Rent roll')).toBeTruthy();
    expect(screen.getByText(en['comingSoon.title'])).toBeTruthy();
  });

  it('says the canvas does not draw it rather than naming a frame that is not there', () => {
    renderInScheme(<ComingSoon session={11} title="Today" />, scheme);
    expect(
      screen.getByText(en['comingSoon.bodyUndrawn'].replace('{session}', '11')),
    ).toBeTruthy();
    expect(screen.queryByText(/^Frame /)).toBeNull();
  });

  it('always offers a way out', () => {
    renderInScheme(<ComingSoon frame="B23" session={9} title="Placements" />, scheme);
    expect(screen.getByLabelText(en['comingSoon.action'])).toBeTruthy();
  });

  /**
   * These two have now been re-pointed three times: they rode on the Landlord
   * and Work stubs until sessions 8 and 10 built those, then on Host until
   * optional Session A built that. Each move is the registry working as
   * designed — a session deletes its entries as it builds them — but it makes
   * the anchor the fragile part of the test rather than the behaviour.
   *
   * So they now ride on `trip/review`, which is a STACK stub: it carries no
   * `surface` of its own, so it indexes whichever surface the provider says,
   * and the assertions are about the indexing rather than about Host. The two
   * facts under test are unchanged — an unbuilt screen offers its surface's
   * other tabs, and never the tab the reader is standing on.
   *
   * When the last entry leaves `STUBS`, `StubId` becomes `never` and these two
   * stop compiling. That is the registry's own end state, and the session that
   * empties it should delete them along with `Stub` itself.
   */
  it('indexes the surface siblings so an unbuilt screen is still a junction', () => {
    renderInScheme(inSurface('guest', <Stub id="trip/review" />), scheme);
    // The Guest set, minus Trips, which is the tab this stub belongs to.
    expect(screen.getByText(en['nav.saved'])).toBeTruthy();
    expect(screen.getByText(en['nav.inbox'])).toBeTruthy();
    expect(screen.getByText(en['nav.account'])).toBeTruthy();
  });

  it('never links the tab the reader is already on', () => {
    renderInScheme(inSurface('guest', <Stub id="trip/review" />), scheme);
    // Trips is the page; it must not appear in its own index.
    const rows = screen.queryAllByText(en['nav.trips']);
    // Once, as the page title — never a second time as a row.
    expect(rows).toHaveLength(1);
  });
});

/**
 * The smoke pass: every registered stub, rendered.
 *
 * Thirty-five screens are most of what a reviewer can walk on day one, and
 * `expo export` proves only that they BUNDLE — a route that throws on render
 * bundles perfectly. This is the cheapest thing that proves the walkthrough
 * actually walks, and it is the test that will fail first when a later session
 * changes a shared component out from under a stub it forgot about.
 */
describe.each(SCHEMES)('every stub renders in the %s scheme', (scheme) => {
  it.each(ids)('%s', (id) => {
    const surface = stubSpec(id).surface ?? 'tenant';
    renderInScheme(inSurface(surface, <Stub id={id} />), scheme);
    // The stub always says what it is and always offers a way out; a screen
    // missing either is a dead end whether or not it threw.
    expect(screen.getByText(en['comingSoon.title'])).toBeTruthy();
    expect(screen.getByLabelText(en['comingSoon.action'])).toBeTruthy();
  });
});
