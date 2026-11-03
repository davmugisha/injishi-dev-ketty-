import type { ExplorePhoto } from "@injishi/contracts";
import { type ReactNode, useState } from "react";
import { FlatList, type LayoutChangeEvent, View } from "react-native";
import { Photo, PhotoPlaceholder, type PhotoSize } from "./photo";

/**
 * A property's photographs, one at a time, swiped sideways (the prototype's card carousel and page
 * header). `overlay` draws over the photograph and is told which one shows; with no photograph, the
 * designed placeholder. The pager is decorative to a screen reader: the card or page names it.
 */
export function PhotoPager({
  photos,
  name,
  size,
  overlay,
}: {
  photos: ExplorePhoto[];
  name: string;
  size: PhotoSize;
  overlay?: (index: number) => ReactNode;
}) {
  // Measured, because a slide in a horizontal list has no height of its own to take a percentage of.
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [index, setIndex] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox({ width: Math.round(width), height: Math.round(height) });
  };
  const { width, height } = box;

  return (
    <View className="flex-1 bg-surface-secondary" onLayout={onLayout} importantForAccessibility="no-hide-descendants">
      {photos.length === 0 ? (
        <PhotoPlaceholder name={name} large={size === "medium"} />
      ) : width > 0 && height > 0 ? (
        <FlatList
          data={photos}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          // Only the photograph in view and its neighbours load: a card list on a weak link asks for no more.
          initialNumToRender={1}
          windowSize={3}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <View style={{ width, height }}>
              <Photo photo={item} size={size} />
            </View>
          )}
        />
      ) : null}
      {overlay ? overlay(index) : null}
    </View>
  );
}

/** The dots under a card's photograph: one per photograph, the current one filled. */
export function PagerDots({ count, index }: { count: number; index: number }) {
  if (count < 2) return null;
  return (
    <View
      className="absolute right-0 bottom-3 left-0 flex-row justify-center gap-1.5"
      style={{ pointerEvents: "none" }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: one dot per position, in a fixed order
          key={i}
          className={`h-1.5 rounded-full bg-overlay ${i === index ? "w-4" : "w-1.5 opacity-60"}`}
        />
      ))}
    </View>
  );
}
