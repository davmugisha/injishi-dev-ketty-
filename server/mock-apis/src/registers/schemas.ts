import { z } from 'zod';

/**
 * The four registers the mock providers answer from, as seed rows.
 *
 * One schema per register, used three ways: to read `seed/*.json` at boot, to
 * check a row added through the console (`POST /__mock/registers/:register`),
 * and as the documentation of what a row may say. A `scenario` is how a seed
 * row asks for a provider's unhappy path; each register lists its own.
 *
 * Every person, number and business here is fictional. The registers agree
 * with each other on purpose: a citizen's National ID is what makes them a
 * director of a taxpayer, a passport holder can direct a company too, and a
 * wallet's holder is a citizen. That agreement is the owner-or-on-behalf
 * demonstration.
 */

const Iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'a date as YYYY-MM-DD');
const Msisdn = z.string().regex(/^\+250\d{9}$/, 'a Rwandan number in E.164, +250 then nine digits');

/** A National ID as NIDA prints it: sixteen digits. */
export const NationalIdNumber = z.string().regex(/^\d{16}$/, 'sixteen digits');

/** A person in NIDA's population register, reached through GTBank's NIDA gateway. */
export const Citizen = z.object({
  nationalId: NationalIdNumber,
  foreNames: z.string().min(1),
  surname: z.string().min(1),
  dateOfBirth: Iso,
  sex: z.enum(['M', 'F']),
  /**
   * - `valid`: found, and the selfie matches (unless it plainly belongs to someone else).
   * - `revoked`: the card was cancelled; found, but refused.
   * - `face_mismatch`: found, and any selfie fails the face match.
   * - `face_not_checked`: found, and the gateway does not compare the face (the
   *   answer a gateway without biometrics gives), so a person checks the selfie.
   */
  scenario: z.enum(['valid', 'revoked', 'face_mismatch', 'face_not_checked']).default('valid'),
  note: z.string().optional(),
});
export type Citizen = z.infer<typeof Citizen>;

/** A taxpayer in RRA's register, keyed by TIN. */
export const Taxpayer = z.object({
  tin: z.string().regex(/^\d{9}$/, 'nine digits'),
  taxpayerName: z.string().min(1),
  tradingName: z.string().min(1).nullable().default(null),
  legalForm: z.enum([
    'PRIVATE_LIMITED',
    'PUBLIC_LIMITED',
    'SOLE_PROPRIETOR',
    'COOPERATIVE',
    'NGO',
    'STATE_OWNED',
  ]),
  registrationDate: Iso,
  vatRegistered: z.boolean(),
  /** Codes from the national administrative structure (province 1, district 102, sector 10201). */
  address: z.object({
    provinceCode: z.number().int().positive(),
    districtCode: z.number().int().positive(),
    sectorCode: z.number().int().positive(),
    street: z.string().min(1).nullable(),
  }),
  /** Who directs or owns it, by the document they registered with. */
  directors: z
    .array(
      z
        .object({
          fullName: z.string().min(1),
          nationalId: NationalIdNumber.nullable().default(null),
          passportNumber: z.string().min(5).nullable().default(null),
          role: z.enum(['DIRECTOR', 'SHAREHOLDER', 'OWNER']).default('DIRECTOR'),
        })
        .refine((d) => d.nationalId !== null || d.passportNumber !== null, 'a director needs a National ID or a passport'),
    )
    .default([]),
  /**
   * - `active`: a registered, trading taxpayer.
   * - `deregistered`: RRA closed the TIN; the lookup answers it, marked closed.
   * - `outage`: RRA's service answers 503 for this TIN, so the API reads "could not reach RRA".
   */
  scenario: z.enum(['active', 'deregistered', 'outage']).default('active'),
  note: z.string().optional(),
});
export type Taxpayer = z.infer<typeof Taxpayer>;

/** A passport Smile ID can verify, keyed by its number. */
export const Passport = z.object({
  passportNumber: z.string().min(5),
  /** ISO 3166-1 alpha-2. */
  country: z.string().regex(/^[A-Z]{2}$/),
  fullName: z.string().min(1),
  dateOfBirth: Iso,
  gender: z.enum(['M', 'F']),
  expiresOn: Iso,
  /**
   * - `valid`: verified; the selfie matches unless it plainly belongs to someone else.
   * - `not_authentic`: the document check fails (a photocopy, a screen).
   * - `face_mismatch`: any selfie fails the comparison.
   * - `unreadable`: the photo page cannot be read.
   * An expired passport needs no scenario: `expiresOn` in the past is enough.
   */
  scenario: z.enum(['valid', 'not_authentic', 'face_mismatch', 'unreadable']).default('valid'),
  note: z.string().optional(),
});
export type Passport = z.infer<typeof Passport>;

/** A mobile money wallet GTBank's Payment Hub can prompt or pay. */
export const Wallet = z.object({
  msisdn: Msisdn,
  network: z.enum(['MTN', 'AIRTEL']),
  holderName: z.string().min(1),
  /**
   * How the handset answers a Request to Pay, and how the wallet takes a payout:
   * - `approve`: approves after the usual few seconds.
   * - `manual`: the prompt waits until someone presses Approve or Decline in the console.
   * - `decline`: the holder declines the prompt.
   * - `insufficient_funds`: the prompt fails, the wallet cannot cover it.
   * - `slow`: approves after a minute.
   * - `late`: approves after the prompt window has closed.
   * - `reverse`: approves, then the bank reverses it two minutes later.
   * - `hang`: no answer at all; the request may or may not have arrived.
   */
  behaviour: z
    .enum(['approve', 'manual', 'decline', 'insufficient_funds', 'slow', 'late', 'reverse', 'hang'])
    .default('approve'),
  note: z.string().optional(),
});
export type Wallet = z.infer<typeof Wallet>;

export const REGISTER_NAMES = ['citizens', 'taxpayers', 'passports', 'wallets'] as const;
export type RegisterName = (typeof REGISTER_NAMES)[number];

export const REGISTER_SCHEMAS = {
  citizens: Citizen,
  taxpayers: Taxpayer,
  passports: Passport,
  wallets: Wallet,
} as const;

export interface Registers {
  citizens: Citizen[];
  taxpayers: Taxpayer[];
  passports: Passport[];
  wallets: Wallet[];
}

/** The key a row is found by, so adding a row with a known key replaces it. */
export function keyOf(register: RegisterName, row: Citizen | Taxpayer | Passport | Wallet): string {
  switch (register) {
    case 'citizens':
      return (row as Citizen).nationalId;
    case 'taxpayers':
      return (row as Taxpayer).tin;
    case 'passports':
      return (row as Passport).passportNumber.toUpperCase();
    case 'wallets':
      return (row as Wallet).msisdn;
  }
}
