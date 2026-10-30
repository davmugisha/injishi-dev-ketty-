import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { Logger } from '@nestjs/common';
import { z } from 'zod';

import { ProviderHttpError, providerFetch } from '../../../shared/http/provider-http';
import type {
  DocumentCheck,
  DocumentImage,
  DocumentVerifierPort,
  IdentityAdapterMode,
} from '../domain/identity-ports';

/**
 * Smile ID Document Verification (job type 6) over HTTP: prepare an upload,
 * upload the document photo and the selfie, then poll `job_status` until the
 * job completes. Requests are signed the Smile ID way: `signature` is the
 * base64 HMAC-SHA256 of `timestamp + partner_id + "sid_request"` under the API
 * key, and the job status answer is signed the same way and checked.
 *
 * Bound under `DOCUMENT_VERIFIER_MODE=sandbox` against Injishi Mock APIs, and
 * the adapter `live` will register: the same class with Smile ID's base URL,
 * partner id and key. Two things the signed contract's documentation must
 * confirm first, each one function here:
 * - `upload()`: the real upload is a zip (`info.json` plus the images) to a
 *   pre-signed URL; the mock takes the same content as JSON.
 * - `toCheck()`: the result codes and action names.
 *
 * A job that has not completed inside `pollTimeoutMs` reads as `unavailable`:
 * the person is told to try again, and their photos are kept either way.
 */

const SELFIE_IMAGE_TYPE = 2;
const DOCUMENT_FRONT_IMAGE_TYPE = 3;

