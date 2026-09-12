import { Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/**
 * Checkout chrome: a single quiet bar, no navigation, no footer. Nothing here
 * should invite the guest to wander off mid-payment.
 */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      {/*
        `border-border`, not `border-surface-tint`. `--surface-tint` is in the
        FIXED group — one pale value in both themes — so under a `bg-card`
        header that is near-black in dark theme it drew a 15.4:1 line: a bright
        rule across the top of the checkout, in a vocabulary nothing else on the
        screen uses. `--border` is the decorative-hairline role and follows the
        theme (1.33:1 light, 1.21:1 dark), which is what a rule under a bar is.
        This is the same class of bug the note below records for the background
        of this very element, caught one property over.
      */}
      <header className="flex items-center justify-between border-b border-border bg-card px-5 py-[18px]">
        <Link href="/" aria-label="Injishi home">
          {/*
            `--ink-900` is the app-shell ramp; this route's public layer
            never defines it, so `dark:bg-ink-900` on the header above used to
            compile to nothing and the bar stayed white in both themes.
            `bg-card` is the role this layer actually has, and already flips
            per theme — the same fix `site-header.tsx` already applies to
            this exact wordmark with `dark:brightness-0 dark:invert`.
          */}
          <Image
            src="/assets/logo-dark.svg"
            alt="Injishi"
            width={110}
            height={26}
            className="dark:brightness-0 dark:invert"
          />
        </Link>
        <span className="flex items-center gap-2 text-sm text-page-fg-70">
          <LockIcon />
          Secure booking
        </span>
      </header>
      <main>{children}</main>
    </div>
  );
}

function LockIcon() {
  return (
    <Lock width={16} height={16} strokeWidth={1.7} aria-hidden />
  );
}
