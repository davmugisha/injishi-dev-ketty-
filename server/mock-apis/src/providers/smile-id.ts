import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import type { MockApisConfig } from '../config.ts';
import { HttpError, type Router, json } from '../http.ts';
import { PASSPORT_GIVEN, PASSPORT_SURNAMES, digest, generatedCitizen } from '../registers/generated.ts';
import type { SmileJob, Store } from '../store.ts';
import { MIN_IMAGE_BYTES, compareFace, decodeImage, nationalIdMarker, passportMarker } from './images.ts';

/**
 * Smile ID's Document Verification (job type 6): a photo of an identity
 * document and a selfie, answered with what the document says and whether
 * the selfie is its holder. Injishi uses it for passports, and for a National
 * ID card only where the NIDA gateway is switched off.
 *
 * MODELLED ON SMILE ID'S PUBLIC v1 REST API, in shape: a signed request
 * (`signature` = base64 HMAC-SHA256 of `timestamp + partner_id + "sid_request"`
 * under the API key), a prepare-upload call that returns an `upload_url`, the
 * upload, then `job_status` polled until `job_complete`. Two simplifications,
 * each confined to one function of the API's adapter:
 * - The real upload is a zip of `info.json` and the images, sent to a
 *   pre-signed storage URL. Here the same content is one JSON body.
 * - Result codes and action names follow Smile ID's documented style
 *   (`0810` verified, `0811` rejected, `0812` unreadable here), but are this
 *   mock's table. Check them against the signed contract's documentation
 *   before the adapter goes live.
 */

const JOB_TYPE_DOCUMENT_VERIFICATION = 6;
/** Smile ID's image type ids: 2 a selfie and 3 a document front, both base64. */
const SELFIE = 2;
const DOCUMENT_FRONT = 3;

const COUNTRIES = ['KE', 'UG', 'TZ', 'GB', 'US', 'DE', 'FR', 'BE'];

function signature(apiKey: string, partnerId: string, timestamp: string): string {
  return createHmac('sha256', apiKey).update(timestamp + partnerId + 'sid_request').digest('base64');
}

function smileError(code: string, error: string): unknown {
  return { code, error };
}

