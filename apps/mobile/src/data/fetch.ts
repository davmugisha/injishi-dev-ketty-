// How a query reads the API (mobile spec 0003, the data layer child): through `api`, with the answer
// checked against its contract when it arrives. The four outcomes become one error a screen words by
// cause: "Can't connect" for no answer, "Something went wrong" for a refusal or a body that does not
// match its contract (retrying will not fix a shape change, so it carries a `parse` flag).

import type { ApiRequest, ParseSchema } from "@injishi/api-client";
import { api } from "@/lib/api";
import { learnServerDate } from "@/lib/clock";
import { sessionEvents } from "@/lib/session-events";

export type ApiErrorKind = "failed" | "refused" | "stepUp" | "signedOut";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** The body did not match its contract. */
  readonly parse: boolean;
  /** The API's own sentence for a person, when a refusal carried one. */
  readonly serverMessage: string | null;

  constructor(kind: ApiErrorKind, options: { parse?: boolean; serverMessage?: string | null } = {}) {
    super(kind);
    this.kind = kind;
    this.parse = options.parse ?? false;
    this.serverMessage = options.serverMessage ?? null;
  }
}

/** A read, checked against its contract; throws `ApiError` for anything but a matching answer. */
export async function getParsed<T>(schema: ParseSchema<T>, path: string, init?: ApiRequest): Promise<T> {
  const answer = await api.request<unknown>(path, init);
  switch (answer.status) {
    case "ok": {
      learnServerDate(answer.serverDate);
      const checked = schema.safeParse(answer.data);
      if (checked.success) return checked.data;
      throw new ApiError("failed", { parse: true });
    }
    case "unauthenticated":
      sessionEvents.signedOut();
      throw new ApiError("signedOut");
    case "refused":
      learnServerDate(answer.serverDate);
      if (answer.code === "two_factor_required") {
        sessionEvents.stepUpRequired();
        throw new ApiError("stepUp");
      }
      throw new ApiError("refused", { serverMessage: answer.message ?? null });
    case "failed":
      throw new ApiError("failed");
  }
}
