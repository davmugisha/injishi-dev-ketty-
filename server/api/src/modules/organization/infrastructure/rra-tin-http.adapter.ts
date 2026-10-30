import { Logger } from '@nestjs/common';
import { z } from 'zod';

import { ProviderHttpError, providerFetch } from '../../../shared/http/provider-http';
import { RraTinAdapter, type TinCheckOutcome, type TinRegistryBusiness } from './rra-tin.adapter';

/**
 * RRA's taxpayer register over HTTP: `GET {base}/v1/taxpayers/{tin}` with an
 * `x-api-key` header (ADR-060 decision 5).
 *
 * Bound under `RRA_TIN_ADAPTER_MODE=sandbox` against Injishi Mock APIs, and the
 * adapter `live` will register once RRA grants access: the same class with
 * RRA's base URL and key. The wire is Injishi's model until RRA's document
 * arrives (`server/mock-apis/src/providers/rra.ts` says what it carries);
 * `TaxpayerRecord` below is the one place that document corrects.
 *
 * Its answers keep the seam's three outcomes apart:
 * - an ACTIVE taxpayer is `verified`, with the register's details;
 * - a TIN the register does not hold, or holds closed, is `failed`;
 * - anything that is not an answer (an outage, a timeout, refused
 *   credentials, a body that does not read) is `pending`, never `failed`: the
 *   check after payment runs again, and a business must not be told it failed
 *   a check that never ran.
 *
 * The stored `raw` never carries a director's document number (ADR-060): it
 * keeps the status, the name and how many directors were listed.
 */

const COMPANY_TYPE: Record<string, TinRegistryBusiness['companyType']> = {
  PRIVATE_LIMITED: 'private_company',
  PUBLIC_LIMITED: 'public_company',
  SOLE_PROPRIETOR: 'sole_trader',
  COOPERATIVE: 'cooperative',
  NGO: 'ngo',
  STATE_OWNED: 'partly_state_owned',
};

const TaxpayerRecord = z.object({
  tin: z.string(),
  taxpayerName: z.string().min(1),
  legalForm: z.string(),
  registrationDate: z.string().nullable().optional(),
  status: z.string(),
  address: z
    .object({
      provinceCode: z.number().int(),
      districtCode: z.number().int(),
      sectorCode: z.number().int(),
      street: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  directors: z
    .array(z.object({ fullName: z.string(), idType: z.string().optional(), idNumber: z.string().nullable().optional() }))
    .default([]),
});

/** An outcome without the two fields every branch shares, kept a union. */
type OutcomeBody = TinCheckOutcome extends infer T
  ? T extends TinCheckOutcome
    ? Omit<T, 'latencyMs' | 'adapterMode'>
    : never
  : never;

export interface RraTinHttpConfig {
  mode: 'sandbox' | 'live';
  /** The register's base, e.g. `http://localhost:8100/rra`. */
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

export class RraTinHttpAdapter extends RraTinAdapter {
  private readonly log = new Logger(RraTinHttpAdapter.name);

  constructor(private readonly config: RraTinHttpConfig) {
    super();
  }

  override async verify(tin: string): Promise<TinCheckOutcome> {
    const startedAt = Date.now();
    // The row's stamp: a sandbox answer is a mock's, whatever wire carried it.
    const adapterMode = this.config.mode === 'live' ? 'live' : 'mock';
    const outcome = (rest: OutcomeBody): TinCheckOutcome =>
      ({ ...rest, latencyMs: Date.now() - startedAt, adapterMode }) as TinCheckOutcome;

    if (!/^\d{9}$/.test(tin)) {
      return outcome({ result: 'failed', reason: 'malformed_tin', raw: { tin } });
    }

    let body: unknown;
    try {
      ({ body } = await providerFetch({
        provider: 'rra',
        method: 'GET',
        url: `${this.config.baseUrl}/v1/taxpayers/${tin}`,
        headers: { 'x-api-key': this.config.apiKey },
        timeoutMs: this.config.timeoutMs,
      }));
    } catch (error) {
      if (error instanceof ProviderHttpError && error.kind === 'refused') {
        // 404: not registered. 400: RRA could not read it as a TIN.
        return outcome({
          result: 'failed',
          reason: error.status === 404 ? 'not_registered' : 'refused_by_rra',
          raw: { tin, status: error.status, code: error.providerCode },
        });
      }
      if (error instanceof ProviderHttpError && error.kind === 'unauthorised') {
        this.log.error('RRA refused our API key. Every TIN check reads as pending until it is fixed.');
      } else {
        this.log.warn(`RRA TIN check could not run: ${(error as Error).message}`);
      }
      return outcome({
        result: 'pending',
        reason: 'adapter_unavailable',
        raw: { tin, failure: error instanceof ProviderHttpError ? error.kind : 'error' },
      });
    }

    const parsed = TaxpayerRecord.safeParse(body);
    if (!parsed.success) {
      this.log.warn(`RRA answered a taxpayer record that does not read: ${parsed.error.issues[0]?.message ?? ''}`);
      return outcome({ result: 'pending', reason: 'adapter_unavailable', raw: { tin, failure: 'unreadable' } });
    }
    const record = parsed.data;
    const raw = {
      tin,
      status: record.status,
      taxpayerName: record.taxpayerName,
      directorsListed: record.directors.length,
      source: this.config.mode === 'sandbox' ? 'injishi-mock-apis' : 'rra',
    };
    if (record.status !== 'ACTIVE') {
      return outcome({ result: 'failed', reason: `taxpayer_${record.status.toLowerCase()}`, raw });
    }
    return outcome({
      result: 'verified',
      raw,
      business: {
        legalName: record.taxpayerName,
        registeredOn: record.registrationDate ?? null,
        companyType: COMPANY_TYPE[record.legalForm] ?? null,
        address: record.address
          ? {
              provinceId: record.address.provinceCode,
              districtId: record.address.districtCode,
              sectorId: record.address.sectorCode,
              street: record.address.street ?? null,
            }
          : null,
        directors: record.directors.map((d) => ({ name: d.fullName, documentNumber: d.idNumber ?? null })),
        generated: this.config.mode === 'sandbox',
      },
    });
  }
}
