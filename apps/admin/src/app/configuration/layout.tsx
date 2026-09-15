import { SectionBoundary } from "@/components/shell/section-boundary";

/**
 * Mounts the section guard for `/configuration` and everything under it (ADR-049
 * AC-25). A layout rather than one gate in the root layout because the root
 * layout does not render on a soft navigation, and this one does whenever a
 * navigation enters the section. `components/shell/section-boundary.tsx`
 * records why; `test/section-gates.test.mjs` fails if this file goes.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <SectionBoundary section="configuration">{children}</SectionBoundary>;
}
