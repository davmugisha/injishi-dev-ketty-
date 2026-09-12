"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@injishi/utils";

/** The explore price filter. Two thumbs when `value` carries two entries. */
function Slider({
  className,
  defaultValue,
  value,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const thumbCount = React.useMemo(
    () => value?.length ?? defaultValue?.length ?? 1,
    [value, defaultValue],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        "data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="bg-secondary relative h-1 w-full grow overflow-hidden rounded-full">
        <SliderPrimitive.Range className="bg-ink absolute h-full" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }, (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className={cn(
            "border-ink block size-[18px] rounded-full border-2 bg-white shadow-control",
            "transition-transform hover:scale-110 focus-visible:outline-none",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
