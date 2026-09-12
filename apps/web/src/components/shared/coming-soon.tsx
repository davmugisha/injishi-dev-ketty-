import Link from "next/link";
import { Button } from "@injishi/ui";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";

/**
 * A placeholder for routes the chrome links to but the prototype never
 * captured — sign-in, host onboarding, trips, and the legal pages.
 *
 * These exist so no navigation link 404s. Each is a real route with real
 * metadata, waiting on its own screen.
 */
export function ComingSoon({
  title,
  description,
  trail,
}: {
  title: string;
  description: string;
  trail: { label: string; href?: string }[];
}) {
  return (
    <div className="page-y">
      <div className="container flex min-h-[50vh] flex-col">
        <Breadcrumbs trail={trail} />
        <div className="flex flex-1 flex-col items-start justify-center gap-4 py-16">
          <h1 className="text-3xl text-page-fg lg:text-display-md">{title}</h1>
          <p className="max-w-narrow text-page-fg-70">{description}</p>
          <div className="mt-4 flex gap-3">
            <Button asChild>
              <Link href="/explore">Browse stays</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/support">Talk to support</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
