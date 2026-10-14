import type { ReactNode } from "react";

/** Public web pages (hub, marketplace, help, registration): each page renders its own header. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh flex-col bg-background">{children}</div>;
}
