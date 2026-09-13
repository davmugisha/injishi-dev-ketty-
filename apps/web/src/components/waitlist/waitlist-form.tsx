"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Building2, Check, Luggage, Mail, User } from "lucide-react";
import {
  WAITLIST_PROPERTY_TYPE_LABEL,
  WAITLIST_SIZE_BAND_LABEL,
  WaitlistPropertyType,
  WaitlistSizeBand,
  isRwMobile,
  type WaitlistSignupInput,
} from "@injishi/contracts";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@injishi/ui";
import { cn } from "@injishi/utils";
import { fetchDistricts } from "@/data/geography";
import { joinWaitlist } from "@/data/waitlist";
import {
  WAITLIST_AUDIENCE_CHOICES,
  WAITLIST_FORM,
} from "@/data/waitlist-content";

/**
 * The waitlist form (ADR-048, AC-7, AC-8, AC-15), in the 2026-09-13 redesign.
 *
 * ONE STEP NOW, AND THE AUDIENCE IS A SWITCH ABOVE IT. The first build asked
 * "which are you?" on a screen of its own and showed the fields on a second.
 * The redesign asked for fewer words and a form that reads as one object, so
 * the choice became a two-segment switch that defaults to the traveller, and
 * the owner's extra fields open inside the same shell when it is flipped. The
 * split that mattered is kept: a traveller still never sees a form built for
 * somebody else, because the owner fields do not exist until asked for.
 *
 * THE OWNER BRANCH ASKS FOR MORE ON PURPOSE. District, property type and size
 * band are the three fields that tell you whether a district is launchable, so
 * this branch is a supply pipeline rather than a list of names. That is also
 * why they are all required, here AND in the database: `waitlist_owner_complete`
 * refuses a half-filled owner row for any caller, not only for this form.
 *
 * VALIDATION RUNS HERE AND AGAIN ON THE SERVER, and neither is redundant. This
 * one exists so somebody is told about a typo without waiting for a round trip;
 * the contract on the other side exists because this one runs in a browser and
 * a browser is not a boundary. The fields sit in a tight grid, so messages are
 * gathered under the shell rather than under each field, and each field still
 * carries `aria-invalid` and points at its own message.
 *
 * THE CONSENT LINE IS NOT DECORATION. Rwanda's Law 058/2021 expects a stated
 * purpose next to the thing that collects the data, a route to the privacy
 * notice, and any consent BEYOND that purpose to be separate, unticked and
 * never required. That is exactly the shape under the shell: one sentence, one
 * link, and one checkbox that nothing depends on.
 */

type Audience = "traveller" | "owner";
type FieldKey =
  | "fullName"
  | "email"
  | "phone"
  | "businessName"
  | "districtId"
  | "propertyType"
  | "sizeBand";
type Errors = Partial<Record<FieldKey, string>>;

type Outcome =
  | { kind: "idle" }
  | { kind: "joined"; email: string }
  | { kind: "already" };

interface DistrictOption {
  id: number;
  name: string;
}

/** The borderless field inside the shell. One height for inputs and selects. */
const FIELD =
  "h-13 rounded border-transparent bg-secondary text-base shadow-none";

