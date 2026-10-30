import { Logger } from '@nestjs/common';
import { z } from 'zod';

import { GtbankTokenSource } from '../../../shared/http/gtbank-oauth';
import { ProviderHttpError, providerFetch } from '../../../shared/http/provider-http';
import type {
  DocumentImage,
  IdentityAdapterMode,
  NationalIdCheck,
  NationalIdRegistryPort,
} from '../domain/identity-ports';

/**
 * NIDA's population register through GTBank's NIDA gateway:
 * `POST {base}/nida/v1/identity-verifications` with a National ID number and
 * the holder's selfie, behind GTBank's bearer token.
 *
 * Bound under `NIDA_ADAPTER_MODE=sandbox` against Injishi Mock APIs, and the
 * adapter `live` will register once GTBank's specification is in hand: the
 * same class with GTBank's base URL and credentials, its `Verification`
 * mapping corrected to the document. The wire is Injishi's model until then
 * (`server/mock-apis/src/providers/gtbank.ts`).
 *
 * The selfie leaves Injishi only in this request, and nothing here logs it or
 * the number.
 */

const Verification = z.object({
  verificationReference: z.string().optional(),
  result: z.enum(['MATCH', 'NO_MATCH', 'NOT_FOUND', 'NOT_CHECKED', 'REVOKED']),
  citizen: z
    .object({
      documentNumber: z.string(),
      foreNames: z.string(),
      surname: z.string(),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      sex: z.enum(['M', 'F']).nullable().optional(),
    })
    .nullable(),
});

export interface GtbankNidaConfig {
  mode: 'sandbox' | 'live';
  /** The bank's base, e.g. `http://localhost:8100/gtbank`. */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
}

export class GtbankNidaRegistry implements NationalIdRegistryPort {
  readonly mode: IdentityAdapterMode;
  private readonly log = new Logger(GtbankNidaRegistry.name);
  private readonly tokens: GtbankTokenSource;

  constructor(private readonly config: GtbankNidaConfig) {
    this.mode = config.mode;
    this.tokens = new GtbankTokenSource(config);
  }

  async verify(input: { documentNumber: string; selfie: DocumentImage; reference: string }): Promise<NationalIdCheck> {
    let body: unknown;
    try {
      body = await this.post(input, true);
    } catch (error) {
      if (error instanceof ProviderHttpError && error.kind === 'refused') {
        // 422s the gateway words itself: a selfie it could not read, a number it would not take.
        if (error.providerCode === 'SELFIE_UNREADABLE') return { status: 'rejected', reason: 'unreadable' };
        if (error.providerCode === 'INVALID_DOCUMENT_NUMBER') return { status: 'rejected', reason: 'not_found' };
      }
      this.log.warn(`NIDA check could not run: ${(error as Error).message}`);
      return { status: 'unavailable' };
    }

    const parsed = Verification.safeParse(body);
    if (!parsed.success) {
      this.log.warn('The NIDA gateway answered a verification that does not read.');
      return { status: 'unavailable' };
    }
    const { result, citizen } = parsed.data;
    if (result === 'NOT_FOUND' || !citizen) return { status: 'rejected', reason: 'not_found' };
    if (result === 'REVOKED') return { status: 'rejected', reason: 'revoked' };
    if (result === 'NO_MATCH') return { status: 'rejected', reason: 'face_mismatch' };
    if (citizen.documentNumber !== input.documentNumber) {
      // An answer about someone else is not an answer about this number.
      this.log.error('The NIDA gateway answered for a different National ID than the one asked.');
      return { status: 'unavailable' };
    }
    return {
      status: 'verified',
      face: result === 'MATCH' ? 'match' : 'not_checked',
      generated: this.mode === 'sandbox',
      holder: {
        fullName: `${citizen.foreNames} ${citizen.surname}`.replace(/\s+/g, ' ').trim(),
        dateOfBirth: citizen.dateOfBirth,
        gender: citizen.sex === 'F' ? 'female' : citizen.sex === 'M' ? 'male' : null,
        documentNumber: citizen.documentNumber,
        issuingCountry: 'RW',
        expiresOn: null,
      },
    };
  }

  /** One request, with one retry on a refused token (it may have expired at the bank first). */
  private async post(
    input: { documentNumber: string; selfie: DocumentImage; reference: string },
    retryOnUnauthorised: boolean,
  ): Promise<unknown> {
    try {
      const { body } = await providerFetch({
        provider: 'gtbank',
        method: 'POST',
        url: `${this.config.baseUrl}/nida/v1/identity-verifications`,
        headers: { authorization: `Bearer ${await this.tokens.bearer()}` },
        json: {
          requestReference: input.reference,
          documentNumber: input.documentNumber,
          selfie: { mimeType: input.selfie.mime ?? 'image/jpeg', data: input.selfie.bytes.toString('base64') },
          purpose: 'KYC',
        },
        timeoutMs: this.config.timeoutMs,
      });
      return body;
    } catch (error) {
      if (retryOnUnauthorised && error instanceof ProviderHttpError && error.kind === 'unauthorised') {
        this.tokens.invalidate();
        return this.post(input, false);
      }
      throw error;
    }
  }
}
