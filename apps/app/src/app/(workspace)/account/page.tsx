import { type Persona, screens } from "@injishi/data";
import type {
  AccountIdentity,
  AccountWorkspace,
  DataRequest,
  KycCheck,
  KycState,
  NotificationCategory,
  PersonalFile,
  PrivacyRight,
  ProfileField,
  SignInMethod,
} from "@injishi/data/fixtures/shared";
import { ActionLink, PageContent, PageHeader, SectionCard } from "@injishi/ui";
import type { Metadata } from "next";
import { PlanDialog } from "@/features/broker/PlanDialog";
import { AccountView } from "@/features/shared/AccountView";
import { TenantAccountView } from "@/features/tenant/TenantAccountView";
import { currentAccount, currentSessionCookie, requirePersona } from "@/lib/session";
import { sessionRow } from "@/lib/sessions";
import { sessionsFor } from "@/server/auth";
import { brokerPlan, brokerScope } from "@/server/broker/client";
import { getCollection } from "@/server/data";
import { passwordStatus } from "@/server/password";

export const metadata: Metadata = { title: screens.Account.pageTitle };

/** The seeded identity is the owner. Other signed-in people see their own persona fields. */
function identityFor(persona: Persona, identities: AccountIdentity[]): AccountIdentity {
  const found = identities.find((i) => i.id === persona.id);
  if (found) return found;
  return {
    id: persona.id,
    legalName: persona.name,
    displayName: persona.firstName,
    email: persona.email,
    phone: persona.phone,
    phoneMasked: persona.phone,
    google: persona.email,
    initials: persona.initials,
    role: persona.role,
    created: "",
    accountId: persona.id,
    verifiedFor: persona.headline,
    verifiedOn: "",
    newsConsentOn: "",
  };
}

/**
 * Personal account. Opens on Sign-in & sessions; `?tab=` opens another section.
 *
 * The sessions are the person's own, from the API, and signing one out ends it there. They were sample
 * rows once, whose "Sign out" only hid a row: a person who saw a device they did not know and pressed it
 * left that device signed in.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; plan?: string; payment?: string }>;
}) {
  const persona = await requirePersona("Account");
  const { tab, plan: planOpen, payment } = await searchParams;
  const cookie = await currentSessionCookie();
  // A tenant's account is their own records only, with the password tenants may hold (2026-10-23). A
  // landlord, an officer or a leader, and Injishi staff read the same real account (an email code only):
  // never the sample identity, workspaces and requests the demo account shows.
  if (["tenant", "landlord", "officer", "ops"].includes(persona.id) && cookie) {
    const [account, sessions, password] = await Promise.all([
      currentAccount(),
      sessionsFor(cookie).then((list) => list.map((s) => sessionRow(s))),
      passwordStatus(cookie).catch(() => null),
    ]);
    return (
      <TenantAccountView
        name={account?.user.name?.trim() || persona.name}
        email={account?.user.email ?? persona.email}
        initials={persona.initials}
        password={password}
        sessions={sessions}
      />
    );
  }

  // Broker landing: Account first, with plan opened as a Cursor-style dialog.
  if (persona.id === "broker") {
    const scoped = await brokerScope();
    const plan = scoped ? await brokerPlan() : null;
    const [account, sessions] = await Promise.all([
      currentAccount(),
      cookie ? sessionsFor(cookie).then((list) => list.map((s) => sessionRow(s))) : [],
    ]);
    const name = account?.user.name?.trim() || persona.name;
    const email = account?.user.email ?? persona.email;
    const openPlan = planOpen === "1" || planOpen === "true" || Boolean(payment);
    return (
      <PageContent>
        <PageHeader
          size="hello"
          title={name ? `Welcome back, ${name.split(/\s+/)[0]}` : "Your account"}
          description={email}
          actions={
            scoped ? (
              <ActionLink href="/account?plan=1" icon="CreditCard" intent="primary">
                Plan & billing
              </ActionLink>
            ) : null
          }
        />
        <div className="grid gap-4 md:grid-cols-2">
          {plan ? (
            <SectionCard
              title="Plan"
              description={plan.current.area}
              actions={
                <ActionLink href="/account?plan=1" size="sm" icon="ArrowRight" intent="primary">
                  Manage
                </ActionLink>
              }
            >
              <p className="text-sm">
                <span className="font-medium capitalize">{plan.current.plan}</span>
                {plan.current.nextPaymentOn && plan.current.nextAmountRwf
                  ? ` · renews ${plan.current.nextPaymentOn}`
                  : " · free district plan"}
              </p>
            </SectionCard>
          ) : null}
          <SectionCard title="Homes desk" description="Overview and find homes in one place.">
            <ActionLink href="/broker" icon="House" intent="primary">
              Open Homes
            </ActionLink>
          </SectionCard>
        </div>
        <SectionCard title="Sign-in & sessions" description="Devices that can open this broker account.">
          <ul className="divide-y divide-border">
            {sessions.length === 0 ? (
              <li className="py-3 text-sm text-muted">This device only.</li>
            ) : (
              sessions.slice(0, 5).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="truncate font-medium">{s.device}</span>
                  <span className="shrink-0 text-muted tabular">{s.last}</span>
                </li>
              ))
            )}
          </ul>
        </SectionCard>
        {plan ? (
          <PlanDialog
            data={plan}
            open={openPlan}
            openPaymentId={payment && /^[0-9a-f-]{36}$/i.test(payment) ? payment : null}
          />
        ) : null}
      </PageContent>
    );
  }

  const [identities, profile, methods, sessions, checks, kycStates, workspaces, categories, rights, requests, files] =
    await Promise.all([
      getCollection<AccountIdentity>("shared.accountIdentities"),
      getCollection<ProfileField>("shared.profileFields"),
      getCollection<SignInMethod>("shared.signInMethods"),
      cookie ? sessionsFor(cookie).then((list) => list.map((s) => sessionRow(s))) : [],
      getCollection<KycCheck>("shared.kycChecks"),
      getCollection<KycState>("shared.kycStates"),
      getCollection<AccountWorkspace>("shared.accountWorkspaces"),
      getCollection<NotificationCategory>("shared.notificationCategories"),
      getCollection<PrivacyRight>("shared.privacyRights"),
      getCollection<DataRequest>("shared.dataRequests"),
      getCollection<PersonalFile>("shared.personalFiles"),
    ]);
  return (
    <AccountView
      key={tab ?? "security"}
      initialTab={tab}
      data={{
        identity: identityFor(persona, identities),
        profile,
        methods,
        sessions,
        checks,
        kycStates,
        workspaces: workspaces.filter((w) => w.members.includes(persona.id)),
        categories,
        rights,
        requests,
        files,
      }}
    />
  );
}
