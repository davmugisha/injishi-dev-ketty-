import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import {
  LEADER_ROLES,
  FlagGuestRequest,
  type GuestReport,
  GuestReportQuery,
  type LeaderGuest,
  type LeaderGuestPage,
  LeaderGuestQuery,
  type LeaderSummary,
  type OversightGrant,
} from '@injishi/contracts';

import { GuestReportsService } from '../../../modules/guests/application/guest-reports.service';
import { LeaderConsoleService } from '../../../modules/guests/application/leader-console.service';
import { CurrentOversight, OversightGuard, RequireOversight } from '../../../shared/auth/oversight.guard';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import type { FileReply } from '../ops/pay-runs.controller';

/** A file name day: `2026-10-24`. */
function stamp(query: { from?: string; to?: string; tab?: string }): string {
  return query.from && query.to ? `${query.from}_${query.to}` : (query.tab ?? 'guests');
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** A download: its type, its name, never cached. */
function send(reply: FileReply, body: Buffer | string, type: string, name: string): void {
  reply.header('content-type', type).header('content-disposition', `attachment; filename="${name}"`).header('cache-control', 'no-store').send(body);
}

/**
 * The local leader's console → /api/v1/oversight/guests (P5, blueprint 2.5).
 *
 * `OversightGuard` with every leader role: a person holding none is
 * refused (403). Inside, scope is the leader's own posts on every read: a
 * village leader their village, a DASSO their sector, a cell executive their
 * cell, the district officer Rwandan guests of the district, the immigration
 * officer guests from abroad. A guest outside answers 404.
 *
 * The fixed paths (summary, export, reports) are declared before `:id`.
 */
@Controller({ path: 'oversight/guests', version: '1' })
@UseGuards(SessionGuard, OversightGuard)
// Every leader post the database knows, retired ones included, so an older record still opens.
@RequireOversight(...LEADER_ROLES)
export class OversightGuestsController {
  constructor(
    private readonly console: LeaderConsoleService,
    private readonly reports: GuestReportsService,
  ) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(LeaderGuestQuery)) query: LeaderGuestQuery,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<LeaderGuestPage> {
    return this.console.page(user.id, grants, query);
  }

  /** The counts, posts and narrowing choices (a chosen sector offers its cells, a cell its villages). */
  @Get('summary')
  summary(
    @Query(new ZodValidationPipe(LeaderGuestQuery)) query: LeaderGuestQuery,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<LeaderSummary> {
    return this.console.summary(user.id, grants, query);
  }

  /** The list as Excel: a summary sheet, then the guests in the reader's columns (the main download). */
  @Get('export.xlsx')
  async exportXlsx(
    @Query(new ZodValidationPipe(LeaderGuestQuery)) query: LeaderGuestQuery,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    send(reply, await this.console.xlsx(user.id, grants, query), XLSX, `guests-${stamp(query)}.xlsx`);
  }

  @Get('export.pdf')
  async exportPdf(
    @Query(new ZodValidationPipe(LeaderGuestQuery)) query: LeaderGuestQuery,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    send(reply, await this.console.pdf(user.id, grants, query), 'application/pdf', `guests-${stamp(query)}.pdf`);
  }

  @Get('export.csv')
  async export(
    @Query(new ZodValidationPipe(LeaderGuestQuery)) query: LeaderGuestQuery,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    send(reply, await this.console.csv(user.id, grants, query), 'text/csv; charset=utf-8', `guests-${stamp(query)}.csv`);
  }

  @Get('reports')
  report(
    @Query(new ZodValidationPipe(GuestReportQuery)) query: GuestReportQuery,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<GuestReport> {
    return this.reports.report(user.id, grants, query);
  }

  @Get('reports.xlsx')
  async reportXlsx(
    @Query(new ZodValidationPipe(GuestReportQuery)) query: GuestReportQuery,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    send(reply, await this.reports.xlsx(user.id, grants, query), XLSX, `guest-report-${stamp(query)}.xlsx`);
  }

  @Get('reports.csv')
  async reportCsv(
    @Query(new ZodValidationPipe(GuestReportQuery)) query: GuestReportQuery,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    send(reply, await this.reports.csv(user.id, grants, query), 'text/csv; charset=utf-8', `guest-report-${stamp(query)}.csv`);
  }

  @Get('reports.pdf')
  async reportPdf(
    @Query(new ZodValidationPipe(GuestReportQuery)) query: GuestReportQuery,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    send(reply, await this.reports.pdf(user.id, grants, query), 'application/pdf', `guest-report-${stamp(query)}.pdf`);
  }

  @Get(':id')
  one(@Param('id', ParseUUIDPipe) id: string, @CurrentOversight() grants: OversightGrant[]): Promise<LeaderGuest> {
    return this.console.one(grants, id);
  }

  @Post(':id/seen')
  @HttpCode(200)
  seen(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<LeaderGuest> {
    return this.console.seen(user.id, grants, id);
  }

  @Post(':id/flag')
  @HttpCode(200)
  flag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(FlagGuestRequest)) body: FlagGuestRequest,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<LeaderGuest> {
    return this.console.flag(user.id, grants, id, body);
  }
}
