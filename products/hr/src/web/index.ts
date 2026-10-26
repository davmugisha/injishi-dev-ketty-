/**
 * HR's web views, and the provider an app mounts around them. The app hands each view its data as props,
 * and its links, commands and shell through `HrProvider`; nothing here reads the API or knows a URL.
 */
export {
  type HrLinks,
  HrProvider,
  type HrShell,
  type TopbarStatusProps,
  useBoardHref,
  useHrActions,
  useHrShell,
} from "./mount.tsx";
export { reported } from "./reported.ts";
