import {
  PlaceTableOrderRequest,
  type TableOrderMenu,
  type TableOrderStatus,
  type TableQrCode,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { PosTableOrderService } from '../../../modules/pos/application/pos-table-order.service';
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
import { TableOrderThrottlerGuard } from './table-order-throttler.guard';

interface PhotoReply {
  header(key: string, value: string): PhotoReply;
  send(payload?: Buffer | string): PhotoReply;
}

/**
 * A guest at a table, from the QR on it (migration 0156). NOT signed in: the code in the path is the whole key, and it
 * opens one table only. Every route is rate limited by address and code (TableOrderThrottlerGuard). Nothing here
 * takes a table, an outlet or a price from the request; the service resolves the code and prices from the menu.
 */
@Controller({ path: 'table-order', version: '1' })
@UseGuards(TableOrderThrottlerGuard)
export class TableOrderController {
  constructor(private readonly tables: PosTableOrderService) {}

  @Get(':code')
  @SkipThrottle({ 'table-order': true })
  menu(@Param('code') code: string): Promise<TableOrderMenu> {
    return this.tables.menu(code);
  }

  @Get(':code/photos/:itemId')
  @SkipThrottle({ 'table-order': true })
  async photo(
    @Param('code') code: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Res() reply: PhotoReply,
  ): Promise<void> {
    const bytes = await this.tables.photo(code, itemId);
    reply
      .header('Content-Type', 'image/jpeg')
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .header('X-Content-Type-Options', 'nosniff')
      .send(bytes);
  }

  @Post(':code/orders')
  @HttpCode(200)
  @SkipThrottle({ 'table-read': true })
  place(
    @Param('code') code: string,
    @Body(new ZodValidationPipe(PlaceTableOrderRequest)) body: PlaceTableOrderRequest,
  ): Promise<TableOrderStatus> {
    return this.tables.place(code, body);
  }

  @Get(':code/orders/:clientKey')
  @SkipThrottle({ 'table-order': true })
  status(@Param('code') code: string, @Param('clientKey') clientKey: string): Promise<TableOrderStatus> {
    return this.tables.status(code, clientKey);
  }
}

/** The staff side: each table's code for its QR card, and replacing one table's code (a lost or copied card). */
@Controller({ path: 'ops/pos', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('pos')
export class OpsTableQrController {
  constructor(private readonly tables: PosTableOrderService) {}

  @Get('outlets/:outletId/table-qr')
  @RequireAnyPermission('pos.sell', 'table.manage', 'pos.checkout', 'outlet.manage')
  codes(@Param('outletId', ParseUUIDPipe) outletId: string, @CurrentWorkspace() ws: ScopedWorkspace): Promise<TableQrCode[]> {
    return this.tables.codes(ws, outletId);
  }

  @Post('tables/:tableId/table-qr/replace')
  @HttpCode(200)
  @RequirePermission('outlet.manage')
  replace(
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<TableQrCode> {
    return this.tables.rotate(ws, tableId, user.id);
  }
}
