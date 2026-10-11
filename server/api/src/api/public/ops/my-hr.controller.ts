import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';

import { MyHrService } from '../../../modules/hr/application/my-hr.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { CurrentWorkspace, WorkspaceGuard } from '../../../shared/auth/workspace.guard';

/** The little of Fastify's reply a file download needs. */
interface FileReply {
  header(name: string, value: string): FileReply;
  send(body: Buffer): FileReply;
}

/**
 * An employee's OWN HR records -> `/api/v1/ops/my-hr` (HR module,
 * self-service — first pass, no ADR yet).
 *
 * NO `@RequirePermission`, ON PURPOSE, and each route is named in the
 * `injishi/require-permission-on-guarded-route` allowlist for it. There is no
 * power to name: a receptionist asking for their own leave is not exercising
 * a capability over the business, and the permission that would gate it would
 * have to be granted to every role. What stands in its place is that nothing
 * here accepts an employee id — every read and every write resolve "me" from
 * the session, so the only record reachable is the caller's own. Clocking in
 * and out are the same: they take no body at all. The one id a
 * route does take, a task's, is matched against the caller's own checklist
 * before anything changes. Deciding a request and seeing anyone else's tasks
 * or pay all stay behind `employee.manage` and `team.manage` on the HR
 * controllers.
 */
@Controller({ path: 'ops/my-hr', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsMyHrController {
  constructor(private readonly myHr: MyHrService) {}

  @Get()
  overview(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): ReturnType<MyHrService['overview']> {
    return this.myHr.overview(workspace, user.id);
  }

  @Get('leave')
  myLeave(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): ReturnType<MyHrService['myLeave']> {
    return this.myHr.myLeave(workspace, user.id);
  }

  @Post('leave')
  requestLeave(
    @Body()
    body: {
      leaveType: 'annual' | 'sick' | 'unpaid' | 'other';
      startDate: string;
      endDate: string;
      reason?: string;
    },
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): ReturnType<MyHrService['requestLeave']> {
    return this.myHr.requestLeave(workspace, user.id, body);
  }

  @Delete('leave/:requestId')
  @HttpCode(204)
  async withdrawLeave(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.myHr.withdrawLeave(workspace, user.id, requestId);
  }

  @Get('tasks')
  myTasks(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): ReturnType<MyHrService['myTasks']> {
    return this.myHr.myTasks(workspace, user.id);
  }

  @Patch('tasks/:itemId')
  @HttpCode(204)
  async setMyTaskDone(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: { done: boolean },
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.myHr.setMyTaskDone(workspace, user.id, itemId, body.done);
  }

  @Get('payslips')
  myPayslips(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): ReturnType<MyHrService['myPayslips']> {
    return this.myHr.myPayslips(workspace, user.id);
  }

  /** One of the caller's own payslips as a PDF. Somebody else's id answers 404. */
  @Get('payslips/:payslipId/pdf')
  async myPayslipPdf(
    @Param('payslipId', ParseUUIDPipe) payslipId: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    const file = await this.myHr.myPayslipPdf(workspace, user.id, payslipId);
    reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `attachment; filename="${file.filename}"`)
      .header('cache-control', 'no-store')
      .send(file.body);
  }

  /** The caller's own clock, this week, coming shifts and recent days. */
  @Get('time')
  myTime(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): ReturnType<MyHrService['myTime']> {
    return this.myHr.myTime(workspace, user.id);
  }

  @Post('time/clock-in')
  clockIn(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): ReturnType<MyHrService['clockIn']> {
    return this.myHr.clockIn(workspace, user.id);
  }

  @Post('time/clock-out')
  clockOut(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): ReturnType<MyHrService['clockOut']> {
    return this.myHr.clockOut(workspace, user.id);
  }
}
