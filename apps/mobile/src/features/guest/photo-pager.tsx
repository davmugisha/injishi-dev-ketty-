import { type ReactNode, useState } from "react";
import { FlatList, type LayoutChangeEvent, View } from "react-native";
import { Photo } from "@/components/ui";
import { PhotoPlaceholder } from "./photo";
import type { GuestPhoto } from "./types";

/** How often the pager hears its scroll while swiping, in ms: enough to move the dots with the finger. */
const SCROLL_THROTTLE = 32;

/**
 * A stay's photographs, one at a time, swiped sideways (the prototype's card carousel and the page's
 * header). `overlay` draws over them and is told which one shows; with none, the stay's initials. The
 * pictures are decoration to a screen reader: the card or the page names the stay.
 */
export function PhotoPager({
  photos,
  height,
  name,
  rounded = false,
  overlay,
}: {
  photos: readonly GuestPhoto[];
  height: number;
  /** The stay's name, for the placeholder's initials. */
  name: string;
  /** `.gx-pcard .ph-im`: 24 corners. A page header runs square to the edges. */
  rounded?: boolean;
  overlay?: (index: number) => ReactNode;
}) {
  // Measured, because a page of a horizontal list has no width of its own to take a share of.
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };

  return (
    <View
      onLayout={onLayout}
      className={`overflow-hidden bg-surface-tertiary ${rounded ? "rounded-3xl" : ""}`}
      style={{ height }}
    >
      <View className="flex-1" importantForAccessibility="no-hide-descendants">
        {photos.length === 0 ? (
          <PhotoPlaceholder name={name} large={!rounded} />
        ) : width > 0 ? (
          <FlatList
            data={photos}
            keyExtractor={(_, i) => `photo-${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            // Only the photograph in view and its neighbours load: on a weak link a list asks for no more.
            initialNumToRender={1}
            windowSize={3}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            scrollEventThrottle={SCROLL_THROTTLE}
            onScroll={(event) => {
              const page = Math.round(event.nativeEvent.contentOffset.x / width);
              if (page !== index) setIndex(Math.max(0, Math.min(photos.length - 1, page)));
            }}
            renderItem={({ item }) => <Photo source={item} width={width} height={height} radius="none" />}
          />
        ) : null}
      </View>
      {overlay ? overlay(index) : null}
    </View>
  );
}
