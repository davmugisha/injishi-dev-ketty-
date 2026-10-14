"use client";

import { ArrowRightToSquare } from "@gravity-ui/icons";
import { Avatar } from "@heroui/react";
import { Navbar } from "@heroui-pro/react";
import { type BoardId, screenHref } from "@injishi/data";
import { LinkButton } from "@injishi/ui";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand";

/** The signed-in visitor shown in the marketplace header (null = nobody is signed in). */
export interface MarketVisitor {
  name: string;
  initials: string;
}

export type MarketNavId = "stays" | "homes" | "hosts" | "help" | "trips";

const NAV: { id: MarketNavId; label: string; href: () => string }[] = [
  { id: "stays", label: "Stays", href: () => screenHref("MarketExplore") },
  { id: "homes", label: "Homes to rent", href: () => `${screenHref("MarketExplore")}?mode=homes` },
  { id: "hosts", label: "For hosts", href: () => screenHref("PublicHost") },
  { id: "help", label: "Help", href: () => screenHref("PublicHelp") },
  { id: "trips", label: "Trips", href: () => screenHref("GuestAccount") },
];

/** Max content width of a marketplace page: explore is wider; checkout’s column is narrower than its header. */
export type MarketWidth = "wide" | "regular" | "narrow";

const WIDTH: Record<MarketWidth, string> = {
  wide: "max-w-[1376px]",
  regular: "max-w-[1240px]",
  narrow: "max-w-[1120px]",
};

/** Account avatar (signed in) or a sign-in link that returns to this page. */
function AccountLink({
  visitor,
  board,
  label,
  returnTo,
}: {
  visitor: MarketVisitor | null;
  board: BoardId;
  label: string;
  returnTo: string;
}) {
  if (!visitor) {
    return (
      <LinkButton href={`${screenHref("SignIn")}?next=${encodeURIComponent(returnTo)}`} variant="ghost" size="sm">
        <ArrowRightToSquare className="size-4" />
        Sign in
      </LinkButton>
    );
  }
  return (
    <NextLink href={screenHref(board)} aria-label={`${label}, ${visitor.name}`} className="rounded-full">
      <Avatar size="sm" variant="soft" color="accent">
        <Avatar.Fallback>{visitor.initials}</Avatar.Fallback>
      </Avatar>
    </NextLink>
  );
}

/**
 * Marketplace header (artifact: the public navbar). `current` marks the active section; on explore the
 * Stays / Homes to rent items switch the search mode in place (`onMode`) instead of navigating.
 */
export function MarketHeader({
  width,
  visitor,
  returnTo,
  current,
  showNav = true,
  onMode,
  actions,
  account = { board: "GuestAccount", label: "Your account" },
}: {
  width: MarketWidth;
  visitor: MarketVisitor | null;
  /** Page to come back to after signing in. */
  returnTo: string;
  current?: MarketNavId;
  showNav?: boolean;
  onMode?: (mode: "stays" | "homes") => void;
  actions?: ReactNode;
  account?: { board: BoardId; label: string };
}) {
  return (
    <Navbar position="static" maxWidth="full" aria-label="Site" className="border-b border-separator bg-background">
      <Navbar.Header className={`${WIDTH[width]} gap-4 px-4 sm:px-[32px]`}>
        <Navbar.Brand>
          <NextLink href={screenHref("Main")} className="flex items-center gap-2.5 text-foreground no-underline">
            <BrandMark size={28} />
            <span className="text-base font-semibold tracking-[-0.01em]">Injishi</span>
          </NextLink>
        </Navbar.Brand>
        {showNav ? (
          <Navbar.Content aria-label="Main" className="ml-3 hidden gap-0.5 md:flex">
            {NAV.map((n) => {
              const isCurrent = n.id === current;
              const cls = isCurrent ? "font-semibold" : undefined;
              if (onMode && (n.id === "stays" || n.id === "homes")) {
                const mode = n.id;
                return (
                  <Navbar.Item
                    key={n.id}
                    className={cls}
                    isCurrent={isCurrent}
                    aria-pressed={isCurrent}
                    onClick={() => onMode(mode)}
                  >
                    {n.label}
                  </Navbar.Item>
                );
              }
              return (
                <Navbar.Item key={n.id} href={n.href()} className={cls} isCurrent={isCurrent}>
                  {n.label}
                </Navbar.Item>
              );
            })}
          </Navbar.Content>
        ) : null}
        <Navbar.Spacer />
        {actions}
        <AccountLink visitor={visitor} board={account.board} label={account.label} returnTo={returnTo} />
      </Navbar.Header>
    </Navbar>
  );
}

const FOOTER: { id: string; label: string; board: BoardId }[] = [
  { id: "help", label: "Help centre", board: "PublicHelp" },
  { id: "privacy", label: "Privacy notice", board: "PublicHelp" },
  { id: "terms", label: "Terms", board: "PublicHelp" },
  { id: "hosts", label: "For hosts", board: "PublicHost" },
  { id: "certificate", label: "Verify a certificate", board: "Training" },
];

/** Marketplace footer: the first `links` footer links, then the currency and language line. */
export function MarketFooter({ width, links }: { width: MarketWidth; links: 3 | 4 | 5 }) {
  return (
    <footer className="mt-auto border-t border-separator">
      <div
        className={`mx-auto flex w-full ${WIDTH[width]} flex-wrap items-center gap-4 px-4 py-[18px] text-[13px] text-muted sm:px-[32px]`}
      >
        <span>© 2026 Injishi</span>
        {FOOTER.slice(0, links).map((l) => (
          <NextLink key={l.id} href={screenHref(l.board)} className="text-inherit no-underline hover:text-foreground">
            {l.label}
          </NextLink>
        ))}
        <span className="flex-1" />
        <span>Prices in RWF · English</span>
      </div>
    </footer>
  );
}

/** Page column under the header (artifact: .ij-web-main). */
export function MarketMain({
  width,
  className,
  children,
}: {
  width: MarketWidth;
  className?: string;
  children: ReactNode;
}) {
  return (
    <main
      className={`mx-auto flex w-full ${WIDTH[width]} flex-col px-4 pb-12 sm:px-[32px] sm:pb-[72px] [&>*]:min-w-0 ${className ?? ""}`}
    >
      {children}
    </main>
  );
}
