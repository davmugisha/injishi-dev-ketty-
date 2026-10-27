"use client";

/* Joining a business as staff (2026-09-13).
 *
 * The owner invited an email address into a role from People · Invites; the
 * mail links here. The preview names the business and the role, and accepting
 * writes the membership — only for the account signed in with the invited
 * address, which the API checks, not this page.
 *
 * THE TOKEN IS HANDLED ONCE, exactly as on `/claim-org`: copied into a ref on
 * load and lifted out of the address bar, and the route is served with
 * `Referrer-Policy: no-referrer` (next.config.ts). */
import {
  ORG_ROLE_LABEL,
  type AcceptedStaffInvitation,
  type StaffInvitationPreview,
} from "@injishi/contracts";
import { Button } from "@heroui/react";
import { Button as UiButton } from "@injishi/web-ui";
import { useEffect, useRef, useState } from "react";

import BrandLogo from "@/components/app/brand-logo";
import ThemeToggleButton from "@/components/app/theme-toggle-button";
import { Icon } from "@/components/app/icon";
import { acceptStaffInvitation, previewStaffInvitation } from "@/data/staff-invitation";
import { apiResultMessage } from "@/lib/api";

type View =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "failed"; message: string }
  | { kind: "ready"; preview: StaffInvitationPreview }
  | { kind: "joined"; preview: StaffInvitationPreview; accepted: AcceptedStaffInvitation };

export default function Page() {
  const link = useRef<{ orgId: string; token: string } | null | undefined>(undefined);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (link.current === undefined) {
      const params = new URLSearchParams(window.location.search);
      const orgId = params.get("org");
      const token = params.get("token");
      link.current = orgId && token ? { orgId, token } : null;
      if (params.has("token") || params.has("org")) {
        window.history.replaceState(window.history.state, "", "/join-team");
      }
    }
    const captured = link.current;
    if (captured === null) {
      setView({ kind: "invalid" });
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await previewStaffInvitation(captured.orgId, captured.token);
      if (cancelled) return;
      if (res.status === "ok") setView({ kind: "ready", preview: res.data });
      else if (res.status === "refused" && res.httpStatus === 404) setView({ kind: "invalid" });
      else setView({ kind: "failed", message: apiResultMessage(res) });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const accept = async () => {
    const captured = link.current;
    if (view.kind !== "ready" || !captured || busy) return;
    setBusy(true);
    setError("");
    const res = await acceptStaffInvitation(captured.orgId, captured.token);
    setBusy(false);
    if (res.status === "ok") {
      setView({ kind: "joined", preview: view.preview, accepted: res.data });
      return;
    }
    setError(apiResultMessage(res));
  };

  return (
    <>
      <header className={"border-b border-border"}>
        <div className={"mx-auto flex h-16 max-w-read items-center gap-4 px-4 sm:px-6"}>
          <BrandLogo variant="extended" />
          <span className={"grow"}></span>
          <ThemeToggleButton />
        </div>
      </header>
      <main className={"mx-auto max-w-read px-4 py-10 sm:px-6"} data-cy="join-team">
        {view.kind === "loading" ? (
          <p role="status" className={"text-sm text-muted-foreground"}>
            {"Reading your invitation…"}
          </p>
        ) : null}

        {view.kind === "invalid" ? (
          <>
            <h1 className={"font-display text-3xl font-bold tracking-tight"}>{"This invitation is not valid"}</h1>
            <p className={"mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground"}>
              {"An invitation works once and expires after 7 days, and the owner can withdraw it. Ask whoever invited you to send a new one."}
            </p>
            <div className={"mt-6"}>
              <UiButton asChild variant="outline">
                <a href={"/start"}>{"Go to your account"}</a>
              </UiButton>
            </div>
          </>
        ) : null}

        {view.kind === "failed" ? (
          <>
            <h1 className={"font-display text-3xl font-bold tracking-tight"}>{"We couldn't open this invitation"}</h1>
            <p role="alert" className={"mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground"}>
              {view.message}
            </p>
          </>
        ) : null}

        {view.kind === "ready" || view.kind === "joined" ? (
          <>
            <h1 className={"font-display text-3xl font-bold tracking-tight"}>
              {view.kind === "joined" ? `You joined ${view.preview.legalName}` : `Join ${view.preview.legalName}`}
            </h1>
            <p className={"mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground"}>
              {view.kind === "joined"
                ? "Your role decides what you can see and do. Open the workspace to start."
                : "You were invited to work at this business on Injishi."}
            </p>

            <dl className={"mt-6 grid gap-3 rounded-card border border-border bg-card p-6 text-card-foreground sm:grid-cols-2"}>
              <div>
                <dt className={"text-xs font-bold uppercase tracking-wider text-card-foreground/60"}>{"Role"}</dt>
                <dd className={"mt-0.5 text-sm font-semibold"} data-cy="join-team-role">
                  {ORG_ROLE_LABEL[view.preview.orgRole]}
                </dd>
              </div>
              <div>
                <dt className={"text-xs font-bold uppercase tracking-wider text-card-foreground/60"}>{"Invited address"}</dt>
                <dd className={"mt-0.5 text-sm font-semibold"}>{view.preview.email}</dd>
              </div>
            </dl>

            {error ? (
              <p role="alert" className={"mt-4 rounded-card border border-border bg-field p-3 text-sm leading-relaxed text-destructive"}>
                {error}
              </p>
            ) : null}

            <div className={"mt-6 flex flex-col gap-3 sm:flex-row-reverse"}>
              {view.kind === "joined" ? (
                <UiButton asChild variant="primary" className="grow">
                  <a href={`/w/${view.accepted.workspaceId}`}>
                    {"Open the workspace"}
                    <Icon name="arrow-right" className="h-4 w-4" />
                  </a>
                </UiButton>
              ) : (
                <Button variant="primary" isDisabled={busy} isPending={busy} onPress={() => void accept()} className="grow">
                  {busy ? "Joining…" : "Accept the invitation"}
                </Button>
              )}
            </div>
            {view.kind === "ready" ? (
              <p className={"mt-3 text-xs text-muted-foreground"}>
                {`Only the account signed in as ${view.preview.email} can accept.`}
              </p>
            ) : null}
          </>
        ) : null}
      </main>
    </>
  );
}
