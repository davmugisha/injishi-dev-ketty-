import type { Metadata } from "next";
import { Badge } from "@injishi/ui";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { SectionHeading } from "@/components/shared/section-heading";
import { TRAINING_COURSE, TRAINING_PASS_MARK } from "@/data/training";
import { CertificateScreen } from "./certificate-screen";

/**
 * `/training/certificate` — the last screen of the course.
 *
 * A Server Component with one client island, the same split every screen under
 * `/training` uses: the page furniture is a constant and renders on the server,
 * and only the parts that depend on `localStorage` — whether there is a
 * certificate at all, whose name is on it, which of the five refusals applies —
 * live in `certificate-screen.tsx`.
 *
 * NO `PageHero`, for the reason `/training/learn` writes down: a hero is for a
 * page somebody reads once while deciding whether to pay. This one is reached
 * by a person who has just been told they passed, and a `min-h-dvh` photograph
 * would put the certificate itself a full screen below the fold. `page-y` plus
 * `Breadcrumbs` is the pattern this app already uses for a working screen.
 *
 * THERE IS DELIBERATELY NO `layout.tsx` under `/training`, and this route may
 * not add one. `training/page.tsx` records the whole reason — seven generated
 * `.next…/types` directories feed one program and their `LayoutRoutes` unions
 * disagree the moment a new layout route appears, which breaks `pnpm typecheck`
 * across the entire app for a title template.
 *
 * The column is `max-w-page` rather than the full 1320px container. The
 * certificate is an A4 landscape sheet and the panels under it are full-width
 * blocks, and at the full column the sheet was wide enough that its display
 * type outgrew the page heading above it.
 */
export const metadata: Metadata = {
  title: "Your certificate",
  description: `The digital certificate for ${TRAINING_COURSE.title}: issued in your name with its own serial once every lesson is complete and the mark is ${TRAINING_PASS_MARK}% or better, delivered by e-mail to the address you enrolled with, and yours to print or download.`,
  // A certificate carries a person's name and a serial. Nothing about this
  // route belongs in a search index, and the page is worthless to anyone who
  // is not the holder — the demo state it renders lives in their browser.
  robots: { index: false, follow: false },
};

const MODULE = TRAINING_COURSE.modules[0];

export default function TrainingCertificatePage() {
  return (
    <div className="page-y">
      <div className="container">
        <div className="mx-auto flex max-w-page flex-col gap-8">
          <div className="flex flex-col gap-5 border-b border-border pb-8">
            <Breadcrumbs
              trail={[
                { label: "Home", href: "/" },
                { label: "Training", href: "/training" },
                { label: "Certificate" },
              ]}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">Delivered by e-mail</Badge>
              <Badge variant="outline">Print or download</Badge>
              <Badge variant="outline">Carries its own serial</Badge>
            </div>

            <SectionHeading as="h1" lead="Your " emphasis="certificate" />

            <p className="max-w-read text-page-fg-70">
              Finishing {MODULE.title} at {TRAINING_PASS_MARK}% or better issues
              a certificate in your name, with a serial of its own and the date
              it was awarded. It is delivered by e-mail to the address you gave
              when you enrolled, and the copy below is yours to print or
              download as well.
            </p>
          </div>

          <CertificateScreen />
        </div>
      </div>
    </div>
  );
}