export function WaitlistForm() {
  const [audience, setAudience] = useState<Audience>("traveller");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [sizeBand, setSizeBand] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const districts = useDistricts(audience === "owner");
  const errorId = useId();

  if (outcome.kind !== "idle") {
    return <WaitlistDone outcome={outcome} />;
  }

  const owner = audience === "owner";

  function validate(): Errors {
    const next: Errors = {};
    if (!fullName.trim()) next.fullName = WAITLIST_FORM.errors.name;
    // Deliberately a shape test and not an attempt to decide deliverability.
    // The server holds the real rule; this one only catches a typo early.
    if (!email.trim() || !email.includes("@")) {
      next.email = WAITLIST_FORM.errors.email;
    }
    if (owner) {
      if (!isRwMobile(phone)) next.phone = WAITLIST_FORM.errors.ownerPhone;
      const missing = WAITLIST_FORM.errors.requiredOwnerField;
      if (!businessName.trim()) next.businessName = missing;
      if (!districtId) next.districtId = missing;
      if (!propertyType) next.propertyType = missing;
      if (!sizeBand) next.sizeBand = missing;
    }
    return next;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setFormError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Built as the discriminated union the contract expects, so the owner
    // branch carries its five extra fields and the traveller branch carries
    // none of them. There is no shape here that the server would have to
    // decide the meaning of.
    const input: WaitlistSignupInput = owner
      ? {
          audience: "owner",
          email,
          fullName,
          phone,
          businessName,
          districtId: Number(districtId),
          propertyType: WaitlistPropertyType.parse(propertyType),
          sizeBand: WaitlistSizeBand.parse(sizeBand),
          marketingOptIn,
        }
      : {
          audience: "traveller",
          email,
          fullName,
          marketingOptIn,
        };

    setSubmitting(true);
    const result = await joinWaitlist(input);
    setSubmitting(false);

    switch (result.status) {
      case "joined":
        setOutcome({ kind: "joined", email });
        return;
      case "already-joined":
        setOutcome({ kind: "already" });
        return;
      case "throttled":
        setFormError(WAITLIST_FORM.errors.throttled);
        return;
      case "refused":
        setFormError(result.message);
        return;
      case "failed":
        setFormError(WAITLIST_FORM.errors.failed);
    }
  }

  // One line per distinct message: five empty owner fields say the same thing,
  // and saying it five times is noise, not help.
  const messages = [
    ...new Set(Object.values(errors).filter(Boolean) as string[]),
  ];
  if (formError) messages.push(formError);
  const invalid = (key: FieldKey) =>
    errors[key]
      ? { "aria-invalid": true as const, "aria-describedby": errorId }
      : {};

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <AudienceSwitch audience={audience} onChoose={setAudience} />

      <form onSubmit={submit} noValidate className="flex w-full flex-col gap-3">
        <div className="flex flex-col gap-1.5 rounded-card border border-border bg-card p-1.5 shadow-xl shadow-foreground/5">
          <div className="flex flex-col gap-1.5 sm:flex-row">
            <Field
              label={WAITLIST_FORM.fields.fullName.label}
              icon={<User className="size-4" />}
              className="sm:flex-1"
            >
              {(id) => (
                <Input
                  id={id}
                  size="lg"
                  value={fullName}
                  placeholder={WAITLIST_FORM.fields.fullName.label}
                  autoComplete="name"
                  onChange={(e) => setFullName(e.target.value)}
                  className={cn(FIELD, "pl-10")}
                  {...invalid("fullName")}
                />
              )}
            </Field>
            <Field
              label={WAITLIST_FORM.fields.email.label}
              icon={<Mail className="size-4" />}
              className="sm:flex-[1.25]"
            >
              {(id) => (
                <Input
                  id={id}
                  size="lg"
                  type="email"
                  value={email}
                  placeholder={WAITLIST_FORM.fields.email.label}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(FIELD, "pl-10")}
                  {...invalid("email")}
                />
              )}
            </Field>
            <Button
              type="submit"
              size="lg"
              shape="rounded"
              pending={submitting}
              className="h-13 w-full px-6 sm:w-auto"
            >
              {WAITLIST_FORM.submitLabel}
            </Button>
          </div>

          {owner ? (
            <div className="flex animate-in flex-col gap-1.5 border-t border-border pt-1.5 fade-in-0 slide-in-from-top-1 duration-settle ease-settle">
              <div className="grid gap-1.5 sm:grid-cols-2">
                <Field label={WAITLIST_FORM.fields.phone.label}>
                  {(id) => (
                    <Input
                      id={id}
                      size="lg"
                      type="tel"
                      value={phone}
                      placeholder={WAITLIST_FORM.fields.phone.label}
                      autoComplete="tel"
                      onChange={(e) => setPhone(e.target.value)}
                      className={cn(FIELD, "px-4")}
                      {...invalid("phone")}
                    />
                  )}
                </Field>
                <Field label={WAITLIST_FORM.fields.businessName.label}>
                  {(id) => (
                    <Input
                      id={id}
                      size="lg"
                      value={businessName}
                      placeholder={WAITLIST_FORM.fields.businessName.label}
                      autoComplete="organization"
                      onChange={(e) => setBusinessName(e.target.value)}
                      className={cn(FIELD, "px-4")}
                      {...invalid("businessName")}
                    />
                  )}
                </Field>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-3">
                <Choice
                  label={WAITLIST_FORM.fields.district.label}
                  value={districtId}
                  onChange={setDistrictId}
                  invalid={invalid("districtId")}
                  onOpen={districts.retry}
                  note={
                    districts.status === "failed"
                      ? WAITLIST_FORM.fields.district.failed
                      : districts.status === "ok"
                        ? undefined
                        : WAITLIST_FORM.fields.district.loading
                  }
                  options={districts.list.map((d) => ({
                    value: String(d.id),
                    label: d.name,
                  }))}
                />
                <Choice
                  label={WAITLIST_FORM.fields.propertyType.label}
                  value={propertyType}
                  onChange={setPropertyType}
                  invalid={invalid("propertyType")}
                  options={WaitlistPropertyType.options.map((value) => ({
                    value,
                    label: WAITLIST_PROPERTY_TYPE_LABEL[value],
                  }))}
                />
                <Choice
                  label={WAITLIST_FORM.fields.sizeBand.label}
                  value={sizeBand}
                  onChange={setSizeBand}
                  invalid={invalid("sizeBand")}
                  options={WaitlistSizeBand.options.map((value) => ({
                    value,
                    label: WAITLIST_SIZE_BAND_LABEL[value],
                  }))}
                />
              </div>
            </div>
          ) : null}
        </div>

        {messages.length > 0 ? (
          <div id={errorId} role="alert" className="flex flex-col gap-1 px-2">
            {messages.map((message) => (
              <p key={message} className="text-sm text-destructive">
                {message}
              </p>
            ))}
          </div>
        ) : null}

        <Consent
          marketingOptIn={marketingOptIn}
          onMarketingChange={setMarketingOptIn}
        />
      </form>
    </div>
  );
}

