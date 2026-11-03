import { Image, type ImageProps } from "expo-image";
import { StyleSheet, View } from "react-native";
import { OnGround } from "./ground";
import { metrics } from "./metrics";
import { Text, type TextRole } from "./text";
import { softGround, softTone, type Tone } from "./tone";

export type AvatarSize = keyof typeof metrics.avatarSize;

/** The initials' role per size: `.ava.s` 12, `.ava` 14, `.ava.l` 19, `.ava.xl` 26. */
const INITIALS: Record<AvatarSize, { role: TextRole; strong: boolean }> = {
  s: { role: "caption", strong: true },
  m: { role: "callout", strong: true },
  l: { role: "title3", strong: true },
  xl: { role: "title1", strong: false },
};

export type AvatarProps = {
  /** `s` 32, `m` 40 (default), `l` 56, `xl` 76. */
  size?: AvatarSize;
  /** A portrait. Without it, the initials. */
  source?: ImageProps["source"];
  /** The person's name: read aloud, and the initials when none are given. */
  name?: string;
  /** Up to two letters; by default the first letters of the first and last word of `name`. */
  initials?: string;
  /** The initials' tint. `accent` is the prototype's `.ava`. */
  tone?: Tone;
};

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/**
 * `.ava`: a round portrait, cropped toward the face (25% from the top), or the initials on a soft
 * tint. Read aloud as the name when there is one; otherwise decoration beside the name.
 */
export function Avatar({ size = "m", source, name, initials, tone = "accent" }: AvatarProps) {
  const side = metrics.avatarSize[size];
  const letters = (initials ?? (name ? initialsOf(name) : "")).slice(0, 2);
  const type = INITIALS[size];
  return (
    <View
      accessible={Boolean(name)}
      accessibilityRole={name ? "image" : undefined}
      accessibilityLabel={name}
      importantForAccessibility={name ? "yes" : "no-hide-descendants"}
      className={`items-center justify-center overflow-hidden rounded-full ${softTone[tone].root}`}
      style={{ width: side, height: side }}
    >
      {source ? (
        <Image
          source={source}
          contentFit="cover"
          contentPosition={FACE}
          accessible={false}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <OnGround ground={softGround(tone)}>
          <Text role={type.role} strong={type.strong} maxScale={1}>
            {letters}
          </Text>
        </OnGround>
      )}
    </View>
  );
}

/** `background-position: center 25%`: a portrait keeps the face. */
const FACE = { top: "25%", left: "50%" } as const;
