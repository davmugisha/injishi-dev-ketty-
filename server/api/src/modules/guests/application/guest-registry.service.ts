import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type GuestHostKind,
  type GuestStayWindow,
  type HostGuest,
  type HostGuestQuery,
  type HostGuestTab,
  type LandlordGuestList,
  type LandlordGuestRequest,
  type TenantGuestList,
  type TenantGuestRequest,
  addDays,
  OTHER_RELATIONSHIP,
  guestIdOf,
  guestIdProblem,
  guestStayOn,
  guestStayProblem,
  kigaliToday,
} from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { assertResidence, buildingFilterIds, coversBuilding } from '../domain/host-scope';
import { placeWords } from '../domain/guest-words';
import {
  type GuestValues,
  GuestRegistryRepository,
  type HomeRow,
  type RegistrationRow,
  type TenancyHome,
} from '../infrastructure/guest-registry.repository';
import { presentHostGuest } from './guest-presenters';
import { GuestRoutingService } from './guest-routing.service';

/** What anyone but the lease's own tenant is told (the same words as the tenancy routes). */
export const TENANCY_NOT_FOUND = "We couldn't find this lease on your account.";
const GUEST_NOT_FOUND = 'That guest was not found.';
/** Who a stay business's guest is to it: a paying guest (inactive on the hosts' forms). */
const STAY_RELATIONSHIP = 'stay_guest';

/** A lease takes guests once it is signed and until it ends. */
const LEASE_TAKES_GUESTS = new Set(['signed', 'active', 'ending']);

/** A 400 shaped like the validation pipe's, so a form puts it under the right field. */
export function fieldError(path: (string | number)[], message: string): BadRequestException {
  return new BadRequestException({ message: 'Validation failed', issues: [{ code: 'custom', path, message }] });
}

type GuestBody = TenantGuestRequest | LandlordGuestRequest;

function tabOf(row: RegistrationRow, today: string): HostGuestTab {
  if (row.status === 'cancelled') return 'cancelled';
  return guestStayOn(today, row.arrivalOn, row.departureOn);
}

function countsOf(rows: readonly RegistrationRow[], today: string): Record<HostGuestTab, number> {
  const counts: Record<HostGuestTab, number> = { arriving: 0, staying: 0, left: 0, cancelled: 0 };
  for (const r of rows) counts[tabOf(r, today)] += 1;
  return counts;
}

/**
 * Registering guests (P5): a tenant for their lease, a landlord for their own
 * guests at a building. The landlord never reads or approves a tenant's guest:
 * a tenant's registration answers a landlord exactly like an id that does not
 * exist, and the other way round.
 *
 * Every filing checks the reference lists and the calendar on the server's own
 * day (arrival today or later, departure on or after it, at most 90 days, and
 * inside the lease for a tenant), then is delivered along the chain in one
 * transaction with its audit and outbox rows; the leaders are emailed after
 * commit. A host may change or cancel until the arrival day has passed.
 */
