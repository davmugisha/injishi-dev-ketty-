"use client";

import { useState } from "react";
import { Input } from "@injishi/ui";
import {
  PHONE_COUNTRIES,
  countryForE164,
  type DialCountry,
} from "@/app/(app)/(entry)/register/phone-input";

/**
 * A phone number as two controls — the country it belongs to, and the number
 * inside that country — for the marketplace layer.
 *
 * THE COUNTRY REGISTER IS NOT REDECLARED HERE. `PHONE_COUNTRIES` and
 * `countryForE164` are imported from the registration wizard's `phone-input.tsx`,
 * which owns them: twelve dialling codes, Rwanda first, sorted longest-first so
 * `+1` cannot claim a `+1…` prefix off a longer code. A second copy of that
 * table in this tree is a table that disagrees with the wizard's the first time
 * a row is added to one of them.
 *
 * WHAT IS NOT REUSED IS THE CONTROL ITSELF, and the reason is mechanical rather
 * than stylistic. `apps/web` compiles two Tailwind entry sheets with
 * `source(none)`: `_injishi-app.css` scans `./(app)` and `_injishi-public.css`
 * scans `./(marketplace)`. A class that appears only inside `(app)` therefore
 * compiles to NOTHING on a marketplace page — silently, with no warning and no
 * error — so rendering the wizard's `PhoneInput` here would put an unstyled
 * `sm:w-60 sm:shrink-0` row on the screen and nothing would say why. Its
 * `SelectField` is HeroUI's listbox out of `wizard-ui.tsx`, which the
 * marketplace uses nowhere else; this file uses a native `<select>` styled from
 * the same tokens, the way `components/book/checkout-field.tsx` already does on
 * this side of the app.
 *
 * The composed value is E.164 either way, so the two forms store the same shape.
 */

/** Rwanda. The default, because this is a Rwandan course. */
const DEFAULT_COUNTRY: DialCountry = PHONE_COUNTRIES[0];

export function PhoneField({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  /** The composed E.164 number, or "" when nothing has been typed. */
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  /**
   * Which country is shown while the number is empty, and only then. Once
   * there is a number the number itself says which country it belongs to;
   * holding a second answer beside it is how a form comes to show `+254` above
   * a value of `+250788123456`.
   */
  const [pickedCode, setPickedCode] = useState<string>(DEFAULT_COUNTRY.code);

  const parsed = countryForE164(value);
  const country =
    parsed ??
    PHONE_COUNTRIES.find((entry) => entry.code === pickedCode) ??
    DEFAULT_COUNTRY;
  const national = parsed
    ? value.slice(parsed.dial.length)
    : nationalDigits(value);

  const emit = (dial: string, typed: string) => {
    const digits = nationalDigits(typed);
    // "" rather than a bare dialling code when the number is empty. `+250` on
    // its own carries no number, so the field would report "that is too short"
    // about a country code the person can see they did not type.
    onChange(digits === "" ? "" : `${dial}${digits}`);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="sm:w-56 sm:shrink-0">
        <select
          aria-label="Country dialling code"
          value={country.code}
          onChange={(event) => {
            const next =
              PHONE_COUNTRIES.find((entry) => entry.code === event.target.value) ??
              DEFAULT_COUNTRY;
            setPickedCode(next.code);
            // The national part is KEPT across the change. Somebody correcting
            // the country of a number they have already typed should not have
            // to type it again.
            emit(next.dial, national);
          }}
          className="h-10 w-full rounded border border-input bg-field px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus:border-ring focus:ring-2 focus:ring-ring/40"
        >
          {PHONE_COUNTRIES.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.dial} · {entry.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grow">
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-label={`Phone number in ${country.name}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          placeholder={country.example}
          maxLength={country.nationalDigits + 6}
          value={national}
          onChange={(event) => emit(country.dial, event.target.value)}
        />
      </div>
    </div>
  );
}

/**
 * The digits of a national number, with the trunk prefix dropped.
 *
 * `0788123456` and `788123456` are one number said two ways; E.164 has no room
 * for the leading zero and a person copying the number off their own handset
 * should not have to know that. Everything that is not a digit goes too, so a
 * number typed with the spaces it is printed with still works.
 */
function nationalDigits(typed: string): string {
  return typed.replace(/\D/g, "").replace(/^0+/, "");
}
