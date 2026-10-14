"use client";

import { Rating } from "@heroui-pro/react";

/** Read-only star row (artifact: rating). Fractional values fill the last star. */
export function Stars({ value, size = "sm", label }: { value: number; size?: "sm" | "md" | "lg"; label: string }) {
  return (
    <Rating size={size} value={value} isReadOnly aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Rating.Item key={n} value={n} />
      ))}
    </Rating>
  );
}
