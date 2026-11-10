"use client";

import { Chip, Description, FieldError, Input, Label, TextField, toast } from "@heroui/react";
import {
  type AdminAccountStatus,
  type AdminCustomRole,
  AdminReasonQuery,
  type AdminUserListResponse,
  type AdminUserRow,
  type GovernmentBody,
  ORG_ROLE_LABEL,
  STAFF_ROLE_LABEL,
  StaffRole,
} from "@injishi/contracts";
import {
  ActionButton,
  DateText,
  EmailInput,
  EmptyBlock,
  type GridSort,
  PageContent,
  PageHeader,
  SelectField,
  ServerDataGrid,
  SidePanel,
} from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { appointOfficer } from "../leaders/actions";
import { knownWords, useKnownPerson, usePostFields } from "../leaders/post-fields";
import {
  CountStrip,
  ListBar,
  ListFilter,
  ListSearch,
  ListUrlProvider,
  SinceFilter,
  useListUrl,
} from "../list/list-kit";
import { EntityMark } from "../list/stat-cards";
import { useStepUp } from "../step-up/step-up-dialog";
import { createAccount } from "./actions";

export interface PeopleFilters {
  q: string;
  kind: string;
  status: string;
  role: string;
  sort: string;
  dir: string;
  page: number;
}

const ANY = "all";
const STATUS_KEYS: Record<AdminAccountStatus, string> = {
  active: "active",
  invited: "invited",
  suspended: "suspended",
};
const STATUS_COLOR: Record<AdminAccountStatus, "success" | "default" | "danger"> = {
  active: "success",
  invited: "default",
  suspended: "danger",
};
/** The grid's columns that the server can sort by, by the API's names. */
const SORTABLE: Record<string, string> = { person: "name", lastSignIn: "lastSignInAt", since: "createdAt" };

/**
 * People (2026-10-29, grid and filters 2026-11-02): every account on Injishi, searchable by name or email and
 * filtered by role, status and kind, one page at a time from the server. A row opens the person. "Add person"
 * makes an account by email with, in the same form, a staff role or a government or PSF post.
 */
export function PeopleView(props: {
  list: AdminUserListResponse;
  filters: PeopleFilters;
  customRoles: readonly AdminCustomRole[];
  /** The government bodies a post can be held under, for a person added with a post. */
  bodies: readonly GovernmentBody[];
  canCreate: boolean;
}) {
  return (
    <ListUrlProvider>
      <People {...props} />
    </ListUrlProvider>
  );
}

const KYC_OPTIONS = [
  { id: ANY, label: "All" },
  { id: "verified", label: "Verified" },
  { id: "pending", label: "Waiting for a check" },
  { id: "none", label: "Not verified" },
];
const SIGNED_IN_OPTIONS = [
  { id: ANY, label: "Any time" },
  { id: "last30", label: "In the last 30 days" },
  { id: "over90", label: "Not for 90 days" },
  { id: "never", label: "Never" },
];

