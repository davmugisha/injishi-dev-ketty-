import type {
  Employee,
  EmployeeMissingDetail,
  EmploymentContract,
  EmploymentContractFull,
  RosterCard,
} from '@injishi/contracts';

import type { ContractRow, EmployeeRow, EmployeeTagRow } from '../infrastructure/employees.repository';
import type { FileView } from './hr-access';

/**
 * Rows to the wire, in the shape the caller may read (AC-P2, 058-people-file
 * AC-PF2).
 *
 * The two shapes are built as two object literals rather than one object with
 * fields deleted from it, so adding a sensitive column means adding it to the
 * full branch on purpose; it cannot reach the basic one by being forgotten.
 * The basic view is the work fields: who, where, what job, since when. Sex,
 * family, address, emergency contact, the ID, RSSB, the wage, and why someone
 * left or a contract ended are personal, and are in the full branch only.
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
  };
}

export function presentEmployee(
  row: EmployeeRow,
  current: ContractRow | null,
  view: FileView,
  tags: readonly EmployeeTagRow[] = [],
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
    hasPhoto: row.photoKey !== null,
    workPropertyId: row.workPropertyId,
    workPropertyName: row.workPropertyName,
    jobPositionId: row.jobPositionId,
    jobPositionTitle: row.jobPositionTitle,
    reportingManagerId: row.reportingManagerId,
    reportingManagerName: row.reportingManagerName,
    hiredOn: row.hiredOn,
    status: row.status,
    offboardedOn: row.offboardedOn,
    employeeType:
      row.employeeTypeId && row.employeeTypeTitle ? { id: row.employeeTypeId, title: row.employeeTypeTitle } : null,
    tags: tags.map((t) => ({ id: t.id, title: t.title, tone: t.tone })),
    qualification: row.qualification,
    priorExperienceYears: row.priorExperienceYears,
    hasAccount,
    orgRole: hasAccount ? row.membershipRole : null,
    detailsMissing: detailsMissing(row),
  };
  if (view === 'full') {
    return {
      ...common,
      view: 'full',
      sex: row.sex,
      dateOfBirth: row.dateOfBirth,
      idDocumentType: row.idDocumentType,
      idDocumentNumber: row.idDocumentNumber,
      rssbNumber: row.rssbNumber,
      maritalStatus: row.maritalStatus,
      childrenCount: row.childrenCount,
      address:
        row.villageId !== null && row.villageName && row.cellName && row.sectorName && row.districtName
          ? {
              villageId: row.villageId,
              villageName: row.villageName,
              cellName: row.cellName,
              sectorName: row.sectorName,
              districtName: row.districtName,
              street: row.street,
            }
          : null,
      emergencyContact: row.emergencyName
        ? { name: row.emergencyName, phone: row.emergencyPhone, relation: row.emergencyRelation }
        : null,
      offboardReason: row.offboardReason,
      serviceFrom: row.serviceFrom,
      previousEmployeeId: row.previousEmployeeId,
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
