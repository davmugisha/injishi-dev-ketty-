"use client";

import { Fragment, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@injishi/web-ui";

import { iconFor } from "./kind-summary";
import { REGISTRATION_KINDS, type RegistrationKind } from "./registration-kinds";
import { Field, TextInput, TileCard } from "./wizard-ui";

/**
 * The kind chooser, at the top of Business when no kind arrived from `/host`
 * (ADR-075 S3): one question, "What kind of business?", and the groups `/host`
 * uses, Stay, Food and drink, Lease (AC-1). What is pressed decides the
 * heading, the documents asked for and the fee (`registrationForKind` derives
 * the role, the kind and the class; nothing else in the wizard decides them).
 *
 * "Other" asks what kind of place it is, here, where the question is, right
 * under the group its tile sits in; an officer reads it and picks the closest
 * RDB class. The chooser stays open on Other until that answer is given and
 * Next is pressed, because the answer belongs to the tile: closing on the press,
 * as every other tile does, hid the one field that could finish it. A broker is
 * not a tile: it keeps its own short registration and is outside this record.
 */

const GROUPS: ReadonlyArray<{ id: "stay" | "venue" | "lease" }> = [
  { id: "stay" },
  { id: "venue" },
  { id: "lease" },
];

/** The group the Other tile sits in, so its question is asked beside it. */
const OTHER_GROUP = REGISTRATION_KINDS.find((k) => k.value === "other")?.group ?? "stay";

export function StepType({
  kind,
  other,
  otherError,
  onChoose,
  onOtherChange,
  onOtherDone,
}: {
  kind: RegistrationKind | null;
  other: string;
  otherError?: string;
  onChoose: (kind: RegistrationKind) => void;
  onOtherChange: (next: string) => void;
  /** Other is described: close the chooser and go on to Business's sections. */
  onOtherDone: () => void;
}) {
  const t = useTranslations("register");
  const described = other.trim() !== "";
  // Other was just pressed: its question opens below the tiles, so the cursor goes to it.
  const lastKind = useRef(kind);
  useEffect(() => {
    if (kind === "other" && lastKind.current !== "other") document.getElementById("register-other")?.focus();
    lastKind.current = kind;
  }, [kind]);

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-base font-semibold">{t("kinds.question")}</h3>
      {GROUPS.map((group) => (
        <Fragment key={group.id}>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-sm font-semibold text-muted-foreground">{t(`kinds.groups.${group.id}`)}</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {REGISTRATION_KINDS.filter((k) => k.group === group.id).map((entry) => {
                const Icon = iconFor(entry.value);
                return (
                  <TileCard
                    key={entry.value}
                    name="registrationKind"
                    value={entry.value}
                    checked={kind === entry.value}
                    label={t(entry.labelKey)}
                    blurb={t(entry.blurbKey)}
                    icon={<Icon size={20} />}
                    onSelect={() => onChoose(entry.value)}
                  />
                );
              })}
            </div>
          </fieldset>

          {kind === "other" && group.id === OTHER_GROUP ? (
            <div className="flex max-w-form flex-col gap-3">
              <Field
                label={t("kinds.otherQuestion")}
                hint={t("kinds.otherHint")}
                error={otherError}
              >
                <TextInput
                  id="register-other"
                  className="w-full"
                  placeholder={t("kinds.otherPlaceholder")}
                  value={other}
                  onChange={(e) => onOtherChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && described) {
                      e.preventDefault();
                      onOtherDone();
                    }
                  }}
                />
              </Field>
              <div>
                <Button onClick={onOtherDone} disabled={!described}>
                  {t("kinds.next")}
                </Button>
              </div>
            </div>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
