"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@injishi/web-ui";
import { cn } from "@injishi/utils";

import { useHostStanding, type HostStanding } from "@/hooks/use-host-standing";
import { appHome } from "@/lib/redirect";

/**
 * The host-side action in the site header — one slot, three renderings.
 *
 * The bar carried a fixed `List Accommodation → /host`, which is right for a
 * visitor and wrong for the two people it is most likely to be shown to next:
 * somebody halfway through a paid registration, and somebody already running a
 * hotel. `use-host-standing.ts` owns which standing applies, why it resolves
 * optimistically rather than behind a placeholder, and why it does not read the
 * session. This file only draws the answer.
 *
 * WHY THE ACTIVE HOST'S BUTTON IS QUIETER. A solid primary is a conversion
 * control, and an operator is already converted — leaving it solid makes the
 * loudest thing in the marketplace bar a button for the one person who does not
 * need selling. `outline` keeps the route one click away without shouting.
 *
 * HOSTING OPENS THE APP, ON ITS OWN ORIGIN (2026-10-24). The operator app has
 * its own host (`NEXT_PUBLIC_PMS_URL`), and its `/auth/continue` opens the
 * person's own home there (`appHome()`). The session cookie is shared: the API
 * writes it on the parent domain in a deployed stack, and on `localhost`, which
 * every port shares, on a laptop. This used to be `/w/<id>` on web's origin,
 * forwarded to the app as a zone; the app has no page there, so it 404ed.
 */
interface Copy {
  label: string;
  href: string;
  variant: "primary" | "outline";
}

function copyFor(standing: HostStanding, labels: Record<HostStanding["state"], string>): Copy {
  switch (standing.state) {
    case "hosting":
      return {
        label: labels.hosting,
        href: appHome(),
        variant: "outline",
      };
    case "registering":
      // NOT `/host`. That page sells the idea of listing to somebody still
      // deciding; this person decided, paid, and is waiting. The wizard reads
      // its own in-flight registration and opens on the resume phase.
      return { label: labels.registering, href: "/register", variant: "primary" };
    case "prospect":
      return { label: labels.prospect, href: "/host", variant: "primary" };
  }
}

export function HostCta({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const { label, href, variant } = copyFor(useHostStanding(), {
    hosting: t("hostSwitch"),
    registering: t("hostResume"),
    prospect: t("hostList"),
  });

  return (
    <Button asChild size="lg" variant={variant} className={cn("shrink-0 px-6", className)}>
      <Link href={href}>{label}</Link>
    </Button>
  );
}

/**
 * The same standing, for the mobile panel.
 *
 * A second rendering rather than the same one at another width, for the reason
 * `AccountMenuMobile` gives: the panel has room to lay the action out full
 * width, and it sits inside a Radix dialog. What it must NOT do is answer
 * differently — a bar offering "Switch to hosting" over a menu offering "List
 * Accommodation" is worse than either alone — so both read the same hook, and
 * the hook answers from one memoised request.
 */
export function HostCtaMobile({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const { label, href, variant } = copyFor(useHostStanding(), {
    hosting: t("hostSwitch"),
    registering: t("hostResume"),
    prospect: t("hostList"),
  });

  return (
    <Button asChild fullWidth variant={variant}>
      <Link href={href} onClick={onNavigate}>
        {label}
      </Link>
    </Button>
  );
}
