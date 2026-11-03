// Property and unit photographs (mobile spec 0005, cross child contract "Photos"). Every photo on the
// wire is `{ id, kind, caption, width, height }`; its URL is built here and nowhere else.

import type { ExplorePhoto } from "@injishi/contracts";
import { Image } from "expo-image";
import { Text as NativeText, View } from "react-native";
import { roleText } from "@/components/ui/text";
import { API_URL } from "@/lib/env";
import { initials } from "./words";

/** `thumb` for cards, `medium` for the page; sized variants arrive in milestone 4, originals until then. */
export type PhotoSize = "thumb" | "medium";

/**
 * The API route a photograph is served from. The route checks the public rule on every request and
 * redirects to a short lived link (ADR-053), so a suspension cuts the image at once.
 */
export function photoUrl(photo: Pick<ExplorePhoto, "id" | "kind">, _size: PhotoSize): string {
  return photo.kind === "unit"
    ? `${API_URL}/api/v1/explore/unit-photos/${photo.id}`
    : `${API_URL}/api/v1/properties/photos/${photo.id}`;
}

/**
 * One photograph filling its box. The disk cache is keyed by the API URL, a best effort given the
 * route's `no-store` (D-ay). Decorative unless `label` is given.
 */
export function Photo({ photo, size, label }: { photo: ExplorePhoto; size: PhotoSize; label?: string }) {
  const uri = photoUrl(photo, size);
  return (
    <Image
      source={{ uri, cacheKey: uri }}
      cachePolicy="disk"
      contentFit="cover"
      transition={150}
      accessible={!!label}
      accessibilityLabel={label}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

/** The initials on `accent-soft` take its own pair, `accent-soft-foreground`, which `Text` has no tone for. */
const INITIALS = { small: roleText("title1"), large: roleText("display") } as const;

/**
 * A property with no photograph: its initials on a tinted surface from the theme, never a stock
 * picture (the property page child).
 */
export function PhotoPlaceholder({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <View className="flex-1 items-center justify-center bg-accent-soft" accessible={false}>
      <NativeText
        className={`${INITIALS[large ? "large" : "small"].className} text-accent-soft-foreground`}
        maxFontSizeMultiplier={INITIALS[large ? "large" : "small"].maxFontSizeMultiplier}
        style={INITIALS[large ? "large" : "small"].style}
      >
        {initials(name)}
      </NativeText>
    </View>
  );
}
