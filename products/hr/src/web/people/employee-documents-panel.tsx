"use client";

import { Check, Ellipsis, Eye, FileText, Plus, Xmark } from "@gravity-ui/icons";
import { Alert, Button, Chip, Dropdown, Input, Label, Skeleton, TextArea, TextField, toast } from "@heroui/react";
import { EmptyState, ListView } from "@heroui-pro/react";
import { useEffect, useState, useTransition } from "react";
import type { EmployeeDocumentView } from "../../model/people.ts";
import { useHrActions } from "../mount.tsx";

const NO_ASK = { title: "", note: "", dueOn: "" };

/**
 * A file's documents as the API keeps them, each opened through a short-lived, logged link. HR approves
 * what was handed in or sends it back, and asks for one that is missing; the person sees both on Me.
 */
export function EmployeeDocumentsPanel({ employeeId }: { employeeId: string }) {
  const { decideEmployeeDocument, loadEmployeeDocuments, openEmployeeDocument, requestEmployeeDocument } =
    useHrActions();
  const [docs, setDocs] = useState<EmployeeDocumentView[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [sendingBack, setSendingBack] = useState<EmployeeDocumentView | null>(null);
  const [why, setWhy] = useState("");
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState(NO_ASK);
  const [deciding, startDeciding] = useTransition();
  const [, startTransition] = useTransition();

  /** Approve it, or send it back with the reason, then read the list again. */
  const decide = (d: EmployeeDocumentView, decision: "approved" | "declined", reason?: string) =>
    startDeciding(async () => {
      const result = await decideEmployeeDocument(d.id, decision, reason);
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      setSendingBack(null);
      setWhy("");
      toast.success(decision === "approved" ? `${d.title} approved.` : `${d.title} sent back.`);
      const again = await loadEmployeeDocuments(employeeId);
      if (again.ok) setDocs(again.documents);
    });

  /** Ask the person for a document, then read the list again. */
  const sendAsk = () =>
    startDeciding(async () => {
      const result = await requestEmployeeDocument(employeeId, ask);
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      toast.success(`${ask.title.trim()} asked for.`);
      setAsk(NO_ASK);
      setAsking(false);
      const again = await loadEmployeeDocuments(employeeId);
      if (again.ok) setDocs(again.documents);
    });

  useEffect(() => {
    let live = true;
    setDocs(null);
    setFailure(null);
    loadEmployeeDocuments(employeeId).then((result) => {
      if (!live) return;
      if (result.ok) setDocs(result.documents);
      else setFailure(result.error);
    });
    return () => {
      live = false;
    };
  }, [employeeId, loadEmployeeDocuments]);

  const open = (id: string) => {
    // Opened before the link arrives, so the browser treats it as the click's own window.
    const tab = window.open("", "_blank");
    setOpening(id);
    startTransition(async () => {
      const result = await openEmployeeDocument(id);
      setOpening(null);
      if (result.ok) {
        if (tab) tab.location.href = result.url;
        else window.location.assign(result.url);
      } else {
        tab?.close();
        toast.danger(result.error);
      }
    });
  };

  if (failure) {
    return (
      <Alert status="danger">
        <Alert.Content>
          <Alert.Title>Documents could not be read</Alert.Title>
          <Alert.Description>{failure}</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }
  if (!docs) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-busy="true" aria-label="Reading documents">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }
  const asker = asking ? (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-secondary p-3">
      <TextField
        value={ask.title}
        onChange={(title) => setAsk((a) => ({ ...a, title }))}
        className="flex flex-col gap-1"
        autoFocus
      >
        <Label>What do you need from them?</Label>
        <Input placeholder="Food handler's certificate" />
      </TextField>
      <div className="grid gap-2 sm:grid-cols-2">
        <TextField
          value={ask.note}
          onChange={(note) => setAsk((a) => ({ ...a, note }))}
          className="flex flex-col gap-1"
        >
          <Label>Note (optional)</Label>
          <Input />
        </TextField>
        <TextField
          value={ask.dueOn}
          onChange={(dueOn) => setAsk((a) => ({ ...a, dueOn }))}
          className="flex flex-col gap-1"
        >
          <Label>Needed by (optional)</Label>
          <Input type="date" />
        </TextField>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" isDisabled={ask.title.trim().length < 2} isPending={deciding} onPress={sendAsk}>
          Ask them
        </Button>
        <Button size="sm" variant="ghost" onPress={() => setAsking(false)}>
          Cancel
        </Button>
      </div>
    </div>
  ) : (
    <Button size="sm" variant="secondary" className="self-start" onPress={() => setAsking(true)}>
      <Plus className="size-4" aria-hidden="true" />
      Ask for a document
    </Button>
  );
  if (docs.length === 0) {
    return (
      <>
        <EmptyState size="sm">
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <FileText />
            </EmptyState.Media>
            <EmptyState.Title>No documents on file</EmptyState.Title>
          </EmptyState.Header>
        </EmptyState>
        {asker}
      </>
    );
  }
  return (
    <>
      {asker}
      <ListView aria-label="Documents on file" variant="secondary" items={docs}>
        {(d) => (
          <ListView.Item id={d.id} textValue={d.title}>
            <ListView.ItemContent>
              <FileText className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <div className="flex min-w-0 flex-col">
                <ListView.Title className="whitespace-normal">{d.title}</ListView.Title>
                <ListView.Description className="whitespace-normal">{d.meta}</ListView.Description>
              </div>
            </ListView.ItemContent>
            <ListView.ItemAction className="flex items-center gap-2">
              <Chip size="sm" variant="soft" color={d.tone}>
                {d.state}
              </Chip>
              {d.canOpen ? (
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label={`Open ${d.title}`}
                  isPending={opening === d.id}
                  onPress={() => open(d.id)}
                >
                  <Eye className="size-4" />
                </Button>
              ) : null}
              {d.canDecide ? (
                <Dropdown>
                  <Button size="sm" variant="ghost" isIconOnly aria-label={`Decide ${d.title}`} isDisabled={deciding}>
                    <Ellipsis className="size-4" />
                  </Button>
                  <Dropdown.Popover placement="bottom end" className="min-w-[160px]">
                    <Dropdown.Menu
                      aria-label={`Decide ${d.title}`}
                      onAction={(key) => {
                        if (key === "approve") decide(d, "approved");
                        else {
                          setWhy("");
                          setSendingBack(d);
                        }
                      }}
                    >
                      <Dropdown.Item id="approve" textValue="Approve">
                        <Check className="size-4 text-success" />
                        <Label>Approve</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="back" textValue="Send back">
                        <Xmark className="size-4 text-danger" />
                        <Label>Send back</Label>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              ) : null}
            </ListView.ItemAction>
          </ListView.Item>
        )}
      </ListView>
      {sendingBack ? (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-secondary p-3">
          <TextField value={why} onChange={setWhy} className="flex flex-col gap-1" autoFocus>
            <Label>Why does {sendingBack.title} go back?</Label>
            <TextArea rows={2} placeholder="The photo is too dark to read" />
          </TextField>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              isDisabled={why.trim().length < 3}
              isPending={deciding}
              onPress={() => decide(sendingBack, "declined", why)}
            >
              Send back
            </Button>
            <Button size="sm" variant="ghost" onPress={() => setSendingBack(null)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
