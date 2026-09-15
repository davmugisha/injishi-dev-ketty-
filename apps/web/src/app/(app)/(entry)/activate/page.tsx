"use client";

/**
 * /activate (F-B10) — claiming a stay the front desk registered for you.
 *
 * ## What changed, and why the old page could not have worked
 *
 * ADR-017 rebuilt this screen on React state and said, in this comment block,
 * exactly what was missing: *"Claiming a stay needs an API that does not exist
 * — no endpoint binds a walk-in stay to a User."* So both claim buttons raised
 * a toast apologising to the guest, and the "matched stay" card underneath them
 * was a picture of a hotel nobody was staying at.
 *
 * §6.8 built that endpoint. `POST /api/v1/me/stays/claim` spends a claim code
 * and binds the stay, and this screen now does the thing it has always looked
 * like it did.
 *
 * ## The auto-matched card is gone, deliberately
 *
 * It showed a stay "matched on your email" with a Claim button. Nothing matches
 * stays by email and nothing should: an address is not a credential, and a
 * screen that offers you somebody's room number because you both use the same
 * mailbox provider is a screen that hands out room numbers. The code is the
 * proof, so the code is the whole form.
 *
 * ## The code arrives in the link
 *
 * The invitation mail links to `/activate?code=UMWE-7241`, so the field
 * prefills and the guest presses one button. It is read from
 * `window.location` in an effect rather than through `useSearchParams`, which
 * would force this route under a Suspense boundary for a value that is a
 * convenience: a guest who typed the address by hand gets an empty field and
 * the same form.
 */
import { useEffect, useState } from "react";
import { Button, Input } from "@heroui/react";
import { Badge } from "@injishi/ui";
import { CLAIM_CODE_PATTERN } from "@injishi/contracts";
import BrandLogo from "@/components/app/brand-logo";
import ThemeToggleButton from "@/components/app/theme-toggle-button";
import { Icon } from "@/components/app/icon";
import { toast } from "@/components/app/toast";
import { claimStay } from "@/data/my-stay";
import { apiResultMessage } from "@/lib/api";
import { useSessionUser } from "@/lib/session";

