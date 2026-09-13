import {
  AdminWaitlistExportQuery,
  AdminWaitlistQuery,
  type AdminWaitlistInviteResult,
  type AdminWaitlistPage,
  type AdminWaitlistRow,
} from '@injishi/contracts';
import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { AdminWaitlistService } from './waitlist-admin.service';

/** The minimum of a Fastify reply the CSV route touches. */
interface RawReply {
  header(key: string, value: string): RawReply;
  send(payload: string): RawReply;
}

/**
 * The waitlist in the admin console (ADR-048 AC-17).
 *
 * `@UseGuards(SessionGuard, StaffGuard)` IN THAT ORDER, the same as every other
 * admin controller: `StaffGuard` throws a 500 rather than treating the request
 * as anonymous when the session guard did not run first, so reversing the two
 * fails loudly instead of quietly reading, in a log, as "that staffer lost
 * their access".
 *
 * IT DECLARES `admin.overview.view`, AND THAT IS A BORROW rather than
 * an oversight. ADR-048 names `StaffGuard` as the boundary and defines no
 * waitlist permission; minting `admin.waitlist.view` would mean adding a power
 * to `@injishi/contracts` and deciding which of the four staff roles hold it,
 * which the ADR did not do. `admin.overview.view` sits in `OBSERVE`, which
 * EVERY staff role holds, so declaring it enforces exactly what AC-17 asks
 * for — any platform staff and nobody else — while satisfying
 * `injishi/require-permission-on-guarded-route`, which refuses a guarded route
 * declaring no permission at all. The same borrowing is documented on
 * `REISSUE` in the console's `lib/actions/users.ts`. A dedicated waitlist
 * permission is a small `/architect` job, and this line changes with it.
 *
 * The console shows the section to the `super_admin` and `ops` lenses. That is
 * an affordance, not the control.
 */
@Controller({ path: 'admin/waitlist', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
@RequireStaffPermission('admin.overview.view')
export class AdminWaitlistController {
  constructor(private readonly waitlist: AdminWaitlistService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(AdminWaitlistQuery)) query: AdminWaitlistQuery,
  ): Promise<AdminWaitlistPage> {
    return this.waitlist.list(query);
  }

  /**
   * The CSV.
   *
   * Declared BEFORE `:id` would be if this controller had one, the same rule
   * `PropertiesController` follows: Nest matches in declaration order and a
   * literal segment registered after a parameter segment is shadowed by it.
   */
  @Get('export')
  async export(
    @Query(new ZodValidationPipe(AdminWaitlistExportQuery))
    query: AdminWaitlistExportQuery,
    @CurrentUser() user: SessionUser,
    @Res({ passthrough: true }) reply: RawReply,
  ): Promise<void> {
    const rows = await this.waitlist.export(query, user.id);

    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header(
        'content-disposition',
        'attachment; filename="injishi-waitlist.csv"',
      )
      // A file of other people's contact details must not sit in a proxy cache.
      .header('cache-control', 'no-store')
      .send(toCsv(rows));
  }

  @Post(':id/invite')
  @HttpCode(200)
  invite(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminWaitlistInviteResult> {
    return this.waitlist.invite(id, user.id);
  }
}

/**
 * The column set is fixed in ADR-048 and is not read off the row object, so a
 * column added to the table later cannot silently start appearing in an export
 * of personal data.
 */
const CSV_COLUMNS = [
  'created_at',
  'audience',
  'email',
  'full_name',
  'phone',
  'business_name',
  'district_name',
  'property_type',
  'size_band',
  'marketing_opt_in',
  'invited_at',
  'unsubscribed_at',
] as const;

function toCsv(rows: AdminWaitlistRow[]): string {
  const lines = [CSV_COLUMNS.join(',')];

  for (const row of rows) {
    lines.push(
      [
        row.createdAt,
        row.audience,
        row.email,
        row.fullName,
        row.phone,
        row.businessName,
        row.districtName,
        row.propertyType,
        row.sizeBand,
        String(row.marketingOptIn),
        row.invitedAt,
        row.unsubscribedAt,
      ]
        .map(cell)
        .join(','),
    );
  }

  return lines.join('\r\n');
}

/**
 * One CSV cell.
 *
 * Quoted whenever it could otherwise break the row, with inner quotes doubled,
 * per RFC 4180. The leading apostrophe on a cell starting `= + - @` is the
 * spreadsheet formula-injection guard: a name stored as `=HYPERLINK(...)` is
 * inert in the database and is executed by Excel the moment somebody opens the
 * export, which is a real way for a public form to reach a staff member's
 * machine.
 */
function cell(value: string | null): string {
  if (value === null || value === undefined) return '';
  const escaped = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${escaped.replace(/"/g, '""')}"`;
}
