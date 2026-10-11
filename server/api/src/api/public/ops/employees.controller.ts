import {
  CreateContractRequest,
  CreateEmployeeNoteRequest,
  CreateEmployeeRequest,
  CreatePayAccountRequest,
  OffboardEmployeeRequest,
  SetEmployeePhotoRequest,
  UpdateEmployeeRequest,
  UploadEmployeeDocumentRequest,
  type CreateContractResponse,
  type Employee,
  type EmployeeDocument,
  type EmployeeDocumentList,
  type EmployeeFile,
  type EmployeeNote,
  type EmployeeNoteList,
  type EmployeePage,
  type FileLink,
  type ListIds,
  type ListQuery,
  type LeaveBalances,
  type PayAccount,
  type PayAccountList,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import { ChecklistsService } from '../../../modules/people/application/checklists.service';
import { EmployeesService } from '../../../modules/people/application/employees.service';
import { LeaveService } from '../../../modules/people/application/leave.service';
import { PeopleFileService } from '../../../modules/people/application/people-file.service';
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
import { ListQueryPipe } from '../../../shared/lists/list-query';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * HR files -> /api/v1/ops/employees (ADR-058, first thread).
 *
 * **One route, two shapes.** A file is read by `people.view`, `people.manage`
 * or `payroll.run`, and only the last two see date of birth, ID, RSSB number
 * and wages (AC-P2). The service picks the shape from the caller's grant, so
 * the permission decides what is SENT, not only what is shown.
 *
 * Offboarding declares `people.manage`, and the service also asks for
 * `team.manage` when the file holds an account: taking someone's access away
 * is staffing the business, which cannot be granted past the owner (AC-O2).
 *
 * **The people file's details have their own routes** (058-people-file AC-PF2):
 * the photo is a work field, so any file reader may fetch it; pay accounts are
 * `people.manage` or `payroll.run`; notes and documents are `people.manage`
 * alone, whatever the file view. A file outside the caller's branches answers
 * 404 on every one of them (AC-PF15).
 */
@Controller({ path: 'ops/employees', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsEmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly leave: LeaveService,
    private readonly peopleFile: PeopleFileService,
    private readonly checklists: ChecklistsService,
  ) {}

  /** One page through the list contract (058-list-framework AC-LF3, AC-LF4). */
  @Get()
  @RequireAnyPermission('people.view', 'people.manage', 'payroll.run')
  list(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @Query(ListQueryPipe) query: ListQuery,
  ): Promise<EmployeePage> {
    return this.employees.list(ws, query);
  }

  /** Select all: the matching ids up to the bulk cap, and how many match (AC-LF15). Before `:id`. */
  @Get('ids')
  @RequireAnyPermission('people.view', 'people.manage', 'payroll.run')
  ids(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @Query(ListQueryPipe) query: ListQuery,
  ): Promise<ListIds> {
    return this.employees.ids(ws, query);
  }

  /**
   * The current view as CSV (AC-LF7). Declared before `:id`: Nest matches in
   * declaration order, and a literal segment after a parameter one is shadowed.
   * `columns`, when given, is a comma list of column keys to keep.
   */
  @Get('export.csv')
  @RequireAnyPermission('people.view', 'people.manage', 'payroll.run')
  async export(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Query(ListQueryPipe) query: ListQuery,
    @Query('columns') columns: string | undefined,
    @Res({ passthrough: true }) reply: CsvReply,
  ): Promise<void> {
    const keys = columns ? columns.split(',').map((c) => c.trim()).filter(Boolean) : null;
    const file = await this.employees.exportCsv(ws, user.id, query, keys);
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${file.filename}"`)
      // A file of people's details must not sit in a proxy cache.
      .header('cache-control', 'no-store')
      .send(file.body);
  }

  /**
   * A new file starts the business's default joining checklist, when it has
   * written one. After the file is committed, and never the reason a hire
   * fails: `startDefault` swallows its own errors.
   */
  @Post()
  @RequirePermission('people.manage')
  async create(
    @Body(new ZodValidationPipe(CreateEmployeeRequest)) body: CreateEmployeeRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Employee> {
    const employee = await this.employees.create(workspace, user.id, body);
    await this.checklists.startDefault(workspace, user.id, employee.id, 'onboarding');
    return employee;
  }

  @Get(':id')
  @RequireAnyPermission('people.view', 'people.manage', 'payroll.run')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<EmployeeFile> {
    return this.employees.get(workspace, id);
  }

  @Patch(':id')
  @RequirePermission('people.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateEmployeeRequest)) body: UpdateEmployeeRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Employee> {
    return this.employees.update(workspace, user.id, id, body);
  }

  /** A wage change is a new contract; the one it replaces ends the day before. */
  @Post(':id/contracts')
  @RequirePermission('people.manage')
  createContract(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateContractRequest)) body: CreateContractRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<CreateContractResponse> {
    return this.employees.createContract(workspace, user.id, id, body);
  }

  /** Offboarding starts the default leaving checklist, counted from the last day, on the same terms as a hire. */
  @Post(':id/offboard')
  @HttpCode(200)
  @RequirePermission('people.manage')
  async offboard(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(OffboardEmployeeRequest)) body: OffboardEmployeeRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Employee> {
    const employee = await this.employees.offboard(workspace, user.id, id, body);
    await this.checklists.startDefault(workspace, user.id, employee.id, 'offboarding');
    return employee;
  }

  /** The balance per type is the sum of the ledger, and the rows are beside it. */
  @Get(':id/leave-balances')
  @RequireAnyPermission('people.view', 'people.manage', 'leave.approve')
  leaveBalances(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<LeaveBalances> {
    return this.leave.balances(workspace, id);
  }

  // --- The people file (058-people-file) ------------------------------------------

  /** Hang an uploaded photo on the file (`POST /ops/hr/files`, purpose `photo`), or take it off. */
  @Put(':id/photo')
  @RequirePermission('people.manage')
  setPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SetEmployeePhotoRequest)) body: SetEmployeePhotoRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<Employee> {
    return this.employees.setPhoto(workspace, user.id, id, body.objectKey);
  }

  /** A five minute link to the photo, a work field (AC-PF2). JSON, so a client sends its headers. */
  @Get(':id/photo')
  @RequireAnyPermission('people.view', 'people.manage', 'payroll.run')
  photo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<FileLink> {
    return this.employees.photoLink(workspace, id);
  }

  @Get(':id/pay-accounts')
  @RequireAnyPermission('people.manage', 'payroll.run')
  payAccounts(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<PayAccountList> {
    return this.peopleFile.payAccounts(workspace, id);
  }

  @Post(':id/pay-accounts')
  @RequireAnyPermission('people.manage', 'payroll.run')
  addPayAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreatePayAccountRequest)) body: CreatePayAccountRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayAccount> {
    return this.peopleFile.addPayAccount(workspace, user.id, id, body);
  }

  /** Reading the notes is itself recorded (AC-PF6). */
  @Get(':id/notes')
  @RequirePermission('people.manage')
  notes(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<EmployeeNoteList> {
    return this.peopleFile.notes(workspace, user.id, id);
  }

  @Post(':id/notes')
  @RequirePermission('people.manage')
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateEmployeeNoteRequest)) body: CreateEmployeeNoteRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<EmployeeNote> {
    return this.peopleFile.addNote(workspace, user.id, id, body);
  }

  @Get(':id/notes/:noteId/files/:index')
  @RequirePermission('people.manage')
  noteFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Param('index', ParseIntPipe) index: number,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FileLink> {
    return this.peopleFile.noteFileLink(workspace, user.id, id, noteId, index);
  }

  @Get(':id/documents')
  @RequirePermission('people.manage')
  documents(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<EmployeeDocumentList> {
    return this.peopleFile.documentsOf(workspace, id);
  }

  /** Upload for one of the person's requested documents, or a document nobody requested (AC-PF4). */
  @Post(':id/documents')
  @RequirePermission('people.manage')
  uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UploadEmployeeDocumentRequest)) body: UploadEmployeeDocumentRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<EmployeeDocument> {
    return this.peopleFile.upload(workspace, user.id, id, body);
  }
}

/** The slice of Fastify's reply the CSV route uses. */
interface CsvReply {
  header(key: string, value: string): CsvReply;
  send(payload: string): CsvReply;
}
