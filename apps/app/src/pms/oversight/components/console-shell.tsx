"use client";

/**
 * The government console's shell.
 *
 * Deliberately not the operator shell. There is no workspace switcher, no
 * property switcher and no "view as" role picker, because an officer holds none
 * of those: their authority is one assignment against one district, and a
 * console offering to switch it would describe something that does not exist.
 *
 * What it does say, on every screen, is WHO is acting and WHERE their scope
 * ends. Both are the boundary an officer's decisions are judged against, and a
 * verifier who cannot see their own district on screen has to remember it.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Toaster } from "@injishi/ui";

import { DemoGuide } from "../../components/demo-guide/demo-guide";
import { useSignOut } from "../../data/sign-out";
import { useShownToasts } from "../../lib/toast-queue";
import { usePms } from "../../store";
import { oversightNav } from "../lib/nav";
import { useConsole } from "../store";
import { Icon } from "./icon";

export function ConsoleShell({ title, children }: { title: string; children: ReactNode }) {
  const { state, oversight, officer } = useConsole();
  const { signOut, signingOut } = useSignOut();
  const pathname = usePathname();
  const sections = oversightNav(officer, oversight);
  const toasts = useShownToasts(state.toasts);
  /*
   * WHO IS ACTING IS THE SIGNED-IN PERSON, and the POSTING is the server's answer.
   *
   * This panel used to print `officer.name` — "Jean-Bosco Nkurunziza" or
   * "Claudine Mukamana", two names from `data/oversight.ts` — beside a sign-out
   * button, on a government console, above a queue of real businesses. Whoever
   * was actually reviewing those files saw somebody else's name over their own
   * decisions. The profile is the same one the operator sidebar shows, and
   * where it has no name it says so rather than inventing one.
   *
   * ADR-053 closed the other half. The issuing body, the officer's own job title
   * and the REGION now come from `GET /api/v1/me/oversight`, so there is no
   * fixture left in this panel at all — and the district, which this shell
   * deliberately refused to print while it could only be read off a fixture, is
   * printed.
   */
  const { me } = usePms();

  return (
    <div className="pms-root light">
      {/* Keyboard users otherwise tab the whole nav on every screen before
          reaching the work. Matches the operator and admin shells. */}
      <a href="#console-content" className="pms-skip">
        Skip to content
      </a>

      <aside
        style={{
          width: 262,
          flex: "0 0 262px",
          display: "flex",
          flexDirection: "column",
          padding: "14px 12px",
          minHeight: 0,
        }}
      >
        <div style={{ padding: "2px 6px 12px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/shared/img/injishi-extended.svg"
            alt="Injishi"
            width={80}
            height={24}
            style={{ height: 24, width: 80, display: "block" }}
          />
        </div>

        {/* Who is acting, under which body, and over which region. The seal
            colour is the issuing body's, so two officers from two bodies do not
            read as the same person.

            THE REGION IS PRINTED because the server now says what it is. An
            officer who cannot see which district they cover cannot tell whether a
            business missing from their queue is out of scope or a bug — and while
            the only available answer came from a fixture, printing it would have
            been worse than printing nothing. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            borderRadius: "var(--radius-surface)",
            border: "1px solid var(--sb-hover)",
            background: "var(--sb-hover)",
            padding: 9,
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              flex: "0 0 auto",
              borderRadius: "var(--radius-surface)",
              background: officer.seal,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-ink)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {me.ini}
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span
              style={{
                display: "block",
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--sb-afg)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {me.name}
            </span>
            {/* The officer's OWN title, as their institution words it, and the
                institution's own name — not the enum and not the body code. The
                three layers of name ADR-053 keeps apart: the database's, the
                console's label, and the employer's. */}
            <span style={{ display: "block", fontSize: 11.5, color: "var(--sb-muted)" }}>
              {officer.title}
            </span>
            <span style={{ display: "block", fontSize: 11.5, color: "var(--sb-muted)" }}>
              {officer.bodyName} · {officer.scope}
            </span>
          </span>
          {/*
            The officer's way out (F-S01).

            This console has no `Sidebar`, so the sign out that lives there
            never reaches it. It matters more here than anywhere: an officer
            reviewing a registration is exercising a government function, and
            leaving that session open on an unattended machine is the failure
            this control exists to prevent.
          */}
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            aria-label="Sign out"
            title="Sign out"
            style={{
              display: "inline-flex",
              flex: "0 0 auto",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              background: "none",
              borderRadius: "var(--radius-surface)",
              padding: 6,
              color: "var(--sb-muted)",
              cursor: signingOut ? "wait" : "pointer",
            }}
          >
            <Icon name="log-out" size={16} />
          </button>
        </div>

        <nav style={{ marginTop: 14, flex: 1, minHeight: 0, overflowY: "auto" }}>
          {sections.map((section) => (
            <div key={section.label} style={{ marginBottom: 14 }}>
              <p
                style={{
                  padding: "7px 10px 4px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--faint)",
                }}
              >
                {section.label}
              </p>
              {section.items.map((item) => {
                const on = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      borderRadius: "var(--radius-surface)",
                      padding: "8px 10px",
                      fontSize: 13.5,
                      fontWeight: on ? 600 : 500,
                      color: on ? "var(--sb-afg)" : "var(--sb-muted)",
                      background: on ? "var(--sb-hover)" : "transparent",
                      textDecoration: "none",
                    }}
                  >
                    <Icon name={item.icon} size={17} />
                    <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
                    {item.count ? (
                      <span
                        className="pms-num"
                        style={{
                          minWidth: 20,
                          padding: "1px 6px",
                          borderRadius: 999,
                          background: "var(--accent)",
                          color: "var(--accent-ink)",
                          fontSize: 11,
                          fontWeight: 700,
                          textAlign: "center",
                        }}
                      >
                        {item.count}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          margin: "8px 8px 8px 0",
          background: "var(--panel)",
          border: "1px solid var(--panel-bd)",
          borderRadius: "var(--radius-surface)",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            flex: "0 0 auto",
            padding: "12px 22px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <h1
            className="pms-display"
            style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--foreground)" }}
          >
            {title}
          </h1>
          {/* The issuing body, on every screen. The district that used to sit
              beside it came from the officer fixture, not from the assignment
              the API checked, so it is gone rather than stated wrongly. */}
          <span className="pms-num" style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {officer.bodyName}
          </span>
        </header>

        <main
          id="console-content"
          style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: "auto", padding: "20px 24px 30px" }}
        >
          {children}
        </main>
      </div>

      {/* The demo persona's story, on the demo only (see the component). */}
      <DemoGuide surface="oversight" />

      <Toaster toasts={toasts} />
    </div>
  );
}
