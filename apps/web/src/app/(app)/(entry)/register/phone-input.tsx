"use client";

import { useState } from "react";

import { SelectField, TextInput } from "./wizard-ui";

/**
 * A phone number as two controls: the country it belongs to, and the number
 * inside that country.
 *
 * It replaced one text box that asked for E.164 and explained itself with the
 * hint "Include the country code, like +250788123456". That hint is the whole
 * problem: nobody in Kigali writes their own number that way. They write
 * `0788 123 456`, which failed the field, and the failure said "include the
 * country code" to a person who had just typed the number off their own SIM
 * card. So the country code stops being something to remember and becomes
 * something to pick, and the number beside it is the one people actually know.
 *
 * The composed value is still E.164, because that is what `PersonalDetails`
 * validates and what the API stores. Nothing downstream changed; only the act
 * of typing did.
 */

export interface DialCountry {
  /** ISO 3166-1 alpha-2, and the option key — two countries may share a dial. */
  code: string;
  name: string;
  /** The E.164 country calling code, with its plus. */
  dial: string;
  /**
   * How many digits the national part usually has, used for the hint and the
   * input's soft length cap. A guide, never a rule: numbering plans change, and
   * refusing a real number because a table is a year stale is worse than
   * accepting one an officer will check anyway.
   */
  nationalDigits: number;
  /** A real number's shape in that country, shown as the placeholder. */
  example: string;
}

/**
 * The countries this form offers, Rwanda first.
 *
 * Not a world list, and that is deliberate: 240 rows in a dropdown is a list
 * nobody scrolls, and every row past the first ten is a row that makes finding
 * Rwanda harder. These are the countries a registrant on Injishi actually dials
 * from — Rwanda, the five neighbours it shares a border or a border post with,
 * the East African Community, and the four diaspora destinations that own most
 * of the Rwandan owners living abroad.
 */
export const PHONE_COUNTRIES: readonly DialCountry[] = [
  { code: "RW", name: "Rwanda", dial: "+250", nationalDigits: 9, example: "788 123 456" },
  { code: "KE", name: "Kenya", dial: "+254", nationalDigits: 9, example: "712 345 678" },
  { code: "UG", name: "Uganda", dial: "+256", nationalDigits: 9, example: "772 123 456" },
  { code: "TZ", name: "Tanzania", dial: "+255", nationalDigits: 9, example: "754 123 456" },
  { code: "BI", name: "Burundi", dial: "+257", nationalDigits: 8, example: "79 12 34 56" },
  { code: "CD", name: "DR Congo", dial: "+243", nationalDigits: 9, example: "812 345 678" },
  { code: "ET", name: "Ethiopia", dial: "+251", nationalDigits: 9, example: "911 234 567" },
  { code: "ZA", name: "South Africa", dial: "+27", nationalDigits: 9, example: "82 123 4567" },
  { code: "BE", name: "Belgium", dial: "+32", nationalDigits: 9, example: "470 12 34 56" },
  { code: "FR", name: "France", dial: "+33", nationalDigits: 9, example: "6 12 34 56 78" },
  { code: "GB", name: "United Kingdom", dial: "+44", nationalDigits: 10, example: "7700 900123" },
  { code: "US", name: "United States and Canada", dial: "+1", nationalDigits: 10, example: "202 555 0147" },
];

/** Rwanda. The default, because this is a Rwandan registration. */
const DEFAULT_COUNTRY: DialCountry = PHONE_COUNTRIES[0];

export function PhoneInput({
  value,
  onChange,
  id,
  invalid,
}: {
  /** The composed E.164 number, or "" when nothing has been typed. */
  value: string;
  onChange: (next: string) => void;
  id?: string;
  invalid?: boolean;
}) {
  /**
   * Which country is shown while the number is empty.
   *
   * Only ever consulted then. Once there is a number, the number itself says
   * which country it belongs to — holding a second answer beside it is how a
   * form comes to show `+254` above a value of `+250788123456`.
   */
  const [pickedCode, setPickedCode] = useState<string>(DEFAULT_COUNTRY.code);

  const parsed = countryForE164(value);
  const country =
    parsed ??
    PHONE_COUNTRIES.find((c) => c.code === pickedCode) ??
    DEFAULT_COUNTRY;
  const national = parsed
    ? value.slice(parsed.dial.length)
    : nationalDigits(value);

  const emit = (dial: string, typed: string) => {
    const digits = nationalDigits(typed);
    // "" rather than a bare dialling code when the number is empty. `+250` on
    // its own passes nothing and reads to the contract as a malformed number,
    // so the person would be told to include a country code they can see is
    // already there. An empty value gets the "required" message it deserves.
    onChange(digits === "" ? "" : `${dial}${digits}`);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="sm:w-60 sm:shrink-0">
        <SelectField
          value={country.code}
          options={PHONE_COUNTRIES.map((c) => ({
            value: c.code,
            label: `${c.dial} · ${c.name}`,
          }))}
          invalid={invalid}
          onChange={(code) => {
            const next =
              PHONE_COUNTRIES.find((c) => c.code === code) ?? DEFAULT_COUNTRY;
            setPickedCode(next.code);
            // The national part is KEPT across the change. Somebody correcting
            // the country of a number they already typed should not have to
            // type it again, and the digits after the dialling code are the
            // same digits whichever country they belong to.
            emit(next.dial, national);
          }}
        />
      </div>
      <div className="grow">
        <TextInput
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-label={`Phone number in ${country.name}`}
          placeholder={country.example}
          maxLength={country.nationalDigits + 6}
          value={national}
          onChange={(e) => emit(country.dial, e.target.value)}
        />
      </div>
    </div>
  );
}

/**
 * The country a composed number belongs to, or `null` when it has none yet.
 *
 * Longest dialling code first, so `+1` can never claim a `+1…` prefix off a
 * longer code that happens to start the same way. Nothing in the list above
 * collides today; sorting here means nothing has to be remembered when a row is
 * added later.
 */
export function countryForE164(value: string): DialCountry | null {
  if (!value.startsWith("+")) return null;
  const byLength = [...PHONE_COUNTRIES].sort(
    (a, b) => b.dial.length - a.dial.length,
  );
  return byLength.find((c) => value.startsWith(c.dial)) ?? null;
}

/**
 * The digits of a national number, with the trunk prefix dropped.
 *
 * `0788123456` and `788123456` are one number said two ways; E.164 has no room
 * for the leading zero, and a person copying it off their own phone should not
 * have to know that. Everything that is not a digit goes too, so a number typed
 * with the spaces it is printed with still works.
 */
function nationalDigits(typed: string): string {
  return typed.replace(/\D/g, "").replace(/^0+/, "");
}
