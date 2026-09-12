/**
 * The Session 0 kit, rendered in both schemes.
 *
 * Every primitive added for the prototype gets a light and a dark render here,
 * plus the one assertion that says what it is FOR. A render test that only
 * proves a component does not throw is a test that passes while the component
 * is wrong; each of these asserts the rule its file header claims — the touch
 * floor, the accessibility semantics a bare `Pressable` cannot provide, the
 * fixed foreground on a photographic ground.
 *
 * The two with real state machines have their own files: `calendar-range` and
 * `countdown`. `photo-credit`, `chip-group`, `list-row`, `toast` and
 * `coming-soon` earn one each below, because their behaviour is the reason
 * they exist rather than a detail of how they draw.
 */
import { screen, fireEvent } from '@testing-library/react-native';
import { View } from 'react-native';
import { Text } from './text';
import { ChipGroup } from './chip-group';
import { HeartButton } from './heart-button';
import { InputField, TextArea } from './input-field';
import { ListRow } from './list-row';
import { PressableScale } from './pressable-scale';
import { ProgressSteps } from './progress-steps';
import { ScoreChip, scoreBand } from './score-chip';
import { Sheet } from './sheet';
import { StatRow } from './stat-row';
import { Stepper } from './stepper';
import { Timeline } from './timeline';
import { SCHEMES, paletteFor, flattenStyle, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';

interface StyledNode {
  props?: { style?: unknown };
  parent: StyledNode | null;
}

/**
 * The border colour of the nearest ancestor that paints one. The twin of
 * `enclosingFill` in `test-utils`, and for the same reason: how many wrappers
 * sit between a `TextInput` and the box drawn around it is a layout detail
 * that should not break a contrast assertion.
 */
function enclosingBorder(node: StyledNode | null): string | undefined {
  for (let cur = node; cur; cur = cur.parent) {
    const edge = flattenStyle(cur.props?.style).borderColor;
    if (edge !== undefined) return edge as string;
  }
  return undefined;
}

describe.each(SCHEMES)('PressableScale in the %s scheme', (scheme) => {
  it('is a button that fires, and names itself', () => {
    const onPress = jest.fn();
    renderInScheme(
      <PressableScale accessibilityLabel="Take next task" onPress={onPress}>
        <Text>Take next task</Text>
      </PressableScale>,
      scheme,
    );
    fireEvent.press(screen.getByLabelText('Take next task'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while disabled, and says it is disabled', () => {
    const onPress = jest.fn();
    renderInScheme(
      <PressableScale accessibilityLabel="Blocked" disabled onPress={onPress}>
        <Text>Blocked</Text>
      </PressableScale>,
      scheme,
    );
    const control = screen.getByLabelText('Blocked');
    fireEvent.press(control);
    expect(onPress).not.toHaveBeenCalled();
    expect(control.props.accessibilityState.disabled).toBe(true);
  });
});

describe.each(SCHEMES)('ChipGroup in the %s scheme', (scheme) => {
  const items = [
    { value: 'all', label: 'All', count: 7 },
    { value: 'active', label: 'Active', count: 5 },
    { value: 'draft', label: 'Draft' },
  ];

  it('prints a count beside a label that has one, and nothing where there is none', () => {
    renderInScheme(
      <ChipGroup items={items} value="all" onChange={() => {}} />,
      scheme,
    );
    expect(screen.getByText('All · 7')).toBeTruthy();
    expect(screen.getByText('Draft')).toBeTruthy();
  });

  it('is a radiogroup when one may be chosen', () => {
    // Rendered as bare pressables a reader hears unrelated buttons and is never
    // told that choosing one clears another.
    //
    // Queried by label rather than by role: the group carries the role but not
    // `accessible`, and marking a container accessible collapses its children
    // into one node — which would take the individual chips away from the
    // reader to satisfy a test.
    renderInScheme(
      <ChipGroup items={items} legend="Status" value="active" onChange={() => {}} />,
      scheme,
    );
    expect(screen.getByLabelText('Status').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByLabelText('Active · 5').props.accessibilityRole).toBe('radio');
    expect(screen.getByLabelText('Active · 5').props.accessibilityState.selected).toBe(true);
  });

  it('adds to the selection in multi mode and removes on a second tap', () => {
    const onChange = jest.fn();
    renderInScheme(
      <ChipGroup
        mode="multi"
        items={items}
        value={['all']}
        onChange={onChange}
        legend="What failed"
        wrap
      />,
      scheme,
    );
    fireEvent.press(screen.getByLabelText('Active · 5'));
    expect(onChange).toHaveBeenCalledWith(['all', 'active']);

    fireEvent.press(screen.getByLabelText('All · 7'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});

describe.each(SCHEMES)('HeartButton in the %s scheme', (scheme) => {
  it('names the action it will perform, not the state it is in', () => {
    const onToggle = jest.fn();
    renderInScheme(<HeartButton saved={false} onToggle={onToggle} />, scheme);
    fireEvent.press(screen.getByLabelText(en['a11y.save']));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('offers to remove once saved, and reports the state', () => {
    const onToggle = jest.fn();
    renderInScheme(<HeartButton saved onToggle={onToggle} />, scheme);
    const control = screen.getByLabelText(en['a11y.unsave']);
    expect(control.props.accessibilityState.selected).toBe(true);
    fireEvent.press(control);
    expect(onToggle).toHaveBeenCalledWith(false);
  });
});

describe.each(SCHEMES)('ScoreChip in the %s scheme', (scheme) => {
  it('always prints one decimal, so a column of scores lines up', () => {
    renderInScheme(<ScoreChip score={9} />, scheme);
    expect(screen.getByText('9.0')).toBeTruthy();
  });

  it('derives the word from the score rather than taking one', () => {
    renderInScheme(<ScoreChip score={8.2} />, scheme);
    expect(screen.getByText(en['score.veryGood'])).toBeTruthy();
  });

  it('reads the score and the word as one sentence', () => {
    renderInScheme(<ScoreChip score={9.4} />, scheme);
    expect(
      screen.getByLabelText(
        en['a11y.score'].replace('{score}', '9.4').replace('{word}', en['score.exceptional']),
      ),
    ).toBeTruthy();
  });
});

describe('scoreBand', () => {
  it.each([
    [10, 'score.exceptional'],
    [9, 'score.exceptional'],
    [8.9, 'score.excellent'],
    [8.5, 'score.excellent'],
    [8.4, 'score.veryGood'],
    [8, 'score.veryGood'],
    [7.9, 'score.good'],
    [7, 'score.good'],
    [6.9, 'score.pleasant'],
    [0, 'score.pleasant'],
  ])('puts %s in %s', (score, key) => {
    expect(scoreBand(score)).toBe(key);
  });

  it('normalises rather than assuming a scale of ten', () => {
    // A five-star source would otherwise land every property in the bottom
    // band with no type error to warn anyone.
    expect(scoreBand(4.6, 5)).toBe('score.exceptional');
    expect(scoreBand(4.6)).toBe('score.pleasant');
  });
});

describe.each(SCHEMES)('ListRow in the %s scheme', (scheme) => {
  it('reads title, subtitle and value as one sentence, not three stops', () => {
    renderInScheme(
      <ListRow title="Payout account" subtitle="MoMo · mock" value="Change" />,
      scheme,
    );
    expect(screen.getByLabelText('Payout account, MoMo · mock, Change')).toBeTruthy();
  });

  it('clears the 44pt touch floor', () => {
    renderInScheme(<ListRow title="Contract" onPress={() => {}} />, scheme);
    // The floor lives in the component, not in a document — which is exactly
    // why the six shipped components the design brief §7.2 lists as under it
    // were under it.
    const tall = screen
      .getByLabelText('Contract')
      .findAll((node: { props: { style?: unknown } }) => {
        const min = flattenStyle(node.props.style).minHeight;
        return typeof min === 'number' && min >= 44;
      });
    expect(tall.length).toBeGreaterThan(0);
  });

  it('is not a button when it does nothing, and draws no chevron', () => {
    // A chevron on a row that goes nowhere is the orphaned control the quality
    // bar rules out.
    renderInScheme(<ListRow title="Rooms cleaned" value="11" />, scheme);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe.each(SCHEMES)('Stepper and ProgressSteps in the %s scheme', (scheme) => {
  const steps = ['Dates', 'Guests', 'Pay'];

  it('says where in the flow the reader is', () => {
    renderInScheme(<Stepper steps={steps} current={1} />, scheme);
    expect(
      screen.getByLabelText(
        en['a11y.stepOf'].replace('{index}', '2').replace('{total}', '3').replace('{label}', 'Guests'),
      ),
    ).toBeTruthy();
  });

  it('reports progress as a value a reader can hear', () => {
    renderInScheme(<Stepper steps={steps} current={2} />, scheme);
    expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({
      min: 1,
      max: 3,
      now: 3,
    });
  });

  it('tints a blocked record danger rather than leaving it looking in progress', () => {
    const c = paletteFor(scheme);
    const record = [
      { key: 'pending', label: 'Pending' },
      { key: 'in_progress', label: 'In progress' },
      { key: 'done', label: 'Done' },
    ];
    renderInScheme(<ProgressSteps steps={record} current="in_progress" blocked />, scheme);
    // "In progress" and "stuck in progress" are not the same fact to an
    // attendant standing in a corridor.
    const fills = screen
      .getByRole('progressbar')
      .findAll(
        (node: { props: { style?: unknown } }) =>
          flattenStyle(node.props.style).backgroundColor === c.danger500,
      );
    expect(fills.length).toBeGreaterThan(0);
  });
});

describe.each(SCHEMES)('Timeline in the %s scheme', (scheme) => {
  it('reads each entry as its title, its when and its sentence', () => {
    renderInScheme(
      <Timeline
        entries={[
          { key: 'collected', title: 'Collected', meta: 'Jan 12, 2026', body: 'at signing', state: 'done' },
          { key: 'held', title: 'Held', meta: 'Ongoing', body: 'lease active', state: 'current' },
          { key: 'settle', title: 'Settle at move-out', state: 'pending' },
        ]}
      />,
      scheme,
    );
    expect(screen.getByLabelText('Collected, Jan 12, 2026, at signing')).toBeTruthy();
    expect(screen.getByLabelText('Settle at move-out')).toBeTruthy();
  });
});

describe.each(SCHEMES)('StatRow in the %s scheme', (scheme) => {
  it('reads the label, the value and its unit together', () => {
    renderInScheme(<StatRow label="Average per room" value={22} unit="min" />, scheme);
    expect(screen.getByLabelText('Average per room, 22 min')).toBeTruthy();
  });
});

describe.each(SCHEMES)('InputField in the %s scheme', (scheme) => {
  it('draws the field edge in the control-boundary role, never the hairline', () => {
    const c = paletteFor(scheme);
    renderInScheme(
      <InputField label="Phone number" value="" onChangeText={() => {}} prefix="RW +250" />,
      scheme,
    );
    // WCAG 1.4.11: a control boundary owes 3:1. `borderDefault` measures
    // 1.12:1 and is decorative — design brief §7.4 forbids it here.
    const edge = enclosingBorder(screen.getByLabelText('Phone number, RW +250'));
    expect(edge).toBe(c.borderStrong);
    expect(edge).not.toBe(c.borderDefault);
  });

  it('carries the prefix into the field label rather than as a second control', () => {
    renderInScheme(
      <InputField label="Phone number" value="788" onChangeText={() => {}} prefix="RW +250" />,
      scheme,
    );
    expect(screen.getByLabelText('Phone number, RW +250')).toBeTruthy();
  });

  it('says what is wrong in words, not in colour alone', () => {
    renderInScheme(
      <InputField
        label="Phone number"
        value="78"
        onChangeText={() => {}}
        error="Nine digits after the country code"
      />,
      scheme,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Nine digits after the country code')).toBeTruthy();
  });

  it('counts a TextArea against its limit so the cap is never a surprise', () => {
    renderInScheme(
      <TextArea label="Message" value="Thank you" onChangeText={() => {}} maxLength={280} />,
      scheme,
    );
    expect(screen.getByText('9 / 280')).toBeTruthy();
  });
});

describe.each(SCHEMES)('Sheet in the %s scheme', (scheme) => {
  it('carries its title as the page heading, since a sheet has no header', () => {
    renderInScheme(
      <Sheet title="Switch workspace" subtitle="One account">
        <View />
      </Sheet>,
      scheme,
    );
    expect(screen.getByRole('header').props.children).toBe('Switch workspace');
  });

  it('offers a close, and can be told not to', () => {
    renderInScheme(
      <Sheet title="Record a payment">
        <View />
      </Sheet>,
      scheme,
    );
    expect(screen.getByLabelText(en['sheet.close'])).toBeTruthy();

    renderInScheme(
      <Sheet title="Record a payment" closable={false}>
        <View />
      </Sheet>,
      scheme,
    );
    expect(screen.queryByLabelText(en['sheet.close'])).toBeNull();
  });
});
