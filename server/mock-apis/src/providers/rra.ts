import { timingSafeEqual } from 'node:crypto';

import type { MockApisConfig } from '../config.ts';
import { HttpError, type Router, header, sleep } from '../http.ts';
import type { Store } from '../store.ts';

/**
 * RRA's taxpayer register, as Injishi will reach it: one read, a taxpayer by
 * TIN, behind an API key.
 *
 * THE WIRE IS INJISHI'S BEST MODEL. RRA has not granted API access (ADR-060
 * decision 5), so the field names are chosen to carry what registration needs
 * from the register (the legal name, when and as what it was registered, its
 * address as administrative codes, whether it is active, and who directs it,
 * by the document they registered with) and nothing more. The API's sandbox
 * adapter is the only reader; both change together when RRA's document arrives.
 *
 * A TIN with no register row and outside the generated `998` blocks is not
 * registered (404). A row's `scenario` asks for a closed TIN or an outage.
 */

const LEGAL_FORM_LABEL: Record<string, string> = {
  PRIVATE_LIMITED: 'Private limited company',
  PUBLIC_LIMITED: 'Public limited company',
  SOLE_PROPRIETOR: 'Sole proprietor',
  COOPERATIVE: 'Cooperative',
  NGO: 'Non-governmental organisation',
  STATE_OWNED: 'State owned enterprise',
};

export function registerRra(router: Router, store: Store, config: MockApisConfig): void {
  const apiKey = Buffer.from(config.credentials.rra.apiKey);

  router.on('GET', '/rra/v1/taxpayers/:tin', async (request) => {
    const given = Buffer.from(header(request, 'x-api-key') ?? '');
    if (given.length !== apiKey.length || !timingSafeEqual(given, apiKey)) {
      throw new HttpError(401, { code: 'UNAUTHORIZED', message: 'A valid x-api-key header is required.' });
    }
    const tin = request.params.tin!;
    if (!/^\d{9}$/.test(tin)) {
      throw new HttpError(400, { code: 'INVALID_TIN', message: 'A TIN is nine digits.' });
    }
    await sleep(150);
    const taxpayer = store.taxpayer(tin);
    if (!taxpayer) {
      throw new HttpError(404, { code: 'TIN_NOT_FOUND', message: 'No taxpayer is registered under this TIN.' });
    }
    if (taxpayer.scenario === 'outage') {
      throw new HttpError(503, { code: 'SERVICE_UNAVAILABLE', message: 'The taxpayer register is not available. Try again later.' });
    }
    return {
      status: 200,
      body: {
        tin: taxpayer.tin,
        taxpayerName: taxpayer.taxpayerName,
        tradingName: taxpayer.tradingName,
        legalForm: taxpayer.legalForm,
        legalFormLabel: LEGAL_FORM_LABEL[taxpayer.legalForm] ?? taxpayer.legalForm,
        registrationDate: taxpayer.registrationDate,
        status: taxpayer.scenario === 'deregistered' ? 'DEREGISTERED' : 'ACTIVE',
        vatRegistered: taxpayer.vatRegistered,
        address: taxpayer.address,
        directors: taxpayer.directors.map((d) => ({
          fullName: d.fullName,
          role: d.role,
          idType: d.nationalId ? 'NATIONAL_ID' : 'PASSPORT',
          idNumber: d.nationalId ?? d.passportNumber,
        })),
      },
    };
  });
}
