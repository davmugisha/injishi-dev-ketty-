"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@injishi/ui";
import { ArrowUpRight, ChevronsUpDown, PanelLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { WEB_URL } from "@/lib/sign-in-url";
import { NAV, roleCanSee } from "@/lib/nav";
import { useAdminUi } from "@/lib/store";
import { useRoleLens } from "@/components/shell/role-lens-seed";

export function Sidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { role: roleLens, label: roleLensLabel } = useRoleLens();
  const openRoleLens = useAdminUi((s) => s.openRoleLens);

  const label = (cls = "") => (collapsed ? "hidden" : cls);

  /*
   * Focus follows the drawer.
   *
   * Opening an overlay without moving focus leaves a keyboard or screen-reader
   * user still on the topbar, tabbing an admin nav they were never told
   * appeared; closing it without handing focus back drops them at the top of
   * the document. Above 1024px the drawer never opens and neither branch runs.
   */
  const asideRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (mobileOpen) asideRef.current?.focus();
    else if (wasOpen.current) document.getElementById("admin-nav-toggle")?.focus();
    wasOpen.current = mobileOpen;
  }, [mobileOpen]);

  return (
    <>
      <aside
        ref={asideRef}
        tabIndex={-1}
        className={`app-canvas fixed inset-y-0 left-0 z-40 shrink-0 flex-col transition-[width] duration-quick lg:static lg:bg-transparent ${
          collapsed ? "w-20" : "w-72"
        } ${mobileOpen ? "flex" : "hidden lg:flex"}`}
        aria-label="Admin navigation"
      >
        <div className="flex h-16 shrink-0 items-center gap-2 px-4">
          <Link
            href="/overview"
            className="flex items-center gap-2"
            aria-label="Injishi Admin — overview"
          >
            <span className={collapsed ? "block h-8 w-8 shrink-0" : "hidden"}>
              <Image src="/brand/injishi-short.svg" alt="" width={32} height={32} className="h-8 w-auto dark:hidden" />
              <Image src="/brand/injishi-short-white.svg" alt="" width={32} height={32} className="hidden h-8 w-auto dark:block" />
            </span>
            <span className={label("flex items-center gap-2")}>
              <Image src="/brand/injishi-extended.svg" alt="Injishi" width={112} height={28} className="h-7 w-auto dark:hidden" />
              <Image src="/brand/injishi-extended-white.svg" alt="Injishi" width={112} height={28} className="hidden h-7 w-auto dark:block" />
              <span
                className="rounded-full px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wider"
                style={{ background: "var(--sb-active)", color: "var(--sb-muted)" }}
              >
                Admin
              </span>
            </span>
          </Link>
        </div>

        <div className="px-3">
          <Button variant="primary"
           
            onClick={openRoleLens}
            className="sb-scope"
            aria-label="Switch staff-role lens"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-ramp-3 font-display text-sm font-bold text-white">
              SK
            </span>
            <span className={label("min-w-0 grow")}>
              <span className="block truncate text-sm font-semibold">Samuel Kayitare</span>
              <span className="block text-xs" style={{ color: "var(--sb-muted)" }}>
                {roleLensLabel}
              </span>
            </span>
            <ChevronsUpDown
              className={label("h-4 w-4 shrink-0")}
              style={{ color: "var(--sb-muted)" }}
              aria-hidden
            />
          </Button>
        </div>

        <nav className="mt-2 grow scrollbar overflow-y-auto px-3 pb-4" aria-label="Admin sections">
          {NAV.map((group) => {
            const visible = roleLens ? group.items.filter((item) => roleCanSee(roleLens, item)) : [];
            if (visible.length === 0) return null;
            return (
              <div key={group.group}>
                <p className={`sb-group ${label()}`}>{group.group}</p>
                <ul className="space-y-1">
                  {visible.map((item) => {
                    const active = pathname.startsWith(`/${item.key}`);
                    const Icon = item.icon;
                    return (
                      <li key={item.key}>
                        <Link
                          href={`/${item.key}`}
                          onClick={onMobileClose}
                          className={`nav-item ${active ? "nav-active" : ""} ${collapsed ? "justify-center" : ""}`}
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon className="h-5 w-5 shrink-0" aria-hidden />
                          <span className={label()}>{item.label}</span>
                          {item.count !== undefined && (
                            <span className={`sb-count ${item.alert ? "sb-count-alert" : ""} ${label()}`}>
                              {item.count}
                            </span>
                          )}
                          {item.chip && (
                            <span className={`sb-chip ${label()}`}>
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-current"
                                aria-hidden
                              />
                              {item.chip}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 space-y-1 border-t p-3" style={{ borderColor: "var(--sb-border)" }}>
          <a href={WEB_URL} className={`nav-item ${collapsed ? "justify-center" : ""}`}>
            <ArrowUpRight className="h-5 w-5 shrink-0" aria-hidden />
            <span className={label()}>View marketplace</span>
          </a>
          <Button variant="primary"
           
            onClick={() => setCollapsed((c) => !c)}
            className={`nav-item w-full ${collapsed ? "justify-center" : ""}`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            <PanelLeft className="h-5 w-5 shrink-0" aria-hidden />
            <span className={label()}>Collapse</span>
          </Button>
        </div>
      </aside>

      {mobileOpen && (
        <Button variant="primary"
         
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-ramp-1/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}
    </>
  );
}
