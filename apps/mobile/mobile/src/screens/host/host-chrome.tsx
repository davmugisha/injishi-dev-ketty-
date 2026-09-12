/**
 * The pieces Today and Bookings both draw.
 *
 * Built inside this folder rather than added to `src/components`, per
 * MOBILE-PROTOTYPE-PROMPTS.md Part 3: the barrel is frozen until Session 11,
 * and a primitive promoted before a second surface wants it is a primitive
 * whose API was designed against one screen. Every one of these is named in
 * this session's report as a lift candidate.
 */
import { type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import {
  AdapterNote as KitAdapterNote,
  Card,
  Icon,
  PressableScale,
  Text,
  type IconName,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';

/* ------------------------------------------------------------- the counters */

export interface CountChip {
  id: string;
  label: string;
  count: number;
}

/**
 * The row of counts at the top of Today, which is also the filter.
 *
 * The operator screen makes its stats clickable and that is the right call on a
 * phone too: a number a desk reads and a number a desk taps are the same
 * number, and drawing them twice would spend a third of a small screen saying
 * one thing. The count leads and the word follows, because the count is what is
 * scanned.
 */
export function CountChips({
  items,
  value,
  onChange,
}: {
  items: readonly CountChip[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { c, space, radius } = useTheme();
  const t = useT();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space[2], paddingRight: space[4] }}
    >
      {items.map((item) => {
        const on = item.id === value;
        return (
          <PressableScale
            key={item.id}
            accessibilityRole="tab"
            accessibilityLabel={`${item.label}, ${item.count}`}
            accessibilityHint={t('host.countHint', { label: item.label })}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(item.id)}
            style={{
              minHeight: 44,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: radius.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              borderWidth: 1,
              borderColor: on ? c.borderBrand : c.borderSubtle,
              backgroundColor: on ? c.actionSubtle : c.surface1,
            }}
          >
            <Text
              family="mono"
              weight="semibold"
              size="md"
              color={on ? 'action' : 'textStrong'}
            >
              {String(item.count)}
            </Text>
            <Text size="sm" weight={on ? 'semibold' : 'regular'} color={on ? 'action' : 'textBody'}>
              {item.label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

/* ------------------------------------------------------------- the sections */

/**
 * A titled group with its count, and its own empty line when it holds nothing.
 *
 * The empty line is per section rather than one for the page, because "nobody
 * is leaving today" and "no requests waiting" are different facts and a desk
 * needs to be able to tell which of them is true.
 */
export function HostSection({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children?: ReactNode;
}) {
  const { c, space } = useTheme();

  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Text
          weight="bold"
          size="xs"
          color="textMuted"
          style={{ letterSpacing: 1, textTransform: 'uppercase', flexShrink: 1 }}
        >
          {title}
        </Text>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ height: 1, flex: 1, backgroundColor: c.borderSubtle }}
        />
        <Text family="mono" weight="semibold" size="xs" color="textMuted">
          {String(count)}
        </Text>
      </View>

      {count === 0 ? (
        <Text size="sm" color="textSubtle" style={{ lineHeight: 19 }}>
          {empty}
        </Text>
      ) : (
        <View style={{ gap: space[3] }}>{children}</View>
      )}
    </View>
  );
}

/* --------------------------------------------------------- what is elsewhere */

/**
 * "This lives on the web desk."
 *
 * The session prompt is explicit that the tape chart, the folio and walk-in
 * capture stay on the operator app and that the SCREEN SAYS SO where they
 * would be. A blank where a feature should be is indistinguishable from a
 * feature that is broken; a card that names it and says where it lives is a
 * decision the reader can see.
 */
export function WebDeskNote({
  icon,
  title,
  body,
}: {
  icon: IconName;
  title: string;
  body: string;
}) {
  const { c, space } = useTheme();
  const t = useT();

  return (
    <Card variant="tint">
      <View style={{ gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={icon} size={15} color={c.brand700} />
          <Text weight="semibold" size="sm" color="brand900" style={{ flex: 1 }}>
            {title}
          </Text>
        </View>
        <Text size="sm" color="brand900" style={{ lineHeight: 19 }}>
          {body}
        </Text>
        <Text
          weight="bold"
          size="2xs"
          color="textMuted"
          style={{ letterSpacing: 1, textTransform: 'uppercase' }}
        >
          {t('host.onTheWeb')}
        </Text>
      </View>
    </Card>
  );
}

/**
 * The adapter chip, rendered inline wherever money or compliance state is.
 *
 * Design brief §4.3's rule, and the Guest canvas draws the same thing on all
 * three of its money screens. A refund, an invoice and a payout are all mocked
 * here, so every screen that shows one owes this line.
 *
 * **Session 11 lifted the shape into the kit** once three surfaces had drawn it
 * three ways. This keeps the name the host screens already call, and supplies
 * this surface's copy.
 */
export function AdapterNote() {
  const t = useT();
  return <KitAdapterNote label={t('host.mockAdapter')} body={t('host.mockAdapterNote')} />;
}

/* -------------------------------------------------------------- small parts */

/** A label and a value on one line, as every fact block on this surface draws. */
export function FactRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <Text size="sm" color="textMuted">
        {label}
      </Text>
      <Text
        weight={strong ? 'semibold' : 'medium'}
        size="sm"
        color="textStrong"
        style={{ flexShrink: 1, textAlign: 'right' }}
      >
        {value}
      </Text>
    </View>
  );
}

/** The hairline every fact block and sheet body uses to separate two ideas. */
export function Rule() {
  const { c } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: 1, backgroundColor: c.borderSubtle }}
    />
  );
}
