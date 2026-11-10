import { CanActivate, ExecutionContext, Injectable, InternalServerErrorException, NotFoundException, createParamDecorator } from '@nestjs/common';

import { TENANCY_NOT_FOUND, TenanciesService, type TenancyRef } from '../../../modules/rentals/application/tenancies.service';
import { accessContextFor, type RequestWithAccessContext } from '../../../shared/auth/access-context';

/** The slice of the request this guard reads and writes. */
interface TenancyRequest extends RequestWithAccessContext {
  user?: { id: string };
  params?: Record<string, string | undefined>;
  tenancy?: TenancyRef;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The tenant's own lease, for `/me/tenancies/:leaseId/*` (blueprint 2.4).
 *
 * Runs after `SessionGuard`. Maps `:leaseId` to the caller through the tenant
 * record their account is linked to (`tenants.user_id`, made when they accept
 * the invitation), and answers 404 for a draft (the landlord's alone) and for
 * anyone else's lease, in the same words as for a lease that does not exist.
 * The resolved tenancy rides on the request for `@CurrentTenancy()`.
 *
 * A tenant acts on their own tenancy, so the request's access context is
 * `self` (ADR-076 G16): every audit row a tenant's act writes says so, never
 * a business grant they do not hold.
 */
@Injectable()
export class TenancyGuard implements CanActivate {
  constructor(private readonly tenancies: TenanciesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenancyRequest>();
    const userId = request.user?.id;
    const leaseId = request.params?.leaseId;
    if (!userId) throw new InternalServerErrorException('TenancyGuard used without SessionGuard before it.');
    if (!leaseId || !UUID.test(leaseId)) throw new NotFoundException(TENANCY_NOT_FOUND);
    request.tenancy = await this.tenancies.resolve(userId, leaseId);
    request.accessContext = accessContextFor('self', userId);
    return true;
  }
}

/** The tenancy `TenancyGuard` resolved. */
export const CurrentTenancy = createParamDecorator((_data: unknown, context: ExecutionContext): TenancyRef => {
  const request = context.switchToHttp().getRequest<TenancyRequest>();
  if (!request.tenancy) throw new InternalServerErrorException('CurrentTenancy used on a route without TenancyGuard.');
  return request.tenancy;
});
