/** Shared 2FA session shape for `/api/v1/me/*` and `/api/v1/me/oversight`. */

export interface TwoFactorState {
  required: boolean;
  verified: boolean;
}

export function toTwoFactorState(raw: unknown): TwoFactorState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.required !== "boolean" || typeof r.verified !== "boolean") {
    return null;
  }
  return { required: r.required, verified: r.verified };
}