export default function Page() {
  // "You're signed in as ..." has to name the actual session. The capture put
  // rayan@example.rw here as a literal, so this screen asserted an identity that
  // was not the visitor's — on the one page whose whole job is binding a stay to
  // the right person.
  const { status, user } = useSessionUser();
  const signedInAs = status === "authenticated" ? (user?.email ?? "") : "";

  const [claimCode, setClaimCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The code from the invitation link. Uppercased on the way in, because the
  // field is uppercase and a guest who copied a lowercase link should not be
  // told their own code is malformed.
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get("code");
    if (fromLink) setClaimCode(fromLink.trim().toUpperCase());
  }, []);

  async function bindByCode(e: React.FormEvent<HTMLFormElement>) {
    // Without this the form navigates and puts the code in the address bar.
    e.preventDefault();
    const code = claimCode.trim().toUpperCase();
    if (!CLAIM_CODE_PATTERN.test(code)) {
      setCodeError("That code doesn't match a stay. Check the slip and try again.");
      return;
    }
    setCodeError(null);
    setBusy(true);

    const result = await claimStay(code);
    setBusy(false);

    if (result.status === "ok") {
      const where = result.data.stay.propertyName ?? "your stay";
      toast(`Claimed. ${where} is on your account now.`);
      // A full navigation rather than a router push: claiming changes what the
      // session owns, and every screen behind `/stay` reads that from the
      // server. Coming back with a fresh load is the honest version.
      window.location.assign("/stay");
      return;
    }

    // Every failure lands in the field, next to the thing the guest can change.
    // A refused claim is almost always a mistyped code, and a toast that
    // disappears is the wrong place for a message about a form.
    setCodeError(apiResultMessage(result));
  }

  return (
    <>
      <main className={"grid min-h-screen lg:grid-cols-[1.1fr_1fr]"}>
        {/* ============ Showcase panel ============ */}
        <section aria-label={"Claiming your stay"} className={"relative hidden overflow-hidden bg-ramp-1 text-ramp-6 lg:block"}>
          <picture><source type={"image/avif"} srcSet={"/assets/stay-06.avif"} />{/* eslint-disable-next-line @next/next/no-img-element */}<img src={"/assets/stay-06.jpg"} alt={""} className={"absolute inset-0 h-full w-full object-cover opacity-35"} /></picture>
          <div className={"absolute inset-0 bg-gradient-to-t from-ramp-1 via-ramp-1/60 to-ramp-1/30"}></div>
          <div className={"relative flex h-full flex-col justify-between p-12"}>
            <a href={"/"} aria-label={"Injishi — home"}>
              <img src={"/shared/img/injishi-extended-white.svg"} alt={"Injishi"} className={"h-8 w-auto"} />
            </a>
            <div className={"max-w-narrow"}>
              <Badge variant="glass">{"Record before account"}</Badge>
              <h2 className={"mt-4 font-display text-4xl font-bold leading-tight"}>
                {"Your stay exists — now make it yours."}
              </h2>
              <p className={"mt-3 text-ramp-6/75"}>
                {"Checked in at the desk without an account? The front desk already recorded your stay. Claiming binds it to your one Injishi identity — no duplicate account, ever."}
              </p>
            </div>
            <p className={"text-xs text-ramp-6/50"}>
              {"Claiming never blocks your check-in · one User per person"}
            </p>
          </div>
        </section>
        {/* ============ Activate panel ============ */}
        <section className={"flex items-center justify-center px-6 py-12"}>
          <div className={"w-full max-w-tile"}>
            <div className={"flex items-center justify-between"}>
              <BrandLogo variant="short" />
              <ThemeToggleButton />
            </div>
            <h1 className={"mt-6 font-display text-3xl font-bold tracking-tight"}>
              {"Claim your stay"}
            </h1>
            <p className={"mt-2 text-sm text-muted-foreground"}>
              {signedInAs ? (
                <>
                  {"You're signed in as "}
                  <span className={"money font-semibold text-foreground"}>
                    {signedInAs}
                  </span>
                  {". Enter the code from your check-in slip or email."}
                </>
              ) : (
                "Enter the code from your check-in slip or email."
              )}
            </p>

            <form noValidate onSubmit={bindByCode} className={"mt-6"}>
              <label htmlFor={"claim-code"} className={"block text-sm font-semibold"}>
                {"Claim code"}
              </label>
              <p className={"mt-0.5 text-xs text-muted-foreground"}>
                {"Four letters, a dash and four digits — printed on your slip and in the email the front desk sent you."}
              </p>
              <div className={"mt-2 flex gap-2"}>
                <Input
                  id={"claim-code"}
                  className={"money w-full uppercase"}
                  placeholder={"UMWE-7241"}
                  autoComplete={"off"}
                  value={claimCode}
                  onChange={(e) => { setClaimCode(e.target.value); setCodeError(null); }}
                  aria-invalid={codeError ? true : undefined}
                  aria-describedby={codeError ? "code-error" : undefined}
                />
                {/* Was "QR scanner — opens the camera in apps/web": a developer
                    note in a guest's hand, naming a directory in our repo. */}
                <Button variant="outline" isIconOnly className="shrink-0" aria-label={"Scan QR code"} onPress={() => toast("Scanning isn't ready yet — type the code from your slip instead.")}>
                  <Icon name="qr-code" className="h-5 w-5" />
                </Button>
              </div>
              {codeError ? (
                <p id={"code-error"} className={"mt-1.5 text-xs font-semibold text-destructive"} role={"alert"}>
                  {codeError}
                </p>
              ) : null}
              <Button type="submit" variant="primary" fullWidth className="mt-4" isDisabled={busy}>
                {busy ? "Claiming…" : "Claim this stay"}
              </Button>
            </form>

            <div className={"mt-6 rounded-card border border-border bg-card p-5 text-card-foreground"}>
              <h2 className={"font-display text-sm font-bold"}>
                {"What claiming gets you"}
              </h2>
              <ul className={"mt-2 space-y-1.5 text-xs text-card-foreground/75"}>
                <li>{"Message the front desk, housekeeping or any other desk in the building"}</li>
                <li>{"Order food and drink to your room"}</li>
                <li>{"See what is on your bill as it happens"}</li>
                <li>{"Raise a problem, or ask for money back, and get an answer in writing"}</li>
              </ul>
            </div>

            <p className={"mt-6 text-xs text-muted-foreground"}>
              <Icon name="info" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
              {/* `/personal-trips` has not existed since ADR-018 move 4 renamed
                  the Personal routes to plain paths. It 404'd.

                  It then went to `/trips`, which exists and is the wrong room:
                  that screen always reads "No trips yet", because no endpoint
                  serves a guest their own bookings. ADR-044 D-a sends this one
                  to `/account`, which has something to show somebody who has
                  just proved who they are. Settled by the engineer on
                  2026-09-11, when two sessions disagreed about this row. */}
              {"No stay to claim? "}
              <a href={"/account"} className={"font-semibold text-accent-text underline"}>
                {"Skip to your account"}
              </a>
              {"."}
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
