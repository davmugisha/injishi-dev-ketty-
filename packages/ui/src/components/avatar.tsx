"use client";

import * as React from "react";
import { Avatar as HeroAvatar } from "@heroui/react";
import { cn } from "@injishi/utils";

/**
 * A person or a workspace as a disc, on HeroUI 3.
 *
 * HeroUI's `Avatar` is Radix's avatar underneath, with its own classes on top,
 * so the behaviour is the one this file always had: `AvatarImage` renders only
 * once its picture has loaded and removes itself if it fails, and
 * `AvatarFallback` stands in until then, or for good. The account menu leans
 * on exactly that to cover the initials path and the broken-photo path with
 * one tree.
 *
 * The look stays ours. HeroUI paints the disc a 40px rounded square on
 * `bg-default` with a soft-coloured fallback; each class below overrides one of
 * those and nothing else, and its `size`, `color` and `variant` props are not
 * passed on, because a size here is a `size-*` class and a fill is a role
 * class, as they always were.
 */
type AvatarProps = Omit<React.ComponentProps<typeof HeroAvatar>, "size" | "color" | "variant">;

function Avatar({ className, ...props }: AvatarProps) {
  return (
    <HeroAvatar
      data-slot="avatar"
      className={cn(
        // `bg-transparent`: HeroUI fills the root, which would show as a ring
        // round the fallback's anti-aliased edge and behind a loading photo.
        "relative flex size-10 shrink-0 overflow-hidden rounded-full bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof HeroAvatar.Image>) {
  return (
    <HeroAvatar.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: Omit<React.ComponentProps<typeof HeroAvatar.Fallback>, "color">) {
  return (
    <HeroAvatar.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-secondary text-secondary-foreground flex size-full items-center justify-center rounded-full text-sm font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
