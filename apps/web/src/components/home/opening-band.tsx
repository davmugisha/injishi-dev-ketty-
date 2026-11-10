import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ImigongoBackground } from "@/components/home/illustrations";
import { supportHref } from "@/lib/support-intent";

/**
 * The band the home page shows while nothing is listed yet.
 *
 * Production opened with an empty catalogue, and the home page offered no stay
 * anywhere. This says what is true instead: places are being verified, here is
 * how, and here is what each reader can do about it today. It goes the moment
 * one property is public, with no flag to remember.
 *
 * Product-true copy only. The verification steps are the registration
 * pipeline's own (RRA TIN check, then an online document review, D20), and
 * nothing here promises a date.
 */
export async function OpeningBand() {
  const t = await getTranslations("home");

  return (
    <section className="section-y container">
      <div className="relative isolate flex flex-col gap-6 overflow-hidden rounded-card bg-card px-6 py-10 text-foreground ring-1 ring-border md:px-10 lg:flex-row lg:items-center lg:justify-between">
        <ImigongoBackground id="opening-imigongo" className="-z-10 text-accent opacity-[0.08]" />
        <div className="flex max-w-wide flex-col gap-2">
          <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-accent-text">
            {t("opening.eyebrow")}
          </p>
          <h2 className="text-2xl font-bold leading-tight lg:text-3xl">
            {t("opening.title")}
          </h2>
          <p className="text-sm text-muted-foreground lg:text-base">
            {t("opening.body")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
          <Link
            href="/host"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-opacity duration-quick hover:opacity-90"
          >
            {t("opening.listPlace")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href={supportHref("opening")}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-surface-secondary px-6 py-3 text-sm font-semibold text-foreground ring-1 ring-border transition-colors duration-quick hover:bg-card"
          >
            {t("opening.tellMe")}
          </Link>
        </div>
      </div>
    </section>
  );
}
