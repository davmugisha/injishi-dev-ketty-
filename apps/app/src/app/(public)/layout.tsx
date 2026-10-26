import type { ReactNode } from "react";
import { PublicSampleNote } from "./sample-note";

/**
 * Public web pages (hub, marketplace, help, registration): each page renders its own header. Every page
 * that still draws sample data says so, in its header or, without one, just above the page.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="group/public flex min-h-dvh flex-col bg-background">
      <PublicSampleNote />
      {children}
    </div>
  );
}
