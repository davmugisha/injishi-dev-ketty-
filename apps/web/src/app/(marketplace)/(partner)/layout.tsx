import type { Metadata } from "next";

import { PsfFooter } from "@/components/psf/psf-footer";
import { PsfHeader } from "@/components/psf/psf-header";

import psf from "./psf-theme.module.css";

/**
 * The chrome of a partner's own pages (2026-10-23): today the Private Sector
 * Federation's /psf, /psf/register and /psf/track.
 *
 * A FIFTH GROUP UNDER `(marketplace)`, beside `(site)`, `(results)`,
 * `(checkout)` and `(gate)`, for the reason `(marketplace)/layout.tsx` writes
 * down: a group is named for the CHROME it puts on. These pages are PSF's,
 * not Injishi's, so they carry PSF's header and footer and none of the site's:
 * no Injishi wordmark, no Explore or Saved, no host call to action, no
 * assistant (`AssistantWidget` stays quiet under /psf).
 *
 * PSF Membership Hub (PMH) is the name of this partner product (renamed from
 * MemberDesk on 2026-11-02): the tab reads "Register for PSF | PSF Membership
 * Hub (PMH)" where the root layout would add "| Injishi", the footer names it
 * (with a small "Powered by Hangaa Softwares" under it), and a phone's "Add to Home Screen"
 * offers "PMH", the short name, since a longer one is cut under the icon.
 *
 * NO `icons` KEY, by the rule in `lib/pwa-metadata.ts`: an explicit `icons`
 * anywhere discards the App Router icon files. A PSF tab icon, when PSF sends a
 * square one, goes in as a file beside this layout (`icon.png`).
 */
export const metadata: Metadata = {
  title: {
    default: "PSF Membership Hub (PMH)",
    template: "%s | PSF Membership Hub (PMH)",
  },
  applicationName: "PSF Membership Hub (PMH)",
  appleWebApp: { capable: true, title: "PMH", statusBarStyle: "default" },
};

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    // PSF's green and orange replace the site's accent inside (psf-theme.module.css).
    <div className={`${psf.theme} flex min-h-screen flex-col`}>
      <PsfHeader />
      <main className="flex-1">{children}</main>
      <PsfFooter />
    </div>
  );
}
