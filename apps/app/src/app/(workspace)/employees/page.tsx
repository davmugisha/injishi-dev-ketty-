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
import { EmployeesView } from "@injishi/product-hr/web";
import type { Metadata } from "next";
import { HrMount } from "@/features/hr/hr-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";
import { hrFeaturesOff } from "@/server/hr-features";

export const metadata: Metadata = { title: screens.Employees.pageTitle };

const FILE_TABS = ["overview", "personal", "pay", "docs", "family", "policies", "access", "offboarding"];

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
  const named = employees.some((e) => e.id === employee);
  return (
    <HrMount off={await hrFeaturesOff()}>
      <EmployeesView
        data={{ properties, employees, compensation, documents, family, policies, org, offboarding }}
        initial={{
          view: view === "org" ? "org" : "dir",
          employee: named ? (employee as string) : (employees[0]?.id ?? ""),
          tab: FILE_TABS.includes(tab ?? "") ? (tab as string) : "overview",
          open: named,
        }}
      />
    </HrMount>
  );
}
