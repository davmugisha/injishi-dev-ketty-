import { cn } from "@injishi/utils";
import { AndroidMark, AppleMark, WindowsMark } from "@/components/downloads/platform-marks";
import { downloadHref, type Platform } from "@/lib/download-links";

/**
 * The download button on `/downloads` (mobile spec 0004): one button for each
 * of the four platforms, all the same size and style, so a row or a column of
 * them lines up exactly.
 *
 * Our own buttons rather than the App Store and Google Play badges (decided
 * 2026-10-30): the official art comes in two different proportions, so the
 * badges could never match each other or the desktop buttons, and no store has
 * the app yet. If a store's rules call for its badge once the app is live,
 * swap it in here; every button on the page comes from this one component.
 *
 * Every href comes from `downloadHref`, so a button opens its store or file
 * once that platform's link is set in `data/app-downloads.ts`, and its Coming
 * soon screen until then. A plain `<a>`, not `Link`: one target is another
 * site, and the other is a bare screen with nothing to prefetch.
 *
 * The ink ground and snow label are fixed, so the button reads the same in
 * either theme. 45px tall, a full touch target.
 */
const BUTTONS: Record<Platform, { name: string; Mark: typeof AppleMark; mark: string }> = {
  ios: { name: "iPhone", Mark: AppleMark, mark: "size-6" },
  android: { name: "Android", Mark: AndroidMark, mark: "size-6" },
  mac: { name: "Mac", Mark: AppleMark, mark: "size-6" },
  windows: { name: "Windows", Mark: WindowsMark, mark: "size-5" },
};

export function DownloadButton({ platform, className }: { platform: Platform; className?: string }) {
  const { name, Mark, mark } = BUTTONS[platform];
  return (
    <a
      href={downloadHref(platform)}
      className={cn(
        "inline-flex h-12 w-44 shrink-0 items-center gap-3 rounded-xl bg-ink pr-4 pl-4 text-snow ring-1 ring-slate-line ring-inset transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      )}
    >
      {/* A fixed box for the mark, so every label starts at the same place. */}
      <span className="grid size-6 shrink-0 place-items-center">
        <Mark className={mark} />
      </span>
      <span className="flex flex-col text-left leading-none">
        <span className="text-2xs">Download for</span>{" "}
        {/* The space keeps the accessible name "Download for Mac", not "Download forMac". */}
        <span className="mt-0.5 text-lg font-semibold tracking-tight">{name}</span>
      </span>
    </a>
  );
}
