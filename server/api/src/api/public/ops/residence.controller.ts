import {
  AdvanceLeaseRequest,
  AdvanceTicketRequest,
  RaiseTicketRequest,
  type OperatorDepositList,
  type OperatorDeposit,
  type OperatorFilingList,
  type OperatorLease,
  type OperatorLeaseList,
  type OperatorRentCharge,
  type OperatorRentRoll,
  type OperatorTicket,
  type OperatorTicketList,
  RecordRentRequest,
  ReturnDepositRequest,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ResidenceService } from '../../../modules/operations/application/residence.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { IdempotencyKey } from '../../../shared/http/idempotency-key';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Tenancies → /api/v1/ops/leases (ADR-012 step 5).
 *
 * Two of the four commands here move money, and both take an `Idempotency-Key`
 * (AC-14). A landlord's office on a patchy connection retries, and a retried
 * rent payment recorded twice is a tenant told they owe nothing when they do.
 */
@Controller({ path: 'ops/leases', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsLeasesController {
  constructor(private readonly residence: ResidenceService) {}

  // Leases, the lease record and Move-outs: whoever advances a lease, records
  // its rent or returns its deposit.
  @Get()
  @RequireAnyPermission('lease.advance', 'rent.record', 'deposit.return')
  async list(
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorLeaseList> {
    return { leases: await this.residence.listLeases(workspace) };
  }

  /**
   * Move a lease one step along its lifecycle.
   *
   * The body names the state it means to reach rather than saying "next". A
   * bare "next" cannot tell a double click from a genuine second step, and the
   * second click would end a lease that was only meant to go active.
   */
  @Post(':id/advance')
  @RequirePermission('lease.advance')
  advance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdvanceLeaseRequest)) body: AdvanceLeaseRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorLease> {
    return this.residence.advanceLease(workspace, id, body);
  }

  /**
   * Record a rent payment for one named month (AC-14).
   *
   * The month is required. "Apply it to the oldest unpaid month" sounds helpful
   * and is the source of the worst disputes in rent collection: the tenant
   * meant this month, the system took last month, and neither side can see why.
   */
  @Post(':id/rent')
  @RequirePermission('rent.record')
  recordRent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RecordRentRequest)) body: RecordRentRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @IdempotencyKey() key: string,
  ): Promise<OperatorRentCharge> {
    return this.residence.recordRent(workspace, id, body, key);
  }
}

/**
 * The rent roll → /api/v1/ops/rent-roll.
 *
 * Its own controller so the ADR's path survives exactly. A Nest controller
 * carries one prefix, and folding this under `ops/leases` would have renamed a
 * route the decision named.
 */
@Controller({ path: 'ops/rent-roll', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsRentRollController {
  constructor(private readonly residence: ResidenceService) {}

  // Money owed by named tenants: whoever records rent, or reads the money.
  // The landlord's mobile app reads it as the owner.
  @Get()
  @RequireAnyPermission('rent.record', 'money.view')
  async list(
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorRentRoll> {
    return { charges: await this.residence.listRentRoll(workspace) };
  }
}

/**
 * Contract filings → /api/v1/ops/filings (F-R10).
 *
 * Its own controller for the same reason the rent roll has one: a Nest
 * controller carries one prefix, and folding this under `ops/leases` would
 * have made the path `/ops/leases/filings`, which reads as a filing belonging
 * to no lease in particular.
 *
 * Read only, and it will stay read only. Nothing here files anything: the
 * filing itself is a background job against a tax administration channel that
 * does not exist yet (F-R10 §11, open question O-4). This lens shows what the
 * platform owes and what it has done, which is the half that can be true today.
 */
@Controller({ path: 'ops/filings', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsFilingsController {
  constructor(private readonly residence: ResidenceService) {}

  // The Filings lens on Finance. The same people who hold the leases or read
  // the money: filing status is a compliance obligation of the business, not a
  // desk task.
  @Get()
  @RequireAnyPermission('lease.advance', 'money.view')
  async list(
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorFilingList> {
    return { filings: await this.residence.listContractFilings(workspace) };
  }
}

/**
 * Maintenance tickets → /api/v1/ops/tickets (ADR-012 step 5).
 *
 * **Residence only**, and that is the schema's call rather than a scoping
 * choice: `maintenance_tickets.lease_id` is NOT NULL, so a ticket cannot exist
 * without a lease and a hotel has none. A hospitality maintenance ticket needs
 * its own table and its own decision.
 */
@Controller({ path: 'ops/tickets', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsTicketsController {
  constructor(private readonly residence: ResidenceService) {}

  // The Maintenance leaf, on both navs, is behind `ticket.advance`.
  @Get()
  @RequirePermission('ticket.advance')
  async list(
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorTicketList> {
    return { tickets: await this.residence.listTickets(workspace) };
  }

  /**
   * Resolve a ticket, with the note that says what was done.
   *
   * `to` is optional and defaults to `resolved`, which is what every caller
   * meant while `maintenance_status` held only two values. ADR-016 widened it
   * to six, so a ticket can now be picked up and worked before it closes.
   *
   * The note stays required: `maintenance_events` is the only record of WHY a
   * ticket moved, and one that closed for no stated reason is the one a tenant
   * reopens next week.
   */
  @Post(':id/advance')
  @RequirePermission('ticket.advance')
  advance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdvanceTicketRequest))
    body: AdvanceTicketRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorTicket> {
    return this.residence.advanceTicket(workspace, id, body, user.id);
  }

  /**
   * Raise a work order (ADR-016 slice 6, AC-11).
   *
   * New here, and it could not have existed before: `lease_id` was NOT NULL, so
   * a hotel had no way to make one. Name a room for a hospitality ticket or a
   * lease for a residence one; the database refuses a ticket that names
   * neither, because a work order nobody can locate is worse than none.
   *
   * `ticket.advance` rather than a new permission. It is the same board and the
   * same people, and a housekeeper who can close a ticket can raise one.
   */
  @Post()
  @RequirePermission('ticket.advance')
  raise(
    @Body(new ZodValidationPipe(RaiseTicketRequest)) body: RaiseTicketRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorTicket> {
    return this.residence.raiseTicket(workspace, body, user.id);
  }
}

/**
 * Caution deposits → /api/v1/ops/deposits (ADR-012 step 5).
 */
@Controller({ path: 'ops/deposits', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsDepositsController {
  constructor(private readonly residence: ResidenceService) {}

  // Move-outs, the rent roll's deposit column and the lease record.
  @Get()
  @RequireAnyPermission('deposit.return', 'lease.advance', 'money.view')
  async list(
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorDepositList> {
    return { deposits: await this.residence.listDeposits(workspace) };
  }

  /**
   * Return a deposit, in whole or in part (AC-14).
   *
   * Both halves are sent explicitly and the server checks they add up to what
   * was held. Deriving the remainder would hide an arithmetic mistake instead
   * of refusing it, and this is the exact figure a tenant disputes.
   */
  @Post(':id/return')
  @RequirePermission('deposit.return')
  returnDeposit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ReturnDepositRequest))
    body: ReturnDepositRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @IdempotencyKey() key: string,
  ): Promise<OperatorDeposit> {
    return this.residence.returnDeposit(workspace, id, body, key);
  }
}
