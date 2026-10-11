"use client";

import { BrokerIcon, HostKindIcons, OtherPropertyIcon } from "@/components/icons/search";

import type { RegistrationKind } from "./registration-kinds";

/** The mark for a kind. `broker` and `other` are the two `HostKindIcons` cannot hold. */
export function iconFor(kind: RegistrationKind) {
  if (kind === "broker") return BrokerIcon;
  if (kind === "other") return OtherPropertyIcon;
  return HostKindIcons[kind];
}
