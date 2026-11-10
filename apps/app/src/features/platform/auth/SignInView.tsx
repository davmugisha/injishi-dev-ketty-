"use client";

import { CircleInfo } from "@gravity-ui/icons";
import { Button, Card, Chip, Disclosure, FieldError, Form, Input, Label, Separator, TextField } from "@heroui/react";
import { OPEN_ENTRIES, PERSONA_GROUPS, type Persona, screenHref } from "@injishi/data";
import { LinkButton, TextLink } from "@injishi/ui";
import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BrandPalm } from "@/components/brand";
import { LanguageSelect } from "@/components/language-select";
import { ThemeToggle } from "@/components/ThemeToggle";
import { type SignInState, signInAs, signInAsDemoEmail, startSignIn } from "@/lib/auth-actions";
import type { DemoRosterPerson } from "@/server/auth";
import { GoogleButton } from "./GoogleButton";
import { HeroCarousel } from "./HeroCarousel";
import { ForgotPasswordForm, PasswordSignInForm } from "./PasswordSignIn";

function PersonaCard({
  persona,
  next,
  highlighted,
  onUseEmail,
}: {
  persona: Persona;
  next: string;
  highlighted: boolean;
  onUseEmail: (email: string) => void;
}) {
  const t = useTranslations("platform.signIn");
  const [expanded, setExpanded] = useState(highlighted);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "center" });
  }, [highlighted]);
  return (
    <div ref={ref} data-persona={persona.id}>
      <Card
        variant={highlighted ? "default" : "transparent"}
        className={`gap-2 p-3.5 ring-1 ring-border ${highlighted ? "ring-2 ring-accent" : ""}`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold">{persona.name}</span>
          <span className="truncate text-xs text-muted">{persona.email}</span>
        </div>
        <span className="text-[15px] font-medium">{persona.headline}</span>
        <Disclosure isExpanded={expanded} onExpandedChange={setExpanded}>
          {expanded ? null : <p className="line-clamp-2 text-[13px] leading-[18px] text-muted">{persona.lands}</p>}
          <Disclosure.Content>
            <Disclosure.Body className="flex flex-col gap-2 pt-0">
              <p className="text-[13px] leading-[18px] text-muted">{persona.lands}</p>
              <p className="text-xs font-semibold tracking-wider text-muted uppercase">{t("whatToTry")}</p>
              <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px] leading-[18px]">
                {persona.tryItems.map((t) => (
                  <li key={t.board}>
                    <span className="font-medium">{t.label}</span> <span className="text-muted">— {t.note}</span>
                  </li>
                ))}
              </ol>
            </Disclosure.Body>
          </Disclosure.Content>
          <Disclosure.Heading>
            <Button
              slot="trigger"
              variant="ghost"
              size="sm"
              className="h-auto px-0 text-[13px] font-medium underline underline-offset-2"
            >
              {expanded ? t("lessRole") : t("moreRole")}
            </Button>
          </Disclosure.Heading>
        </Disclosure>
        <div className="flex flex-wrap items-center gap-2">
          <Chip size="sm" variant="secondary">
            {persona.role}
          </Chip>
          <span className="text-xs text-muted">{persona.org}</span>
          {persona.status.tone === "warning" ? (
            <Chip size="sm" color="warning" variant="soft">
              {persona.status.label}
            </Chip>
          ) : null}
        </div>
        <div className="flex items-center gap-3 pt-1">
          <form action={signInAs.bind(null, persona.id, next)} className="flex-1">
            <Button type="submit" fullWidth className="rounded-full">
              {t("signInAs", { name: persona.firstName })}
            </Button>
          </form>
          <Button
            variant="ghost"
            size="sm"
            className="text-[13px] underline underline-offset-2"
            onPress={() => onUseEmail(persona.email)}
          >
            {t("useEmail")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/**
 * Sign-in page cloned from the legacy Injishi demo (www-demo.injishi.com/sign-in): photo hero on the
 * left; email + one-time code on the right, with "Explore the demo" listing every artifact persona on the demo stack.
 */

/** "15 Oct, 03:00", in Kigali. */
function resetLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function SignInView({
  personas,
  roster = [],
  next,
  highlight,
  demo,
  google,
  notice,
}: {
  personas: Persona[];
  /** The API's demo roster (`GET /api/v1/demo/personas`) less those `personas` already lists. */
  roster?: DemoRosterPerson[];
  /** Where to go once signed in: a screen here, or a page on web (`return-to.ts`). */
  next: string;
  highlight: string | null;
  /** The demo's fixed code and last reset; null outside the demo, where the persona list is not drawn. */
  demo: { code: string; seededAt: string | null } | null;
  /** The API has Google credentials, so the button works; otherwise it says it is coming. */
  google: boolean;
  /** Why the person is back here, from `?error=` (Google did not finish, a persona's code was refused). */
  notice: string | null;
}) {
  const t = useTranslations("platform.signIn");
  const [state, formAction, pending] = useActionState<SignInState, FormData>(startSignIn, {});
  const [email, setEmail] = useState(state.email ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  // Email code by default; a password only for those who set one (tenants), offered to every address.
  const [mode, setMode] = useState<"code" | "password" | "forgot">("code");
  const [saved, setSaved] = useState<string | null>(null);
  const fillEmail = (value: string) => {
    setMode("code");
    setEmail(value);
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ block: "center" });
  };

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-1/2 shrink-0 p-2 lg:block" aria-label="About Injishi">
        <HeroCarousel />
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col items-center px-5 pt-14 pb-12 sm:px-8">
        <div className="absolute top-5 right-5 flex items-center gap-2">
          <LanguageSelect />
          <ThemeToggle />
        </div>
        <div className="flex w-full max-w-[400px] flex-col items-center gap-5">
          <BrandPalm size={44} className="h-11 w-auto" />
          <h1 className="text-center text-[32px] leading-10 font-medium tracking-[-0.02em]">{t("welcome")}</h1>

          {notice ? (
            <p role="alert" className="w-full text-center text-sm text-danger">
              {notice}
            </p>
          ) : null}

          <div className="flex w-full flex-col items-center gap-2">
            <span className="text-[13px] text-muted">{t("continueWith")}</span>
            {google ? (
              <GoogleButton next={next} />
            ) : (
              <>
                <Button variant="secondary" fullWidth isDisabled className="rounded-full">
                  <span aria-hidden="true" className="font-bold">
                    G
                  </span>
                  {t("continueGoogle")}
                </Button>
                <span className="text-xs text-muted">{t("googleSoon")}</span>
              </>
            )}
          </div>

          <div className="flex w-full items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted">{t("orEmail")}</span>
            <Separator className="flex-1" />
          </div>

          {mode === "password" ? (
            <PasswordSignInForm
              next={next}
              email={email}
              onEmailChange={setEmail}
              notice={saved}
              onForgot={() => {
                setSaved(null);
                setMode("forgot");
              }}
              onUseCode={() => {
                setSaved(null);
                setMode("code");
              }}
            />
          ) : mode === "forgot" ? (
            <ForgotPasswordForm
              email={email}
              onBack={() => setMode("password")}
              onDone={(address) => {
                setEmail(address);
                setSaved("Password saved. Sign in with it.");
                setMode("password");
              }}
            />
          ) : (
            <>
              <Form action={formAction} className="flex w-full flex-col gap-3" validationBehavior="aria">
                <input type="hidden" name="next" value={next} />
                <TextField
                  name="email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  isInvalid={!!state.error}
                  fullWidth
                  autoComplete="email"
                >
                  <Label className="sr-only">{t("email")}</Label>
                  <Input ref={inputRef} placeholder={t("email")} className="rounded-xl" />
                  {state.error ? <FieldError>{state.error}</FieldError> : null}
                </TextField>
                <Button type="submit" variant="secondary" fullWidth isPending={pending} className="rounded-full">
                  {t("continue")}
                </Button>
              </Form>
              <Button variant="ghost" size="sm" className="text-sm text-muted" onPress={() => setMode("password")}>
                {t("password")}
              </Button>
            </>
          )}

          {/* Only with someone to list: a demo database without its seeds has nobody to offer. */}
          {demo && (personas.length > 0 || roster.length > 0) ? (
            <Card className="w-full gap-3 p-4" aria-labelledby="demo-h">
              <div className="flex items-center justify-between gap-3">
                <h2 id="demo-h" className="text-[15px] font-semibold">
                  {t("exploreDemo")}
                </h2>
                <TextLink href={screenHref("Main")} className="text-[13px]">
                  {t("demoHow")}
                </TextLink>
              </div>
              <p className="flex gap-1.5 text-[13px] leading-[18px] text-muted">
                <CircleInfo className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {t("demoChoice", { code: "" }).replace(/\s+$/, "")}{" "}
                  <strong className="font-semibold text-foreground">{demo.code}</strong>.
                </span>
              </p>
              {demo.seededAt ? (
                <p className="text-xs text-muted">{t("demoReset", { date: resetLabel(demo.seededAt) })}</p>
              ) : null}

              {PERSONA_GROUPS.map((g) => {
                const people = personas.filter((p) => p.group === g.id);
                const open = OPEN_ENTRIES.filter((o) => o.group === g.id);
                return (
                  <section key={g.id} className="flex flex-col gap-2.5 pt-1" aria-label={g.title}>
                    <h3 className="pt-1 text-xs font-semibold tracking-wider text-muted uppercase">
                      {t(`groups.${g.id}`)}
                    </h3>
                    {people.map((p) => (
                      <PersonaCard
                        key={p.id}
                        persona={p}
                        next={next}
                        highlighted={highlight === p.id}
                        onUseEmail={fillEmail}
                      />
                    ))}
                    {open.map((o) => (
                      <Card key={o.id} variant="transparent" className="gap-2 p-3.5 ring-1 ring-border">
                        <span className="font-semibold">{o.title}</span>
                        <span className="text-[13px] font-medium">{o.tagline}</span>
                        <p className="text-[13px] leading-[18px] text-muted">{o.lands}</p>
                        <LinkButton href={screenHref(o.board)} variant="outline" fullWidth className="rounded-full">
                          {o.action}
                        </LinkButton>
                      </Card>
                    ))}
                  </section>
                );
              })}

              {roster.length ? (
                <section className="flex flex-col gap-2.5 pt-1" aria-label="More demo people">
                  <h3 className="pt-1 text-xs font-semibold tracking-wider text-muted uppercase">{t("morePeople")}</h3>
                  <p className="text-[13px] leading-[18px] text-muted">
                    The people the API&rsquo;s demo seeds create, the PSF District, Provincial and National Managers among them.
                  </p>
                  {roster.map((r) => (
                    <Card key={r.email} variant="transparent" className="gap-1.5 p-3.5 ring-1 ring-border">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold">{r.name}</span>
                        <span className="truncate text-xs text-muted">{r.email}</span>
                      </div>
                      {r.headline ? <span className="text-[14px] font-medium">{r.headline}</span> : null}
                      {r.roles.length ? <span className="text-xs text-muted">{r.roles.join(" · ")}</span> : null}
                      <div className="flex items-center gap-3 pt-1">
                        <form action={signInAsDemoEmail.bind(null, r.email, next)} className="flex-1">
                          <Button type="submit" fullWidth className="rounded-full">
                            {t("signInAs", { name: r.name.split(" ")[0] })}
                          </Button>
                        </form>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[13px] underline underline-offset-2"
                          onPress={() => fillEmail(r.email)}
                        >
                          {t("useEmail")}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </section>
              ) : null}
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  );
}
