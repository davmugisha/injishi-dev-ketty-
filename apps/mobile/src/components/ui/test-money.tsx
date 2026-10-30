import { Text as NativeText, View } from "react-native";
import { paymentsMode } from "@/lib/payments-mode";
import { Glyph } from "./icon";
import { roleText } from "./text";

/** The kit's only fixed words (prototype `shared-12-testmoney`). */
const COPY = { tag: "Test money", title: "This is the beta.", body: "No real money moves." } as const;

/**
 * Words and glyphs on the warning soft fill take its pair, `warning-soft-foreground`, which the
 * contrast table holds to 4.5:1 on that fill. `Text` has no tone for it, so these draw on React
 * Native's text with the type table's roles.
 */
const ON_FILL = { className: "text-warning-soft-foreground", role: "warning-soft-foreground" } as const;
/** Chrome: `micro` in capitals, growing to 1.5x at most (D-k). */
const TAG = roleText("micro", true);
const TITLE = roleText("headline");
const BODY = roleText("callout");

/**
 * "TEST MONEY" beside a payment's title while payments are a rehearsal (mobile spec 0002, AC-16,
 * D-t): a triangle and the words, never the colour alone. Nothing at all once `paymentsMode` is
 * `"live"`.
 */
export function TestMoneyTag() {
  if (paymentsMode === "live") return null;
  return (
    // Its own row, so the tag hugs its words in a column and still centres in a row.
    <View className="flex-row">
      <View
        accessible
        accessibilityLabel={COPY.tag}
        className="flex-row items-center gap-1 rounded-md bg-warning-soft px-2 py-1"
      >
        <Glyph name="TriangleExclamation" size={12} role={ON_FILL.role} />
        <NativeText
          className={`${TAG.className} ${ON_FILL.className}`}
          maxFontSizeMultiplier={TAG.maxFontSizeMultiplier}
          style={TAG.style}
        >
          {COPY.tag}
        </NativeText>
      </View>
    </View>
  );
}

export type TestMoneyBannerProps = {
  /** One more sentence from the payment screen, after "No real money moves.". */
  detail?: string;
};

/**
 * The beta warning on a payment screen (mobile spec 0002, AC-16, D-t): "This is the beta." in
 * bold, then "No real money moves." and the caller's detail, on the warning soft fill. A screen
 * reader hears it as one passage. Nothing at all once `paymentsMode` is `"live"`.
 */
export function TestMoneyBanner({ detail }: TestMoneyBannerProps) {
  if (paymentsMode === "live") return null;
  return (
    <View accessible className="flex-row items-start gap-3 rounded-2xl bg-warning-soft px-4 py-3">
      {/* As tall as the first line, so the icon sits beside it. */}
      <View className="justify-center" style={{ minHeight: TITLE.style.lineHeight }}>
        <Glyph name="CircleInfo" size={20} role={ON_FILL.role} />
      </View>
      <View className="flex-1">
        <NativeText
          className={`${TITLE.className} ${ON_FILL.className}`}
          maxFontSizeMultiplier={TITLE.maxFontSizeMultiplier}
          style={TITLE.style}
        >
          {COPY.title}
        </NativeText>
        <NativeText
          className={`${BODY.className} ${ON_FILL.className}`}
          maxFontSizeMultiplier={BODY.maxFontSizeMultiplier}
          style={BODY.style}
        >
          {detail ? `${COPY.body} ${detail}` : COPY.body}
        </NativeText>
      </View>
    </View>
  );
}
