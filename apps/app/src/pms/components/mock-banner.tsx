"use client";

/**
 * "These screens are still demo data" (ADR-012, AC-12).
 *
 * The migration runs one screen at a time, so for a while the app is honestly
 * half real. Without this, an operator reading a demo revenue figure beside a
 * real reservation has no way to tell which is which, and the first time they
 * find out is when the two disagree.
 *
 * It names the screens rather than saying "some screens", because "some" is the
 * kind of warning people learn to scroll past. The list comes from the nav the
 * shell already built, minus `LIVE_SCREENS`, so it cannot claim a screen is
 * live that is not.
 *
 * Shows exactly when `GET /api/v1/platform` says the database holds sample data
 * (ADR-043, AC-23): the demo, staging and a laptop. A guest of a real hotel
 * must never be told the numbers are pretend, and a real operator must never
 * see a banner suggesting they might be. It used to key on `NODE_ENV`, which
 * `next build` sets to production for the demo image too, so the demo, the one
 * place the banner is true, never showed it. Hidden until the API answers, and
 * when it cannot be reached. It also never renders once the list is empty: the
 * day it disappears by itself is the day the migration is done.
 */

import { Button } from "@injishi/ui";
import { useState } from "react";
import type { NavSection } from "../lib/nav";
import { isLive } from "../lib/mock-screens";
import { usePms } from "../store";
import { Icon } from "./icon";

export function MockBanner({ sections }: { sections: NavSection[] }) {
  const [open, setOpen] = useState(false);
  const { state } = usePms();

  if (state.platform?.sampleData !== true) return null;

  // `built: false` screens are placeholders with no data at all; they are not
  // pretending to be anything, so naming them here would only pad the list.
  const screens = sections.flatMap((section) => section.items).filter((item) => item.built);
  const mock = screens.filter((item) => !isLive(item.key));

  if (mock.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "8px 24px",
        borderBottom: "1px solid var(--line)",
        background: "var(--warn-bg)",
        fontSize: 12,
        color: "var(--ink2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--warn)", display: "flex" }}>
          <Icon name="flag" size={14} />
        </span>
        <span>
          {mock.length} of {screens.length} screens here still show demo data, not this
          property&apos;s real records.
        </span>
        <Button variant="ghost"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            marginLeft: "auto",
            border: "none",
            background: "none",
            color: "var(--foreground)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {open ? "Hide" : "Which ones?"}
        </Button>
      </div>
      {open && (
        <span style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          {mock.map((item) => item.label).join(" · ")}
        </span>
      )}
    </div>
  );
}
