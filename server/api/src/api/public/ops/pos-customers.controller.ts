import {
  AttachCustomerRequest,
  CreateCustomerRequest,
  CustomerListQuery,
  EraseCustomerRequest,
  MergeCustomersRequest,
  UpdateCustomerRequest,
  type CustomerExport,
  type CustomerList,
  type CustomerProfile,
  type PosOrder,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';

import { PosCustomerService } from '../../../modules/pos/application/pos-customer.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Customers of the bar and restaurant -> /api/v1/ops/pos/customers (CRM, phase 1).
 *
 * Who may do what, decided here and again by the service:
 *  - READ (`customer.view` or `customer.manage`): find a customer and open their profile. Without
 *    `customer.manage` the phone and email come back masked and the book can only be searched, never listed.
 *  - REGISTER and CORRECT (`customer.manage`): create, edit, note, record marketing consent.
 *  - MERGE, EXPORT and ERASE (`customer.admin`): the data-protection acts; owner and manager.
 *  - PUT an order's customer (`pos.sell`, and the service wants `customer.view` too): who a bill is for.
 *
 * A customer belongs to the business: the service filters every query by the caller's workspace, and another
 * business's customer is a 404. Nothing here deletes anything.
 *
 * POS's, like every other `ops/pos` controller (ADR-076 G10): refused where POS is switched off. No route
 * here takes a payment; the orders and payments they touch are already POS's.
 */
@Controller({ path: 'ops/pos', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('pos')
export class OpsPosCustomersController {
  constructor(private readonly customers: PosCustomerService) {}

  @Get('customers')
  @RequireAnyPermission('customer.view', 'customer.manage')
  list(
    @Query(new ZodValidationPipe(CustomerListQuery)) query: CustomerListQuery,
    @CurrentWorkspace() ws: ScopedWorkspace,
  ): Promise<CustomerList> {
    return this.customers.list(ws, query);
  }

  @Post('customers')
  @RequirePermission('customer.manage')
  create(
    @Body(new ZodValidationPipe(CreateCustomerRequest)) body: CreateCustomerRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<CustomerProfile> {
    return this.customers.create(ws, body, user.id);
  }

  @Get('customers/:customerId')
  @RequireAnyPermission('customer.view', 'customer.manage')
  one(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentWorkspace() ws: ScopedWorkspace,
  ): Promise<CustomerProfile> {
    return this.customers.get(ws, customerId);
  }

  @Patch('customers/:customerId')
  @RequirePermission('customer.manage')
  update(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body(new ZodValidationPipe(UpdateCustomerRequest)) body: UpdateCustomerRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<CustomerProfile> {
    return this.customers.update(ws, customerId, body, user.id);
  }

  @Post('customers/:customerId/merge')
  @HttpCode(200)
  @RequirePermission('customer.admin')
  merge(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body(new ZodValidationPipe(MergeCustomersRequest)) body: MergeCustomersRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<CustomerProfile> {
    return this.customers.merge(ws, customerId, body, user.id);
  }

  @Post('customers/:customerId/erase')
  @HttpCode(200)
  @RequirePermission('customer.admin')
  erase(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body(new ZodValidationPipe(EraseCustomerRequest)) body: EraseCustomerRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<{ erased: true }> {
    return this.customers.erase(ws, customerId, body, user.id);
  }

  @Get('customers/:customerId/export')
  @RequirePermission('customer.admin')
  export(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<CustomerExport> {
    return this.customers.export(ws, customerId, user.id);
  }

  /** Who a bill is for. `customerId: null` takes the customer off again. */
  @Put('orders/:orderId/customer')
  @RequirePermission('pos.sell')
  attach(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body(new ZodValidationPipe(AttachCustomerRequest)) body: AttachCustomerRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosOrder> {
    return this.customers.attach(ws, orderId, body, user.id);
  }
}
