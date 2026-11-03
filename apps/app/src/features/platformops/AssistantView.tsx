"use client";

import {
  ArrowRight,
  Calendar,
  Check,
  CircleCheck,
  Copy,
  Headphones,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  TrashBin,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Label,
  Modal,
  SearchField,
  Skeleton,
  Tag,
  TagGroup,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { ChatMessage, EmptyState, ItemCard, PromptInput, PromptSuggestion } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { AssistantConversation } from "@injishi/data/fixtures/platformops";
import { Icon, KeyValueList, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import NextLink from "next/link";
import { useState } from "react";
import { BrandMark } from "@/components/brand";

interface AssistantData {
  conversations: AssistantConversation[];
}

const SUGGESTIONS = [
  "Which rooms are out of order this week?",
  "What is blocking fiscal receipt F-5512?",
  "How do I move a guest to another room?",
  "Summarise today’s arrivals",
];

const REASONS = ["Wrong information", "Missing a source", "Not helpful", "Should not see this"];

type Proposal = "pending" | "editing" | "approved" | "approvedEdit" | "dismissed";
type Feedback = "up" | "down" | null;

export function AssistantView({ data, handoff = false }: { data: AssistantData; handoff?: boolean }) {
  const [conv, setConv] = useState("c305");
  const [query, setQuery] = useState("");
  const [prop, setProp] = useState<Proposal>("pending");
  const [fb, setFb] = useState<Feedback>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [fbSent, setFbSent] = useState(false);
  const [handed, setHanded] = useState<boolean | null>(null);
  const [handoffAsk, setHandoffAsk] = useState(false);
  const [delAsk, setDelAsk] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<string[]>([]);

  const handedOff = handed === null ? handoff : handed;
  const isNew = conv === "new";
  const current = data.conversations.find((c) => c.id === conv);
  const isMain = conv === "c305";
  const q = query.trim().toLowerCase();
  const groups = ["Today", "Earlier"].map((label) => ({
    label,
    items: data.conversations.filter(
      (c) => c.group === label && (!q || `${c.title} ${c.snippet}`.toLowerCase().includes(q)),
    ),
  }));
  const end = prop === "approvedEdit" ? "Thu 15 Oct · 12:00" : "Wed 14 Oct · 12:00";
  const propChip =
    prop === "pending"
      ? { text: "Needs your approval", tone: "warning" as const }
      : prop === "editing"
        ? { text: "Editing", tone: "default" as const }
        : prop === "dismissed"
          ? { text: "Dismissed", tone: "default" as const }
          : { text: "Approved · applied", tone: "success" as const };
  const headChip = isMain && handedOff ? "With support · SUP-4121" : current?.chip;
  const fbNote =
    fb === "up"
      ? "Thanks. Marked helpful."
      : fb === "down"
        ? fbSent
          ? "Sent for review · FL-0232"
          : "Tell us what was wrong"
        : "Was this helpful?";

  return (
    <PageContent>
      <PageHeader
        eyebrow="Injishi assistant · Isangano Lakeside Hotel"
        title="Assistant"
        actions={
          <Button
            variant="secondary"
            onPress={() => {
              setConv("new");
              setDelAsk(false);
              setDeleted(false);
              setSent([]);
            }}
          >
            <Plus />
            New conversation
          </Button>
        }
      />

      <Card
        className="flex min-h-[860px] flex-row flex-wrap gap-0 overflow-hidden p-0"
        aria-label="Assistant conversations"
      >
        <div className="flex min-w-[min(240px,100%)] flex-[0_1_280px] flex-col gap-2.5 border-r border-separator p-3.5">
          <SearchField aria-label="Search conversations" value={query} onChange={setQuery}>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search conversations" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          {groups.map((g) => (
            <div key={g.label} className="flex flex-col gap-0.5">
              <span className="px-2.5 pt-1.5 text-xs text-muted">{g.label}</span>
              {g.items.map((c) => {
                const chip = c.id === "c305" && handedOff ? "With support · SUP-4121" : c.chip;
                return (
                  <Button
                    key={c.id}
                    variant="ghost"
                    aria-current={conv === c.id ? "true" : undefined}
                    onPress={() => {
                      setConv(c.id);
                      setDelAsk(false);
                      setDeleted(false);
                      setSent([]);
                    }}
                    className="h-auto flex-col items-stretch gap-0.5 px-2.5 py-2"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium">{c.title}</span>
                      <span className="text-[11px] text-muted tabular">{c.time}</span>
                    </span>
                    <span className="truncate text-left text-xs leading-4 text-muted">{c.snippet}</span>
                    {chip ? (
                      <Chip size="sm" variant="soft" color="accent" className="self-start">
                        <Chip.Label>{chip}</Chip.Label>
                      </Chip>
                    ) : null}
                  </Button>
                );
              })}
            </div>
          ))}
          <span className="flex-1" />
          <p className="px-1 text-xs leading-4 text-muted">
            Conversations older than 90 days are deleted automatically.
          </p>
        </div>

        <div className="flex min-w-0 flex-[999_1_520px] flex-col">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-separator px-[18px] py-3">
            <div className="flex min-w-[300px] flex-1 flex-col">
              <span className="font-semibold">{isNew ? "New conversation" : current?.title}</span>
              <span className="text-xs text-muted">
                {isNew ? "Nothing is saved until you send a question" : current?.meta}
              </span>
            </div>
            <Chip size="sm" variant="soft">
              <ShieldCheck className="size-3" />
              <Chip.Label>Scope: Isangano · General manager</Chip.Label>
            </Chip>
            {isMain && !handedOff && !deleted ? (
              <Button size="sm" variant="secondary" onPress={() => setHandoffAsk(true)}>
                <Headphones />
                Talk to a person
              </Button>
            ) : null}
            {headChip && !deleted ? (
              <Chip variant="soft" color="accent">
                <Chip.Label>{headChip}</Chip.Label>
              </Chip>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              aria-label="Delete this conversation"
              onPress={() => setDelAsk(true)}
            >
              <TrashBin />
            </Button>
          </div>

          {delAsk && !deleted ? (
            <Alert status="danger" className="mx-[18px] mt-3">
              <Alert.Indicator>
                <TrashBin />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Delete this conversation now?</Alert.Title>
                <Alert.Description>
                  It is removed before the 90-day limit. Only a usage count is kept. A ticket already sent to support
                  keeps its own copy.
                </Alert.Description>
              </Alert.Content>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onPress={() => setDelAsk(false)}>
                  Keep
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onPress={() => {
                    setDelAsk(false);
                    setDeleted(true);
                    toast.success("Conversation deleted");
                  }}
                >
                  Delete
                </Button>
              </div>
            </Alert>
          ) : null}

          <div className="flex min-h-[520px] flex-1 flex-col">
            <div className="mx-auto flex w-full max-w-[860px] flex-col gap-3.5 px-[18px] pt-[18px] pb-2">
              {deleted ? (
                <EmptyState size="md" className="py-12">
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                      <TrashBin />
                    </EmptyState.Media>
                    <EmptyState.Title>Conversation deleted</EmptyState.Title>
                    <EmptyState.Description>
                      Nothing from it is kept except a usage count for your plan.
                    </EmptyState.Description>
                  </EmptyState.Header>
                </EmptyState>
              ) : null}
              {isNew && !deleted ? (
                <PromptSuggestion className="py-8">
                  <PromptSuggestion.Header>
                    <PromptSuggestion.Title>What do you need to know?</PromptSuggestion.Title>
                    <PromptSuggestion.Description>
                      Ask about rooms, bookings, work orders or how to do something in Injishi. Answers use only
                      Isangano Lakeside Hotel records you can open, and cite them.
                    </PromptSuggestion.Description>
                  </PromptSuggestion.Header>
                </PromptSuggestion>
              ) : null}
              {!deleted && !isNew && current ? (
                <>
                  <ChatMessage.User>
                    <ChatMessage.Bubble className="max-w-[72%]">
                      <ChatMessage.Content>{current.question}</ChatMessage.Content>
                    </ChatMessage.Bubble>
                    <span className="mt-1 text-[11px] text-muted">Aline · {current.questionTime}</span>
                  </ChatMessage.User>
                  <ChatMessage.Assistant className="gap-2">
                    <Avatar size="sm" variant="soft" color="accent">
                      <Avatar.Fallback>
                        <BrandMark size={18} />
                      </Avatar.Fallback>
                    </Avatar>
                    <ChatMessage.Body>
                      {current.answer.map((para) => (
                        <ChatMessage.Content key={para}>{para}</ChatMessage.Content>
                      ))}
                      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
                        {current.sources.map((src) => (
                          <NextLink key={src.n} href={screenHref(src.board)} className="no-underline">
                            <ItemCard variant="secondary" className="px-2.5 py-2">
                              <ItemCard.Icon>
                                <Icon name={src.icon} />
                              </ItemCard.Icon>
                              <ItemCard.Content>
                                <ItemCard.Title>
                                  [{src.n}] {src.title}
                                </ItemCard.Title>
                                <ItemCard.Description className="whitespace-normal">{src.detail}</ItemCard.Description>
                              </ItemCard.Content>
                            </ItemCard>
                          </NextLink>
                        ))}
                      </div>
                      <p className="flex flex-wrap items-center gap-1.5 text-xs leading-4 text-muted">
                        <ShieldCheck className="size-3.5" />
                        <span>Answered from data you can access</span>
                        {current.permissions.map((pm) => (
                          <Chip key={pm} size="sm" variant="soft">
                            <Chip.Label>{pm}</Chip.Label>
                          </Chip>
                        ))}
                      </p>
                      {isMain && current.proposal ? (
                        <ProposalCard
                          prop={prop}
                          end={end}
                          chip={propChip.text}
                          tone={propChip.tone}
                          onApprove={() => setProp("approved")}
                          onEdit={() => setProp("editing")}
                          onDismiss={() => setProp("dismissed")}
                          onApproveEdited={() => setProp("approvedEdit")}
                          onCancelEdit={() => setProp("pending")}
                          onRestore={() => setProp("pending")}
                        />
                      ) : null}
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          aria-label="Helpful"
                          aria-pressed={fb === "up"}
                          onPress={() => {
                            setFb("up");
                            setFbSent(false);
                          }}
                          className={fb === "up" ? "text-accent" : undefined}
                        >
                          <ThumbsUp />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          aria-label="Not helpful"
                          aria-pressed={fb === "down"}
                          onPress={() => {
                            setFb("down");
                            setFbSent(false);
                          }}
                          className={fb === "down" ? "text-danger" : undefined}
                        >
                          <ThumbsDown />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          aria-label="Copy answer"
                          onPress={() => toast.success("Answer copied with its source references")}
                        >
                          <Copy />
                        </Button>
                        <span className="text-xs text-muted">{fbNote}</span>
                      </div>
                      {fb === "down" && !fbSent ? (
                        <div className="flex flex-col gap-2">
                          <span className="text-[13px] font-medium">What was wrong?</span>
                          <TagGroup
                            aria-label="Feedback reason"
                            selectionMode="single"
                            selectedKeys={reason ? [reason] : []}
                            onSelectionChange={(keys) => {
                              const k = [...keys][0];
                              setReason(k ? String(k) : null);
                            }}
                          >
                            <TagGroup.List className="flex flex-wrap gap-1.5">
                              {REASONS.map((r) => (
                                <Tag key={r} id={r} size="sm">
                                  {r}
                                </Tag>
                              ))}
                            </TagGroup.List>
                          </TagGroup>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => {
                                setFbSent(true);
                                toast.success("Feedback sent for review · FL-0232");
                              }}
                            >
                              Send for review
                            </Button>
                            <span className="text-xs text-muted">
                              Shares this answer and its sources with Injishi reviewers, nothing else.
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </ChatMessage.Body>
                  </ChatMessage.Assistant>
                  {isMain && handedOff ? (
                    <Alert status="accent" role="status">
                      <Alert.Indicator>
                        <Headphones />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>Handed to Injishi support · ticket SUP-4121</Alert.Title>
                        <Alert.Description>
                          The ticket has this transcript and the record IDs it cites (WO-312, room 305 housekeeping
                          record). Support opens records only within their own logged access. You will be notified when
                          someone replies.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}
                </>
              ) : null}
              {sent.map((text) => (
                <div key={text} className="flex flex-col gap-3.5">
                  <ChatMessage.User>
                    <ChatMessage.Bubble className="max-w-[72%]">
                      <ChatMessage.Content>{text}</ChatMessage.Content>
                    </ChatMessage.Bubble>
                    <span className="mt-1 text-[11px] text-muted">Aline · just now</span>
                  </ChatMessage.User>
                  <ChatMessage.Assistant>
                    <Avatar size="sm" variant="soft" color="accent">
                      <Avatar.Fallback>
                        <BrandMark size={18} />
                      </Avatar.Fallback>
                    </Avatar>
                    <ChatMessage.Body role="status">
                      <span className="text-[13px] text-muted">Checking records you can access…</span>
                      <Skeleton className="block h-3 w-4/5 rounded-md" />
                      <Skeleton className="block h-3 w-[55%] rounded-md" />
                    </ChatMessage.Body>
                  </ChatMessage.Assistant>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 px-[18px] pt-2.5 pb-3.5">
            <PromptSuggestion>
              <PromptSuggestion.Items className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <PromptSuggestion.Item key={s} className="w-auto px-3 py-1.5 text-[13px]" onPress={() => setDraft(s)}>
                    {s}
                  </PromptSuggestion.Item>
                ))}
              </PromptSuggestion.Items>
            </PromptSuggestion>
            <PromptInput value={draft} onValueChange={setDraft} onSubmit={() => send()} variant="primary">
              <PromptInput.Shell>
                <PromptInput.Content>
                  <Label className="sr-only" htmlFor="ask">
                    Ask the Injishi assistant
                  </Label>
                  <PromptInput.TextArea
                    id="ask"
                    rows={2}
                    placeholder="Ask about rooms, bookings, or how to do something in Injishi…"
                  />
                </PromptInput.Content>
                <PromptInput.Toolbar>
                  <PromptInput.ToolbarStart>
                    <Chip size="sm" variant="soft">
                      <Lock className="size-3" />
                      <Chip.Label>Isangano Lakeside Hotel only</Chip.Label>
                    </Chip>
                  </PromptInput.ToolbarStart>
                  <PromptInput.ToolbarEnd>
                    <PromptInput.Send aria-label="Send" isDisabled={!draft.trim()} />
                  </PromptInput.ToolbarEnd>
                </PromptInput.Toolbar>
              </PromptInput.Shell>
              <PromptInput.Footer>
                Kept 90 days, then deleted (Amahoro Hospitality Group setting). Support sees a transcript only if you
                hand it over. The assistant cannot see payroll, other properties or other businesses.
              </PromptInput.Footer>
            </PromptInput>
          </div>
        </div>
      </Card>

      <Modal.Backdrop isOpen={handoffAsk} onOpenChange={(open) => !open && setHandoffAsk(false)}>
        <Modal.Container>
          <Modal.Dialog aria-labelledby="ho-h" className="gap-4 sm:max-w-[520px]">
            <Modal.Header className="flex-col items-start gap-1">
              <Modal.Heading id="ho-h" className="text-[18px] leading-[26px] font-semibold">
                Talk to a Person
              </Modal.Heading>
              <p className="text-[13px] leading-[18px] text-muted">
                Injishi support will pick this up as ticket SUP-4121. Here is exactly what they receive.
              </p>
            </Modal.Header>
            <Modal.Body className="gap-3">
              <ul className="flex list-none flex-col gap-2 p-0">
                <li className="flex items-start gap-2.5 text-[13px]">
                  <Icon name="Comments" className="mt-0.5 text-muted" />
                  This conversation’s transcript (your question and the answer)
                </li>
                <li className="flex items-start gap-2.5 text-[13px]">
                  <Icon name="Link" className="mt-0.5 text-muted" />
                  Record IDs only: WO-312 and the room 305 housekeeping record
                </li>
                <li className="flex items-start gap-2.5 text-[13px]">
                  <Icon name="Person" className="mt-0.5 text-muted" />
                  Your name, role and property, so they can reply
                </li>
              </ul>
              <TextField
                fullWidth
                defaultValue="The heater supplier may slip to Wednesday. Can the block be extended automatically if WO-312 is still open?"
                className="gap-1"
              >
                <Label htmlFor="ho-note">Add a note (optional)</Label>
                <TextArea id="ho-note" rows={2} />
              </TextField>
            </Modal.Body>
            <Modal.Footer className="justify-end gap-2">
              <Button variant="secondary" onPress={() => setHandoffAsk(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onPress={() => {
                  setHandoffAsk(false);
                  setHanded(true);
                  setConv("c305");
                  toast.success("Ticket SUP-4121 created with this transcript");
                }}
              >
                <Headphones />
                Create ticket
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );

  function send() {
    const text = draft.trim();
    if (!text) return;
    setSent((items) => [...items, text]);
    setDraft("");
  }
}

function ProposalCard({
  prop,
  end,
  chip,
  tone,
  onApprove,
  onEdit,
  onDismiss,
  onApproveEdited,
  onCancelEdit,
  onRestore,
}: {
  prop: Proposal;
  end: string;
  chip: string;
  tone: "warning" | "default" | "success";
  onApprove: () => void;
  onEdit: () => void;
  onDismiss: () => void;
  onApproveEdited: () => void;
  onCancelEdit: () => void;
  onRestore: () => void;
}) {
  return (
    <Card variant="secondary" className="gap-2.5 px-4 py-3.5" role="group" aria-labelledby="prop-h">
      <div className="flex flex-wrap items-start gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-default">
          <Calendar className="size-4" />
        </span>
        <div className="flex min-w-[260px] flex-1 flex-col">
          <span className="text-xs text-muted">Proposed action</span>
          <span id="prop-h" className="font-semibold">
            Extend out-of-order block to 14 Oct
          </span>
        </div>
        <Chip size="sm" variant="soft" color={tone === "default" ? "default" : tone}>
          <Chip.Label>{chip}</Chip.Label>
        </Chip>
      </div>
      <KeyValueList
        items={[
          { label: "Room", value: "305 · Deluxe Lake View" },
          { label: "Block ends now", value: "Tue 13 Oct · 12:00" },
          { label: "Proposed end", value: end },
          {
            label: "Effect",
            value: "Night of 13 Oct taken off sale on direct and channel inventory. No reservation is affected.",
          },
        ]}
      />
      {prop === "pending" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary" onPress={onApprove}>
            <Check />
            Approve
          </Button>
          <Button size="sm" variant="secondary" onPress={onEdit}>
            <Pencil />
            Edit
          </Button>
          <Button size="sm" variant="ghost" onPress={onDismiss}>
            Dismiss
          </Button>
          <span className="min-w-[220px] flex-1 text-xs text-muted">
            Nothing changes until you approve. It is applied under your name.
          </span>
        </div>
      ) : null}
      {prop === "editing" ? (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <TextField fullWidth defaultValue="Thu 15 Oct 2026 · 12:00" className="gap-1">
              <Label htmlFor="back">Back in service</Label>
              <Input id="back" />
            </TextField>
            <TextField fullWidth defaultValue="Heater replacement and leak check · WO-312" className="gap-1">
              <Label htmlFor="why">Reason on the room rack</Label>
              <Input id="why" />
            </TextField>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onPress={onApproveEdited}>
              Approve edited change
            </Button>
            <Button size="sm" variant="ghost" onPress={onCancelEdit}>
              Cancel
            </Button>
          </div>
        </>
      ) : null}
      {prop === "approved" || prop === "approvedEdit" ? (
        <>
          <Alert status="success" role="status">
            <Alert.Indicator>
              <CircleCheck />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Approved by you at 09:14</Alert.Title>
              <Alert.Description>
                Injishi applied your change: the block now ends {end}. Logged on WO-312 and the room rack under Aline
                Uwase.
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <LinkButton href={screenHref("RoomRack")} variant="ghost" size="sm" className="self-start">
            Open room rack
            <ArrowRight />
          </LinkButton>
        </>
      ) : null}
      {prop === "dismissed" ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[13px] text-muted">
            Dismissed · nothing was changed. The block still ends Tue 13 Oct 12:00.
          </span>
          <Button size="sm" variant="ghost" onPress={onRestore}>
            Show again
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
