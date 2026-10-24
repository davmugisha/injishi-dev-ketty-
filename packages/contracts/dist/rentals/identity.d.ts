import { z } from "zod";
import { type IdKind } from "./vocab";
/**
 * The address as it was probably meant, or null when nothing looks wrong.
 *
 * `alice@demo.injishi.con` → `alice@demo.injishi.com`;
 * `aline@gmial.com` → `aline@gmail.com`; `aline@gmail.co` → `aline@gmail.com`.
 */
export declare function suggestEmailFix(email: string): string | null;
/** The sentence a form and the API both say about a likely typo. */
export declare function emailTypoMessage(suggestion: string): string;
/** An email address, trimmed and lower cased. The typo guard runs where `confirmEmail` is known. */
export declare const PersonEmail: z.ZodString;
export type PersonEmail = z.infer<typeof PersonEmail>;
/** Add the typo issue at `path` unless the person confirmed the address. */
export declare function checkEmailTypo(email: string | undefined, confirmed: boolean | undefined, ctx: z.RefinementCtx, path: (string | number)[]): void;
/** Spaces, dashes and dots out, letters upper case: how a document number is stored. */
export declare function normaliseIdNumber(value: string): string;
/**
 * Why a document number is not one, or null when it is. A Rwandan national ID
 * is 16 digits; a passport number is 5 to 20 letters and digits.
 */
export declare function idNumberProblem(kind: IdKind, value: string): string | null;
/** The document a number is read as when nobody said: an ID for a Rwandan, a passport otherwise. */
export declare function defaultIdKind(nationality: string): IdKind;
/** A person's full name as a form takes it. */
export declare const PersonName: z.ZodString;
export type PersonName = z.infer<typeof PersonName>;
/**
 * A name reduced to what a person means by it: accents, case and spacing
 * dropped. `  Aimée   UWERA ` and `Aimee Uwera` are the same name.
 */
export declare function comparableName(name: string): string;
/**
 * Does a typed signature match the name the contract states? Case, spacing
 * and accents may differ; anything else may not (`Aline U.` is not
 * `Aline Uwera`).
 */
export declare function sameName(typed: string, expected: string): boolean;
//# sourceMappingURL=identity.d.ts.map