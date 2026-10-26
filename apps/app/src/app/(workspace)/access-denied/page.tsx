import { type BoardId, screens } from "@injishi/data";
import type {
  AccessAlternatives,
  AccessDenial,
  DataExport,
  ExportPurpose,
  ExportRecord,
} from "@injishi/data/fixtures/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccessDeniedView } from "@/features/shared/AccessDeniedView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.AccessDenied.pageTitle };

const VARIANTS = ["denied", "stepup"] as const;

function isBoard(value: string): value is BoardId {
  return value in screens;
}

/** Seeded denials win. Any other board synthesises a denial from the registry. */
function resolveDenial(from: string | undefined, denials: AccessDenial[]): AccessDenial | undefined {
  const seeded = denials.find((d) => d.id === (from ?? "Reports")) ?? denials[0];
  if (!from || denials.some((d) => d.id === from) || !seeded || !isBoard(from)) return seeded;
  const screen = screens[from];
  return { ...seeded, id: screen.board, crumb: screen.title, noun: "screen", scope: screen.title };
}

/** Shared denial screen. Default is the front-desk report denial; `?variant=stepup` opens the export dialog. */
export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string; from?: string }>;
}) {
  const persona = await requirePersona("AccessDenied");
  const { variant: variantParam, from } = await searchParams;
  const variant = VARIANTS.find((v) => v === variantParam) ?? "denied";
  const [denials, alternatives, exports, purposes, history] = await Promise.all([
    getCollection<AccessDenial>("shared.accessDenials"),
    getCollection<AccessAlternatives>("shared.accessAlternatives"),
    getCollection<DataExport>("shared.dataExports"),
    getCollection<ExportPurpose>("shared.exportPurposes"),
    getCollection<ExportRecord>("shared.exportHistory"),
  ]);
  const denial = resolveDenial(from, denials);
  const alt = alternatives.find((a) => a.id === persona.id) ?? alternatives.find((a) => a.id === "frontdesk");
  const dataExport = exports[0];
  if (!denial || !alt || !dataExport) notFound();
  return (
    <AccessDeniedView
      key={`${variant}:${denial.id}`}
      persona={persona}
      variant={variant}
      data={{ denial, alternatives: alt, dataExport, purposes, history }}
    />
  );
}
