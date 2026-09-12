/**
 * The hero plate, in both schemes — and the guard on the duplicate inside it.
 *
 * `HeroMoney` re-implements `MoneyAmount` because that component resolves its
 * own palette colour and offers no override, so on the light scheme's ink plate
 * it paints near-ink on near-ink. See `hero-card.tsx` for why the duplicate
 * stands and what removes it. **The test that matters here is the third one**:
 * while two implementations of the money format exist, they must agree
 * character for character, and that agreement is checked rather than assumed.
 */
import { screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { MoneyAmount } from '@/components';
import { SCHEMES, renderInScheme, paletteFor, enclosingFill } from '@/test-utils';
import { HeroCard, HeroLabel, HeroMoney } from './hero-card';

describe.each(SCHEMES)('the hero plate in the %s scheme', (scheme) => {
  it('draws its label and its figure', () => {
    renderInScheme(
      <HeroCard>
        <HeroLabel>Next payment</HeroLabel>
        <HeroMoney value={310000} size="2xl" />
      </HeroCard>,
      scheme,
    );
    expect(screen.getByText('Next payment')).toBeTruthy();
    expect(screen.getByText('310,000')).toBeTruthy();
    expect(screen.getByText('RWF')).toBeTruthy();
  });

  /**
   * The design brief §3.4 forbids a white card on a mobile dark screen, so the
   * plate must NOT be `surfaceInverse` in dark — where that role resolves to
   * near-white. Light takes the ink plate the canvas draws; dark elevates by
   * surface lightness instead.
   */
  it('takes the ink plate in light and a raised surface in dark, never an inverted card', () => {
    renderInScheme(
      <HeroCard>
        <HeroLabel>Next payment</HeroLabel>
      </HeroCard>,
      scheme,
    );
    const c = paletteFor(scheme);
    const fill = enclosingFill(screen.getByText('Next payment'));
    expect(fill).toBe(scheme === 'light' ? c.surfaceInverse : c.surface2);
  });
});

describe('HeroMoney and MoneyAmount', () => {
  /**
   * Two implementations of design brief §8.6 exist while the duplicate stands.
   * They agree here, or one of them has drifted from `RWF 45,000`.
   */
  it.each([0, 5, 310000, 1485000, -240000])(
    'render %p identically, so the duplicate cannot drift',
    (value) => {
      const hero = renderInScheme(<HeroMoney value={value} />, 'light');
      const heroText = hero.root.findAllByType(require('react-native').Text as never);
      const heroWords = heroText.map((n) => n.props.children);
      hero.unmount();

      const kit = renderInScheme(
        <View>
          <MoneyAmount value={value} strong />
        </View>,
        'light',
      );
      const kitText = kit.root.findAllByType(require('react-native').Text as never);
      const kitWords = kitText.map((n) => n.props.children);

      expect(heroWords.join('|')).toBe(kitWords.join('|'));
    },
  );
});
