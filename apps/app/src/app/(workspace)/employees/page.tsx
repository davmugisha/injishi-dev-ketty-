import { screens } from "@injishi/data";
import type {
  CompensationChange,
  Employee,
  FamilyMember,
  FileDocument,
  OffboardingTask,
  OrgNode,
  PeopleProperty,
  PolicyAck,
} from "@injishi/data/fixtures/people";
import type { Metadata } from "next";
import { HrMount } from "@/features/hr/hr-mount";
import { EmployeesView } from "@/features/people/EmployeesView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";

export const metadata: Metadata = { title: screens.Employees.pageTitle };

const FILE_TABS = ["overview", "pay", "docs", "family", "policies"];

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; employee?: string; tab?: string }>;
}) {
  await requirePersona("Employees");
  // The file's access log is not read: no route serves it, and the sample entries were nobody's.
  const [properties, employees, compensation, documents, family, policies, org, offboarding] = await Promise.all([
    getCollection<PeopleProperty>("people.properties"),
    getCollection<Employee>("people.employees"),
    getCollection<CompensationChange>("people.compensation"),
    getCollection<FileDocument>("people.fileDocuments"),
    getCollection<FamilyMember>("people.family"),
    getCollection<PolicyAck>("people.policies"),
    getCollection<OrgNode>("people.orgChart"),
    getCollection<OffboardingTask>("people.offboarding"),
  ]);
  const { view, employee, tab } = await searchParams;
  return (
    <HrMount>
      <EmployeesView
        data={{ properties, employees, compensation, documents, family, policies, org, offboarding }}
        today={(await requestContext()).today.iso}
        initial={{
          view: view === "org" ? "org" : "dir",
          employee: employees.some((e) => e.id === employee) ? (employee as string) : (employees[0]?.id ?? ""),
          tab: FILE_TABS.includes(tab ?? "") ? (tab as string) : "overview",
        }}
      />
    </HrMount>
  );
}
