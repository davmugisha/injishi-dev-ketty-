"use client";

import { Magnifier } from "@gravity-ui/icons";
import { Button, Kbd } from "@heroui/react";
import { Command } from "@heroui-pro/react";
import { type BoardId, type NavGroup, navHref } from "@injishi/data";
import { Icon } from "@injishi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/** The lists a search can open, filtered by the words typed (`?q=` on each list). */
const SEARCHABLE: Partial<Record<BoardId, string>> = {
  Leases: "Leases",
  Units: "Units",
  Faults: "Faults",
  MoveOuts: "Move-outs",
};

interface Hit {
  id: string;
  label: string;
  icon: NavGroup["items"][number]["icon"];
  href: string;
}

/**
 * The top bar search of a real-data workspace (a landlord): a palette that jumps to a page of the
 * person's own sidebar, or opens one of their lists filtered by the words typed. It reads nothing on its
 * own; every list it opens reads the API. ⌘K / Ctrl+K opens it.
 */
export function QuickSearch({ groups, placeholder }: { groups: NavGroup[]; placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const words = q.trim();
  const lists: Hit[] = words
    ? items
        .filter((i) => SEARCHABLE[i.board])
        .map((i) => ({
          id: `find-${i.id}`,
          label: `${SEARCHABLE[i.board]} matching “${words}”`,
          icon: i.icon,
          href: `${navHref(i.board, pathname)}?q=${encodeURIComponent(words)}`,
        }))
    : [];
  const pages: Hit[] = items
    .filter((i) => !words || i.label.toLowerCase().includes(words.toLowerCase()))
    .map((i) => ({ id: `go-${i.id}`, label: i.label, icon: i.icon, href: i.href ?? navHref(i.board, pathname) }));
  const sections = [
    { id: "find", heading: "Search", hits: lists },
    { id: "go", heading: "Go to", hits: pages },
  ].filter((s) => s.hits.length > 0);

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) setQ("");
  };

  return (
    <>
      <Button
        variant="tertiary"
        onPress={() => setOpen(true)}
        className="h-9 min-w-0 max-w-md flex-[1_1_260px] justify-start gap-2 rounded-xl px-3 text-sm font-normal text-muted"
        aria-label={placeholder}
      >
        <Magnifier className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{placeholder}</span>
        <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
      </Button>
      <Command>
        <Command.Backdrop isOpen={open} onOpenChange={close} isDismissable>
          <Command.Container size="md">
            <Command.Dialog aria-label={placeholder} inputValue={q} onInputChange={setQ} filter={() => true}>
              <Command.InputGroup>
                <Command.InputGroup.Prefix>
                  <Magnifier className="size-4" aria-hidden="true" />
                </Command.InputGroup.Prefix>
                <Command.InputGroup.Input placeholder={placeholder} aria-label={placeholder} />
                {q ? <Command.InputGroup.ClearButton aria-label="Clear search" /> : null}
              </Command.InputGroup>
              <Command.List
                aria-label="Results"
                className="max-h-96"
                onAction={(key) => {
                  const hit = [...lists, ...pages].find((h) => h.id === key);
                  if (!hit) return;
                  close(false);
                  router.push(hit.href);
                }}
                renderEmptyState={() => (
                  <p className="px-4 py-6 text-center text-sm text-muted">Nothing matches “{words}”.</p>
                )}
              >
                {sections.map((s) => (
                  <Command.Group key={s.id} heading={s.heading}>
                    {s.hits.map((h) => (
                      <Command.Item key={h.id} id={h.id} textValue={h.label}>
                        <Icon name={h.icon} className="size-4 shrink-0 text-muted" />
                        <span className="min-w-0 flex-1 truncate">{h.label}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>
            </Command.Dialog>
          </Command.Container>
        </Command.Backdrop>
      </Command>
    </>
  );
}
