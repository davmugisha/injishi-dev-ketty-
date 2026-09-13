import { SectionGate } from "@/components/shell/section-gate";

/**
 * Refuses a staffer whose permissions do not cover this section, typed URL
 * included (ADR-049, AC-A4). Every route under the section passes through it.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <SectionGate section="environments">{children}</SectionGate>;
}
