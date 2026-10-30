import type { Metadata } from "next";
import { MyTraining } from "./my-training";

/**
 * `/training/certificate` — the holder's own training record (ADR-049 AC-19).
 *
 * GATED AT THE EDGE, not here. `apps/web/src/proxy.ts` carries
 * `/training/certificate` in `PROTECTED_PREFIXES`, so an anonymous request is
 * bounced to `/sign-in` with a return url before this file runs. The prefix is
 * this exact path and NOT `/training`, because that gate matches the path or
 * the path followed by a slash, and gating `/training` would lock the public
 * course listing behind a sign in. That is a ROUTING control and not the
 * boundary: the API refuses the read as well, which is what actually protects
 * it.
 *
 * The page is a thin shell around one client island, because the read needs the
 * session cookie and `credentials: "include"` only attaches one in a browser.
 *
 * `dynamic = "force-dynamic"` so nothing about one person's certificates is
 * ever served to another from a route cache.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My training",
  description:
    "The training sessions you registered for, and the certificates you hold.",
  robots: { index: false, follow: false },
};

export default function TrainingCertificatePage() {
  return (
    <section className="container py-16 md:py-24">
      <h1 className="text-2xl font-bold text-foreground md:text-display-sm">
        My training
      </h1>
      <p className="mt-3 max-w-read text-muted-foreground">
        Every session you registered for, and every certificate you hold. A
        certificate is issued when a trainer marks you present at a live
        session, and never any other way.
      </p>

      <div className="mt-10">
        <MyTraining />
      </div>
    </section>
  );
}
