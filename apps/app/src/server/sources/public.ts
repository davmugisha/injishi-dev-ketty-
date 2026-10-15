/**
 * Live sources for the public area: API responses presented as the public fixture document types.
 *
 * Only the help centre's "Business" choice is live: the branches the signed-in person works at. The
 * rest of the area (plans and fees awaiting prices, the status page, policies, processors, training
 * and the broker workspace) stays on fixtures with its reason recorded in the data map.
 */
import type { SupportBusiness } from "@injishi/data/fixtures/public";
import { defineSources } from "./types";

/** GET /api/v1/me/businesses (MyBusinesses in @injishi/contracts marketplace.ts). */
interface MyBusinessesApi {
  businesses: { propertyId: string; propertyName: string; legalName: string; orgId: string; role: string }[];
}

export const sources = defineSources({
  "public.supportBusinesses": {
    naturalKey: "name",
    // The help centre is public: with nobody signed in there is no business to name, so the list is empty.
    accountParityPersona: "owner",
    async list(ctx): Promise<SupportBusiness[]> {
      if (!ctx.account) return [];
      const { businesses } = await ctx.api.get<MyBusinessesApi>("/api/v1/me/businesses");
      return businesses.map((b) => ({ id: b.propertyId, name: b.propertyName, legalEntity: b.legalName }));
    },
  },
});
