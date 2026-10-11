import { ListQuery, defineListSpec, type ListField, type ListGroup, type ListPage } from "@injishi/contracts";

/**
 * One sample staff list for the list framework's stories (058-list-framework).
 * Invented people at an invented hotel; nothing here is a real person or a
 * real wage. `samplePage` answers a query the way the server would, so the
 * stories exercise the same contract the routes speak.
 */
export interface SampleStaff {
  readonly id: string;
  readonly number: string;
  readonly name: string;
  readonly status: "active" | "offboarded";
  readonly branch: string;
  readonly position: string;
  readonly hiredOn: string;
  readonly hasAccount: boolean;
  readonly stage: "applied" | "interview" | "offer" | "hired";
  readonly wage: number;
}

export const SAMPLE_BRANCHES = [
  { value: "b-kiyovu", label: "Kigali, Kiyovu" },
  { value: "b-musanze", label: "Musanze" },
  { value: "b-rubavu", label: "Rubavu" },
] as const;

export const SAMPLE_SPEC = defineListSpec({
  key: "sample.staff",
  searchFields: ["name", "number"],
  statusField: "status",
  stageField: "stage",
  defaultSort: [{ field: "number", dir: "asc" }],
  fields: [
    { key: "number", label: "Number", type: "text", filterable: true, sortable: true },
    { key: "name", label: "Name", type: "text", filterable: true, sortable: true },
    {
      key: "status",
      label: "Status",
      type: "enum",
      enumValues: ["active", "offboarded"],
      enumLabels: { active: "Working", offboarded: "Left" },
      filterable: true,
      groupable: true,
    },
    { key: "branch", label: "Branch", type: "ref", filterable: true, groupable: true },
    { key: "hiredOn", label: "Hired on", type: "date", filterable: true, sortable: true },
    { key: "hasAccount", label: "Has an account", type: "bool", filterable: true, groupable: true },
    {
      key: "stage",
      label: "Stage",
      type: "enum",
      enumValues: ["applied", "interview", "offer", "hired"],
      enumLabels: { applied: "Applied", interview: "Interview", offer: "Offer", hired: "Hired" },
      filterable: true,
    },
    { key: "wage", label: "Monthly wage", type: "money", filterable: true, sortable: true, sensitive: true },
  ],
});

/** The fields, widened from the declaration's literal types for the stories to read freely. */
export const SAMPLE_FIELDS: readonly ListField[] = SAMPLE_SPEC.fields;

const NAMES = [
  "Uwase Aline",
  "Mugisha Eric",
  "Ingabire Claudine",
  "Niyonzima Jean Bosco",
  "Mukamana Béatrice",
  "Habimana Olivier",
  "Uwimana Diane",
  "Nshimiyimana Patrick",
  "Iradukunda Grace",
  "Twagirayezu Emmanuel",
  "Umutoni Sandrine",
  "Bizimana Fabrice",
  "Kayitesi Josiane",
  "Ndayisaba Innocent",
];
const POSITIONS = ["Receptionist", "Cook", "Housekeeper", "Waiter", "Night guard"];
const STAGES = ["applied", "interview", "offer", "hired"] as const;

export const SAMPLE_ROWS: readonly SampleStaff[] = NAMES.map((name, i) => ({
  id: `00000000-0000-4000-8000-0000000000${String(i + 10)}`,
  number: `EMP${String(i + 1).padStart(4, "0")}`,
  name,
  status: i % 6 === 5 ? "offboarded" : "active",
  branch: SAMPLE_BRANCHES[i % 3].value,
  position: POSITIONS[i % POSITIONS.length],
  hiredOn: `202${3 + (i % 3)}-0${1 + (i % 9)}-1${i % 9}`,
  hasAccount: i % 3 !== 2,
  stage: STAGES[i % STAGES.length],
  wage: 150000 + i * 12500,
}));

export const branchName = (id: string): string => SAMPLE_BRANCHES.find((b) => b.value === id)?.label ?? id;

type Key = keyof SampleStaff;

function keyOf(row: SampleStaff, field: string): string | null {
  const value = row[field as Key];
  return value === undefined || value === null ? null : String(value);
}

function matches(row: SampleStaff, filter: ListQuery["filters"][number]): boolean {
  const value = keyOf(row, filter.field);
  const wanted = Array.isArray(filter.value) ? filter.value.map(String) : [String(filter.value)];
  switch (filter.op) {
    case "eq":
      return value === wanted[0];
    case "ne":
      return value !== wanted[0];
    case "in":
      return value !== null && wanted.includes(value);
    case "nin":
      return value === null || !wanted.includes(value);
    case "contains":
      return (value ?? "").toLowerCase().includes(wanted[0].toLowerCase());
    case "isNull":
      return value === null;
    case "isNotNull":
      return value !== null;
    default:
      return true;
  }
}

/** The group key of a row, as the server keys it. */
export const sampleGroupKey = (row: SampleStaff, field: string): string | null => keyOf(row, field);

/** Answer a query over the sample rows, as a list route would. */
export function samplePage(query: ListQuery, rows: readonly SampleStaff[] = SAMPLE_ROWS): ListPage<SampleStaff> {
  const q = (query.q ?? "").toLowerCase();
  const searched = rows.filter((r) => q === "" || r.name.toLowerCase().includes(q) || r.number.toLowerCase().includes(q));
  const filtered = searched.filter((r) => query.filters.every((f) => matches(r, f)));
  const sorts = query.sort.length > 0 ? query.sort : (SAMPLE_SPEC.defaultSort ?? []);
  const order = [...(query.groupBy ? [{ field: query.groupBy, dir: "asc" as const }] : []), ...sorts];
  const sorted = [...filtered].sort((a, b) => {
    for (const s of order) {
      const x = keyOf(a, s.field) ?? "";
      const y = keyOf(b, s.field) ?? "";
      const c = x.localeCompare(y, undefined, { numeric: true });
      if (c !== 0) return s.dir === "desc" ? -c : c;
    }
    return 0;
  });
  const groups: ListGroup[] | undefined = query.groupBy
    ? [...new Set(sorted.map((r) => keyOf(r, query.groupBy as string)))].map((key) => ({
        key,
        label:
          key === null
            ? "None"
            : query.groupBy === "branch"
              ? branchName(key)
              : (SAMPLE_FIELDS.find((f) => f.key === query.groupBy)?.enumLabels?.[key] ??
                (key === "true" ? "Yes" : key === "false" ? "No" : key)),
        count: sorted.filter((r) => keyOf(r, query.groupBy as string) === key).length,
      }))
    : undefined;
  const withoutStatus = searched.filter((r) => query.filters.filter((f) => f.field !== "status").every((f) => matches(r, f)));
  const statusCounts = (["active", "offboarded"] as const).map((value) => ({
    value,
    count: withoutStatus.filter((r) => r.status === value).length,
  }));
  const start = (query.page - 1) * query.pageSize;
  return {
    items: sorted.slice(start, start + query.pageSize),
    total: sorted.length,
    page: query.page,
    pageSize: query.pageSize,
    ...(groups ? { groups } : {}),
    statusCounts,
  };
}

export const emptyQuery = (): ListQuery => ListQuery.parse({});
