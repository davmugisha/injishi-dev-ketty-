/**
 * Screen and Screen.List — the page scaffold in both of its modes.
 *
 * The list variant is the riskiest change in ADR-031, because every page in the
 * app imports this file and picking the wrong mode fails silently. Three things
 * are worth pinning:
 *
 *  1. **One vertical scroller per screen.** That is the whole point: a list
 *     inside the scroll variant nests two scrollers and loses virtualization,
 *     and React Native only warns about it at runtime.
 *  2. **The header slot carries what the page used to render above its rows** —
 *     the title block, the greeting, the action, and the per-screen content.
 *     Losing any of them is a visible regression on four screens at once.
 *  3. **Empty and loading are distinguishable**, because "no rows" and "rows on
 *     the way" are different facts and one standing in for the other is the
 *     misleading zero `ui-screens.md` §6 rules out.
 */
import { fireEvent, screen } from '@testing-library/react-native';
import { ScrollView, Text as RNText, View } from 'react-native';
import { Screen, SectionLabel } from './screen';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { SCHEMES, renderInScheme } from '@/test-utils';

interface Row {
  id: string;
  title: string;
}

const ROWS: Row[] = [
  { id: 'a', title: 'Lakeside Villa' },
  { id: 'b', title: 'Kigali Duplex' },
  { id: 'c', title: 'Musanze Lodge' },
];

/**
 * Every vertical scroll container in the tree. A horizontal one is fine and
 * expected — Explore and Directory both scroll their filter row sideways
 * inside the list header — so it is excluded here rather than counted.
 */
const verticalScrollers = () =>
  screen.UNSAFE_queryAllByType(ScrollView).filter((node) => node.props.horizontal !== true);

function List(props: Partial<Parameters<typeof Screen.List<Row>>[0]> = {}) {
  return (
    <Screen.List
      title="Explore"
      data={ROWS}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <RNText>{item.title}</RNText>}
      {...props}
    />
  );
}

describe.each(SCHEMES)('Screen.List in the %s scheme', (scheme) => {
  it('renders every row', () => {
    renderInScheme(<List />, scheme);
    for (const row of ROWS) expect(screen.getByText(row.title)).toBeTruthy();
  });

  it('is exactly one vertical scroll container', () => {
    renderInScheme(<List />, scheme);
    expect(verticalScrollers()).toHaveLength(1);
  });

  it('stays one vertical scroller with a horizontal one in the header', () => {
    renderInScheme(
      <List
        header={
          <ScrollView horizontal>
            <RNText>Anywhere</RNText>
          </ScrollView>
        }
      />,
      scheme,
    );

    expect(verticalScrollers()).toHaveLength(1);
    expect(screen.getByText('Anywhere')).toBeTruthy();
  });

  it('renders the title block, the greeting and the action in the header slot', () => {
    const onPress = jest.fn();
    renderInScheme(
      <List
        title="Explore"
        greeting="Muraho, Aline"
        action={<Button onPress={onPress}>Switch</Button>}
      />,
      scheme,
    );

    expect(screen.getByText('Explore')).toBeTruthy();
    expect(screen.getByText('Muraho, Aline')).toBeTruthy();

    // The action is a live control, not a picture of one — it scrolls with the
    // header and still presses.
    fireEvent.press(screen.getByRole('button', { name: 'Switch' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the per-screen header between the title block and the rows', () => {
    renderInScheme(
      <List
        header={
          <View>
            <SectionLabel>Stays</SectionLabel>
          </View>
        }
      />,
      scheme,
    );

    expect(screen.getByText('Stays')).toBeTruthy();
    expect(screen.getByText('Lakeside Villa')).toBeTruthy();
  });

  it('renders the empty node when there are no rows', () => {
    renderInScheme(
      <List
        data={[]}
        empty={<EmptyState title="No stays match that filter" body="Widen it and try again." />}
      />,
      scheme,
    );

    expect(screen.getByRole('summary', { name: /No stays match that filter/ })).toBeTruthy();
    expect(screen.queryByText('Lakeside Villa')).toBeNull();
  });

  it('keeps the header visible on an empty list, so the filters stay reachable', () => {
    // Otherwise a filter that matches nothing is a filter you cannot undo.
    renderInScheme(
      <List
        data={[]}
        header={<SectionLabel>Stays</SectionLabel>}
        empty={<EmptyState title="Nothing here" body="Yet." />}
      />,
      scheme,
    );

    expect(screen.getByText('Stays')).toBeTruthy();
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });

  it('draws the skeleton while loading, and not the empty state', () => {
    renderInScheme(
      <List
        data={[]}
        loading
        loadingLabel="Loading stays"
        empty={<EmptyState title="No stays" body="None at all." />}
      />,
      scheme,
    );

    expect(screen.getByRole('progressbar', { name: 'Loading stays' })).toBeTruthy();
    expect(screen.queryByText('No stays')).toBeNull();
  });

  it('draws the skeleton even when rows are already cached', () => {
    // `loading` means the read is in flight. Showing stale rows under a
    // skeleton would be two answers to the same question.
    renderInScheme(<List loading loadingLabel="Loading stays" />, scheme);

    expect(screen.getByRole('progressbar', { name: 'Loading stays' })).toBeTruthy();
    expect(screen.queryByText('Lakeside Villa')).toBeNull();
  });
});

describe.each(SCHEMES)('Screen in the %s scheme', (scheme) => {
  it('still scrolls its children, unchanged', () => {
    renderInScheme(
      <Screen title="Portfolio" greeting="Good morning">
        <RNText>A compliance card</RNText>
      </Screen>,
      scheme,
    );

    expect(screen.getByText('Portfolio')).toBeTruthy();
    expect(screen.getByText('Good morning')).toBeTruthy();
    expect(screen.getByText('A compliance card')).toBeTruthy();
    expect(verticalScrollers()).toHaveLength(1);
  });

  it('renders without a title block when it has no title', () => {
    renderInScheme(
      <Screen>
        <RNText>Just the body</RNText>
      </Screen>,
      scheme,
    );

    expect(screen.getByText('Just the body')).toBeTruthy();
  });
});