function People({
  list,
  filters,
  customRoles,
  bodies,
  canCreate,
}: {
  list: AdminUserListResponse;
  filters: PeopleFilters;
  customRoles: readonly AdminCustomRole[];
  bodies: readonly GovernmentBody[];
  canCreate: boolean;
}) {
  const t = useTranslations("adminPeople.people");
  const router = useRouter();
  const url = useListUrl();
  const [creating, setCreating] = useState(false);

  const roleOptions = [
    { id: ANY, label: "All" },
    ...StaffRole.options.map((r) => ({ id: r, label: STAFF_ROLE_LABEL[r] })),
    ...customRoles.filter((r) => !r.archivedAt).map((r) => ({ id: r.id, label: r.name })),
  ];
  const kindOptions = [
    { id: ANY, label: "All" },
    { id: "staff", label: t("injishiStaff") },
    { id: "official", label: t("leadersOfficers") },
    { id: "business", label: t("worksInBusiness") },
    { id: "guest", label: t("guestsOthers") },
  ];
  const statusOptions = [
    { id: ANY, label: "All" },
    { id: "active", label: t("active") },
    { id: "invited", label: t("invitedNotSignedIn") },
    { id: "suspended", label: t("suspended") },
  ];
  const sortColumn = Object.entries(SORTABLE).find(([, api]) => api === filters.sort)?.[0];
  const sort: GridSort | null = sortColumn
    ? { column: sortColumn, direction: filters.dir === "asc" ? "ascending" : "descending" }
    : null;
  const filtered = Boolean(
    filters.q ||
      filters.kind ||
      filters.status ||
      filters.role ||
      url.get("kyc") ||
      url.get("since") ||
      url.get("signedIn"),
  );
  const counts = list.statusCounts ?? {};

  return (
    <PageContent>
      <PageHeader
        title={t("title")}
        description="Every account on Injishi. Open a person to see and change what they can do."
        actions={
          canCreate ? (
            <ActionButton icon="Plus" intent="primary" onPress={() => setCreating(true)}>
              {t("addPerson")}
            </ActionButton>
          ) : null
        }
      />
      <CountStrip
        label="People by status"
        param="status"
        items={[
          { id: "active", label: t("active"), icon: "CircleCheck", value: counts.active ?? 0 },
          { id: "invited", label: "Invited, not signed in yet", icon: "Envelope", value: counts.invited ?? 0 },
          {
            id: "suspended",
            label: t("suspended"),
            icon: "CircleXmark",
            value: counts.suspended ?? 0,
            status: (counts.suspended ?? 0) > 0 ? "danger" : undefined,
          },
        ]}
      />
      <ListBar
        keys={["q", "kind", "status", "role", "kyc", "since", "signedIn"]}
        found={list.meta.total}
        noun={{ one: "person", many: "people" }}
        search={<ListSearch placeholder={t("nameOrEmail")} />}
      >
        <ListFilter param="kind" name={t("kind")} icon="Persons" options={kindOptions} />
        <ListFilter param="status" name={t("status")} options={statusOptions} />
        <ListFilter param="role" name="Staff role" icon="ShieldCheck" options={roleOptions} />
        <ListFilter param="kyc" name="ID" icon="Persons" options={KYC_OPTIONS} />
        <ListFilter param="signedIn" name="Signed in" icon="ArrowRightToSquare" options={SIGNED_IN_OPTIONS} />
        <SinceFilter name="Joined" />
      </ListBar>
      <ServerDataGrid<AdminUserRow>
        label={t("title")}
        rows={list.items}
        rowKey={(p) => p.id}
        isLoading={url.pending}
        onRowAction={(p) => router.push(`/admin/people/${p.id}`)}
        sort={sort}
        onSortChange={(s) =>
          url.set({ sort: SORTABLE[s.column] ?? null, dir: s.direction === "ascending" ? "asc" : "desc" })
        }
        paging={{
          page: list.meta.page,
          pageSize: list.meta.pageSize,
          total: list.meta.total,
          onPageChange: (page) => url.set({ page: String(page) }),
        }}
        empty={
          <EmptyBlock
            size="sm"
            icon="Persons"
            title={filtered ? t("nobodyMatches") : t("noAccounts")}
            description={filtered ? t("noMatchesHint") : t("noAccountsHint")}
          />
        }
        mobile={{
          title: (p) => p.name?.trim() || p.email,
          description: (p) => p.email,
          trailing: (p) => <StatusChip status={p.status} />,
        }}
        columns={[
          {
            id: "person",
            header: t("person"),
            isRowHeader: true,
            sortable: true,
            minWidth: 220,
            cell: (p) => (
              <NextLink href={`/admin/people/${p.id}`} className="flex min-w-0 items-center gap-3 text-sm">
                <EntityMark name={p.name?.trim() || p.email} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium hover:underline">{p.name?.trim() || p.email}</span>
                  <span className="truncate text-xs text-muted">{p.email}</span>
                </span>
              </NextLink>
            ),
          },
          { id: "status", header: t("status"), cell: (p) => <StatusChip status={p.status} /> },
          {
            id: "roles",
            header: t("staffRoles"),
            cell: (p) =>
              p.staffRoles.length || p.customRoles.length ? (
                <span className="flex flex-wrap gap-1">
                  {p.staffRoles.map((r) => (
                    <Chip key={r} size="sm" variant="soft" color="accent">
                      {STAFF_ROLE_LABEL[r]}
                    </Chip>
                  ))}
                  {p.customRoles.map((r) => (
                    <Chip key={r.id} size="sm" variant="soft">
                      {r.name}
                    </Chip>
                  ))}
                </span>
              ) : (
                <span className="text-xs text-muted">—</span>
              ),
          },
          {
            id: "businesses",
            header: t("businesses"),
            cell: (p) =>
              p.memberships.length ? (
                <span className="flex min-w-0 flex-col text-xs">
                  {p.memberships.slice(0, 2).map((m) => (
                    <span key={m.orgId} className="truncate">
                      {m.orgName} · {ORG_ROLE_LABEL[m.orgRole]}
                    </span>
                  ))}
                  {p.memberships.length > 2 ? (
                    <span className="text-muted">{t("more", { count: p.memberships.length - 2 })}</span>
                  ) : null}
                </span>
              ) : (
                <span className="text-xs text-muted">—</span>
              ),
          },
          {
            id: "post",
            header: t("post"),
            cell: (p) =>
              p.oversight ? (
                <span className="text-xs">
                  {p.oversight.governmentTitle ?? p.oversight.oversightRole.replace(/_/g, " ")}
                </span>
              ) : (
                <span className="text-xs text-muted">—</span>
              ),
          },
          {
            id: "lastSignIn",
            header: t("lastSignIn"),
            sortable: true,
            cell: (p) =>
              p.lastSignInAt ? <DateText value={p.lastSignInAt} /> : <span className="text-xs text-muted">—</span>,
          },
          { id: "since", header: t("since"), sortable: true, cell: (p) => <DateText value={p.createdAt} /> },
        ]}
      />
      {creating ? (
        <AddPersonPanel customRoles={customRoles} bodies={bodies} onClose={() => setCreating(false)} />
      ) : null}
    </PageContent>
  );
}

