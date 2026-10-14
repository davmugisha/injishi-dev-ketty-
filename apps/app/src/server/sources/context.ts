import { type ApiClient, createApiClient, type SessionCookie } from "../api";
import { type Account, accountFor, workspaceFor } from "../auth";
import { type Domain, type KigaliDay, NoWorkspaceError, type ScopedApi, type SourceContext } from "./types";

/** Today in Africa/Kigali (UTC+2, no daylight saving). */
export function kigaliToday(now: Date = new Date()): KigaliDay {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return { iso, noon: new Date(`${iso}T12:00:00Z`) };
}

function scoped(api: ApiClient, account: Account | null, domain: Domain): ScopedApi {
  const workspace = account ? workspaceFor(account, domain) : null;
  if (!workspace || (domain !== "hospitality" && workspace.domain !== domain)) throw new NoWorkspaceError(domain);
  const workspaceId = workspace.workspaceId;
  return {
    workspace,
    get: (path, options) => api.get(path, { ...options, workspaceId }),
    post: (path, body, options) => api.post(path, body, { ...options, workspaceId }),
    put: (path, body, options) => api.put(path, body, { ...options, workspaceId }),
    patch: (path, body, options) => api.patch(path, body, { ...options, workspaceId }),
    delete: (path, options) => api.delete(path, { ...options, workspaceId }),
  };
}

/** Build a source context from an already-resolved account (the Next request path uses this). */
export function sourceContext(api: ApiClient, account: Account | null, now: Date = new Date()): SourceContext {
  const cache = new Map<Domain, ScopedApi>();
  return {
    api,
    account,
    persona: account?.persona ?? null,
    today: kigaliToday(now),
    ops(domain: Domain = "hospitality") {
      let s = cache.get(domain);
      if (!s) {
        s = scoped(api, account, domain);
        cache.set(domain, s);
      }
      return s;
    },
  };
}

/** Build a source context straight from a session cookie (verify scripts). */
export async function sourceContextFor(cookie: SessionCookie | null, now?: Date): Promise<SourceContext> {
  const api = createApiClient(cookie);
  const account = cookie ? await accountFor(cookie) : null;
  return sourceContext(api, account, now);
}
