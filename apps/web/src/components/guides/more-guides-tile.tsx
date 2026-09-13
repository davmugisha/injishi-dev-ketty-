import Link from "next/link";
import { cn } from "@injishi/utils";
import { ArrowBoxIcon } from "@/components/icons/marks";

/**
 * The "More" tile that closes the "Latest from Blog" row.
 *
 * It is the narrow third column in the capture, and it is deliberately NOT a
 * third guide: the 1fr slot is too narrow to carry a headline, which is why the
 * card that used to sit there ran a 3:5 crop of a landscape photograph and a
 * title that wrapped to four lines. A plain surface with one word and the boxed
 * arrow says the same thing the section heading's "All guides" link says, in
 * the place the eye is already travelling to.
 *
 * No photograph, so no scrim: this is the one tile in the row drawn on a theme
 * role rather than over an image, and it takes `rounded-card` with its
 * neighbours.
 */
export function MoreGuidesTile({ className }: { className?: string }) {
  return (
    <Link
      href="/guides"
      aria-label="More guides"
      className={cn(
        "group flex flex-col justify-end rounded-card bg-surface-secondary p-4 transition-colors duration-travel hover:bg-surface-tertiary md:p-6",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-base text-page-fg md:text-lg">More</span>
        <ArrowBoxIcon className="shrink-0 text-page-fg transition-transform duration-travel group-hover:-translate-y-1 group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
