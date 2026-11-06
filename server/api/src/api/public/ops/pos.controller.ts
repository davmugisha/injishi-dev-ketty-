import {
  AddPosLinesRequest,
  AdvancePosTicketRequest,
  ApplyPosDiscountRequest,
  CancelPosOrderRequest,
  CashMovementRequest,
  CloseShiftRequest,
  CreatePosOrderRequest,
  DecideCashMovementRequest,
  DecidePosDiscountRequest,
  MergeSessionsRequest,
  MoveSessionRequest,
  OpenShiftRequest,
  OpenTableSessionRequest,
  PosListQuery,
  PrepStationKind,
  RefundPosPaymentRequest,
  ResolvePosPaymentRequest,
  ReviewShiftRequest,
  SetTableStatusRequest,
  SplitPosOrderRequest,
  TakePosPaymentRequest,
  TransferPosOrderRequest,
  UpdatePosLineRequest,
  UpdatePosOutletSettingsRequest,
  VoidPosLineRequest,
  type PosAuditEvent,
  type PosFloor,
  type PosMenu,
  type PosOrder,
  type PosOrderSummary,
  type PosOutlet,
  type PosRegister,
  type PosShift,
  type PosStation,
  type PosTicket,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { PosFloorService } from '../../../modules/pos/application/pos-floor.service';
import { PosKitchenService } from '../../../modules/pos/application/pos-kitchen.service';
import { PosOrderService } from '../../../modules/pos/application/pos-order.service';
import { PosPaymentService } from '../../../modules/pos/application/pos-payment.service';
import { PosReadService } from '../../../modules/pos/application/pos-read.service';
import { PosShiftService } from '../../../modules/pos/application/pos-shift.service';
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
 * The bar and restaurant point of sale -> /api/v1/ops/pos (POS spec, phase 1).
 *
 * Every route is behind the session and the workspace, with the POS
 * permission that names its act; the services add what a permission cannot
 * say (a sent line needs the override, cash needs the cashier's own open
 * shift, nobody reviews their own drawer). Every read and write is filtered
 * by the caller's branch scope.
 *
 * Every payment is SIMULATED: no provider is contacted by any route here.
 */

/** Outlets, settings, the menu, stations and the floor. */
@Controller({ path: 'ops/pos', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('pos')
export class OpsPosController {
  constructor(
    private readonly read: PosReadService,
    private readonly floor: PosFloorService,
  ) {}

  @Get('outlets')
  @RequireAnyPermission('pos.sell', 'pos.checkout', 'kitchen.work', 'register.operate', 'shift.review', 'outlet.manage')
  outlets(@CurrentWorkspace() ws: ScopedWorkspace): Promise<PosOutlet[]> {
    return this.read.outlets(ws);
  }

  @Patch('outlets/:outletId/settings')
  @RequirePermission('outlet.manage')
  updateSettings(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Body(new ZodValidationPipe(UpdatePosOutletSettingsRequest)) body: UpdatePosOutletSettingsRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosOutlet> {
    return this.read.updateSettings(ws, outletId, body, user.id);
  }

  @Get('outlets/:outletId/menu')
  @RequireAnyPermission('pos.sell', 'pos.checkout')
  menu(@Param('outletId', ParseUUIDPipe) outletId: string, @CurrentWorkspace() ws: ScopedWorkspace): Promise<PosMenu> {
    return this.read.menu(ws, outletId);
  }

  @Get('outlets/:outletId/stations')
  @RequireAnyPermission('pos.sell', 'kitchen.work', 'outlet.manage')
  stations(@Param('outletId', ParseUUIDPipe) outletId: string, @CurrentWorkspace() ws: ScopedWorkspace): Promise<PosStation[]> {
    return this.read.stations(ws, outletId);
  }

  @Get('outlets/:outletId/floor')
  @RequireAnyPermission('pos.sell', 'table.manage', 'pos.checkout')
  floorPlan(@Param('outletId', ParseUUIDPipe) outletId: string, @CurrentWorkspace() ws: ScopedWorkspace): Promise<PosFloor> {
    return this.read.floor(ws, outletId);
  }

  @Post('tables/:tableId/seat')
  @RequirePermission('table.manage')
  seat(
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Body(new ZodValidationPipe(OpenTableSessionRequest)) body: OpenTableSessionRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosFloor> {
    return this.floor.seat(ws, tableId, body, user.id);
  }

  @Post('tables/:tableId/status')
  @HttpCode(200)
  @RequirePermission('table.manage')
  tableStatus(
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Body(new ZodValidationPipe(SetTableStatusRequest)) body: SetTableStatusRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosFloor> {
    return this.floor.setStatus(ws, tableId, body, user.id);
  }

  @Post('sessions/:sessionId/release')
  @HttpCode(200)
  @RequirePermission('table.manage')
  release(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosFloor> {
    return this.floor.release(ws, sessionId, user.id);
  }

  @Post('sessions/:sessionId/move')
  @HttpCode(200)
  @RequirePermission('table.manage')
  move(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body(new ZodValidationPipe(MoveSessionRequest)) body: MoveSessionRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosFloor> {
    return this.floor.move(ws, sessionId, body, user.id);
  }

  @Post('sessions/:sessionId/merge')
  @HttpCode(200)
  @RequirePermission('table.manage')
  merge(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body(new ZodValidationPipe(MergeSessionsRequest)) body: MergeSessionsRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosFloor> {
    return this.floor.merge(ws, sessionId, body, user.id);
  }

  @Get('audit')
  @RequireAnyPermission('money.view', 'shift.review', 'pos.override')
  audit(
    @Query(new ZodValidationPipe(PosListQuery)) query: PosListQuery,
    @CurrentWorkspace() ws: ScopedWorkspace,
  ): Promise<PosAuditEvent[]> {
    return this.read.auditTrail(ws, query);
  }
}

/** Orders, their lines, discounts and the bill. */
@Controller({ path: 'ops/pos/orders', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('pos')
export class OpsPosOrdersController {
  constructor(
    private readonly read: PosReadService,
    private readonly orders: PosOrderService,
    private readonly payments: PosPaymentService,
  ) {}

  @Get()
  @RequireAnyPermission('pos.sell', 'pos.checkout', 'money.view')
  list(
    @Query(new ZodValidationPipe(PosListQuery)) query: PosListQuery,
    @CurrentWorkspace() ws: ScopedWorkspace,
  ): Promise<PosOrderSummary[]> {
    return this.read.orders(ws, query);
  }

  @Get(':orderId')
  @RequireAnyPermission('pos.sell', 'pos.checkout', 'money.view')
  one(@Param('orderId', ParseUUIDPipe) orderId: string, @CurrentWorkspace() ws: ScopedWorkspace): Promise<PosOrder> {
    return this.read.order(ws, orderId);
  }

  @Post()
  @RequirePermission('pos.sell')
  create(
    @Body(new ZodValidationPipe(CreatePosOrderRequest)) body: CreatePosOrderRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<PosOrder> {
    const clientKey = key && /^[A-Za-z0-9_-]{8,100}$/.test(key) ? key : null;
    return this.orders.create(ws, body, user.id, clientKey);
  }

  @Post(':orderId/lines')
  @HttpCode(200)
  @RequirePermission('pos.sell')
  addLines(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body(new ZodValidationPipe(AddPosLinesRequest)) body: AddPosLinesRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosOrder> {
    return this.orders.addLines(ws, orderId, body, user.id);
  }

  @Patch(':orderId/lines/:lineId')
  @RequirePermission('pos.sell')
  updateLine(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body(new ZodValidationPipe(UpdatePosLineRequest)) body: UpdatePosLineRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosOrder> {
    return this.orders.updateLine(ws, orderId, lineId, body, user.id);
  }

  @Delete(':orderId/lines/:lineId')
  @RequirePermission('pos.sell')
  removeLine(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosOrder> {
    return this.orders.removeDraftLine(ws, orderId, lineId, user.id);
  }

  @Post(':orderId/lines/:lineId/void')
  @HttpCode(200)
  @RequirePermission('pos.override')
  voidLine(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body(new ZodValidationPipe(VoidPosLineRequest)) body: VoidPosLineRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosOrder> {
    return this.orders.voidLine(ws, orderId, lineId, body, user.id);
  }

  @Post(':orderId/send')
  @HttpCode(200)
  @RequirePermission('pos.sell')
  send(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosOrder> {
    return this.orders.send(ws, orderId, user.id);
  }

  @Post(':orderId/cancel')
  @HttpCode(200)
  @RequireAnyPermission('pos.sell', 'pos.override')
  cancel(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body(new ZodValidationPipe(CancelPosOrderRequest)) body: CancelPosOrderRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosOrder> {
    return this.orders.cancel(ws, orderId, body, user.id);
  }

  @Post(':orderId/discounts')
  @HttpCode(200)
  @RequireAnyPermission('pos.discount', 'pos.override')
  discount(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body(new ZodValidationPipe(ApplyPosDiscountRequest)) body: ApplyPosDiscountRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosOrder> {
    return this.orders.applyDiscount(ws, orderId, body, user.id);
  }

  @Post(':orderId/discounts/:discountId/decide')
  @HttpCode(200)
  @RequirePermission('pos.override')
  decideDiscount(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('discountId', ParseUUIDPipe) discountId: string,
    @Body(new ZodValidationPipe(DecidePosDiscountRequest)) body: DecidePosDiscountRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosOrder> {
    return this.orders.decideDiscount(ws, orderId, discountId, body, user.id);
  }

  @Post(':orderId/transfer')
  @HttpCode(200)
  @RequirePermission('table.manage')
  transfer(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body(new ZodValidationPipe(TransferPosOrderRequest)) body: TransferPosOrderRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosOrder> {
    return this.orders.transfer(ws, orderId, body, user.id);
  }

  @Post(':orderId/split')
  @RequireAnyPermission('pos.sell', 'pos.checkout')
  split(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body(new ZodValidationPipe(SplitPosOrderRequest)) body: SplitPosOrderRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosOrder> {
    return this.orders.split(ws, orderId, body, user.id);
  }

  @Post(':orderId/print-bill')
  @HttpCode(200)
  @RequireAnyPermission('pos.sell', 'pos.checkout')
  printBill(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<{ copyNumber: number; payload: unknown }> {
    return this.orders.printBill(ws, orderId, user.id);
  }

  @Post(':orderId/payments')
  @HttpCode(200)
  @RequirePermission('pos.checkout')
  pay(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body(new ZodValidationPipe(TakePosPaymentRequest)) body: TakePosPaymentRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosOrder> {
    return this.payments.take(ws, orderId, body, user.id);
  }
}

/** A payment's simulated callback and its refund. */
@Controller({ path: 'ops/pos/payments', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('pos')
export class OpsPosPaymentsController {
  constructor(private readonly payments: PosPaymentService) {}

  @Post(':paymentId/resolve')
  @HttpCode(200)
  @RequirePermission('pos.checkout')
  resolve(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body(new ZodValidationPipe(ResolvePosPaymentRequest)) body: ResolvePosPaymentRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosOrder> {
    return this.payments.resolve(ws, paymentId, body, user.id);
  }

  @Post(':paymentId/refund')
  @HttpCode(200)
  @RequirePermission('pos.refund')
  refund(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body(new ZodValidationPipe(RefundPosPaymentRequest)) body: RefundPosPaymentRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosOrder> {
    return this.payments.refund(ws, paymentId, body, user.id);
  }
}

/** The kitchen and bar boards. */
@Controller({ path: 'ops/pos', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('pos')
export class OpsPosKitchenController {
  constructor(
    private readonly read: PosReadService,
    private readonly kitchen: PosKitchenService,
  ) {}

  @Get('outlets/:outletId/tickets')
  @RequireAnyPermission('kitchen.work', 'pos.sell')
  tickets(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Query('kind') kind: string | undefined,
    @CurrentWorkspace() ws: ScopedWorkspace,
  ): Promise<PosTicket[]> {
    const parsed = PrepStationKind.safeParse(kind);
    return this.read.tickets(ws, outletId, parsed.success ? parsed.data : undefined);
  }

  @Post('tickets/:ticketId/advance')
  @HttpCode(200)
  @RequireAnyPermission('kitchen.work', 'pos.sell')
  advance(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body(new ZodValidationPipe(AdvancePosTicketRequest)) body: AdvancePosTicketRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosTicket> {
    return this.kitchen.advance(ws, ticketId, body, user.id);
  }

  @Post('tickets/:ticketId/reprint')
  @HttpCode(200)
  @RequireAnyPermission('kitchen.work', 'pos.sell')
  reprint(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosTicket> {
    return this.kitchen.reprint(ws, ticketId, user.id);
  }
}

/** Registers, cashier shifts and cash movements. */
@Controller({ path: 'ops/pos', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('pos')
export class OpsPosShiftsController {
  constructor(
    private readonly read: PosReadService,
    private readonly shifts: PosShiftService,
  ) {}

  @Get('outlets/:outletId/registers')
  @RequireAnyPermission('register.operate', 'shift.review')
  registers(@Param('outletId', ParseUUIDPipe) outletId: string, @CurrentWorkspace() ws: ScopedWorkspace): Promise<PosRegister[]> {
    return this.read.registers(ws, outletId);
  }

  @Get('outlets/:outletId/my-shift')
  @RequireAnyPermission('register.operate', 'pos.checkout')
  myShift(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosShift | null> {
    return this.read.myShift(ws, outletId, user.id);
  }

  @Get('shifts')
  @RequireAnyPermission('shift.review', 'money.view')
  list(
    @Query(new ZodValidationPipe(PosListQuery)) query: PosListQuery,
    @CurrentWorkspace() ws: ScopedWorkspace,
  ): Promise<PosShift[]> {
    return this.read.shifts(ws, query);
  }

  @Post('shifts')
  @RequirePermission('register.operate')
  open(
    @Body(new ZodValidationPipe(OpenShiftRequest)) body: OpenShiftRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosShift> {
    return this.shifts.open(ws, body, user.id);
  }

  @Post('shifts/:shiftId/movements')
  @HttpCode(200)
  @RequireAnyPermission('register.operate', 'shift.review')
  movement(
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
    @Body(new ZodValidationPipe(CashMovementRequest)) body: CashMovementRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosShift> {
    return this.shifts.movement(ws, shiftId, body, user.id);
  }

  @Post('cash-movements/:movementId/decide')
  @HttpCode(200)
  @RequirePermission('shift.review')
  decideMovement(
    @Param('movementId', ParseUUIDPipe) movementId: string,
    @Body(new ZodValidationPipe(DecideCashMovementRequest)) body: DecideCashMovementRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosShift> {
    return this.shifts.decideMovement(ws, movementId, body, user.id);
  }

  @Post('shifts/:shiftId/close')
  @HttpCode(200)
  @RequireAnyPermission('register.operate', 'shift.review')
  close(
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
    @Body(new ZodValidationPipe(CloseShiftRequest)) body: CloseShiftRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosShift> {
    return this.shifts.close(ws, shiftId, body, user.id);
  }

  @Post('shifts/:shiftId/review')
  @HttpCode(200)
  @RequirePermission('shift.review')
  review(
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
    @Body(new ZodValidationPipe(ReviewShiftRequest)) body: ReviewShiftRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosShift> {
    return this.shifts.review(ws, shiftId, body, user.id);
  }
}