export function registerSmileId(router: Router, store: Store, config: MockApisConfig): void {
  const { partnerId, apiKey } = config.credentials.smileId;

  const checkSignature = (body: { timestamp?: unknown; signature?: unknown; partner_id?: unknown; smile_client_id?: unknown }): void => {
    const partner = String(body.partner_id ?? body.smile_client_id ?? '');
    const timestamp = String(body.timestamp ?? '');
    const given = Buffer.from(String(body.signature ?? ''));
    const expected = Buffer.from(signature(apiKey, partnerId, timestamp));
    if (partner !== partnerId || timestamp === '' || given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new HttpError(401, smileError('2205', 'You are not authorized to do that.'));
    }
    const age = Math.abs(Date.now() - Date.parse(timestamp));
    if (!Number.isFinite(age) || age > 60 * 60 * 1_000) {
      throw new HttpError(401, smileError('2205', 'The request timestamp is too old or unreadable.'));
    }
  };

  const signed = (): { timestamp: string; signature: string } => {
    const timestamp = new Date().toISOString();
    return { timestamp, signature: signature(apiKey, partnerId, timestamp) };
  };

  const PartnerParams = z.object({
    job_id: z.string().min(1),
    user_id: z.string().min(1),
    job_type: z.union([z.number(), z.string()]).transform(Number),
  });

  // 1. Prepare the upload.
  router.on('POST', '/smile-id/v1/upload', (request) => {
    const raw = json(request, (m) => smileError('2204', m)) as Record<string, unknown>;
    checkSignature(raw);
    const parsed = z
      .object({ partner_params: PartnerParams, callback_url: z.string().url().optional() })
      .safeParse(raw);
    if (!parsed.success) throw new HttpError(400, smileError('2204', 'partner_params with job_id, user_id and job_type are required.'));
    const { partner_params: params, callback_url } = parsed.data;
    if (params.job_type !== JOB_TYPE_DOCUMENT_VERIFICATION) {
      throw new HttpError(400, smileError('2213', `This mock answers job type ${JOB_TYPE_DOCUMENT_VERIFICATION} (Document Verification) only.`));
    }
    if (store.smileJob(partnerId, params.user_id, params.job_id)) {
      throw new HttpError(400, smileError('2215', 'A job with this job_id already exists for this user.'));
    }
    const smileJobId = String(1_000_000_000 + (randomBytes(4).readUInt32BE(0) % 8_999_999_999));
    const job: SmileJob = {
      partnerId,
      userId: params.user_id,
      jobId: params.job_id,
      smileJobId,
      uploadedAt: null,
      completesAt: null,
      result: null,
      callbackUrl: callback_url ?? null,
      createdAt: new Date().toISOString(),
    };
    store.addSmileJob(job);
    return {
      status: 200,
      body: {
        upload_url: `${config.publicUrl}/smile-id/uploads/${smileJobId}`,
        ref_id: randomBytes(8).toString('hex'),
        smile_job_id: smileJobId,
        camera_config: null,
        code: '2202',
      },
    };
  });

  // 2. The upload: in the real service, a zip to a pre-signed URL.
  const Upload = z.object({
    id_info: z.object({
      country: z.string().regex(/^[A-Z]{2}$/),
      id_type: z.enum(['PASSPORT', 'NATIONAL_ID']),
    }),
    images: z.array(z.object({ image_type_id: z.number().int(), image: z.string() })).min(1),
  });

  router.on('PUT', '/smile-id/uploads/:smileJobId', (request) => {
    const job = store.smileJobBySmileId(request.params.smileJobId!);
    if (!job) throw new HttpError(404, smileError('2203', 'No upload is expected at this URL.'));
    if (job.uploadedAt) throw new HttpError(409, smileError('2216', 'This job has already been uploaded.'));
    const parsed = Upload.safeParse(json(request, (m) => smileError('2204', m)));
    if (!parsed.success) {
      throw new HttpError(400, smileError('2204', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
    }
    const { id_info, images } = parsed.data;
    const selfie = decodeImage(images.find((i) => i.image_type_id === SELFIE)?.image);
    const front = decodeImage(images.find((i) => i.image_type_id === DOCUMENT_FRONT)?.image);
    job.uploadedAt = new Date().toISOString();
    job.completesAt = new Date(Date.now() + config.timing.smileJobMs).toISOString();
    job.result = documentResult(store, job, id_info, front, selfie);
    store.save();
    return { status: 200, body: '' };
  });

  // 3. Poll.
  router.on('POST', '/smile-id/v1/job_status', (request) => {
    const raw = json(request, (m) => smileError('2204', m)) as Record<string, unknown>;
    checkSignature(raw);
    const job = store.smileJob(partnerId, String(raw.user_id ?? ''), String(raw.job_id ?? ''));
    if (!job) throw new HttpError(404, smileError('2203', 'No job matches this user_id and job_id.'));
    const complete = job.completesAt !== null && Date.now() >= Date.parse(job.completesAt);
    const result = complete ? job.result : null;
    return {
      status: 200,
      body: {
        ...signed(),
        job_complete: complete,
        job_success: complete && result?.ResultCode === '0810',
        code: complete ? '2302' : '2314',
        result: result ?? { ResultCode: null, ResultText: job.uploadedAt ? 'Job is processing' : 'Awaiting upload' },
        history: [],
        image_links: {},
      },
    };
  });
}

type Actions = Record<string, 'Passed' | 'Failed' | 'Not Applicable' | 'Returned' | 'Not Returned'>;

/** What Smile ID would answer for these photos, decided once, at upload. */
function documentResult(
  store: Store,
  job: SmileJob,
  idInfo: { country: string; id_type: 'PASSPORT' | 'NATIONAL_ID' },
  front: Buffer | null,
  selfie: Buffer | null,
): Record<string, unknown> {
  const base = {
    SmileJobID: job.smileJobId,
    PartnerParams: { job_id: job.jobId, user_id: job.userId, job_type: JOB_TYPE_DOCUMENT_VERIFICATION },
    ResultType: 'DocVerification',
    Country: idInfo.country,
    IDType: idInfo.id_type,
    timestamp: new Date().toISOString(),
  };
  const notApplicable: Actions = {
    Verify_Document: 'Not Applicable',
    Document_Check: 'Not Applicable',
    Expiry_Check: 'Not Applicable',
    Liveness_Check: 'Not Applicable',
    Selfie_To_ID_Card_Compare: 'Not Applicable',
    Return_Personal_Info: 'Not Returned',
  };
  if (!front || !selfie || front.length < MIN_IMAGE_BYTES || selfie.length < MIN_IMAGE_BYTES) {
    return { ...base, ResultCode: '0812', ResultText: 'Unable to read the document or the selfie', Actions: { ...notApplicable, Verify_Document: 'Failed' } };
  }

  const holder = idInfo.id_type === 'PASSPORT' ? passportHolder(store, front) : nationalIdHolder(store, front);
  if (!holder) {
    return { ...base, ResultCode: '0812', ResultText: 'Unable to read the document', Actions: { ...notApplicable, Verify_Document: 'Failed' } };
  }
  if (holder.scenario === 'unreadable') {
    return { ...base, ResultCode: '0812', ResultText: 'Unable to read the document', Actions: { ...notApplicable, Verify_Document: 'Failed' } };
  }

  const personal = {
    IDNumber: holder.number,
    FullName: holder.fullName,
    DOB: holder.dateOfBirth,
    Gender: holder.gender,
    ExpirationDate: holder.expiresOn ?? 'Not Available',
    Country: holder.country,
  };
  const authentic = holder.scenario !== 'not_authentic';
  const current = holder.expiresOn === null || holder.expiresOn > new Date().toISOString().slice(0, 10);
  const face = compareFace({
    selfie,
    documentNumber: holder.number,
    documentImage: front,
    forceMismatch: holder.scenario === 'face_mismatch',
  });
  const actions: Actions = {
    Verify_Document: authentic && current ? 'Passed' : 'Failed',
    Document_Check: authentic ? 'Passed' : 'Failed',
    Expiry_Check: current ? 'Passed' : 'Failed',
    Liveness_Check: face === 'unreadable' ? 'Failed' : 'Passed',
    Selfie_To_ID_Card_Compare: face === 'match' ? 'Passed' : 'Failed',
    Return_Personal_Info: 'Returned',
  };
  const passed = authentic && current && face === 'match';
  return {
    ...base,
    ...personal,
    ResultCode: passed ? '0810' : face === 'unreadable' ? '0812' : '0811',
    ResultText: passed
      ? 'Document Verified'
      : !authentic
        ? 'Document failed the authenticity checks'
        : !current
          ? 'Document has expired'
          : 'Selfie does not match the document',
    Actions: actions,
    // True when the mock made this holder up from the photo's bytes.
    IsGenerated: holder.generated,
  };
}

interface Holder {
  number: string;
  fullName: string;
  dateOfBirth: string;
  gender: 'M' | 'F';
  country: string;
  expiresOn: string | null;
  scenario: 'valid' | 'not_authentic' | 'face_mismatch' | 'unreadable';
  generated: boolean;
}

/** A passport's photo page: the seeded passport it names, else one made up from its bytes. */
function passportHolder(store: Store, front: Buffer): Holder | null {
  const named = passportMarker(front);
  if (named) {
    const row = store.passport(named);
    if (!row) return null;
    return {
      number: row.passportNumber,
      fullName: row.fullName,
      dateOfBirth: row.dateOfBirth,
      gender: row.gender,
      country: row.country,
      expiresOn: row.expiresOn,
      scenario: row.scenario,
      generated: false,
    };
  }
  // The same algorithm as the API's in-process mock verifier.
  const seed = digest(front);
  const female = seed[0]! % 2 === 0;
  const given = female ? PASSPORT_GIVEN.F : PASSPORT_GIVEN.M;
  const year = 1960 + (seed[1]! % 40);
  const thisYear = new Date().getUTCFullYear();
  return {
    number: `P${String(seed.readUInt32BE(8) % 100_000_000).padStart(8, '0')}`,
    fullName: `${given[seed[3]! % given.length]} ${PASSPORT_SURNAMES[seed[4]! % PASSPORT_SURNAMES.length]}`,
    dateOfBirth: `${year}-${pad(1 + (seed[5]! % 12))}-${pad(1 + (seed[6]! % 28))}`,
    gender: female ? 'F' : 'M',
    country: COUNTRIES[seed[2]! % COUNTRIES.length]!,
    expiresOn: `${thisYear + 1 + (seed[7]! % 8)}-${pad(1 + (seed[9]! % 12))}-15`,
    scenario: 'valid',
    generated: true,
  };
}

/** A National ID card front: the citizen its demo marker names, else one made up from its bytes. */
function nationalIdHolder(store: Store, front: Buffer): Holder | null {
  const seed = digest(front);
  const number = nationalIdMarker(front) ?? madeUpNationalId(seed);
  const citizen = store.citizen(number);
  if (!citizen) return null;
  return {
    number,
    fullName: `${citizen.foreNames} ${citizen.surname}`,
    dateOfBirth: citizen.dateOfBirth,
    gender: citizen.sex,
    country: 'RW',
    expiresOn: null,
    scenario: citizen.scenario === 'face_mismatch' ? 'face_mismatch' : citizen.scenario === 'revoked' ? 'not_authentic' : 'valid',
    generated: generatedCitizen(number) !== null && !store.rows('citizens').some((c) => c.nationalId === number),
  };
}

function madeUpNationalId(seed: Buffer): string {
  const year = 1960 + (seed[1]! % 40);
  const marker = seed[0]! % 2 === 0 ? '7' : '8';
  const sequence = String(2_000_000 + (seed.readUInt32BE(8) % 7_000_000)).padStart(7, '0');
  const tail = String(seed.readUInt16BE(12) % 1000).padStart(3, '0');
  return `1${year}${marker}${sequence}${tail}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
