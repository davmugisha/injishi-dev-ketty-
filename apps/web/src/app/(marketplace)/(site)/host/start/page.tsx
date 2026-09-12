import type { Metadata } from "next";
import { businessTypeFor } from "@injishi/contracts";
import Link from "next/link";
import { Button } from "@injishi/ui";
import { withQuery } from "@injishi/utils";
import { HostKindIcons } from "@/components/icons/search";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { RegistrationStepRail } from "@/components/shared/registration-step-rail";
import { findHostKind, registrationForHostKind } from "@/data/host";
import { fetchRegistrationFee } from "@/data/registration";
import { formatRwf } from "@/lib/money";

export const metadata: Metadata = {
  title: "Start your listing",
  description:
    "Register your business, then list your accommodation. We take it from there.",
};

/**
 * Step one of the listing funnel — the join between `/host` and `/register`.
 *
 * The chooser on `/host` is the page's central move, and this route catches the
 * choice. It used to end here, saying the intake form was not open yet; that
 * sentence stopped being true when the registration wizard went live on the
 * real API, so the page now does the thing the route tree always said it did
 * (`ui-screens.md`: "host chooser → /register").
 *
 * It stays a page rather than becoming a redirect for one reason: a person who
 * pressed "Hotel" asked to list a hotel, not to register a company, and being
 * dropped into a three step business registration with no sentence in between
 * is how a funnel loses people. The page names the choice back, says why
 * registration comes first, and hands the choice on in the query.
 *
 * The `kind` is validated rather than trusted (`findHostKind`), so a typed
 * `?kind=castle` lands as if nothing was chosen instead of prefilling a class
 * the contract does not have.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const chosen = findHostKind(kind);
  const entry = chosen ? registrationForHostKind(chosen.value) : null;

  // The price, on the screen BEFORE the wizard rather than on its last step
  // (ADR-026, AC-3). A fee first shown after five screens of work is a fee
  // people find out about once they have already spent the effort, and the
  // quote route is public precisely so it can be asked here.
  const quote = entry
    ? await fetchRegistrationFee(businessTypeFor(entry.role))
    : null;
  const feeRwf = quote?.status === "ok" ? quote.data.amountRwf : null;

  // What the officer asks for differs by domain, and it is the one thing worth
  // saying before someone starts: a hospitality business is checked against its
  // TIN, a residence against its UPI (D24, and the `check` behind it).
  const documentNeeded =
    entry === null
      ? null
      : entry.role === "landlord"
        ? "the UPI of the property you let"
        : "your 9 digit RRA TIN";

  const Icon = chosen ? HostKindIcons[chosen.value] : null;

  return (
    <div className="page-y">
      <div className="container flex min-h-[50vh] flex-col">
        <Breadcrumbs
          trail={[
            { label: "Home", href: "/" },
            { label: "List your accommodation", href: "/host" },
            { label: chosen ? chosen.label : "Start your listing" },
          ]}
        />

        <div className="flex flex-1 flex-col items-start justify-center gap-5 py-16">
          {chosen && Icon ? (
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-page-fg">
                <Icon size={22} />
              </span>
              <p className="text-xs uppercase tracking-widest text-page-fg-70">
                {chosen.label}
              </p>
            </div>
          ) : null}

          <h1 className="text-3xl text-page-fg lg:text-display-md">
            {chosen ? (
              <>
                Let&apos;s get your{" "}
                <b className="font-bold">{chosen.label.toLowerCase()}</b> listed
              </>
            ) : (
              <>
                Let&apos;s get your place <b className="font-bold">listed</b>
              </>
            )}
          </h1>

          <p className="max-w-narrow text-page-fg-70">
            {chosen
              ? "A listing belongs to a registered business, so that is where we start. We carry your answer over, ask who you are and what you run, and take the registration to the district office for you."
              : "A listing belongs to a registered business, so that is where we start. Tell us who you are and what you run, and we take the registration to the district office for you."}
          </p>

          {documentNeeded ? (
            <p className="max-w-narrow text-sm text-page-fg-70">
              Have {documentNeeded} to hand. You can attach your certificates as
              you go, or leave them for the verification visit.
            </p>
          ) : null}

          {feeRwf !== null ? (
            <div className="flex items-center gap-3 rounded-card border border-border px-4 py-3">
              <span className="text-sm text-page-fg-70">
                One time registration fee
              </span>
              <b className="text-lg font-bold text-page-fg">
                {formatRwf(feeRwf)}
              </b>
              <span className="text-xs text-page-fg-70">
                paid at the last step
              </span>
            </div>
          ) : null}

          {/* The object the wizard continues with, shown here first — pressing
              the button below carries this exact rail into `/register` rather
              than opening what reads as a different page. */}
          <div className="mt-2 flex flex-col gap-2.5">
            <p className="text-xs uppercase tracking-widest text-page-fg-70">
              What happens next
            </p>
            <RegistrationStepRail active={null} />
          </div>

          <div className="flex items-center gap-3 border border-border bg-secondary p-3 rounded-card bg-surface-secondary">
            <ArtDirectedImage
              stem="injishi-rra-compliance"
              alt=""
              sizes="56px"
              width={960}
              height={640}
              className="aspect-square size-14 shrink-0 rounded-card object-cover"
            />
            <p className="text-sm text-page-fg-70">
              We check your registration with RRA ourselves, once you reach the
              payment step.
            </p>
          </div>

          <div className="mt-2 flex flex-wrap gap-3">
            <Button asChild>
              <Link
                href={
                  chosen
                    ? withQuery("/register", { kind: chosen.value })
                    : "/register"
                }
              >
                Register your business
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={chosen ? "/host" : "/host#host-chooser-title"}>
                {chosen ? "Back to listing" : "Pick your kind of place"}
              </Link>
            </Button>
          </div>

          <p className="text-sm text-page-fg-70">
            Not ready?{" "}
            <Link href="/support" className="underline">
              Talk to our team
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
