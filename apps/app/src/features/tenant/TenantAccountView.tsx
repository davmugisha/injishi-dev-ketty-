"use client";

import { Avatar, Checkbox, Chip, Label, toast } from "@heroui/react";
import {
  ActionButton,
  CodeInput,
  FormDialog,
  Icon,
  KeyValueList,
  PageContent,
  PageHeader,
  SectionCard,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PasswordField } from "@/features/platform/auth/PasswordField";
import { signOutOtherSessions, signOutSession } from "@/lib/auth-actions";
import { changeMyPassword, sendMyPasswordCode, setMyPasswordWithCode } from "@/lib/password-actions";
import type { SessionRow } from "@/lib/sessions";

/**
 * The tenant's account (2026-10-26): who they are, their password (tenants only), and the devices
 * signed in. Real records only: the name and email from the session, the sessions from the API.
 */
export function TenantAccountView({
  name,
  email,
  initials,
  password,
  sessions,
}: {
  name: string;
  email: string;
  initials: string;
  /** From `GET /me/password`; null when the API did not answer. */
  password: { offered: boolean; set: boolean } | null;
  sessions: SessionRow[];
}) {
  const others = sessions.filter((s) => !s.current);
  return (
    <PageContent>
      <PageHeader title="Account" />
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <SectionCard title="You" className="lg:col-span-1">
          <div className="flex items-center gap-3">
            <Avatar variant="soft" color="accent" className="size-12">
              <Avatar.Fallback>{initials}</Avatar.Fallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{name}</span>
              <span className="truncate text-sm text-muted">{email}</span>
            </div>
          </div>
        </SectionCard>
        <PasswordCard email={email} status={password} />
      </div>
      <SessionsCard sessions={sessions} others={others.length} />
    </PageContent>
  );
}

function PasswordCard({ email, status }: { email: string; status: { offered: boolean; set: boolean } | null }) {
  const [open, setOpen] = useState<"set" | "change" | null>(null);
  const set = status?.set === true;
  return (
    <SectionCard
      title="Password"
      className="lg:col-span-2"
      actions={
        status === null ? null : set ? (
          <ActionButton icon="Key" onPress={() => setOpen("change")}>
            Change password
          </ActionButton>
        ) : status.offered ? (
          <ActionButton icon="Key" onPress={() => setOpen("set")}>
            Set a password
          </ActionButton>
        ) : null
      }
    >
      <KeyValueList
        items={[
          {
            label: "Sign in",
            value: set ? "Password or an email code" : "An email code",
          },
          {
            label: "Status",
            value:
              status === null ? (
                <span className="text-muted">Couldn&apos;t check just now</span>
              ) : (
                <Chip size="sm" variant="soft" color={set ? "success" : "default"}>
                  {set ? "Set" : "Not set"}
                </Chip>
              ),
          },
        ]}
      />
      <SetPasswordDialog isOpen={open === "set"} onOpenChange={(o) => setOpen(o ? "set" : null)} email={email} />
      <ChangePasswordDialog isOpen={open === "change"} onOpenChange={(o) => setOpen(o ? "change" : null)} />
    </SectionCard>
  );
}

/** A first password from the account: a code to the tenant's own email, then the password twice. */
function SetPasswordDialog({
  isOpen,
  onOpenChange,
  email,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
}) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const close = (o: boolean) => {
    if (!o) {
      setSent(false);
      setCode("");
      setPassword("");
      setConfirm("");
      setError(null);
    }
    onOpenChange(o);
  };
  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={close}
      title="Set a password"
      description={sent ? `We sent a code to ${email}.` : `We email a code to ${email} first.`}
      submitLabel={sent ? "Save password" : "Send a code"}
      isPending={pending}
      formError={error}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          if (!sent) {
            const r = await sendMyPasswordCode();
            if (r.ok) setSent(true);
            else setError(r.message);
            return;
          }
          const r = await setMyPasswordWithCode({ code, password, confirm });
          if (!r.ok) return setError(r.message);
          toast.success("Password saved.");
          close(false);
          router.refresh();
        });
      }}
    >
      {sent ? (
        <div className="flex flex-col gap-3">
          <CodeInput value={code} onChange={setCode} autoFocus />
          <PasswordField label="New password" value={password} onChange={setPassword} isNew />
          <PasswordField label="Type it again" value={confirm} onChange={setConfirm} />
        </div>
      ) : null}
    </FormDialog>
  );
}

function ChangePasswordDialog({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const close = (o: boolean) => {
    if (!o) {
      setCurrent("");
      setPassword("");
      setConfirm("");
      setError(null);
    }
    onOpenChange(o);
  };
  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={close}
      title="Change password"
      submitLabel="Save password"
      isPending={pending}
      formError={error}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await changeMyPassword({ current, password, confirm, signOutOthers });
          if (!r.ok) return setError(r.message);
          toast.success(signOutOthers ? "Password changed. Other devices are signed out." : "Password changed.");
          close(false);
          router.refresh();
        });
      }}
    >
      <div className="flex flex-col gap-3">
        <PasswordField label="Current password" value={current} onChange={setCurrent} autoFocus />
        <PasswordField label="New password" value={password} onChange={setPassword} isNew />
        <PasswordField label="Type it again" value={confirm} onChange={setConfirm} />
        <Checkbox isSelected={signOutOthers} onChange={setSignOutOthers}>
          <Checkbox.Content className="flex items-center gap-2.5">
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Label>Sign out my other devices</Label>
          </Checkbox.Content>
        </Checkbox>
      </div>
    </FormDialog>
  );
}

function SessionsCard({ sessions, others }: { sessions: SessionRow[]; others: number }) {
  const [ending, setEnding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const end = (key: string, change: () => Promise<{ error?: string }>) => {
    setEnding(key);
    setError(null);
    start(async () => {
      const r = await change();
      setError(r.error ?? null);
      setEnding(null);
      if (!r.error) toast.success(key === "others" ? "Other devices are signed out." : "That device is signed out.");
    });
  };
  return (
    <SectionCard
      title="Signed in devices"
      actions={
        <ActionButton
          icon="ArrowRightFromSquare"
          intent="danger-soft"
          isDisabled={others === 0 || ending !== null}
          isPending={ending === "others"}
          onPress={() => end("others", () => signOutOtherSessions())}
        >
          Sign out other devices
        </ActionButton>
      }
    >
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col divide-y divide-border">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <Icon name={s.icon} className="size-4 shrink-0 text-muted" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="truncate">{s.device}</span>
                {s.current ? (
                  <Chip size="sm" variant="soft" color="success">
                    This device
                  </Chip>
                ) : null}
              </span>
              <span className="truncate text-xs text-muted">
                {[s.place, s.current ? s.last : `Last active ${s.last}`].filter(Boolean).join(" · ")}
              </span>
            </div>
            {s.current ? null : (
              <ActionButton
                intent="ghost"
                size="sm"
                isDisabled={ending !== null}
                isPending={ending === s.id}
                onPress={() => end(s.id, () => signOutSession(s.id))}
              >
                Sign out
              </ActionButton>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
