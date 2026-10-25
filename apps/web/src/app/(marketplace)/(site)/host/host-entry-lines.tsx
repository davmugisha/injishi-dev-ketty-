import Link from "next/link";
import { Button } from "@injishi/ui";
import { SectionHeading } from "@/components/shared/section-heading";

/**
 * The closing registration entry on `/host` points back to the chooser. A tile
 * press goes straight to `/register` with the kind, which opens on You.
 */

/** Where the chooser's heading sits, for the doors that send people to it. */
export const CHOOSER_ANCHOR = "#host-chooser-title";

/**
 * The closing card. Its button used to open `/register` with no kind, so the
 * kind was asked a second time below the chooser the person had just scrolled
 * past. It takes them back up to the chooser instead, where one press answers
 * it. Same composition as the card it replaces: a centred terminal panel on a
 * tonal band, separated by tone and a hairline rather than a shadow.
 */
export function HostClosing() {
  return (
    <section className="section-y-loose w-full bg-secondary">
      <div className="container">
        <div className="mx-auto flex max-w-wide flex-col items-center gap-6 rounded-card border border-border bg-background px-6 py-12 text-center lg:px-16 lg:py-16">
          <SectionHeading
            lead="List your "
            emphasis="accommodation"
            className="justify-center"
            headingClassName="text-center"
          />
          <p className="max-w-narrow text-page-fg-70">
            About ten minutes to register: have your ID and your RRA TIN (or the UPI of a home you
            let) to hand, and leave the certificates for the visit if you need to. We check it,
            photograph it at our cost, and get it live before your first guest arrives.
          </p>
          <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
            <Button asChild size="lg" variant="primary">
              <a href={CHOOSER_ANCHOR}>Choose what you are listing</a>
            </Button>
            <Button asChild variant="link" size="md">
              <Link href="/sign-in">Already hosting with us? Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
