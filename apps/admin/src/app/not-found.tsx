import { Button } from "@injishi/ui";
import Link from "next/link";

/**
 * An address in the console that leads nowhere.
 *
 * Two ways here, and the copy has to serve both: a mistyped or stale url, and a
 * `notFound()` from a page whose record does not exist. Neither is a refusal and
 * neither is a platform failure, so this says plainly that the thing is not
 * there and points at the one place every section can be reached from.
 *
 * It renders inside the console chrome, because `app/layout.tsx` wraps every
 * route — so the sidebar is still there to leave by, and it is still behind the
 * staff gate.
 */
export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <section className="animate-arrive rounded-card border border-dashed border-border bg-field p-6 sm:p-7">
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          This console
        </p>
        <h1 className="mt-3 font-display text-2xl font-bold">
          That record isn&apos;t here
        </h1>
        <p className="mt-3 max-w-read text-sm leading-6 text-muted-foreground">
          Nothing answers to this address. Check it, or the record may have been
          removed since the link was made. Every section is one click away from
          the overview.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/overview">Back to the overview</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
