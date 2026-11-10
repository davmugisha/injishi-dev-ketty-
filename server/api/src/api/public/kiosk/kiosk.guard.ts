import {
  createParamDecorator,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { PRODUCT_LABEL } from '@injishi/contracts';

import { KioskService, type KioskContext } from '../../../modules/hr/application/kiosk.service';
import { accessContextFor, type RequestWithAccessContext } from '../../../shared/auth/access-context';
import { accessRefusal } from '../../../shared/auth/access-refusal';
import { EntitlementCheck } from '../../../shared/entitlements/entitlement-check';

/** The sentence the pairing screen is shown on. */
const KIOSK_UNPAIRED_MESSAGE = 'This device is not paired as a kiosk.';

/** The device cookie a paired kiosk carries. HttpOnly, so the page never holds the token. */
export const KIOSK_COOKIE = 'injishi_kiosk';
/** Scoped to the kiosk's own routes: no other request carries it. */
export const KIOSK_COOKIE_PATH = '/api/v1/kiosk';

interface KioskRequest extends RequestWithAccessContext {
  cookies?: Record<string, string | undefined>;
  ip?: string;
  kiosk?: KioskContext;
}

/**
 * The kiosk's device token (ADR-058, 058-time AC-TM10).
 *
 * A shared tablet never carries a staff member's session, so the kiosk routes
 * sit outside `SessionGuard` and this is their only door: the cookie must name
 * an active kiosk, from an address on its list when it has one. A revoked
 * kiosk's token hash is gone with it, so its cookie names nothing from the
 * moment it is revoked. 401 with `kiosk_unpaired` tells the page to show the
 * pairing screen.
 */
@Injectable()
export class KioskGuard implements CanActivate {
  constructor(
    private readonly kiosks: KioskService,
    private readonly entitlements: EntitlementCheck,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<KioskRequest>();
    const token = request.cookies?.[KIOSK_COOKIE];
    const kiosk = token ? await this.kiosks.resolve(token, request.ip) : null;
    if (!kiosk) {
      // `kiosk_unpaired` is the alias of `device_unpaired` the kiosk page
      // already routes on (ADR-076 G11), now with `layer: "session"` beside it.
      throw accessRefusal('kiosk_unpaired', KIOSK_UNPAIRED_MESSAGE);
    }
    // Clocking is HR's, so a kiosk stops when HR is off at its branch, checked
    // here, before any PIN is read: a permission never opens a product that is
    // off (ADR-076 G9).
    if (!(await this.entitlements.onForOrgAt('hr', kiosk.orgId, kiosk.propertyId))) {
      throw accessRefusal('product_off', `${PRODUCT_LABEL.hr} is not switched on here.`);
    }
    request.kiosk = kiosk;
    // An act through an enrolled device (ADR-076 contract section 8). Slice D
    // moves kiosks to Account's device table and adds the device user session.
    request.accessContext = accessContextFor('device', null, { deviceId: kiosk.id });
    return true;
  }
}

/** The kiosk `KioskGuard` resolved. */
export const CurrentKiosk = createParamDecorator((_data: unknown, context: ExecutionContext): KioskContext => {
  const kiosk = context.switchToHttp().getRequest<KioskRequest>().kiosk;
  if (!kiosk) throw accessRefusal('kiosk_unpaired', KIOSK_UNPAIRED_MESSAGE);
  return kiosk;
});