/**
 * The thirty districts, fetched when the owner branch opens.
 *
 * WHY THIS IS MORE THAN ONE FETCH. The first version asked once and, on any
 * failure, left the list empty for good: the dropdown opened on nothing and
 * said nothing, and an owner could not finish the form. A dropped connection
 * or an API restart is enough to cause that, and it was reproduced locally. So
 * it tries three times with a short backoff, says it is loading while it does,
 * says it could not when it gives up, and tries again when the list is opened.
 *
 * The result is kept at module scope: the list is reference data, and flipping
 * the switch back and forth should not ask again.
 */
let districtCache: DistrictOption[] | null = null;

function useDistricts(enabled: boolean) {
  const [list, setList] = useState<DistrictOption[]>(() => districtCache ?? []);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "failed">(
    () => (districtCache ? "ok" : "idle"),
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || districtCache) return;
    let live = true;
    setStatus("loading");
    void (async () => {
      for (let tries = 0; tries < 3; tries++) {
        const res = await fetchDistricts();
        if (!live) return;
        if (res.status === "ok") {
          districtCache = res.data.map((d) => ({ id: d.id, name: d.name }));
          setList(districtCache);
          setStatus("ok");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 600 * (tries + 1)));
        if (!live) return;
      }
      setStatus("failed");
    })();
    return () => {
      live = false;
    };
  }, [enabled, attempt]);

  return {
    list,
    status,
    retry: () => {
      if (status === "failed") setAttempt((n) => n + 1);
    },
  };
}

/**
 * The audience switch.
 *
 * Real radio inputs, visually hidden and styled through the label around each.
 * A hand-rolled `role="radio"` on a div would have to re-implement arrow-key
 * movement, roving tabindex and form association, and would get one of them
 * wrong. The native control brings all three and costs a `sr-only` class.
 */
