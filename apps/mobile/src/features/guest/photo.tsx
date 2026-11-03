// Property and unit photographs (mobile spec 0005, cross child contract "Photos"). Every photo on the
// wire is `{ id, kind, caption, width, height }`; its URL is built here and nowhere else. Api mode
// only: the sample data draws the prototype's bundled photos.

import type { ExplorePhoto } from "@injishi/contracts";
import { Text as NativeText, View } from "react-native";
import { roleText } from "@/components/ui/text";
import { API_URL } from "@/lib/env";
import type { GuestPhoto } from "./types";
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

/** A photograph as an image source, keyed by its API URL for the disk cache (D-ay). */
export function photoSource(photo: Pick<ExplorePhoto, "id" | "kind">, size: PhotoSize): GuestPhoto {
  const uri = photoUrl(photo, size);
  return { uri, cacheKey: uri };
}

/** The initials on `accent-soft` take its own pair, `accent-soft-foreground`, which `Text` has no tone for. */
const INITIALS = { small: roleText("title1"), large: roleText("display") } as const;

/**
 * A property with no photograph: its initials on a tinted surface from the theme, never a stock
 * picture (the property page child).
 */
export function PhotoPlaceholder({ name, large = false }: { name: string; large?: boolean }) {
  const type = INITIALS[large ? "large" : "small"];
  return (
    <View className="flex-1 items-center justify-center bg-accent-soft" accessible={false}>
      <NativeText
        className={`${type.className} text-accent-soft-foreground`}
        maxFontSizeMultiplier={type.maxFontSizeMultiplier}
        style={type.style}
      >
        {initials(name)}
      </NativeText>
    </View>
  );
}