export function StatusChip({ status }: { status: AdminAccountStatus }) {
  const t = useTranslations("adminPeople.people");
  return (
    <Chip size="sm" variant="soft" color={STATUS_COLOR[status]}>
      {t(STATUS_KEYS[status])}
    </Chip>
  );
}

const ACCOUNT = "account";
const STAFF = "staff";
const POST = "post";

/**
 * Add a person, and what they get, in one form (2026-11-09): an account alone, a staff role, or a
 * government or PSF post with its area. A post goes as one appointment, which makes the account and sends
 * the one email; nothing is asked twice and nothing is written until the form is sent.
 */
function AddPersonPanel({
  customRoles,
  bodies,
  onClose,
}: {
  customRoles: readonly AdminCustomRole[];
  bodies: readonly GovernmentBody[];
  onClose: () => void;
}) {
  const t = useTranslations("adminPeople.people");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gives, setGives] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const post = usePostFields(bodies, null);
  const { guard, dialog, pending } = useStepUp();
  // An email that already has an account: say whose, skip their name and phone, and send a staff role or
  // an account-only add to their page, where those are changed (2026-11-09).
  const known = useKnownPerson(email);

  const clear = (field: string): void => setErrors((e) => (e[field] ? { ...e, [field]: "" } : e));

  const givesOptions = [
    { id: POST, label: t("governmentPost"), description: "PSF managers and BDEs, leaders, reviewers" },
    { id: STAFF, label: "An Injishi staff role", description: "Built-in or custom" },
    { id: ACCOUNT, label: "Just an account", description: "They can sign in; give a role later" },
  ];
  const staffOptions = [
    ...StaffRole.options.map((r) => ({
      id: `staff:${r}`,
      label: STAFF_ROLE_LABEL[r],
      description: t("builtInRole"),
    })),
    ...customRoles
      .filter((r) => !r.archivedAt)
      .map((r) => ({ id: `custom:${r.id}`, label: r.name, description: r.description || t("customRole") })),
  ];

  const grant = (() => {
    if (gives !== STAFF || !staffRole) return undefined;
    const [kind, value] = staffRole.split(":");
    return kind === "staff"
      ? { kind: "staff_role" as const, role: value }
      : { kind: "custom_role" as const, roleId: value };
  })();

  const problems = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!known && name.trim().length < 2) next.name = "Enter their full name.";
    if (!gives) next.gives = "Choose what they get.";
    if (gives === STAFF && !staffRole) next.staffRole = "Choose a staff role.";
    const why = AdminReasonQuery.shape.reason.safeParse(reason);
    if (!why.success) next.reason = "Say why in a few words, for the audit log.";
    if (gives === POST) {
      for (const [k, v] of Object.entries(post.check({ email, name, reason }))) if (v && !next[k]) next[k] = v;
    }
    return next;
  };

  const addAccount = () =>
    guard(
      () => createAccount({ email, name, phone: phone.trim() || undefined, grant, reason }),
      (result) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onClose();
        if (!result.value.created) {
          toast.warning("That email already has an account. Opening it: change their roles there.");
        } else {
          toast.success("Added. They were emailed how to sign in.");
        }
        router.push(`/admin/people/${result.value.userId}`);
      },
    );

  const appoint = () =>
    guard(
      () =>
        appointOfficer({
          ...post.request({ email, name: known ? "" : name, reason }),
          phone: known ? undefined : phone.trim() || undefined,
        }),
      (result) => {
        if (!result.ok) {
          const fields = post.showServerErrors(result.fieldErrors ?? {});
          setErrors(fields);
          setError(Object.keys(fields).length > 0 ? null : result.error);
          return;
        }
        onClose();
        toast.success(
          `${result.value.name ?? result.value.email} is now ${result.value.roleLabel.toLowerCase()}. They were emailed how to sign in.`,
        );
        router.push(`/admin/people/${result.value.userId}`);
      },
    );

  const submit = () => {
    setError(null);
    const found = problems();
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    if (gives === POST) appoint();
    else addAccount();
  };

  return (
    <>
      <SidePanel
        isOpen
        onOpenChange={(open) => (open ? null : onClose())}
        title={t("addPerson")}
        description={t("signInCodeHint")}
        submitLabel={
          gives === POST ? (known ? "Appoint" : "Add and appoint") : known ? "Open their page" : t("addPerson")
        }
        submitIcon="PersonPlus"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        isPending={pending}
        validationErrors={{ ...errors, ...post.errors }}
        formError={error ?? undefined}
      >
        <EmailInput
          label={t("email")}
          name="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            clear("email");
          }}
          isRequired
          errorMessage={errors.email || null}
          description={known ? knownWords(known) : undefined}
        />
        {known ? (
          <NextLink
            href={`/admin/people/${known.id}`}
            className="-mt-2 text-sm font-medium text-accent hover:underline"
          >
            Open {known.name ?? "their"} page instead
          </NextLink>
        ) : null}
        {known ? null : (
          <>
            <TextField
              name="name"
              value={name}
              onChange={(v) => {
                setName(v);
                clear("name");
              }}
              isRequired
              isInvalid={errors.name ? true : undefined}
              className="flex flex-col gap-1"
            >
              <Label>{t("fullName")}</Label>
              <Input placeholder={t("asOnId")} />
              <FieldError>{errors.name}</FieldError>
            </TextField>
            <TextField value={phone} onChange={setPhone} className="flex flex-col gap-1">
              <Label>{t("phone")}</Label>
              <Input placeholder="0788 123 456" inputMode="tel" />
              <Description>{t("phoneHint")}</Description>
            </TextField>
          </>
        )}
        <SelectField
          label={t("whatTheyGet")}
          name="gives"
          options={givesOptions}
          value={gives}
          onChange={(v) => {
            setGives(v);
            clear("gives");
          }}
          isRequired
          errorMessage={errors.gives}
        />
        {gives === STAFF ? (
          <SelectField
            label="Staff role"
            name="staffRole"
            options={staffOptions}
            value={staffRole}
            onChange={(v) => {
              setStaffRole(v);
              clear("staffRole");
            }}
            isRequired
            errorMessage={errors.staffRole}
          />
        ) : null}
        {gives === POST ? post.fields : null}
        {gives ? (
          <TextField
            name="reason"
            value={reason}
            onChange={(v) => {
              setReason(v);
              clear("reason");
            }}
            isRequired
            isInvalid={errors.reason ? true : undefined}
            className="flex flex-col gap-1"
          >
            <Label>Why</Label>
            <Input placeholder={gives === POST ? "Took office in November 2026" : t("auditReason")} />
            <FieldError>{errors.reason}</FieldError>
          </TextField>
        ) : null}
        {gives === POST && post.role ? (
          <p className="m-0 rounded-xl bg-default/60 px-3 py-2.5 text-sm text-muted">
            {post.sentence(known?.name ?? (name.trim() || email || "They"))}
          </p>
        ) : null}
      </SidePanel>
      {dialog}
    </>
  );
}