function AudienceSwitch({
  audience,
  onChoose,
}: {
  audience: Audience;
  onChoose: (value: Audience) => void;
}) {
  const name = useId();
  const icons = { traveller: Luggage, owner: Building2 } as const;

  return (
    <fieldset className="rounded-full border border-border bg-secondary p-1">
      <legend className="sr-only">{WAITLIST_FORM.audienceLegend}</legend>
      <div className="grid grid-cols-2 gap-0.5">
        {WAITLIST_AUDIENCE_CHOICES.map((choice) => {
          const Icon = icons[choice.value];
          const on = audience === choice.value;
          return (
            <label
              key={choice.value}
              className={cn(
                "flex h-9 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-medium",
                "transition-colors duration-quick ease-settle",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                on
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name={name}
                value={choice.value}
                checked={on}
                onChange={() => onChoose(choice.value)}
                className="sr-only"
              />
              <Icon className="size-4" aria-hidden />
              {choice.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Field({
  label,
  icon,
  className,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  className?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();

  return (
    <div className={cn("relative", className)}>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      {icon ? (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
        >
          {icon}
        </span>
      ) : null}
      {children(id)}
    </div>
  );
}

function Choice({
  label,
  value,
  onChange,
  invalid,
  options,
  note,
  onOpen,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid: Record<string, unknown>;
  options: { value: string; label: string }[];
  /** Said inside the open list while it has nothing to offer yet. */
  note?: string;
  onOpen?: () => void;
}) {
  const id = useId();

  return (
    <div>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select
        value={value}
        onValueChange={onChange}
        onOpenChange={(open) => {
          if (open) onOpen?.();
        }}
      >
        <SelectTrigger
          id={id}
          onPointerDown={(e) => makeRoomBelow(e.currentTarget)}
          onKeyDown={(e) => {
            if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
              makeRoomBelow(e.currentTarget);
            }
          }}
          // Radix marks the trigger `data-placeholder` until a value is
          // chosen, so the empty select reads like the empty inputs beside it.
          className={cn(
            FIELD,
            "px-4 text-sm data-[placeholder]:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
          )}
          {...invalid}
        >
          <SelectValue placeholder={label} />
        </SelectTrigger>
        {/* The district list is thirty long. Left alone, Radix flipped it ABOVE
            the field whenever the space below was short, which on a laptop and
            on every phone meant it covered the name and phone fields. So the
            trigger makes room below itself before it opens (`makeRoomBelow`),
            and the list is capped at the space Radix reports, scrolling, at the
            field's own width. */}
        <SelectContent
          sideOffset={6}
          collisionPadding={16}
          className="max-h-[min(18rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] border border-border data-[side=top]:-translate-y-1"
        >
          {options.length === 0 && note ? (
            <p role="status" className="px-3 py-2.5 text-sm text-muted-foreground">
              {note}
            </p>
          ) : null}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Space a select list needs under its field to open downward: 18rem + gap. */
const LIST_ROOM_PX = 320;

/**
 * Scroll the page so an opening list has room to drop BELOW its field.
 *
 * It runs on the trigger's pointerdown and keydown, which fire before Radix
 * opens the list. It cannot run after: an open Select locks page scrolling, so
 * a programmatic scroll then would do nothing. It moves the page only when the
 * room is short, and never further than needed.
 */
function makeRoomBelow(field: HTMLElement) {
  const rect = field.getBoundingClientRect();
  const short = LIST_ROOM_PX - (window.innerHeight - rect.bottom);
  if (short > 0) window.scrollBy({ top: short, behavior: "instant" });
}

/**
 * The purpose, the privacy notice, and the one optional consent (AC-15).
 *
 * The checkbox is unticked by default and nothing on this form depends on it.
 * A "consent" that has to be given to proceed is not consent, and under Law
 * 058/2021 it is the difference between a lawful basis and a story about one.
 */
function Consent({
  marketingOptIn,
  onMarketingChange,
}: {
  marketingOptIn: boolean;
  onMarketingChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-x-5 gap-y-2 text-sm text-muted-foreground sm:flex-row sm:justify-center">
      <Checkbox
        isSelected={marketingOptIn}
        onChange={(selected: boolean) => onMarketingChange(selected)}
      >
        <span className="text-sm text-muted-foreground">
          {WAITLIST_FORM.marketingOptIn}
        </span>
      </Checkbox>
      <p className="text-center">
        {WAITLIST_FORM.consentLead}
        <Link href="/legal/privacy" className="underline underline-offset-2">
          {WAITLIST_FORM.consentLinkLabel}
        </Link>
        {WAITLIST_FORM.consentTrail}
      </p>
    </div>
  );
}

function WaitlistDone({
  outcome,
}: {
  outcome: Extract<Outcome, { kind: "joined" } | { kind: "already" }>;
}) {
  const joined = outcome.kind === "joined";
  const body = joined
    ? WAITLIST_FORM.done.joinedBody.replace("{email}", outcome.email)
    : WAITLIST_FORM.done.alreadyBody;

  return (
    <div className="flex w-full animate-in flex-col items-center gap-3 rounded-card border border-border bg-card px-6 py-10 text-center shadow-xl shadow-foreground/5 fade-in-0 zoom-in-95 duration-arrive ease-settle">
      {/* The confirmation renders immediately. It never waits on the welcome
          email, because that is queued rather than sent inline: a mail relay
          having a slow minute must not turn a stored signup into a spinner
          (AC-11). */}
      <span className="grid size-14 place-items-center rounded-full bg-accent/15 text-accent-text ring-8 ring-accent/5">
        <Check className="size-6" strokeWidth={2.5} aria-hidden />
      </span>
      <h2
        className="mt-2 text-display-sm text-card-foreground"
        role="status"
        aria-live="polite"
      >
        {joined
          ? WAITLIST_FORM.done.joinedHeading
          : WAITLIST_FORM.done.alreadyHeading}
      </h2>
      <p className="text-base text-muted-foreground">{body}</p>
    </div>
  );
}
