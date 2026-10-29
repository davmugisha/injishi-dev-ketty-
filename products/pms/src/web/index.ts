/**
 * PMS's web views, and the provider an app mounts around them. The app hands each view its data as props,
 * and its links, commands, shell and photographs through `PmsProvider`; nothing here reads the API or knows a URL.
 */
export {
  type PmsLinks,
  type PmsMedia,
  PmsProvider,
  type PmsShell,
  type TopbarStatusProps,
} from "./mount.tsx";
