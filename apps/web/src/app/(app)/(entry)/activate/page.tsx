"use client";

/**
 * /activate (F-B10), rebuilt on React state by ADR-017 slice 3.
 *
 * The markup came from a prototype capture and kept the capture's binding
 * points: `#code-form`, `#claim-code` and a `#code-error` paragraph rendered
 * with `hidden` for a script to unhide. No such script was ever written for
 * this route, so the error line could not appear, the claim buttons did
 * nothing at all, and the submit button reloaded the page with the code in the
 * query string. The state is React's now, so the error shows when it should
 * and the form stops navigating.
 *
 * WHAT IS DELIBERATELY NOT BUILT HERE. Claiming a stay needs an API that does
 * not exist — no endpoint binds a walk-in stay to a User. ADR-017 is a page
 * refactor and does not add one. The two claim actions therefore say so out
 * loud through the same `toast` affordance the QR button in this file already
 * used, rather than looking like they worked. The matched stay below is
 * fixture content for the same reason.
 */
import { useState } from "react";
import { Button, Input } from "@heroui/react";
import { Badge } from "@injishi/ui";
import BrandLogo from "@/components/app/brand-logo";
import ThemeToggleButton from "@/components/app/theme-toggle-button";
import { Icon } from "@/components/app/icon";
import { toast } from "@/components/app/toast";
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

  /** A claim code is printed on the check-in slip as four letters, a dash, four digits. */
  const CLAIM_CODE_RE = /^[A-Z]{4}-\d{4}$/;

  function bindByCode(e: React.FormEvent<HTMLFormElement>) {
    // Without this the form navigates and puts the code in the address bar.
    e.preventDefault();
    const code = claimCode.trim().toUpperCase();
    if (!CLAIM_CODE_RE.test(code)) {
      setCodeError("That code doesn't match a stay. Check the slip and try again.");
      return;
    }
    setCodeError(null);
    // Guest language, and no feature id. It said "Claiming by code is not wired
    // up yet (F-B10)" — a sentence about our backlog, handed to somebody who
    // just wants their stay. What they need to know is that nothing is lost.
    toast("Claiming a stay online isn't ready yet. Your stay is safe on record — the front desk can pull it up.");
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
              {"Activate your account"}
            </h1>
            <p className={"mt-2 text-sm text-muted-foreground"}>
              {signedInAs ? (
                <>
                  {"You're signed in as "}
                  <span className={"money font-semibold text-foreground"}>
                    {signedInAs}
                  </span>
                  {". We found a stay waiting to be claimed."}
                </>
              ) : (
                "We found a stay waiting to be claimed."
              )}
            </p>
            {/* Auto-matched stay */}
            <div className={"mt-6 rounded-card border border-border bg-card p-5 text-card-foreground"}>
              <div className={"flex items-start gap-3"}>
                <picture><source type={"image/avif"} srcSet={"/assets/stay-01.avif"} /><img src={"/assets/stay-01.jpg"} alt={""} className={"h-16 w-20 shrink-0 rounded-card object-cover"} /></picture>
                <div className={"min-w-0 grow"}>
                  <div className={"flex flex-wrap items-center gap-2"}>
                    <h2 className={"font-display text-lg font-bold"}>
                      {"Umurage Guesthouse"}
                    </h2>
                    <Badge variant="warning" size="sm">{"unclaimed"}</Badge>
                  </div>
                  <p className={"mt-0.5 text-xs text-card-foreground/70"}>
                    {"Walk-in stay"}
                    <span className={"money"}>
                      {"#S-1093"}
                    </span>
                    {"· Room 2"}
                  </p>
                  <p className={"money mt-1 text-xs text-card-foreground/70"}>
                    {"Jul 02 – 04 · matched on your email"}
                  </p>
                </div>
              </div>
              <Button variant="primary" fullWidth className="mt-4" onPress={() => toast("Claiming a stay online isn't ready yet. Your stay is safe on record — the front desk can pull it up.")}>
                <Icon name="badge-check" className="h-4 w-4" />
                {"Claim this stay"}
              </Button>
            </div>
            {/* Claim-code fallback */}
            <div className={"my-6 flex items-center gap-3 text-xs text-muted-foreground"} aria-hidden={"true"}>
              <span className={"h-px grow bg-border"}></span>
              {"or use a claim code"}
              <span className={"h-px grow bg-border"}></span>
            </div>
            <form noValidate onSubmit={bindByCode}>
              <label htmlFor={"claim-code"} className={"block text-sm font-semibold"}>
                {"Claim code"}
              </label>
              <p className={"mt-0.5 text-xs text-muted-foreground"}>
                {"Printed on your check-in slip, or scan the QR the front desk gave you."}
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
              <Button type="submit" variant="outline" fullWidth className="mt-4">
                {"Bind stay by code"}
              </Button>
            </form>
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