const JobStatus = z.object({
  timestamp: z.string().optional(),
  signature: z.string().optional(),
  job_complete: z.boolean(),
  result: z
    .object({
      ResultCode: z.string().nullable().optional(),
      Actions: z.record(z.string()).optional(),
      IDNumber: z.string().optional(),
      FullName: z.string().optional(),
      DOB: z.string().optional(),
      Gender: z.string().optional(),
      Country: z.string().optional(),
      ExpirationDate: z.string().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
});
type JobResult = NonNullable<z.infer<typeof JobStatus>['result']>;

export interface SmileIdConfig {
  mode: 'sandbox' | 'live';
  /** The service's base, e.g. `http://localhost:8100/smile-id`. */
  baseUrl: string;
  partnerId: string;
  apiKey: string;
  timeoutMs: number;
  pollTimeoutMs: number;
  pollIntervalMs: number;
}

export class SmileIdDocumentVerifier implements DocumentVerifierPort {
  readonly mode: IdentityAdapterMode;
  private readonly log = new Logger(SmileIdDocumentVerifier.name);

  constructor(private readonly config: SmileIdConfig) {
    this.mode = config.mode;
  }

  async verifyDocument(input: {
    documentType: 'national_id' | 'passport';
    front: DocumentImage;
    selfie: DocumentImage;
    issuingCountry?: string | null;
  }): Promise<DocumentCheck> {
    // Opaque to Smile ID: never our user id, never a name.
    const partnerParams = { job_id: randomUUID(), user_id: `injishi-${randomUUID()}`, job_type: 6 };
    try {
      const prepared = await this.call<{ upload_url?: unknown }>('/v1/upload', {
        ...this.signed(),
        smile_client_id: this.config.partnerId,
        partner_params: partnerParams,
        model_parameters: {},
        source_sdk: 'rest_api',
        source_sdk_version: '1.0.0',
        file_name: 'document.zip',
      });
      if (typeof prepared.upload_url !== 'string') throw new Error('no upload_url in the answer');
      await this.upload(prepared.upload_url, input);

      const deadline = Date.now() + this.config.pollTimeoutMs;
      while (Date.now() < deadline) {
        const raw = await this.call<unknown>('/v1/job_status', {
          ...this.signed(),
          partner_id: this.config.partnerId,
          user_id: partnerParams.user_id,
          job_id: partnerParams.job_id,
          image_links: false,
          history: false,
        });
        const status = JobStatus.safeParse(raw);
        if (!status.success) throw new Error('a job status that does not read');
        if (!this.signatureHolds(status.data.timestamp, status.data.signature)) {
          this.log.error('Smile ID answered a job status whose signature does not hold. It is not trusted.');
          return { status: 'unavailable' };
        }
        if (status.data.job_complete && status.data.result) {
          return this.toCheck(status.data.result, input.documentType);
        }
        await new Promise((resolve) => setTimeout(resolve, this.config.pollIntervalMs));
      }
      this.log.warn(`Smile ID job ${partnerParams.job_id} did not complete within ${this.config.pollTimeoutMs} ms.`);
      return { status: 'unavailable' };
    } catch (error) {
      this.log.warn(`Smile ID check could not run: ${(error as Error).message}`);
      return { status: 'unavailable' };
    }
  }

  /** The upload. The real service takes a zip at a pre-signed URL: this is the function that changes. */
  private async upload(
    url: string,
    input: { documentType: 'national_id' | 'passport'; front: DocumentImage; selfie: DocumentImage; issuingCountry?: string | null },
  ): Promise<void> {
    await providerFetch({
      provider: 'smile_id',
      method: 'PUT',
      url,
      json: {
        id_info: {
          country: input.documentType === 'national_id' ? 'RW' : (input.issuingCountry ?? 'RW'),
          id_type: input.documentType === 'passport' ? 'PASSPORT' : 'NATIONAL_ID',
        },
        images: [
          { image_type_id: DOCUMENT_FRONT_IMAGE_TYPE, image: input.front.bytes.toString('base64') },
          { image_type_id: SELFIE_IMAGE_TYPE, image: input.selfie.bytes.toString('base64') },
        ],
      },
      timeoutMs: this.config.timeoutMs,
    });
  }

  /** A completed job's verdict, in the seam's words. */
  private toCheck(result: JobResult, documentType: 'national_id' | 'passport'): DocumentCheck {
    const actions = result.Actions ?? {};
    const failed = (name: string): boolean => actions[name] === 'Failed';
    switch (result.ResultCode) {
      case '0810': {
        const dob = result.DOB && /^\d{4}-\d{2}-\d{2}$/.test(result.DOB) ? result.DOB : null;
        if (!result.IDNumber || !result.FullName || !dob) {
          // Verified, but without the details the account needs: not usable.
          this.log.warn('Smile ID verified a document but returned no number, name or birth date.');
          return { status: 'unavailable' };
        }
        return {
          status: 'verified',
          generated: this.mode === 'sandbox',
          holder: {
            fullName: result.FullName,
            dateOfBirth: dob,
            gender: result.Gender === 'F' ? 'female' : result.Gender === 'M' ? 'male' : null,
            documentNumber: result.IDNumber,
            issuingCountry: documentType === 'national_id' ? 'RW' : (result.Country ?? 'RW').toUpperCase(),
            expiresOn:
              result.ExpirationDate && /^\d{4}-\d{2}-\d{2}$/.test(result.ExpirationDate) ? result.ExpirationDate : null,
          },
        };
      }
      case '0811':
        if (failed('Selfie_To_ID_Card_Compare')) return { status: 'rejected', reason: 'face_mismatch' };
        if (failed('Expiry_Check')) return { status: 'rejected', reason: 'expired' };
        return { status: 'rejected', reason: 'not_authentic' };
      case '0812':
        return { status: 'rejected', reason: 'unreadable' };
      default:
        this.log.warn(`Smile ID answered result code ${result.ResultCode ?? 'none'}, which this adapter does not know.`);
        return { status: 'unavailable' };
    }
  }

  private async call<T>(path: string, body: unknown): Promise<T> {
    try {
      const { body: answer } = await providerFetch<T>({
        provider: 'smile_id',
        method: 'POST',
        url: `${this.config.baseUrl}${path}`,
        json: body,
        timeoutMs: this.config.timeoutMs,
      });
      return answer;
    } catch (error) {
      if (error instanceof ProviderHttpError && error.kind === 'unauthorised') {
        this.log.error('Smile ID refused our signature. Check the partner id and API key.');
      }
      throw error;
    }
  }

  private signed(): { timestamp: string; signature: string } {
    const timestamp = new Date().toISOString();
    return { timestamp, signature: this.sign(timestamp) };
  }

  private sign(timestamp: string): string {
    return createHmac('sha256', this.config.apiKey)
      .update(timestamp + this.config.partnerId + 'sid_request')
      .digest('base64');
  }

  private signatureHolds(timestamp: string | undefined, signature: string | undefined): boolean {
    if (!timestamp || !signature) return false;
    const expected = Buffer.from(this.sign(timestamp));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