@Injectable()
export class GuestRegistryService {
  constructor(
    private readonly guests: GuestRegistryRepository,
    private readonly routing: GuestRoutingService,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  private today(): string {
    return kigaliToday(this.now());
  }

  // --- Reference lists ------------------------------------------------------------------

  countries(): Promise<{ code: string; name: string }[]> {
    return this.guests.countries();
  }

  relationships(): Promise<{ code: string; label: string; needsDetail: boolean }[]> {
    return this.guests.relationships();
  }

  // --- Tenants ----------------------------------------------------------------------------

  private async tenancy(userId: string, leaseId: string): Promise<TenancyHome> {
    const home = await this.guests.tenancyHome(userId, leaseId);
    if (!home || home.tenantUserId !== userId) throw new NotFoundException(TENANCY_NOT_FOUND);
    return home;
  }

  async tenantList(userId: string, leaseId: string, query: HostGuestQuery): Promise<TenantGuestList> {
    const home = await this.tenancy(userId, leaseId);
    const today = this.today();
    const rows = await this.guests.hostList({ leaseId: home.leaseId });
    return {
      ...(await this.present(rows, today, query.tab)),
      window: { start: home.start > today ? home.start : today, end: home.end },
    };
  }

  async tenantRegister(userId: string, leaseId: string, body: TenantGuestRequest): Promise<HostGuest> {
    const home = await this.tenancy(userId, leaseId);
    if (!LEASE_TAKES_GUESTS.has(home.status)) {
      throw new ConflictException(
        home.status === 'ended' || home.status === 'cancelled'
          ? 'This lease has ended, so there is no home to register a guest at.'
          : 'You can register guests once both of you have signed the lease.',
      );
    }
    const values = await this.prepare(body, { start: home.start, end: home.end });
    const id = await this.file(home, values, { hostKind: 'tenant', leaseId: home.leaseId, userId });
    return this.one(id);
  }

  async tenantUpdate(userId: string, leaseId: string, registrationId: string, body: TenantGuestRequest): Promise<HostGuest> {
    const home = await this.tenancy(userId, leaseId);
    const row = await this.guests.find(registrationId);
    if (!row || row.hostKind !== 'tenant' || row.leaseId !== home.leaseId) throw new NotFoundException(GUEST_NOT_FOUND);
    this.assertChangeable(row);
    const values = await this.prepare(body, { start: home.start, end: home.end });
    await this.change(row, home, values, userId);
    return this.one(row.id);
  }

  async tenantCancel(userId: string, leaseId: string, registrationId: string): Promise<HostGuest> {
    const home = await this.tenancy(userId, leaseId);
    const row = await this.guests.find(registrationId);
    if (!row || row.hostKind !== 'tenant' || row.leaseId !== home.leaseId) throw new NotFoundException(GUEST_NOT_FOUND);
    await this.cancelRow(row, userId);
    return this.one(row.id);
  }

  // --- Landlords: their own guests ----------------------------------------------------------

  async landlordList(ws: ScopedWorkspace, query: HostGuestQuery): Promise<LandlordGuestList> {
    const r = assertResidence(ws);
    const today = this.today();
    const [rows, buildings] = await Promise.all([
      this.guests.hostList({ workspaceId: r.workspaceId, propertyIds: buildingFilterIds(ws.branchScope) }),
      this.guests.buildings(r.workspaceId),
    ]);
    return {
      ...(await this.present(rows, today, query.tab)),
      buildings: buildings
        .filter((b) => coversBuilding(ws.branchScope, b.id))
        .map((b) => ({
          id: b.id,
          name: b.name,
          address: [b.addressText, placeWords(b)].filter(Boolean).join(', ') || null,
          located: b.villageId !== null,
          units: b.units,
        })),
    };
  }

  async landlordRegister(ws: ScopedWorkspace, userId: string, body: LandlordGuestRequest): Promise<HostGuest> {
    const r = assertResidence(ws);
    const home = await this.landlordHome(ws, r.workspaceId, body);
    const values = await this.prepare(body, {});
    const id = await this.file(home, values, { hostKind: 'landlord', leaseId: null, userId });
    return this.one(id);
  }

  async landlordUpdate(ws: ScopedWorkspace, userId: string, registrationId: string, body: LandlordGuestRequest): Promise<HostGuest> {
    const r = assertResidence(ws);
    const row = await this.ownLandlordGuest(ws, r.workspaceId, registrationId);
    this.assertChangeable(row);
    const home = await this.landlordHome(ws, r.workspaceId, body);
    const values = await this.prepare(body, {});
    await this.change(row, home, values, userId);
    return this.one(row.id);
  }

  async landlordCancel(ws: ScopedWorkspace, userId: string, registrationId: string): Promise<HostGuest> {
    const r = assertResidence(ws);
    const row = await this.ownLandlordGuest(ws, r.workspaceId, registrationId);
    await this.cancelRow(row, userId);
    return this.one(row.id);
  }

  private async landlordHome(ws: ScopedWorkspace, workspaceId: string, body: LandlordGuestRequest): Promise<HomeRow> {
    if (!coversBuilding(ws.branchScope, body.propertyId)) throw fieldError(['propertyId'], 'Pick one of your buildings.');
    const home = await this.guests.buildingHome(workspaceId, body.propertyId, body.unitId ?? null);
    if (!home) {
      throw body.unitId
        ? fieldError(['unitId'], 'Pick a unit in that building.')
        : fieldError(['propertyId'], 'Pick one of your buildings.');
    }
    return home;
  }

  /**
   * A landlord's own guest, or a 404. A tenant's guest in the same building
   * answers exactly as an id that does not exist: the landlord never reads it.
   */
  private async ownLandlordGuest(ws: ScopedWorkspace, workspaceId: string, registrationId: string): Promise<RegistrationRow> {
    const row = await this.guests.find(registrationId);
    if (!row || row.hostKind !== 'landlord' || row.workspaceId !== workspaceId || !coversBuilding(ws.branchScope, row.propertyId)) {
      throw new NotFoundException(GUEST_NOT_FOUND);
    }
    return row;
  }

  // --- Shared ---------------------------------------------------------------------------------

  private async present(
    rows: RegistrationRow[],
    today: string,
    tab: HostGuestTab | undefined,
  ): Promise<{ guests: HostGuest[]; counts: Record<HostGuestTab, number> }> {
    const shown = tab ? rows.filter((r) => tabOf(r, today) === tab) : rows;
    const routes = await this.guests.routesFor(shown.map((r) => r.id));
    const order = (a: RegistrationRow, b: RegistrationRow): number =>
      tab === 'left' || tab === 'cancelled' ? b.departureOn.localeCompare(a.departureOn) : a.arrivalOn.localeCompare(b.arrivalOn);
    return {
      guests: [...shown].sort(order).map((r) => presentHostGuest(r, routes, today)),
      counts: countsOf(rows, today),
    };
  }

  private async one(registrationId: string): Promise<HostGuest> {
    const row = await this.guests.find(registrationId);
    if (!row) throw new NotFoundException(GUEST_NOT_FOUND);
    return presentHostGuest(row, await this.guests.routesFor([row.id]), this.today());
  }

  /** A host can change or cancel until the arrival day has passed. */
  private assertChangeable(row: RegistrationRow): void {
    if (row.status === 'cancelled') throw new ConflictException('This guest registration is cancelled.');
    if (row.arrivalOn < this.today()) {
      throw new ConflictException('This guest has already arrived, so the registration stays as it is.');
    }
  }

  /**
   * Check a registration against the reference lists and the calendar, on the
   * server's own day, and put it in the shape it is stored in. The form
   * checked the same rules; this is the authority.
   */
  async prepare(body: GuestBody, window: GuestStayWindow): Promise<GuestValues> {
    const stay = guestStayProblem({ arrivalOn: body.arrivalOn, departureOn: body.departureOn, today: this.today(), window });
    if (stay) throw fieldError([stay.path], stay.message);

    const nationality = body.nationality;
    if (!(await this.guests.countryName(nationality))) throw fieldError(['nationality'], 'Pick their nationality.');

    const idProblem = guestIdProblem({ nationality, idKind: body.idKind, idNumber: body.idNumber });
    if (idProblem) throw fieldError([idProblem.path], idProblem.message);
    const id = guestIdOf({ nationality, idKind: body.idKind, idNumber: body.idNumber });

    const relation = await this.guests.relationship(body.relationship);
    if (!relation) throw fieldError(['relationship'], 'Pick who they are to you.');
    const other = body.relationshipOther?.trim() ?? '';
    if (relation.needsDetail && other.length < 2) {
      throw fieldError(['relationshipOther'], 'Say who they are to you, in a few words.');
    }

    let originCountry: string;
    let originVillageId: number | null = null;
    if (body.origin.kind === 'village') {
      if (!(await this.guests.villagePath(body.origin.villageId))) throw fieldError(['origin'], 'Pick the village they come from.');
      originCountry = 'RW';
      originVillageId = body.origin.villageId;
    } else {
      if (body.origin.countryCode === 'RW' || !(await this.guests.countryName(body.origin.countryCode))) {
        throw fieldError(['origin'], 'Pick the country they come from.');
      }
      originCountry = body.origin.countryCode;
    }

    return {
      fullName: body.fullName.trim(),
      phone: body.phone,
      nationality,
      idKind: id.idKind,
      idNumber: id.idNumber,
      relationship: relation.code,
      relationshipOther: relation.needsDetail || relation.code === OTHER_RELATIONSHIP ? other || null : null,
      originCountry,
      originVillageId,
      arrivalOn: body.arrivalOn,
      departureOn: body.departureOn,
    };
  }

  /** File a registration and its routes, with the audit and outbox rows, then email the leaders. */
  /**
   * A stay business's guest, filed at check in (2026-10-29): Rwandan law makes an accommodation keep a
   * record of every guest for the authorities, and the leaders of the place (and DGIE for a guest from
   * abroad) read it the same way they read a tenant's guest. One registration per stay; a check in that
   * is retried files nothing twice. Returns null, and files nothing, when the desk did not record the
   * nationality and a phone, the two facts the leaders need.
   */
  async fileStayGuest(input: {
    workspaceId: string;
    propertyId: string;
    guestStayId: string;
    userId: string;
    fullName: string;
    phone: string | null;
    nationality: string | null;
    idKind: 'national_id' | 'passport' | null;
    idNumber: string | null;
    arrivalOn: string;
    departureOn: string;
  }): Promise<string | null> {
    if (!input.nationality || !input.phone) return null;
    if (await this.guests.stayRegistered(input.guestStayId)) return null;
    const home = await this.guests.buildingHome(input.workspaceId, input.propertyId, null);
    if (!home) return null;
    if (!(await this.guests.countryName(input.nationality))) return null;
    // A document the desk typed in a shape the registry does not hold is left off rather than refusing the guest.
    const typed = { nationality: input.nationality, idKind: input.idKind, idNumber: input.idNumber };
    const id = guestIdProblem(typed) ? { idKind: null, idNumber: null } : guestIdOf(typed);
    const departureOn = input.departureOn > input.arrivalOn ? input.departureOn : addDays(input.arrivalOn, 1);
    return this.file(
      home,
      {
        fullName: input.fullName.trim(),
        phone: input.phone,
        nationality: input.nationality,
        idKind: id.idKind,
        idNumber: id.idNumber,
        relationship: STAY_RELATIONSHIP,
        relationshipOther: null,
        originCountry: input.nationality,
        originVillageId: null,
        arrivalOn: input.arrivalOn,
        // The leaders' record spans at most 90 days; a longer stay is filed again as it runs on (the sweep).
        departureOn: departureOn < addDays(input.arrivalOn, 90) ? departureOn : addDays(input.arrivalOn, 90),
      },
      { hostKind: 'hotel', leaseId: null, userId: input.userId, guestStayId: input.guestStayId },
    );
  }

  private async file(
    home: HomeRow,
    values: GuestValues,
    host: { hostKind: GuestHostKind; leaseId: string | null; userId: string; guestStayId?: string },
  ): Promise<string> {
    const now = this.now();
    const area = { villageId: home.villageId, cellId: home.cellId, sectorId: home.sectorId, districtId: home.districtId, provinceId: home.provinceId ?? null };
    const id = await this.guests.transaction(async (tx) => {
      const routes = await this.routing.plan(area, values.nationality, tx);
      const registrationId = await this.guests.insertRegistration(tx, {
        ...values,
        orgId: home.orgId,
        workspaceId: home.workspaceId,
        hostKind: host.hostKind,
        leaseId: host.leaseId,
        propertyId: home.propertyId,
        unitId: home.unitId,
        guestStayId: host.guestStayId ?? null,
        registeredByUserId: host.userId,
        area,
      });
      await this.guests.insertRoutes(tx, registrationId, routes, now);
      await this.guests.audit(tx, {
        actorUserId: host.userId,
        registrationId,
        eventType: 'guest_registration.filed',
        diff: {
          hostKind: host.hostKind,
          leaseId: host.leaseId,
          propertyId: home.propertyId,
          arrivalOn: values.arrivalOn,
          departureOn: values.departureOn,
          fromAbroad: values.nationality !== 'RW',
          waiting: routes.filter((r) => !r.assignmentId).map((r) => r.role),
        },
        districtId: area.districtId,
      });
      await this.guests.outbox(tx, {
        eventType: 'guest.registered',
        registrationId,
        workspaceId: home.workspaceId,
        change: 'filed',
        payload: { propertyId: home.propertyId, leaseId: host.leaseId, districtId: area.districtId },
      });
      return registrationId;
    });
    void this.routing.notify(id, false);
    return id;
  }

  private async change(row: RegistrationRow, home: HomeRow, values: GuestValues, userId: string): Promise<void> {
    const now = this.now();
    const area = { villageId: home.villageId, cellId: home.cellId, sectorId: home.sectorId, districtId: home.districtId, provinceId: home.provinceId ?? null };
    await this.guests.transaction(async (tx) => {
      const routes = await this.routing.plan(area, values.nationality, tx);
      await this.guests.updateRegistration(tx, row.id, { ...values, propertyId: home.propertyId, unitId: home.unitId, area }, routes, now);
      await this.guests.audit(tx, {
        actorUserId: userId,
        registrationId: row.id,
        eventType: 'guest_registration.changed',
        diff: { changed: changedFields(row, values, home) },
        districtId: area.districtId,
      });
    });
    void this.routing.notify(row.id, true);
  }

  private async cancelRow(row: RegistrationRow, userId: string): Promise<void> {
    this.assertChangeable(row);
    await this.guests.transaction(async (tx) => {
      if (!(await this.guests.cancel(tx, row.id, userId, this.now()))) {
        throw new ConflictException('This guest registration is cancelled.');
      }
      await this.guests.audit(tx, { actorUserId: userId, registrationId: row.id, eventType: 'guest_registration.cancelled', districtId: row.districtId });
    });
  }
}

/** Which fields a change touched, by name only: never the values (an ID number stays out of the audit). */
function changedFields(row: RegistrationRow, v: GuestValues, home: HomeRow): string[] {
  const out: string[] = [];
  if (row.fullName !== v.fullName) out.push('fullName');
  if (row.phone !== v.phone) out.push('phone');
  if (row.nationality !== v.nationality) out.push('nationality');
  if (row.idKind !== v.idKind || row.idNumber !== v.idNumber) out.push('id');
  if (row.relationship !== v.relationship || row.relationshipOther !== v.relationshipOther) out.push('relationship');
  if (row.originCountry !== v.originCountry || row.originVillageId !== v.originVillageId) out.push('origin');
  if (row.arrivalOn !== v.arrivalOn || row.departureOn !== v.departureOn) out.push('dates');
  if (row.propertyId !== home.propertyId || row.unitId !== home.unitId) out.push('home');
  return out;
}
