import type { EmployeeDocument, EmployeeDocumentList, MyUpload, UploadEmployeeDocumentRequest } from '@injishi/contracts';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { EmployeesRepository, type EmployeeRow } from '../infrastructure/employees.repository';
import { MyWorkRepository } from '../infrastructure/my-work.repository';
import { HrFilesService } from './hr-files.service';
import { PeopleFileService } from './people-file.service';

/**
 * A person's own documents (ADR-058, 058-self-service; 058-people-file
 * AC-PF4): what the office asked them for, what they handed in, and the way to
 * hand one in.
 *
 * A document could reach a file only through the office: somebody carried
 * their ID to HR, who scanned it and uploaded it for them. The person uploads
 * it here, for a document the office asked of them or one nobody asked for.
 * What they hand in is a new VERSION waiting to be checked, exactly as an
 * office upload is: it is approved or refused on the Documents lens, and
 * nothing a person sends is on their file as approved until somebody has
 * looked at it.
 *
 * The caller names their own file; any other id answers 404 (index contract
 * 10). A file the person has left is read only.
 */
@Injectable()
export class MyDocumentsService {
  constructor(
    private readonly work: MyWorkRepository,
    private readonly employees: EmployeesRepository,
    private readonly files: HrFilesService,
    private readonly peopleFile: PeopleFileService,
  ) {}

  async list(userId: string, employeeId: string): Promise<EmployeeDocumentList> {
    return this.peopleFile.documentsMine(await this.mine(userId, employeeId));
  }

  /** The file first, kept as a document upload; the document that names its key comes after. */
  async uploadFile(userId: string, employeeId: string, input: { body: Buffer; filename: string }): Promise<MyUpload> {
    const employee = await this.mineActive(userId, employeeId);
    const stored = await this.files.upload({ workspaceId: await this.workspaceOf(employee) }, userId, { ...input, purpose: 'document' });
    return { key: stored.objectKey, contentType: stored.mime, sizeBytes: stored.sizeBytes };
  }

  async handIn(userId: string, employeeId: string, body: UploadEmployeeDocumentRequest): Promise<EmployeeDocument> {
    const employee = await this.mineActive(userId, employeeId);
    return this.peopleFile.uploadMine({ workspaceId: await this.workspaceOf(employee), userId }, employee, body);
  }

  // --- Ownership -----------------------------------------------------------------------

  private async workspaceOf(employee: EmployeeRow): Promise<string> {
    const workspaceId = await this.work.workspaceOf(employee.orgId);
    if (!workspaceId) throw new ConflictException('This business has no workspace to keep the file in.');
    return workspaceId;
  }

  /** The caller's file, or 404: a probe for any other id learns nothing (index contract 10). */
  private async mine(userId: string, employeeId: string): Promise<EmployeeRow> {
    if (!(await this.work.owned(userId, employeeId))) throw new NotFoundException();
    const employee = await this.employees.find(employeeId);
    if (!employee) throw new NotFoundException();
    return employee;
  }

  /** A write needs the file active (AC-S1). */
  private async mineActive(userId: string, employeeId: string): Promise<EmployeeRow> {
    const employee = await this.mine(userId, employeeId);
    if (employee.status !== 'active') throw new ConflictException('You no longer work here, so this file is read only.');
    return employee;
  }
}
