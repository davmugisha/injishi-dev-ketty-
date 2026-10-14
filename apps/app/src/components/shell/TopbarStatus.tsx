"use client";

import { Chip } from "@heroui/react";
import { type TopbarStatus as Status, screens } from "@injishi/data";
import { GateChip, Icon, StatusDot, toneColor } from "@injishi/ui";
import NextLink from "next/link";
import { createContext, useContext, useEffect } from "react";

const SetStatus = createContext<((slot: number, status: Status | null) => void) | null>(null);

/** Provided by the workspace shell: lets the current screen replace its top-bar status pill. */
export const TopbarStatusProvider = SetStatus.Provider;

/**
 * Replaces one of the screen's top-bar pills while mounted — for pills that follow the screen's own state
 * (Roster "Week 42 · published" → "Week 43 · draft"). `slot` is the pill's position in the registry's
 * `topbar.pills` (default 0, the first). Renders nothing in place; the shell draws the pills.
 * Static pills need no code: the shell reads them from the screen registry.
 */
export function TopbarStatus({ slot = 0, ...status }: Status & { slot?: number }) {
  const setStatus = useContext(SetStatus);
  const key = JSON.stringify(status);
  useEffect(() => {
    setStatus?.(slot, JSON.parse(key) as Status);
    return () => setStatus?.(slot, null);
  }, [setStatus, slot, key]);
  return null;
}

/** The top-bar status pill (artifact: .ij-gate, or a soft .chip with an icon or a status dot). */
export function TopbarStatusPill({ status }: { status: Status }) {
  const pill =
    status.kind === "gate" ? (
      <GateChip icon={status.icon ? <Icon name={status.icon} className="size-3" /> : undefined}>
        {status.label}
      </GateChip>
    ) : (
      <Chip variant="soft" color={toneColor(status.tone)} className="whitespace-nowrap">
        {status.dot ? <StatusDot tone={status.dot} /> : null}
        {!status.dot && status.icon ? <Icon name={status.icon} className="size-3.5" /> : null}
        <Chip.Label>{status.label}</Chip.Label>
      </Chip>
    );
  return status.board ? (
    <NextLink href={screens[status.board].href} className="no-underline">
      {pill}
    </NextLink>
  ) : (
    pill
  );
}
