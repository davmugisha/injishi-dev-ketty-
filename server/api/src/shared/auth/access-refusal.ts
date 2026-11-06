import {
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ACCESS_REFUSAL_LAYER,
  type AccessRefusal,
  type AccessRefusalCode,
} from '@injishi/contracts';

/**
 * The one way a guard refuses (ADR-076 A-6, G11; AC-U3).
 *
 * Every refusal names its layer and code beside the sentence the guard always
 * sent, which does not change: a client that read `message` keeps working, and
 * one that branches on `code` (the step-up screen, the kiosk pairing screen)
 * keeps the value it already knew. The layer comes from the code
 * (`ACCESS_REFUSAL_LAYER`), so a code can never be thrown under the wrong one.
 *
 * The status follows the code, as the layers answer today: 401 for no session
 * or no paired device, 404 for a branch or record outside scope (so a probe
 * cannot tell "not yours" from "does not exist"), 403 for everything else.
 */
export function accessRefusal(code: AccessRefusalCode, message: string): HttpException {
  if (code === 'unauthenticated' || code === 'device_unpaired' || code === 'kiosk_unpaired') {
    return new UnauthorizedException(refusalBody(401, 'Unauthorized', message, code));
  }
  if (code === 'not_found') {
    return new NotFoundException(refusalBody(404, 'Not Found', message, code));
  }
  return new ForbiddenException(refusalBody(403, 'Forbidden', message, code));
}

function refusalBody(
  statusCode: number,
  error: string,
  message: string,
  code: AccessRefusalCode,
): AccessRefusal {
  return { statusCode, error, message, layer: ACCESS_REFUSAL_LAYER[code], code };
}
