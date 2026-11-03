import { useId } from "react";

/** An id react-native-svg's `url(#…)` accepts on every platform: React's own ids carry colons. */
export function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
