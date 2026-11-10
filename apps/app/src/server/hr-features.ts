import type { HrFeatureId } from "@injishi/product-hr";
import { requestContext } from "./data";
import { myFeaturesOff } from "./sources/staff";

/**
 * The HR features Injishi switched off for the business in view, for screens to hide. HR's screens read
 * `GET /ops/hr/features`; someone with no HR permission (a housekeeper on the phone, anyone on Me) reads it
 * through their own file. Unknown means nothing hidden: the API refuses work through a feature that is off
 * whatever a screen shows.
 */
export async function hrFeaturesOff(): Promise<HrFeatureId[]> {
  const ctx = await requestContext();
  try {
    return (await ctx.ops("hospitality").get<{ off: HrFeatureId[] }>("/api/v1/ops/hr/features")).off;
  } catch {
    return myFeaturesOff(ctx).catch(() => []);
  }
}
