"use client";

/**
 * A screen the IA reserves but the design hasn't detailed yet. It names what
 * the section is for (never a blank page), and carries a "Next design pass"
 * marker so the gap is honest rather than hidden.
 */

import { PLACEHOLDER_COPY } from "../lib/nav";
import { Icon } from "./icon";

export function Placeholder({ screenKey }: { screenKey: string }) {
  const info = PLACEHOLDER_COPY[screenKey] ?? {
    icon: "layout-grid",
    title: screenKey,
    line: "",
  };

  return (
    <div className="pms-enter" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 480, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <span style={{ width: 56, height: 56, borderRadius: 16, background: "var(--field)", border: "1px solid var(--line2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink2)" }}>
          <Icon name={info.icon} size={26} strokeWidth={1.6} />
        </span>
        <h2 className="pms-display" style={{ fontSize: 23, fontWeight: 700, color: "var(--foreground)" }}>
          {info.title}
        </h2>
        <p style={{ fontSize: 14, color: "var(--muted)", textWrap: "pretty" }}>{info.line}</p>
        {info.hint && <p style={{ fontSize: 12.5, color: "var(--accent-text)", fontWeight: 600 }}>{info.hint}</p>}
        <span style={{ border: "1px solid var(--line2)", color: "var(--muted)", borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600 }}>
          Next design pass
        </span>
      </div>
    </div>
  );
}
