/**
 * SegmentedTabs — the in-screen tab strip on Trips and Leases.
 *
 * The selection is the whole component, and it is the part that has to reach a
 * screen reader: an underline is invisible to one, so `accessibilityState`
 * carrying `selected` is what makes "which tab am I on" answerable at all. The
 * count is folded into the label for the same reason — a pill beside the word
 * is read as a loose number otherwise.
 *
 * This one matters beyond itself: ADR-031 moves it into the list header slot on
 * both screens, so a regression here shows up as two broken screens.
 */
import { fireEvent, screen } from '@testing-library/react-native';
import { SegmentedTabs } from './segmented-tabs';
import { SCHEMES, flattenStyle, paletteFor, renderInScheme } from '@/test-utils';

const ITEMS = [
  { value: 'active', label: 'Active', count: 2 },
  { value: 'past', label: 'Past', count: 5 },
];

/** The border colour of the nearest ancestor of a tab's label that draws one. */
function underlineOf(label: string): string | undefined {
  type Node = { props?: { style?: unknown }; parent: Node | null };
  for (let cur: Node | null = screen.getByText(label) as unknown as Node; cur; cur = cur.parent) {
    const border = flattenStyle(cur.props?.style).borderBottomColor;
    if (border !== undefined) return border as string;
  }
  return undefined;
}

describe.each(SCHEMES)('SegmentedTabs in the %s scheme', (scheme) => {
  const c = paletteFor(scheme);

  it('renders one tab per item', () => {
    renderInScheme(<SegmentedTabs items={ITEMS} value="active" onChange={() => {}} />, scheme);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('folds the count into the label, so it is heard as part of the tab', () => {
    renderInScheme(<SegmentedTabs items={ITEMS} value="active" onChange={() => {}} />, scheme);
    expect(screen.getByRole('tab', { name: 'Active, 2' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Past, 5' })).toBeTruthy();
  });

  it('labels a tab with no count by its name alone', () => {
    renderInScheme(
      <SegmentedTabs
        items={[{ value: 'all', label: 'All' }]}
        value="all"
        onChange={() => {}}
      />,
      scheme,
    );
    expect(screen.getByRole('tab', { name: 'All' })).toBeTruthy();
  });

  it('announces which tab is selected, since the underline is invisible to a reader', () => {
    renderInScheme(<SegmentedTabs items={ITEMS} value="active" onChange={() => {}} />, scheme);
    expect(screen.getByRole('tab', { name: 'Active, 2' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Past, 5' })).not.toBeSelected();
  });

  /**
   * Read off the node that actually carries the border rather than off the
   * pressable. Session 11 moved this onto `PressableScale`, which puts the
   * style on the animated view inside the pressable — and this assertion broke
   * on it, reading `undefined`. The claim was right and the mechanism was not:
   * how many wrappers sit between a control and its border is a layout detail.
   */
  it('underlines the selected tab and leaves the other one clear', () => {
    renderInScheme(<SegmentedTabs items={ITEMS} value="active" onChange={() => {}} />, scheme);
    expect(underlineOf('Active')).toBe(c.brand700);
    expect(underlineOf('Past')).toBe('transparent');
  });

  it('reports the value that was pressed, and not the one already active', () => {
    const onChange = jest.fn();
    renderInScheme(<SegmentedTabs items={ITEMS} value="active" onChange={onChange} />, scheme);

    fireEvent.press(screen.getByRole('tab', { name: 'Past, 5' }));
    expect(onChange).toHaveBeenCalledWith('past');
  });

  it('renders nothing at all for an empty item list', () => {
    renderInScheme(<SegmentedTabs items={[]} value="" onChange={() => {}} />, scheme);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});
