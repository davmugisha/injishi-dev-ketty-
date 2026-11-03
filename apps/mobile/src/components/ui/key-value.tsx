import { Fragment, type ReactNode } from "react";
import { View } from "react-native";
import { Icon, type IconName } from "./icon";
import { Text, type TextTone } from "./text";

export type KeyValueRow = {
  /** The muted name on the left ("Paid to", "Fee"). */
  label: string;
  /** The value on the right: words, or a node (a chip, a value with an icon). */
  value: ReactNode;
  /** The value's tone when it is words: `success` for "Paid", `warning` for a balance due. */
  tone?: TextTone;
  /** A small icon before a word value (the check before "Yes"). */
  icon?: IconName;
  /** A stable key when two rows share a label. */
  key?: string;
};

export type KeyValueProps = {
  rows: readonly KeyValueRow[];
  /** `.kv.total`: the last row, larger and in the page's ink ("Total RWF 280,000"). */
  total?: { label: string; value: string };
  /** Layout only. */
  className?: string;
};

/**
 * `.kv`: label and value pairs, one per line, a hairline between each. Labels are muted, values
 * `label` weight and aligned to the end; both wrap rather than cut off. A screen reader reads each
 * pair as one line ("Paid to, Amahoro Residences Ltd").
 */
export function KeyValue({ rows, total, className }: KeyValueProps) {
  return (
    <View className={className}>
      {rows.map((row, index) => (
        <Fragment key={row.key ?? row.label}>
          {index > 0 ? <View className="h-px bg-separator" importantForAccessibility="no" /> : null}
          <Pair row={row} />
        </Fragment>
      ))}
      {total ? (
        <>
          {rows.length > 0 ? <View className="h-px bg-separator" importantForAccessibility="no" /> : null}
          <View
            accessible
            accessibilityLabel={`${total.label}, ${total.value}`}
            className="flex-row items-baseline justify-between gap-3 py-2.5"
          >
            <Text role="headline" strong className="shrink">
              {total.label}
            </Text>
            <Text role="headline" strong tabular className="shrink text-right">
              {total.value}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function Pair({ row }: { row: KeyValueRow }) {
  const words = typeof row.value === "string" || typeof row.value === "number";
  return (
    <View
      accessible={words}
      accessibilityLabel={words ? `${row.label}, ${String(row.value)}` : undefined}
      className="flex-row items-center justify-between gap-3 py-2.5"
    >
      <Text role="callout" tone="muted" className="shrink">
        {row.label}
      </Text>
      {words ? (
        <View className="shrink flex-row items-center justify-end gap-1">
          {row.icon ? <Icon name={row.icon} size={16} tone={row.tone} /> : null}
          <Text role="callout" strong tone={row.tone} className="shrink text-right">
            {String(row.value)}
          </Text>
        </View>
      ) : (
        <View className="shrink items-end">{row.value}</View>
      )}
    </View>
  );
}
