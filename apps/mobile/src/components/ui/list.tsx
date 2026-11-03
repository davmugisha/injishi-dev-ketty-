import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { View } from "react-native";
import { OnGround } from "./ground";
import { Glyph, Icon, type IconName } from "./icon";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import { Text, type TextTone } from "./text";
import { softTone, type Tone } from "./tone";

export type IconTileProps = {
  icon: IconName;
  tone?: Tone;
  /** `md` is `.tile-ic` (40), `lg` is `.tile-ic.lg` (48). */
  size?: "md" | "lg";
};

/**
 * `.tile-ic`: an icon on a soft tile, a row's or a card's leading mark. `accent` is the prototype's
 * default; `default` is `.tile-ic.gray`.
 */
export function IconTile({ icon, tone = "accent", size = "md" }: IconTileProps) {
  const side = size === "lg" ? metrics.iconTileLarge : metrics.iconTile;
  return (
    <View
      className={`items-center justify-center ${size === "lg" ? "rounded-2xl" : "rounded-xl"} ${softTone[tone].root}`}
      style={{ width: side, height: side }}
    >
      <Glyph name={icon} size={size === "lg" ? 24 : 20} role={softTone[tone].role} />
    </View>
  );
}

export type ListGroupProps = {
  /** `ListItem`s (or any rows); a hairline is drawn between each two. */
  children: ReactNode;
  /** Layout only, e.g. `mx-4`. */
  className?: string;
};

/**
 * `.list`: rows on one 24 cornered surface with a hairline around it and between the rows. Empty
 * children (`null`, `false`) leave no line behind.
 */
export function ListGroup({ children, className }: ListGroupProps) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <OnGround ground={null}>
      <View
        className={["overflow-hidden rounded-3xl border border-separator bg-surface", className]
          .filter(Boolean)
          .join(" ")}
      >
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 ? <View className="h-px bg-separator" importantForAccessibility="no" /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </OnGround>
  );
}

export type ListItemProps = {
  title: string;
  /** `.li .sub`: one or two quiet lines. */
  subtitle?: string;
  /** A third line under the subtitle: chips, a progress bar. */
  meta?: ReactNode;
  /** A leading icon tile (`.tile-ic`) in `tone`. */
  icon?: IconName;
  tone?: Tone;
  /** Any other leading item: an `Avatar`, a `Photo` thumbnail, a date block. Wins over `icon`. */
  leading?: ReactNode;
  /** A short value at the end, in the `label` role ("950,000", "More soon"). */
  value?: string;
  /** Anything else at the end: a `Chip`, a `StatusPill`, a `Toggle`, a `LiveDot`. */
  trailing?: ReactNode;
  /** The chevron. Defaults to on for a row that opens something (`onPress`). */
  chevron?: boolean;
  onPress?: () => void;
  /** `lg` is `.li.big` (64): a row with a thumbnail or two lines of subtitle. */
  size?: "md" | "lg";
  /** The title's tone: `danger` for a destructive row ("Delete my account"). */
  titleTone?: TextTone;
  /** Read aloud instead of the row's words, for a row that opens something. */
  accessibilityLabel?: string;
};

/**
 * `.li`: one row of a `ListGroup`. At least 56 high (64 for `lg`), 12 by 14 padding, a leading
 * tile or item, a title (`callout strong`) over an optional subtitle (`caption`, muted) and meta line,
 * a value or trailing item, and a chevron when it opens something. Pressed, it shows the `pressed`
 * colour as a highlight on iOS and a ripple on Android (AC-13). Text wraps; nothing is cut off.
 */
export function ListItem({
  title,
  subtitle,
  meta,
  icon,
  tone = "accent",
  leading,
  value,
  trailing,
  chevron,
  onPress,
  size = "md",
  titleTone,
  accessibilityLabel,
}: ListItemProps) {
  const lead = leading ?? (icon ? <IconTile icon={icon} tone={tone} /> : null);
  const showChevron = chevron ?? Boolean(onPress);
  const body = (
    <View
      className="flex-row items-center gap-3 px-3.5 py-3"
      style={{ minHeight: size === "lg" ? metrics.rowLarge : metrics.rowMin }}
    >
      {lead}
      <View className="flex-1 gap-0.5">
        <Text role="callout" strong tone={titleTone}>
          {title}
        </Text>
        {subtitle ? (
          <Text role="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
        {meta ? <View className="mt-1 flex-row flex-wrap items-center gap-2">{meta}</View> : null}
      </View>
      {value ? (
        <Text role="callout" strong className="text-right">
          {value}
        </Text>
      ) : null}
      {/* Its own box, so a trailing chip (HeroUI aligns a chip to the start) still centres. */}
      {trailing ? <View>{trailing}</View> : null}
      {showChevron ? <Icon name="ChevronRight" size={16} tone="muted" /> : null}
    </View>
  );
  // A row that only shows things stays open, so a trailing control (a Toggle) is reached on its own.
  if (!onPress) return body;
  // No label of its own unless given: a screen reader reads the title, subtitle and value.
  return (
    <PressArea onPress={onPress} feedback="native" accessibilityLabel={accessibilityLabel} className="overflow-hidden">
      {body}
    </PressArea>
  );
}
