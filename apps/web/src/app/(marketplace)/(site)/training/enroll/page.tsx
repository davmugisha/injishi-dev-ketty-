import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@injishi/web-ui";
import { TrainingSessionDetail } from "@injishi/contracts";
import { apiFetch } from "@/lib/api";
import { RegisterForm } from "./register-form";

/**
 * `/training/enroll?session=<id>` — register for one published session.
 *
 * A Server Component that reads the chosen session from the PUBLIC endpoint,
 * with the form as the one client island on it. The session's date, venue and
 * price are the same for everybody, so they are server-rendered and never
 * flicker; only the parts that depend on who is asking (their name, their
 * businesses, whether they are signed in at all) live in the island.
 *
 * THE SESSION IS READ SERVER SIDE FOR A SECOND REASON. The public endpoint
 * answers 404 for a draft, a cancelled session, a session of an unpublished
 * course and an id that names nothing, all alike. So this page cannot render a
 * registration form for something nobody may register for, and it does not have
 * to work out which of those four it was.
 *
 * `dynamic = "force-dynamic"` for the same reason `/training` is: a cached page
 * for a session that has since been cancelled sends somebody on a journey.
 *
 * No `layout.tsx` beside this file. `/training/page.tsx` records why in full:
 * a new layout route makes the generated `.next…/types` directories that
 * `tsconfig.json` feeds into one program disagree about the `LayoutRoutes`
 * union, and every layout in the app then fails to validate.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Register for a training session",
  description:
    "Register for an in person Injishi training session. Your name, phone and the business you work for.",
};

export default async function TrainingEnrolPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: sessionId } = await searchParams;

  if (!sessionId) return <PickADate />;

  const result = await apiFetch<unknown>(
    `/api/v1/training/sessions/${encodeURIComponent(sessionId)}`,
  );

  if (result.status !== "ok") return <PickADate unavailable />;

  const parsed = TrainingSessionDetail.safeParse(result.data);
  if (!parsed.success) return <PickADate unavailable />;

  return (
    <section className="container py-16 md:py-24">
      <h1 className="text-2xl font-bold text-foreground md:text-display-sm">
        Register for this session
      </h1>
      <p className="mt-3 max-w-read text-muted-foreground">
        Three questions, and a code sent to your e-mail if you are not signed
        in. Attending is what earns the certificate, so there is nothing to do
        here beyond putting your name down.
      </p>

      <div className="mt-10">
        <RegisterForm session={parsed.data} />
      </div>
    </section>
  );
}

/**
 * No session chosen, or the one chosen is not open.
 *
 * ONE SCREEN FOR BOTH, worded so neither reads as an accusation. A person who
 * followed a stale link from a WhatsApp message did nothing wrong, and telling
 * them their link is invalid is less useful than showing them the dates that
 * are open.
 */
function PickADate({ unavailable }: { unavailable?: boolean }) {
  return (
    <section className="container py-16 md:py-24">
      <h1 className="text-2xl font-bold text-foreground md:text-display-sm">
        {unavailable ? "That session is not open" : "Pick a date first"}
      </h1>
      <p className="mt-3 max-w-read text-muted-foreground">
        {unavailable
          ? "It may have been cancelled, or filled and closed. The dates that are open are all on the training page."
          : "Choose the session you want to attend and we will bring you back here."}
      </p>
      <Button asChild className="mt-6">
        <Link href="/training#dates">See the dates</Link>
      </Button>
    </section>
  );
}
