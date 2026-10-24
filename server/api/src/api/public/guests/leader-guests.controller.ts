import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import {
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

/**
 * The local leader's console → /api/v1/oversight/guests (P5, blueprint 2.5).
 *
 * `OversightGuard` with the five leader roles: a person holding none is
 * refused (403). Inside, scope is the leader's own posts on every read: a
 * village leader their village, a DASSO their sector, a cell executive their
 * cell, the district officer Rwandan guests of the district, the immigration
 * officer guests from abroad. A guest outside answers 404.
 *
 * The fixed paths (summary, export, reports) are declared before `:id`.
 */
@Controller({ path: 'oversight/guests', version: '1' })
@UseGuards(SessionGuard, OversightGuard)
@RequireOversight('village_leader', 'dasso', 'cell_executive', 'district_officer', 'district_immigration')
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

  @Get('summary')
  summary(@CurrentUser() user: SessionUser, @CurrentOversight() grants: OversightGrant[]): Promise<LeaderSummary> {
    return this.console.summary(user.id, grants);
  }

  @Get('export.csv')
  async export(
    @Query(new ZodValidationPipe(LeaderGuestQuery)) query: LeaderGuestQuery,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    const body = await this.console.csv(user.id, grants, query);
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="guests-${stamp(query)}.csv"`)
      .header('cache-control', 'no-store')
      .send(body);
  }

  @Get('reports')
  report(
    @Query(new ZodValidationPipe(GuestReportQuery)) query: GuestReportQuery,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<GuestReport> {
    return this.reports.report(user.id, grants, query);
  }

  @Get('reports.csv')
  async reportCsv(
    @Query(new ZodValidationPipe(GuestReportQuery)) query: GuestReportQuery,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    const body = await this.reports.csv(user.id, grants, query);
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="guest-report-${stamp(query)}.csv"`)
      .header('cache-control', 'no-store')
      .send(body);
  }

  @Get('reports.pdf')
  async reportPdf(
    @Query(new ZodValidationPipe(GuestReportQuery)) query: GuestReportQuery,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
    @Res({ passthrough: true }) reply: FileReply,
  ): Promise<void> {
    const body = await this.reports.pdf(user.id, grants, query);
    reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `attachment; filename="guest-report-${stamp(query)}.pdf"`)
      .header('cache-control', 'no-store')
      .send(body);
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
