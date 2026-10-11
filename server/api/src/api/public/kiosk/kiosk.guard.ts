import {
  createParamDecorator,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';

import { KioskService, type KioskContext } from '../../../modules/people/application/kiosk.service';

/** The device cookie a paired kiosk carries. HttpOnly, so the page never holds the token. */
export const KIOSK_COOKIE = 'injishi_kiosk';
/** Scoped to the kiosk's own routes: no other request carries it. */
export const KIOSK_COOKIE_PATH = '/api/v1/kiosk';

interface KioskRequest {
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
  constructor(private readonly kiosks: KioskService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<KioskRequest>();
    const token = request.cookies?.[KIOSK_COOKIE];
    const kiosk = token ? await this.kiosks.resolve(token, request.ip) : null;
    if (!kiosk) {
      throw new UnauthorizedException({ code: 'kiosk_unpaired', message: 'This device is not paired as a kiosk.' });
    }
    request.kiosk = kiosk;
    return true;
  }
}

/** The kiosk `KioskGuard` resolved. */
export const CurrentKiosk = createParamDecorator((_data: unknown, context: ExecutionContext): KioskContext => {
  const kiosk = context.switchToHttp().getRequest<KioskRequest>().kiosk;
  if (!kiosk) throw new UnauthorizedException({ code: 'kiosk_unpaired', message: 'This device is not paired as a kiosk.' });
  return kiosk;
});
