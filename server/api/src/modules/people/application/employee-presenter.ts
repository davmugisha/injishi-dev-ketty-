import type {
  Employee,
  EmployeeMissingDetail,
  EmploymentContract,
  EmploymentContractFull,
  RosterCard,
} from '@injishi/contracts';

import type { ContractRow, EmployeeRow } from '../infrastructure/employees.repository';
import type { FileView } from './hr-access';

/**
 * Rows to the wire, in the shape the caller may read (AC-P2).
 *
 * The two shapes are built as two object literals rather than one object with
 * fields deleted from it, so adding a sensitive column means adding it to the
 * full branch on purpose; it cannot reach the basic one by being forgotten.
 */

export function displayNameOf(row: Pick<EmployeeRow, 'preferredName' | 'legalName'>): string {
  return row.preferredName?.trim() || row.legalName;
}

/** What the create route requires and a backfilled file may lack (AC-P5). */
export function detailsMissing(row: EmployeeRow): EmployeeMissingDetail[] {
  const missing: EmployeeMissingDetail[] = [];
  if (!row.phone) missing.push('phone');
  if (!row.dateOfBirth) missing.push('dateOfBirth');
  if (!row.sex) missing.push('sex');
  if (!row.idDocumentType || !row.idDocumentNumber) missing.push('idDocument');
  return missing;
}

export function presentContractFull(row: ContractRow): EmploymentContractFull {
  return {
    view: 'full',
    id: row.id,
    employeeId: row.employeeId,
    contractType: row.contractType,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    wageBasis: row.wageBasis,
    status: row.status,
    endReason: row.endReason,
    wageRwf: row.wageRwf,
  };
}

export function presentContract(row: ContractRow, view: FileView): EmploymentContract {
  if (view === 'full') return presentContractFull(row);
  return {
    view: 'basic',
    id: row.id,
    employeeId: row.employeeId,
    contractType: row.contractType,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    wageBasis: row.wageBasis,
    status: row.status,
    endReason: row.endReason,
  };
}

export function presentEmployee(
  row: EmployeeRow,
  current: ContractRow | null,
  view: FileView,
): Employee {
  const hasAccount = row.orgMembershipId !== null && row.membershipStatus === 'active';
  const common = {
    id: row.id,
    employeeNumber: row.employeeNumber,
    legalName: row.legalName,
    preferredName: row.preferredName,
    displayName: displayNameOf(row),
    phone: row.phone,
    email: row.email,
    sex: row.sex,
    workPropertyId: row.workPropertyId,
    workPropertyName: row.workPropertyName,
    jobPositionId: row.jobPositionId,
    jobPositionTitle: row.jobPositionTitle,
    reportingManagerId: row.reportingManagerId,
    reportingManagerName: row.reportingManagerName,
    hiredOn: row.hiredOn,
    status: row.status,
    offboardedOn: row.offboardedOn,
    offboardReason: row.offboardReason,
    hasAccount,
    orgRole: hasAccount ? row.membershipRole : null,
    detailsMissing: detailsMissing(row),
  };
  if (view === 'full') {
    return {
      ...common,
      view: 'full',
      dateOfBirth: row.dateOfBirth,
      idDocumentType: row.idDocumentType,
      idDocumentNumber: row.idDocumentNumber,
      rssbNumber: row.rssbNumber,
      currentContract: current ? presentContractFull(current) : null,
    };
  }
  return {
    ...common,
    view: 'basic',
    currentContract: current
      ? (presentContract(current, 'basic') as Extract<EmploymentContract, { view: 'basic' }>)
      : null,
  };
}

/** Everything a roster or an attendance sheet shows of a person. */
export function rosterCard(
  row: Pick<EmployeeRow, 'id' | 'preferredName' | 'legalName' | 'jobPositionTitle'>,
): RosterCard {
  return {
    employeeId: row.id,
    displayName: displayNameOf(row),
    jobPositionTitle: row.jobPositionTitle,
  };
}
