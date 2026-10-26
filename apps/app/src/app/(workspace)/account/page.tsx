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
import type { Metadata } from "next";
import { AccountView } from "@/features/shared/AccountView";
import { currentSessionCookie, requirePersona } from "@/lib/session";
import { sessionRow } from "@/lib/sessions";
import { sessionsFor } from "@/server/auth";
import { getCollection } from "@/server/data";

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
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const persona = await requirePersona("Account");
  const { tab } = await searchParams;
  const cookie = await currentSessionCookie();
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
