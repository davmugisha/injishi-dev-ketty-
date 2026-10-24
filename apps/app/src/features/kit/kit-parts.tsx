import { SectionHeader } from "@injishi/ui";
import type { ReactNode } from "react";

/** One gallery section: a heading the top navigation links to, then its specimens. */
export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className="flex scroll-mt-6 flex-col gap-5 border-t border-separator pt-10 first:border-t-0 first:pt-2"
    >
      <SectionHeader id={`${id}-h`} title={title} description={description} />
      {children}
    </section>
  );
}

/** One state of a component, named. */
export function Specimen({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className ?? ""}`}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </div>
  );
}

export function SpecimenRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}
