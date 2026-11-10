"use client";

import { Description, FieldError, Input, Label, TextField, toast } from "@heroui/react";
import type { GovernmentBody } from "@injishi/contracts";
import { EmailInput, SidePanel } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useStepUp } from "../step-up/step-up-dialog";
import { appointOfficer } from "./actions";
import { type AppointPrefill, knownWords, useKnownPerson, usePostFields } from "./post-fields";

export { type AppointPrefill, ROLE_CHOICES, roleLabel } from "./post-fields";

/** The person's own fields: everything else in the form belongs to the post. */
const PERSON_FIELDS = new Set(["email", "name", "reason"]);

/**
 * Appoint a person to a post (reordered 2026-11-09): the role and its area first, with the body and title
 * folded into one line that follows the role; then who, by email, greeted by name when they already have
 * an account (so their name is not asked again); then why. A confirmation names exactly what happens before
 * anything is written; the admin API holds it to `admin.user.role.grant` behind the step-up.
 */
export function AppointPanel({
  bodies,
  prefill,
  onClose,
}: {
  bodies: readonly GovernmentBody[];
  prefill: AppointPrefill | null;
  onClose: () => void;
}) {
  const t = useTranslations("admin.appointment");
  const tr = useTranslations("admin.roles");
  const router = useRouter();
  const post = usePostFields(bodies, prefill);
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Appointing gives authority, so the API may ask for a fresh code first (2026-11-02).
  const stepUp = useStepUp();
  const pending = stepUp.pending;
  // Who the email already belongs to, so a known person is greeted by name and not asked for it again.
  const known = useKnownPerson(email);
  const person = { email, name: known ? "" : name, reason };
  const who = known?.name ?? (name.trim() || email.trim() || "They");

  const clear = (field: string): void => setErrors((e) => (e[field] ? { ...e, [field]: "" } : e));
  const own = (all: Record<string, string>) =>
    Object.fromEntries(Object.entries(all).filter(([k]) => PERSON_FIELDS.has(k)));

  const appoint = () => {
    stepUp.guard(
      () => appointOfficer(post.request(person)),
      (result) => {
        if (!result.ok) {
          const fields = post.showServerErrors(result.fieldErrors ?? {});
          setErrors(own(fields));
          setFormError(Object.keys(fields).length > 0 ? null : result.error);
          return;
        }
        toast.success(
          t("appointmentSuccess", { person: result.value.name ?? result.value.email, role: tr(result.value.role) }),
        );
        onClose();
        router.refresh();
      },
    );
  };

  return (
    <>
      <SidePanel
        isOpen
        onOpenChange={(open) => (open ? undefined : onClose())}
        title={t("title")}
        submitLabel={t("appoint")}
        submitIcon="PersonPlus"
        isPending={pending}
        validationErrors={{ ...errors, ...post.errors }}
        formError={formError}
        onSubmit={(event) => {
          event.preventDefault();
          setFormError(null);
          const problems = post.check(person);
          setErrors(own(problems));
          if (Object.keys(problems).length === 0) appoint();
        }}
      >
        {post.fields}
        {post.role ? (
          <>
            <div className="mt-1 border-t border-separator pt-4 text-sm font-semibold">Who</div>
            <EmailInput
              label={t("email")}
              name="email"
              value={email}
              onChange={(v) => {
                setEmail(v);
                clear("email");
              }}
              isRequired
              errorMessage={errors.email || null}
              description={
                known ? knownWords(known) : "They sign in with this email. An account is made if they have none."
              }
            />
            {known ? null : (
              <TextField
                name="name"
                value={name}
                onChange={(v) => {
                  setName(v);
                  clear("name");
                }}
                isInvalid={errors.name ? true : undefined}
                fullWidth
                className="gap-1"
              >
                <Label>Full name</Label>
                <Input placeholder={t("nameHint")} />
                <Description>Optional. They can complete it when they first sign in.</Description>
                <FieldError>{errors.name}</FieldError>
              </TextField>
            )}
            <TextField
              name="reason"
              value={reason}
              onChange={(v) => {
                setReason(v);
                clear("reason");
              }}
              isInvalid={errors.reason ? true : undefined}
              fullWidth
              className="gap-1"
            >
              <Label>{t("why")}</Label>
              <Input placeholder="Took office in November 2026" />
              <FieldError>{errors.reason}</FieldError>
            </TextField>
            <p className="m-0 rounded-xl bg-default/60 px-3 py-2.5 text-sm text-muted">{post.sentence(who)}</p>
          </>
        ) : null}
      </SidePanel>
      {stepUp.dialog}
    </>
  );
}
