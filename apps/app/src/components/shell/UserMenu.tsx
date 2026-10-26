"use client";

import { ArrowRightFromSquare, ChevronsExpandVertical, Moon, Person, PersonsLock, Sun } from "@gravity-ui/icons";
import { Avatar, Button, Chip, Dropdown, Label, Separator } from "@heroui/react";
import { type Persona, screenHref } from "@injishi/data";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { signOut } from "@/lib/auth-actions";
import { THEME } from "@/lib/theme";

const toneColor = (t: Persona["avatarTone"]) => (t === "info" ? "accent" : t);

/** Sidebar footer: the signed-in person, with account, theme, switch user and sign out. */
export function UserMenu({ persona, compact = false }: { persona: Persona; compact?: boolean }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const dark = resolvedTheme === THEME.dark;

  const onAction = (key: React.Key) => {
    if (key === "account") router.push(screenHref("Account"));
    if (key === "theme") setTheme(dark ? THEME.light : THEME.dark);
    if (key === "switch" || key === "sign-out") startTransition(() => signOut());
  };

  return (
    <Dropdown>
      <Button
        variant="ghost"
        className="h-auto w-full justify-start gap-2.5 rounded-[14px] px-2.5 py-2 text-left"
        isPending={pending}
        aria-label={`${persona.name}, ${persona.role}. Account menu`}
      >
        <Avatar size="sm" variant="soft" color={toneColor(persona.avatarTone)}>
          <Avatar.Fallback>{persona.initials}</Avatar.Fallback>
        </Avatar>
        {compact ? null : (
          <span className="flex min-w-0 flex-1 flex-col" data-sidebar="label">
            <span className="truncate text-[13px] leading-[18px] font-semibold">{persona.name}</span>
            <span className="truncate text-xs leading-4 font-normal text-muted">{persona.role}</span>
            {persona.workspace?.proposedRole ? (
              <Chip size="sm" variant="soft" color="warning" className="mt-0.5 self-start">
                Proposed role
              </Chip>
            ) : null}
          </span>
        )}
        {compact ? null : <ChevronsExpandVertical className="size-4 shrink-0 text-muted" aria-hidden="true" />}
      </Button>
      <Dropdown.Popover placement="top start" className="min-w-[240px]">
        <Dropdown.Menu aria-label="Account" onAction={onAction}>
          <Dropdown.Item id="account" textValue="Account and privacy">
            <Person className="size-4 text-muted" />
            <Label>Account and privacy</Label>
          </Dropdown.Item>
          <Dropdown.Item id="theme" textValue={dark ? "Light theme" : "Dark theme"}>
            {dark ? <Sun className="size-4 text-muted" /> : <Moon className="size-4 text-muted" />}
            <Label>{dark ? "Light theme" : "Dark theme"}</Label>
          </Dropdown.Item>
          <Separator />
          <Dropdown.Item id="switch" textValue="Switch user">
            <PersonsLock className="size-4 text-muted" />
            <Label>Switch user</Label>
          </Dropdown.Item>
          <Dropdown.Item id="sign-out" textValue="Sign out">
            <ArrowRightFromSquare className="size-4 text-muted" />
            <Label>Sign out</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
