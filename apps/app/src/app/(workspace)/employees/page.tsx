import { screens } from "@injishi/data";
import type {
  CompensationChange,
  Employee,
  FamilyMember,
  FileAccess,
  FileDocument,
  OffboardingTask,
  OrgNode,
  PeopleProperty,
  PolicyAck,
} from "@injishi/data/fixtures/people";
import type { Metadata } from "next";
import { EmployeesView } from "@/features/people/EmployeesView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Employees.pageTitle };

const FILE_TABS = ["overview", "pay", "docs", "family", "policies"];

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; employee?: string; tab?: string }>;
}) {
  await requirePersona("Employees");
  const [properties, employees, compensation, documents, access, family, policies, org, offboarding] =
    await Promise.all([
      getCollection<PeopleProperty>("people.properties"),
      getCollection<Employee>("people.employees"),
      getCollection<CompensationChange>("people.compensation"),
      getCollection<FileDocument>("people.fileDocuments"),
      getCollection<FileAccess>("people.fileAccess"),
      getCollection<FamilyMember>("people.family"),
      getCollection<PolicyAck>("people.policies"),
      getCollection<OrgNode>("people.orgChart"),
      getCollection<OffboardingTask>("people.offboarding"),
    ]);
  const { view, employee, tab } = await searchParams;
  return (
    <EmployeesView
      data={{ properties, employees, compensation, documents, access, family, policies, org, offboarding }}
      initial={{
        view: view === "org" ? "org" : "dir",
        employee: employees.some((e) => e.id === employee) ? (employee as string) : (employees[0]?.id ?? ""),
        tab: FILE_TABS.includes(tab ?? "") ? (tab as string) : "overview",
      }}
    />
  );
}
