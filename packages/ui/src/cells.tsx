import { Avatar } from "@heroui/react";
import type { ReactNode } from "react";
import { Icon } from "./icon.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** "Aline Uwase" as "AU"; one name as its first letter. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * A person in a table cell or list row: avatar (photo or initials), name, and one muted line (email,
 * phone, role). The avatar is decorative; the name is the text.
 */
export function PersonCell({
  name,
  secondary,
  imageSrc,
  size = "sm",
  className,
}: {
  name: string;
  /** One line under the name: an email, a phone, "Invited, not signed in yet". */
  secondary?: ReactNode;
  imageSrc?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={cx("flex min-w-0 items-center gap-3", className)}>
      <Avatar size={size} aria-hidden="true" className="shrink-0">
        {imageSrc ? <Avatar.Image src={imageSrc} alt="" /> : null}
        <Avatar.Fallback className="text-xs font-semibold">{initialsOf(name)}</Avatar.Fallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        {secondary ? <span className="truncate text-xs text-muted">{secondary}</span> : null}
      </div>
    </div>
  );
}

/**
 * A rental unit in a table cell or list row: a neutral tile (or the cover photo), the unit's label,
 * and one muted line (block, bedrooms, the property).
 */
export function UnitCell({
  label,
  secondary,
  photoSrc,
  className,
}: {
  /** The unit's own label: "A-12", "Studio 3". */
  label: string;
  /** "Block A · 2 bedrooms". */
  secondary?: ReactNode;
  photoSrc?: string | null;
  className?: string;
}) {
  return (
    <div className={cx("flex min-w-0 items-center gap-3", className)}>
      {photoSrc ? (
        // A plain img: unit photos are already sized thumbnails from storage, not optimisable Next assets.
        // biome-ignore lint/performance/noImgElement: storage thumbnails
        <img src={photoSrc} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-default text-muted"
        >
          <Icon name="FolderHouse" />
        </span>
      )}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{label}</span>
        {secondary ? <span className="truncate text-xs text-muted">{secondary}</span> : null}
      </div>
    </div>
  );
}
