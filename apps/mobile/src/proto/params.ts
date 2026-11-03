import { useLocalSearchParams } from "expo-router";
import { type DefaultParams, SCREENS, type ScreenId } from "./screens";

/**
 * A screen's route params with the prototype's defaults filled in (`SCREENS[id].params`), so a screen
 * opened without them (a tab press, a deep link) still has its sample room or thread:
 * `const { room } = useScreenParams("hk-task")` is "204" unless the URL says otherwise.
 */
export function useScreenParams<Id extends ScreenId>(
  id: Id,
): { [K in keyof DefaultParams<Id>]: string } & Record<string, string | undefined> {
  const local = useLocalSearchParams();
  const values: Record<string, string | undefined> = { ...SCREENS[id].params };
  for (const [key, value] of Object.entries(local)) {
    const one = Array.isArray(value) ? value[0] : value;
    if (one !== undefined && one !== "") values[key] = one;
  }
  return values as { [K in keyof DefaultParams<Id>]: string } & Record<string, string | undefined>;
}
