"use client";

import Link from "next/link";
import { Button } from "@injishi/web-ui";
import { cn } from "@injishi/utils";

import { useHostStanding, type HostStanding } from "@/hooks/use-host-standing";

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
 * `/w/<id>` IS SAME-ORIGIN. The operator app is a zone rewritten under web's
 * origin (`next.config.mjs`, `beforeFiles`), so this is a plain `Link` and the
 * session cookie travels because the browser only ever sees one origin. Do not
 * "fix" it into an absolute `NEXT_PUBLIC_PMS_URL` link; that config says why the
 * zone exists, and an absolute URL would leave the origin the cookie is set on.
 */
interface Copy {
  label: string;
  href: string;
  variant: "primary" | "outline";
}

function copyFor(standing: HostStanding): Copy {
  switch (standing.state) {
    case "hosting":
      return {
        label: "Switch to hosting",
        href: `/w/${standing.workspace.workspaceId}`,
        variant: "outline",
      };
    case "registering":
      // NOT `/host`. That page sells the idea of listing to somebody still
      // deciding; this person decided, paid, and is waiting. The wizard reads
      // its own in-flight registration and opens on the resume phase.
      return { label: "Resume registration", href: "/register", variant: "primary" };
    case "prospect":
      return { label: "List Accommodation", href: "/host", variant: "primary" };
  }
}

export function HostCta({ className }: { className?: string }) {
  const { label, href, variant } = copyFor(useHostStanding());

  return (
    <Button asChild size="md" variant={variant} className={cn("shrink-0 px-5", className)}>
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
  const { label, href, variant } = copyFor(useHostStanding());

  return (
    <Button asChild fullWidth variant={variant}>
      <Link href={href} onClick={onNavigate}>
        {label}
      </Link>
    </Button>
  );
}
