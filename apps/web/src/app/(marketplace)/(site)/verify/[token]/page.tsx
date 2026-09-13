import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button } from "@injishi/ui";
import { TRAINING_CREDENTIAL_WORDING } from "@injishi/contracts";
import { verifyCertificate } from "@/data/training-api";
import { formatSessionDate } from "@/lib/training-format";

/**
 * `/verify/[token]` — the page a stranger reaches by scanning a certificate.
 *
 * THE WHOLE POINT OF THE FEATURE LANDS HERE. Somebody is holding a piece of
 * paper and wants to know whether to believe it. Everything about this page is
 * shaped by that one moment:
 *
 * PUBLIC, AND NO SESSION. Reachable with no cookie, from any phone, and
 * deliberately outside `PROTECTED_PREFIXES`. Asking the person checking a
 * credential to sign in first would make the credential uncheckable by exactly
 * the people it is meant to convince.
 *
 * THE ANSWER IS `status`, NEVER A MISSING FIELD. A valid token, a withdrawn one
 * and one that names nothing all come back as a successful API call carrying a
 * different `status`, because the endpoint answers 200 for all three so that it
 * cannot be used to confirm which guessed tokens are real. So this page renders
 * from `status` and treats a failed CALL as "we could not check right now",
 * which is a different sentence from "this is not genuine". Saying the second
 * when the first is true would be the worst bug this page could have.
 *
 * NO CACHING. `dynamic = "force-dynamic"` because a withdrawn certificate has
 * to read as withdrawn on the very next load (AC-16). The API caches the answer
 * for sixty seconds and purges that entry the moment a certificate is
 * withdrawn; a Next.js route cache in front of it would reintroduce exactly the
 * staleness the purge exists to remove.
 *
 * IT NAMES NO BUSINESS. The certificate records the holder's employer and never
 * shows it (AC-12). A stranger checking a credential needs to know the paper is
 * real, not where the person works.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Check a training certificate",
  description:
    "Confirm whether an Injishi training certificate is genuine, and whether it still stands.",
  // A verification result is about one named person. It is public so it can be
  // checked, and it should not accumulate in a search index.
  robots: { index: false, follow: false },
};

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await verifyCertificate(token);

  if (result.status !== "ok") {
    return (
      <Shell>
        <Badge variant="subtle">Could not check</Badge>
        <h1 className="mt-4 text-2xl font-semibold text-foreground md:text-display-sm">
          We could not check this certificate just now
        </h1>
        <p className="mt-3 max-w-read text-muted-foreground">
          This is a problem at our end, not a judgement about the certificate in
          your hand. Try the code again in a moment. If it keeps failing, the
          serial printed on the paper is enough for our support team to look it
          up.
        </p>
        <Actions />
      </Shell>
    );
  }

  const certificate = result.data;

  if (certificate.status === "unknown") {
    return (
      <Shell>
        <Badge variant="subtle">Not recognised</Badge>
        <h1 className="mt-4 text-2xl font-semibold text-foreground md:text-display-sm">
          {TRAINING_CREDENTIAL_WORDING.unknownClaim}
        </h1>
        <p className="mt-3 max-w-read text-muted-foreground">
          Nothing on our records matches this code. Check it was scanned or
          typed correctly, including the letters. If it still does not match,
          treat the document with caution and send us the serial printed on it.
        </p>
        <Actions />
      </Shell>
    );
  }

  const withdrawn = certificate.status === "revoked";

  return (
    <Shell>
      <Badge variant={withdrawn ? "danger" : "success"}>
        {withdrawn ? "Withdrawn" : "Genuine"}
      </Badge>

      <h1 className="mt-4 text-2xl font-semibold text-foreground md:text-display-sm">
        {certificate.holderName}
      </h1>

      <p className="mt-3 max-w-read text-muted-foreground">
        {withdrawn
          ? TRAINING_CREDENTIAL_WORDING.revokedClaim
          : TRAINING_CREDENTIAL_WORDING.verifiedClaim}
      </p>

      <dl className="mt-8 grid gap-5 rounded-card border border-border bg-card p-6 sm:grid-cols-2">
        <Fact label="Course">
          {certificate.courseTitle}
          {certificate.courseVersion === null ? null : (
            <span className="block text-sm text-muted-foreground">
              Version {certificate.courseVersion}
            </span>
          )}
        </Fact>
        {/*
          EVERY DESCRIPTIVE FIELD IS NULLABLE IN THE CONTRACT, and that is not
          slack typing: the endpoint answers one shape for valid, withdrawn and
          unknown alike so that it cannot confirm which guessed tokens are real,
          so the unknown answer needs a null for each of these. Narrowing on
          `status` above does not narrow them, and the right response is to
          render what is there rather than to assert a value the type does not
          promise. A certificate that somehow reached this branch missing a
          field renders one row short instead of crashing the page a stranger
          is reading.
        */}
        {certificate.sessionDate ? (
          <Fact label="Session date">
            {formatSessionDate(certificate.sessionDate)}
          </Fact>
        ) : null}
        <Fact label="Venue">
          {certificate.venueName}
          {certificate.districtName ? (
            <span className="block text-sm text-muted-foreground">
              {certificate.districtName}
            </span>
          ) : null}
        </Fact>
        <Fact label="Led by">{certificate.leadTrainerName}</Fact>
        <Fact label="Serial">
          <span className="font-mono text-sm">{certificate.serial}</span>
        </Fact>
        {certificate.issuedAt ? (
          <Fact label={withdrawn ? "Issued, then withdrawn" : "Issued"}>
            {formatSessionDate(certificate.issuedAt)}
            {withdrawn && certificate.revokedAt ? (
              <span className="block text-sm text-muted-foreground">
                Withdrawn {formatSessionDate(certificate.revokedAt)}
              </span>
            ) : null}
          </Fact>
        ) : null}
      </dl>

      {/*
        The honest limit of what this page proves, said out loud. A certificate
        records attendance at a live session and nothing more: no assessment
        took place, so the paper is not evidence of competence and this page
        must not let anybody read it as such (AC-31).
      */}
      <p className="mt-6 max-w-read text-sm text-muted-foreground">
        This records attendance at a live, in person session on the date above.
        No test was taken, so it is not a statement about how well the person
        named can do the work.
      </p>

      <Actions />
    </Shell>
  );
}

/**
 * The page frame.
 *
 * Narrow and centred, with nothing else on it. Somebody scanning a code on a
 * phone in a hotel lobby wants one answer, and a page that also advertises the
 * course buries it.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="container py-16 md:py-24">
      <div className="mx-auto max-w-wide">{children}</div>
    </section>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-foreground">{children}</dd>
    </div>
  );
}

function Actions() {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Button asChild>
        <Link href="/training">About Injishi training</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/support">Report a problem</Link>
      </Button>
    </div>
  );
}
