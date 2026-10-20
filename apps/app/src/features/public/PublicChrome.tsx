"use client";

import { ArrowRightToSquare, Person } from "@gravity-ui/icons";
import { Chip } from "@heroui/react";
import { Navbar } from "@heroui-pro/react";
import { screenByPath, screenHref } from "@injishi/data";
import { LinkButton, Photo, type PhotoSource } from "@injishi/ui";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand";
import { SampleDataPill } from "@/components/shell/SampleData";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export type PublicNavId = "stays" | "homes" | "hosts" | "help" | "trips";

const NAV: { id: PublicNavId; label: string; href: string }[] = [
  { id: "stays", label: "Stays", href: screenHref("MarketExplore") },
  { id: "homes", label: "Homes to rent", href: `${screenHref("MarketExplore")}?mode=homes` },
  { id: "hosts", label: "For hosts", href: screenHref("PublicHost") },
  { id: "help", label: "Help", href: screenHref("PublicHelp") },
  { id: "trips", label: "Trips", href: screenHref("GuestAccount") },
];

/** Signed-in visitor shown in the public header instead of "Sign in". */
export interface PublicVisitor {
  name: string;
  home: string;
}

/**
 * Header of the public web pages (artifact: header.navbar with the Injishi brand, the main navigation and
 * page-specific actions on the right). `current` marks the page in the main navigation.
 */
export function PublicHeader({ current, actions }: { current?: PublicNavId; actions?: ReactNode }) {
  const board = screenByPath(usePathname())?.board;
  return (
    <Navbar position="static" aria-label="Main" shouldBlockScroll={false} className="border-b border-separator">
      <Navbar.Header className="max-w-[1240px] gap-[16px] px-[16px] sm:px-[32px]">
        <Navbar.MenuToggle className="md:hidden" />
        <Navbar.Brand>
          <NextLink href={screenHref("Main")} className="flex items-center gap-[10px] text-foreground no-underline">
            <BrandMark size={28} />
            <span className="text-[16px] font-[650] tracking-[-0.01em]">Injishi</span>
          </NextLink>
        </Navbar.Brand>
        <Navbar.Content className="ml-[12px] hidden gap-[2px] md:flex">
          {NAV.map((n) => (
            <Navbar.Item
              key={n.id}
              href={n.href}
              isCurrent={n.id === current}
              className={n.id === current ? "font-semibold" : undefined}
            >
              {n.label}
            </Navbar.Item>
          ))}
        </Navbar.Content>
        <Navbar.Spacer />
        {/* The page's sample-data mark sits in the header, as in the workspace top bar (the public layout's own note then hides). */}
        <span data-sample-mark="header" className="contents">
          <SampleDataPill board={board} />
        </span>
        {actions ? <div className="flex min-w-0 items-center gap-[8px]">{actions}</div> : null}
      </Navbar.Header>
      <Navbar.Menu>
        {NAV.map((n) => (
          <Navbar.MenuItem key={n.id} href={n.href} isCurrent={n.id === current}>
            {n.label}
          </Navbar.MenuItem>
        ))}
      </Navbar.Menu>
    </Navbar>
  );
}

/** "Sign in" for visitors, or the signed-in person's name linking to their workspace. */
export function SignInAction({ visitor, label = "Sign in" }: { visitor: PublicVisitor | null; label?: string }) {
  return visitor ? (
    <LinkButton href={visitor.home} variant="ghost" size="sm">
      <Person className="size-4" />
      {visitor.name}
    </LinkButton>
  ) : (
    <LinkButton href={screenHref("SignIn")} variant="ghost" size="sm">
      <ArrowRightToSquare className="size-4" />
      {label}
    </LinkButton>
  );
}

/** Page column of the public pages (artifact: .ij-web-main — 1240px wide, 32px gutters). */
export function PublicMain({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cx(
        "mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-[16px] pt-[20px] pb-[48px] *:min-w-0 sm:px-[32px] sm:pb-[72px]",
        className,
      )}
    >
      {children}
    </main>
  );
}

export interface FooterLink {
  label: string;
  /** Built with screenHref(). */
  href: string;
}

/** Footer of the public pages: copyright, links and the language line. */
export function PublicFooter({ links }: { links: FooterLink[] }) {
  return (
    <footer className="border-t border-separator">
      <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-[16px] px-[16px] py-[18px] text-[13px] text-muted sm:px-[32px]">
        <span>© 2026 Injishi</span>
        {links.map((l) => (
          <NextLink key={l.label} href={l.href} className="text-inherit no-underline hover:text-foreground">
            {l.label}
          </NextLink>
        ))}
        <span className="flex-1" />
        <span>English · Kinyarwanda</span>
      </div>
    </footer>
  );
}

/**
 * A stock photo with the artifact's placeholder caption printed on it (artifact: .ij-photo + caption span).
 * The caption sits on a soft chip so it stays legible on any photo.
 */
export function CaptionedPhoto({
  image,
  caption,
  captionAt = "bottom",
  className,
  sizes,
  priority,
}: {
  image: PhotoSource;
  caption: string;
  captionAt?: "top" | "bottom";
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <figure className={cx("relative m-0 overflow-hidden bg-surface-secondary", className)}>
      <Photo image={image} fill sizes={sizes} priority={priority} />
      <figcaption
        className={cx(
          "absolute left-[12px] max-w-[calc(100%-24px)]",
          captionAt === "top" ? "top-[12px]" : "bottom-[10px]",
        )}
      >
        <Chip size="sm" className="max-w-full bg-background/85 backdrop-blur-sm">
          <Chip.Label className="truncate">{caption}</Chip.Label>
        </Chip>
      </figcaption>
    </figure>
  );
}
