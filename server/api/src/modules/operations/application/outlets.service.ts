import {
  OutletAddress,
  type CreateOutletPartyRequest,
  type CreateOutletRequest,
  type OperatorOutlet,
  type OperatorOutletList,
  type OutletParty,
  type OutletPartyList,
  type OutletRelationshipType,
  type UpdateOutletPartyRequest,
  type UpdateOutletRequest,
  type WorkspaceAccess,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import {
  allowedRelationshipsFor,
  disallowedPairSentence,
  firstFreeSlug,
  readRelationshipPolicy,
  type RelationshipPolicy,
  slugBase,
  taxEntityFor,
} from '../domain/outlet-rules';
import {
  type OutletRow,
  OutletUniqueViolation,
  type OutletValues,
  OutletsRepository,
  type PartyRow,
  type TenancyRow,
} from '../infrastructure/outlets.repository';

/** How many times a standalone slug is re-minted when a concurrent create takes it. */
const SLUG_ATTEMPTS = 5;

/**
 * Outlets and the parties that run and own them (ADR-050 slice 4, tasks 21
 * and 22).
 *
 * The one thing to read twice: **`tax_entity_org_id` is decided here and never
 * accepted from a client** (D-j). It is whose TIN signs every sale the outlet
 * makes, it is copied onto each charge and order at write time, and once a sale
 * has been signed it may not move.
 *
 * Scope held back on purpose, and refused with a sentence rather than half
 * built: an outlet OPERATED BY ANOTHER BUSINESS needs the tenancy flow (task
 * 26), which waits on a decision about whose workspace that row lives in.
 */
@Injectable()
export class OutletsService {
  constructor(private readonly outlets: OutletsRepository) {}

  // --- Outlets ---------------------------------------------------------------

  async list(ws: WorkspaceAccess): Promise<OperatorOutletList> {
    const [rows, policy] = await Promise.all([
      this.outlets.listOutlets(ws.workspaceId),
      this.policy(),
    ]);
    const tenancies = await this.outlets.openTenancies(rows.map((r) => r.id));
    const byOutlet = new Map(tenancies.map((t) => [t.outletId, t]));
    return {
      outlets: rows.map((row) => this.present(row, policy, byOutlet.get(row.id) ?? null)),
      relationshipPolicy: policy,
    };
  }

  async create(ws: WorkspaceAccess, body: CreateOutletRequest): Promise<OperatorOutlet> {
    const orgId = this.businessOrg(ws);
    const property = body.propertyId
      ? assertOwned(await this.outlets.findProperty(body.propertyId), ws)
      : null;
    await this.ownedDepartment(ws, body.departmentId, property?.id ?? null);
    if (!property && !body.address) {
      throw new UnprocessableEntityException(
        'An outlet with no property needs an address, so guests can find it and its hours have a clock.',
      );
    }

    const policy = await this.policy();
    this.assertPairAllowed(policy, body.outletKind, body.relationshipType);
    const parties = await this.resolveParties(ws, orgId, {
      relationshipType: body.relationshipType,
      operatorPartyId: body.operatorPartyId ?? null,
      ownerPartyId: body.ownerPartyId ?? null,
    });
    if (body.amenityCode) {
      await this.assertAmenity(property?.id ?? null, body.amenityCode);
    }

    const taxEntityOrgId = this.taxEntity({
      relationshipType: body.relationshipType,
      propertyOrgId: property?.orgId ?? null,
      workspaceOrgId: orgId,
      operatorOrgId: parties.operator.orgId,
    });

    const values: Omit<OutletValues, 'slug'> = {
      name: body.name,
      departmentId: body.departmentId,
      outletKind: body.outletKind,
      propertyId: property?.id ?? null,
      relationshipType: body.relationshipType,
      operatorPartyId: parties.operator.id,
      ownerPartyId: parties.owner.id,
      taxEntityOrgId,
      orderingAccess: body.orderingAccess,
      amenityCode: body.amenityCode ?? null,
      rraBranchId: body.rraBranchId ?? '00',
      guestVisible: body.guestVisible ?? true,
      address: body.address ?? null,
      hours: body.hours ?? null,
      sortOrder: body.sortOrder ?? 0,
    };

    const id = await this.insertWithSlug(ws.workspaceId, values, property === null);
    return this.one(ws, id, policy);
  }

  async update(
    ws: WorkspaceAccess,
    id: string,
    patch: UpdateOutletRequest,
  ): Promise<OperatorOutlet> {
    const orgId = this.businessOrg(ws);
    const current = assertOwned(await this.outlets.findOutlet(id), ws);
    if (current.status === 'archived') {
      throw new ConflictException('That outlet is archived. Create a new one instead of changing it.');
    }

    const next = {
      departmentId: patch.departmentId ?? current.departmentId,
      outletKind: patch.outletKind ?? current.outletKind,
      relationshipType: patch.relationshipType ?? current.relationshipType,
      operatorPartyId:
        patch.operatorPartyId === undefined ? current.operatorPartyId : patch.operatorPartyId,
      ownerPartyId: patch.ownerPartyId === undefined ? current.ownerPartyId : patch.ownerPartyId,
      amenityCode: patch.amenityCode === undefined ? current.amenityCode : patch.amenityCode,
      address: patch.address === undefined ? current.address : patch.address,
    };

    if (patch.departmentId !== undefined) {
      await this.ownedDepartment(ws, next.departmentId, current.propertyId);
    }
    if (current.propertyId === null && next.address === null) {
      throw new UnprocessableEntityException(
        'An outlet with no property keeps its address. Change it rather than clearing it.',
      );
    }

    const policy = await this.policy();
    const arrangementTouched =
      patch.outletKind !== undefined ||
      patch.relationshipType !== undefined ||
      patch.operatorPartyId !== undefined ||
      patch.ownerPartyId !== undefined;

    const values: Partial<OutletValues> = {};
    if (arrangementTouched) {
      // Re checked only when the arrangement itself changes, so a later
      // tightening of the config row never blocks renaming an outlet.
      this.assertPairAllowed(policy, next.outletKind, next.relationshipType);
      const parties = await this.resolveParties(ws, orgId, next);
      const property = current.propertyId
        ? await this.outlets.findProperty(current.propertyId)
        : null;
      const taxEntityOrgId = this.taxEntity({
        relationshipType: next.relationshipType,
        propertyOrgId: property?.orgId ?? null,
        workspaceOrgId: orgId,
        operatorOrgId: parties.operator.orgId,
      });
      if (taxEntityOrgId !== current.taxEntityOrgId && (await this.outlets.hasSignedSale(current.id))) {
        throw new ConflictException(
          'This outlet has signed sales under its current taxpayer, so that cannot change. Archive it and create a new outlet for the new arrangement.',
        );
      }
      Object.assign(values, {
        outletKind: next.outletKind,
        relationshipType: next.relationshipType,
        operatorPartyId: parties.operator.id,
        ownerPartyId: parties.owner.id,
        taxEntityOrgId,
      });
    }

    if (patch.amenityCode !== undefined) {
      if (next.amenityCode !== null) await this.assertAmenity(current.propertyId, next.amenityCode);
      values.amenityCode = next.amenityCode;
    }
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.departmentId !== undefined) values.departmentId = patch.departmentId;
    if (patch.orderingAccess !== undefined) values.orderingAccess = patch.orderingAccess;
    if (patch.hours !== undefined) values.hours = patch.hours;
    if (patch.address !== undefined) values.address = patch.address;
    if (patch.rraBranchId !== undefined) values.rraBranchId = patch.rraBranchId;
    if (patch.guestVisible !== undefined) values.guestVisible = patch.guestVisible;
    if (patch.sortOrder !== undefined) values.sortOrder = patch.sortOrder;

    try {
      await this.outlets.updateOutlet(current.id, values);
    } catch (e) {
      throw this.uniqueConflict(e);
    }
    return this.one(ws, current.id, policy);
  }

  /**
   * Archive an outlet. Never deleted: its charges, orders and invoices name it.
   *
   * Refused while a tenancy is active, because the host's page lists it and
   * guests may be charging it to a room. End the tenancy first.
   */
  async archive(ws: WorkspaceAccess, id: string): Promise<OperatorOutlet> {
    const current = assertOwned(await this.outlets.findOutlet(id), ws);
    if (current.status !== 'archived') {
      if (await this.outlets.hasActiveTenancy(current.id)) {
        throw new ConflictException(
          'This outlet has an active tenancy. End the tenancy before archiving the outlet.',
        );
      }
      await this.outlets.archiveOutlet(current.id);
    }
    return this.one(ws, current.id, await this.policy());
  }

  // --- Parties ---------------------------------------------------------------

  async listParties(ws: WorkspaceAccess): Promise<OutletPartyList> {
    if (ws.orgId) await this.outlets.ensureOwnParty({ workspaceId: ws.workspaceId, orgId: ws.orgId });
    const rows = await this.outlets.listParties(ws.workspaceId, ws.orgId);
    return { parties: rows.map((row) => this.presentParty(ws, row)) };
  }

  async createParty(ws: WorkspaceAccess, body: CreateOutletPartyRequest): Promise<OutletParty> {
    this.businessOrg(ws);
    const tin = await this.reconcileTin(body.orgId ?? null, body.tin ?? null);
    let id: string;
    try {
      id = await this.outlets.insertParty({
        workspaceId: ws.workspaceId,
        orgId: body.orgId ?? null,
        legalName: body.legalName,
        tin,
        contactName: body.contactName ?? null,
        contactPhone: body.contactPhone ?? null,
        contactEmail: body.contactEmail ?? null,
      });
    } catch (e) {
      throw await this.partyConflict(e, body.orgId ?? null);
    }
    return this.presentParty(ws, await this.partyOrVanished(id));
  }

  async updateParty(
    ws: WorkspaceAccess,
    id: string,
    patch: UpdateOutletPartyRequest,
  ): Promise<OutletParty> {
    const party = this.assertPartyReachable(ws, await this.outlets.findParty(id));
    const isOwn = party.orgId !== null && party.orgId === ws.orgId;

    if (patch.orgId !== undefined && isOwn && patch.orgId !== party.orgId) {
      throw new UnprocessableEntityException(
        'This is your own business on record. It cannot be pointed at another business.',
      );
    }
    if (patch.status === 'archived' && party.status !== 'archived') {
      if (isOwn) {
        throw new ConflictException(
          'Your own business runs every hotel operated outlet, so it cannot be archived.',
        );
      }
      if (await this.outlets.partyInUse(party.id)) {
        throw new ConflictException(
          'An active outlet names this party. Change or archive that outlet first.',
        );
      }
    }

    const orgId = patch.orgId === undefined ? party.orgId : patch.orgId;
    const values: Partial<Omit<PartyRow, 'id' | 'workspaceId'>> = {};
    if (patch.orgId !== undefined || patch.tin !== undefined) {
      values.orgId = orgId;
      // A new org with no TIN sent takes the org's own; the old party TIN
      // belonged to whatever the row named before.
      const tin = patch.tin ?? (patch.orgId !== undefined ? null : party.tin);
      values.tin = await this.reconcileTin(orgId, tin);
    }
    if (patch.legalName !== undefined) values.legalName = patch.legalName;
    if (patch.contactName !== undefined) values.contactName = patch.contactName;
    if (patch.contactPhone !== undefined) values.contactPhone = patch.contactPhone;
    if (patch.contactEmail !== undefined) values.contactEmail = patch.contactEmail;
    if (patch.status !== undefined) values.status = patch.status;

    try {
      await this.outlets.updateParty(party.id, values);
    } catch (e) {
      throw await this.partyConflict(e, orgId);
    }
    return this.presentParty(ws, await this.partyOrVanished(party.id));
  }

  // --- Rules -----------------------------------------------------------------

  private async policy(): Promise<RelationshipPolicy> {
    return readRelationshipPolicy(await this.outlets.relationshipPolicyValue(new Date()));
  }

  /** AC-14: the pair comes from config, and an unreadable row allows only the hotel. */
  private assertPairAllowed(
    policy: RelationshipPolicy,
    outletKind: string,
    relationship: OutletRelationshipType,
  ): void {
    const allowed = allowedRelationshipsFor(policy, outletKind);
    if (!allowed.includes(relationship)) {
      throw new UnprocessableEntityException(
        disallowedPairSentence(outletKind, relationship, allowed),
      );
    }
  }

  /**
   * Who runs the outlet and who owns it (D-h).
   *
   * `hotel_operated`: the business's own party runs it, created once per org;
   * the owner defaults to the same row. Anything else: the operator must be a
   * party with an Injishi org, and today that org must be THIS business,
   * because an outlet run by another business needs the tenancy flow.
   */
  private async resolveParties(
    ws: WorkspaceAccess,
    orgId: string,
    input: {
      relationshipType: OutletRelationshipType;
      operatorPartyId: string | null;
      ownerPartyId: string | null;
    },
  ): Promise<{ operator: PartyRow; owner: PartyRow }> {
    const own = await this.outlets.ensureOwnParty({ workspaceId: ws.workspaceId, orgId });

    let operator: PartyRow;
    if (input.relationshipType === 'hotel_operated') {
      if (input.operatorPartyId && input.operatorPartyId !== own.id) {
        throw new UnprocessableEntityException(
          'A hotel operated outlet is run by this business itself. Choose another arrangement to name a different operator.',
        );
      }
      operator = own;
    } else {
      if (!input.operatorPartyId) {
        throw new UnprocessableEntityException(
          'An outlet that is not hotel operated must name who runs it.',
        );
      }
      operator = await this.activeParty(ws, input.operatorPartyId, 'operator');
      if (!operator.orgId) {
        throw new UnprocessableEntityException(
          `${operator.legalName} is not a business registered on Injishi, so it cannot run an outlet here: nothing it sold could be signed.`,
        );
      }
      if (operator.orgId !== orgId) {
        throw new UnprocessableEntityException(
          `An outlet run by another business, such as ${operator.legalName}, needs a tenancy between the two businesses, and tenancies are not available yet.`,
        );
      }
    }

    const owner = input.ownerPartyId
      ? await this.activeParty(ws, input.ownerPartyId, 'owner')
      : operator;
    return { operator, owner };
  }

  private async activeParty(
    ws: WorkspaceAccess,
    id: string,
    role: 'operator' | 'owner',
  ): Promise<PartyRow> {
    const party = await this.outlets.findParty(id);
    if (!party || !this.partyReachable(ws, party)) {
      throw new UnprocessableEntityException(`That ${role} is not a party this business has on record.`);
    }
    if (party.status !== 'active') {
      throw new UnprocessableEntityException(`${party.legalName} is archived and cannot be named as ${role}.`);
    }
    return party;
  }

  private async ownedDepartment(
    ws: WorkspaceAccess,
    departmentId: string,
    propertyId: string | null,
  ) {
    const department = await this.outlets.findDepartment(departmentId);
    if (!department || department.workspaceId !== ws.workspaceId) {
      throw new UnprocessableEntityException('That department is not one of this business\'s departments.');
    }
    if (department.status !== 'active') {
      throw new UnprocessableEntityException('That department is archived.');
    }
    if (department.propertyId !== null && department.propertyId !== propertyId) {
      throw new UnprocessableEntityException(
        propertyId === null
          ? 'An outlet with no property belongs to a business wide department, not one of a property\'s.'
          : 'That department belongs to a different property.',
      );
    }
    return department;
  }

  /** D-k: the amenity must be one this property lists. */
  private async assertAmenity(propertyId: string | null, amenityCode: string): Promise<void> {
    if (propertyId === null) {
      throw new UnprocessableEntityException(
        'Only an outlet at a property can be one of that property\'s amenities.',
      );
    }
    if (!(await this.outlets.propertyHasAmenity(propertyId, amenityCode))) {
      throw new UnprocessableEntityException(
        `This property does not list the amenity "${amenityCode}". Add it to the property first.`,
      );
    }
  }

  private taxEntity(input: Parameters<typeof taxEntityFor>[0]): string {
    const org = taxEntityFor(input);
    if (!org) {
      throw new UnprocessableEntityException('Nobody could sign this outlet\'s sales, so it cannot be saved.');
    }
    return org;
  }

  /**
   * An org party's TIN is the org's TIN (value sourcing, party row). A
   * disagreement is refused rather than resolved, because one of the two is a
   * typo and only a person knows which.
   */
  private async reconcileTin(orgId: string | null, tin: string | null): Promise<string | null> {
    if (!orgId) return tin;
    const org = await this.outlets.findOrg(orgId);
    if (!org) {
      throw new UnprocessableEntityException('No business on Injishi has that id.');
    }
    if (tin && org.tin && tin !== org.tin) {
      throw new UnprocessableEntityException(
        `That TIN does not match ${org.legalName}'s TIN on Injishi. Check the number, or leave it out to use theirs.`,
      );
    }
    return org.tin ?? tin;
  }

  private businessOrg(ws: WorkspaceAccess): string {
    if (!ws.orgId) {
      throw new UnprocessableEntityException('Only a business workspace runs outlets.');
    }
    return ws.orgId;
  }

  /**
   * A party this workspace recorded, or its own business's row wherever that
   * was recorded. Anything else is 404, the `assertOwned` answer.
   */
  private partyReachable(ws: WorkspaceAccess, party: PartyRow): boolean {
    return party.workspaceId === ws.workspaceId || (party.orgId !== null && party.orgId === ws.orgId);
  }

  private assertPartyReachable(ws: WorkspaceAccess, party: PartyRow | null): PartyRow {
    if (!party || !this.partyReachable(ws, party)) throw new NotFoundException();
    return party;
  }

  private async insertWithSlug(
    workspaceId: string,
    values: Omit<OutletValues, 'slug'>,
    standalone: boolean,
  ): Promise<string> {
    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      let slug: string | null = null;
      if (standalone) {
        const base = slugBase(values.name);
        slug = firstFreeSlug(base, await this.outlets.slugsLike(base));
      }
      try {
        return await this.outlets.insertOutlet(workspaceId, { ...values, slug });
      } catch (e) {
        // A concurrent create took the same slug between the read and the write.
        if (e instanceof OutletUniqueViolation && e.constraint === 'outlets_slug_uk') continue;
        throw this.uniqueConflict(e);
      }
    }
    throw new ConflictException('Could not mint a unique address for this outlet. Try a slightly different name.');
  }

  private uniqueConflict(e: unknown): unknown {
    if (!(e instanceof OutletUniqueViolation)) return e;
    if (e.constraint === 'outlets_property_amenity_uk') {
      return new ConflictException(
        'That amenity already has an outlet at this property. One amenity has at most one outlet.',
      );
    }
    return new ConflictException('That clashes with an outlet that already exists.');
  }

  private async partyConflict(e: unknown, orgId: string | null): Promise<unknown> {
    if (!(e instanceof OutletUniqueViolation)) return e;
    const existing = orgId ? await this.outlets.findPartyByOrg(orgId) : null;
    return new ConflictException(
      existing
        ? `That business is already on record as ${existing.legalName}.`
        : 'That party is already on record.',
    );
  }

  private async partyOrVanished(id: string): Promise<PartyRow> {
    const row = await this.outlets.findParty(id);
    if (!row) throw this.vanished();
    return row;
  }

  private async one(ws: WorkspaceAccess, id: string, policy: RelationshipPolicy): Promise<OperatorOutlet> {
    const row = await this.outlets.findOutlet(id);
    if (!row) throw this.vanished();
    const [tenancy] = await this.outlets.openTenancies([row.id]);
    return this.present(assertOwned(row, ws), policy, tenancy ?? null);
  }

  // --- Presentation ----------------------------------------------------------

  private present(row: OutletRow, policy: RelationshipPolicy, tenancy: TenancyRow | null): OperatorOutlet {
    const address = OutletAddress.safeParse(row.address);
    return {
      id: row.id,
      name: row.name,
      outletKind: row.outletKind,
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      propertyId: row.propertyId,
      propertyName: row.propertyName,
      relationshipType: row.relationshipType,
      operatorParty: row.operatorPartyId
        ? { id: row.operatorPartyId, legalName: row.operatorLegalName ?? '', orgId: row.operatorOrgId }
        : null,
      ownerParty: row.ownerPartyId
        ? { id: row.ownerPartyId, legalName: row.ownerLegalName ?? '', orgId: row.ownerOrgId }
        : null,
      taxEntityOrgId: row.taxEntityOrgId,
      orderingAccess: row.orderingAccess,
      amenityCode: row.amenityCode,
      rraBranchId: row.rraBranchId,
      guestVisible: row.guestVisible,
      slug: row.slug,
      address: address.success ? address.data : null,
      hours: row.hours && typeof row.hours === 'object' ? (row.hours as Record<string, unknown>) : null,
      sortOrder: row.sortOrder,
      status: row.status,
      tenancy: tenancy
        ? {
            id: tenancy.id,
            status: tenancy.status,
            hostPropertyId: tenancy.hostPropertyId,
            tenantOrgId: tenancy.tenantOrgId,
          }
        : null,
      allowedRelationships: allowedRelationshipsFor(policy, row.outletKind),
    };
  }

  private presentParty(ws: WorkspaceAccess, row: PartyRow): OutletParty {
    return {
      id: row.id,
      orgId: row.orgId,
      legalName: row.legalName,
      tin: row.tin,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      contactEmail: row.contactEmail,
      status: row.status,
      isOwnOrg: row.orgId !== null && row.orgId === ws.orgId,
    };
  }

  private vanished(): BadRequestException {
    return new BadRequestException(
      'That record changed while we were writing it. Refresh and try again.',
    );
  }
}
