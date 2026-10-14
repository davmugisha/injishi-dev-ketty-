import { ImageOff } from "lucide-react";
import { cn } from "@injishi/utils";

/**
 * What a stay shows where its photograph would be, when it has uploaded none.
 *
 * Stays used to borrow a Kigali landscape here, which read as the property's
 * own picture. This says what is true instead. It fills its box, so it drops
 * into any frame that already sets the size.
 */
export function NoPhoto({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div
      data-no-photo
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-1.5 bg-surface-secondary text-muted-foreground",
        className,
      )}
    >
      <ImageOff className={compact ? "size-4" : "size-6"} strokeWidth={1.6} aria-hidden />
      {compact ? (
        <span className="sr-only">No photos yet</span>
      ) : (
        <span className="text-xs font-semibold">No photos yet</span>
      )}
    </div>
  );
}
