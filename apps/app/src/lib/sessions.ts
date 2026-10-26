/**
 * The rows of "Sign-in & sessions", from the person's real sessions (`sessionsFor` in server/auth.ts).
 * No `next/*` imports: the unit tests drive it directly.
 *
 * What a session record knows is the browser's user agent, the network address it last came from, and when
 * it started and was last used. Nothing here claims more: no city (there is no lookup behind an address),
 * no workspace (one session opens every workspace a person holds).
 */

export interface SessionRow {
  id: string;
  icon: "Smartphone" | "Display";
  device: string;
  place: string;
  since: string;
  last: string;
  current: boolean;
}

interface SessionInput {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  current: boolean;
}

const BROWSERS: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\bOPR\//, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/Chrome\/|\bCriOS\//, "Chrome"],
  [/\bVersion\/[\d.]+.*\bSafari\//, "Safari"],
  [/\bExpo\b|\bokhttp\/|\bCFNetwork\//, "Injishi app"],
];

const SYSTEMS: [RegExp, string, SessionRow["icon"]][] = [
  [/\biPhone\b/, "iPhone", "Smartphone"],
  [/\biPad\b/, "iPad", "Smartphone"],
  [/\bAndroid\b/, "Android", "Smartphone"],
  [/\bCrOS\b/, "ChromeOS", "Display"],
  [/\bWindows\b/, "Windows", "Display"],
  [/\bMac OS X\b|\bMacintosh\b/, "macOS", "Display"],
  [/\bLinux\b/, "Linux", "Display"],
];

/** "Chrome on Windows", from a user agent; "Unknown device" when it says nothing recognisable. */
export function describeDevice(userAgent: string | null): { device: string; icon: SessionRow["icon"] } {
  const ua = userAgent ?? "";
  const browser = BROWSERS.find(([pattern]) => pattern.test(ua))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(ua));
  const icon = system?.[2] ?? (/\bMobile\b/.test(ua) ? "Smartphone" : "Display");
  if (browser && system) return { device: `${browser} on ${system[1]}`, icon };
  return { device: browser ?? system?.[1] ?? "Unknown device", icon };
}

/** The product's clock is Kigali's, whatever the server's is. */
const STAMP = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Africa/Kigali",
});

/** "12 Oct, 07:58". */
export function stamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : STAMP.format(date);
}

/** "Active now", "5 minutes ago", "3 hours ago", "2 days ago", or the date once it is older than a week. */
export function lastActive(iso: string, now: Date, current: boolean): string {
  if (current) return "Active now";
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 2) return "Just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "Yesterday" : `${days} days ago`;
  return stamp(iso);
}

export function sessionRow(session: SessionInput, now: Date = new Date()): SessionRow {
  const { device, icon } = describeDevice(session.userAgent);
  return {
    id: session.id,
    icon,
    device,
    place: session.ipAddress?.trim() || "Unknown network",
    since: stamp(session.createdAt),
    last: lastActive(session.updatedAt, now, session.current),
    current: session.current,
  };
}
