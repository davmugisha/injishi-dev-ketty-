"use client";

import { Camera, CircleCheck, PaperPlane, Person, Wrench } from "@gravity-ui/icons";
import { Button, Card, Input, Label, Switch, TextArea, TextField, toast } from "@heroui/react";
import { ListView, NativeSelect, Segment } from "@heroui-pro/react";
import type {
  RepairCategory,
  RepairRequest,
  Tenancy,
  VisitorDraft,
  VisitorPass,
} from "@injishi/data/fixtures/resident";
import { PhoneBody, PhoneTop } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerVisitorAction, requestRepairAction } from "./actions";
import { PhoneToasts, ResidentTitle, renderSection, SectionTitle, ToneChip } from "./parts";

type Tab = "repairs" | "visitors";

/** Repairs and visitor codes for the resident's unit (artifact: TenantRequests). */
export function TenantRequestsView({
  tenancy,
  categories,
  repairs,
  visitorDraft,
  visitors,
}: {
  tenancy: Tenancy;
  categories: RepairCategory[];
  repairs: RepairRequest[];
  visitorDraft: VisitorDraft;
  visitors: VisitorPass[];
}) {
  const [tab, setTab] = useState<Tab>("repairs");
  // Both forms start empty: what is sent is what the resident chose and typed, never a sample draft. The
  // category list needs one choice, so it opens on the first; entering when nobody is home is the resident's
  // own permission, so it starts off.
  const [category, setCategory] = useState(categories[0]?.id ?? "other");
  const [desc, setDesc] = useState("");
  const [entry, setEntry] = useState(false);
  const [visitorName, setVisitorName] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [overnight, setOvernight] = useState(false);
  /** The code the gate issued for the visitor just registered, with the name and day it was issued for. */
  const [issued, setIssued] = useState<{ code: string; name: string; when: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const repairRows: RepairRequest[] = repairs;
  const visitorRows: VisitorPass[] = visitors;
  const canSend = desc.trim().length > 0;

  /** Send request → `POST /me/residence/repairs`; the list comes back from the server with its WO number. */
  const submit = async () => {
    const text = desc.trim();
    if (!text || busy) return;
    setBusy(true);
    const result = await requestRepairAction({ unit: tenancy.unit, category, description: text, staffMayEnter: entry });
    setBusy(false);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    setDesc("");
    toast(`Request ${result.value} sent to management`, { indicator: <CircleCheck /> });
    router.refresh();
  };

  /** Get access code → `POST /me/residence/visitor-passes`; the server mints the code. */
  const getCode = async () => {
    if (busy) return;
    setBusy(true);
    const name = visitorName.trim();
    const result = await registerVisitorAction({
      unit: tenancy.unit,
      visitorName: name,
      date: visitDate,
      time: visitTime,
      overnight,
    });
    setBusy(false);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    setIssued({ code: result.value.code, name, when: `${visitDate.trim() || "Today"}, ${visitTime.trim()}` });
    setVisitorName("");
    setVisitDate("");
    setVisitTime("");
    router.refresh();
  };

  const shareCode = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.code);
      toast(`Code ${issued.code} copied`, { indicator: <CircleCheck /> });
    } catch {
      toast(`Code ${issued.code}`, { indicator: <CircleCheck /> });
    }
  };

  return (
    <>
      <PhoneTop>
        <div className="flex w-full flex-col gap-[10px]">
          <ResidentTitle title="Requests" sub={`Unit ${tenancy.unit} · ${tenancy.property}`} />
          <Segment
            aria-label="Request type"
            selectedKey={tab}
            onSelectionChange={(key) => {
              if (key === "repairs" || key === "visitors") setTab(key);
            }}
            className="w-full"
          >
            <Segment.Item id="repairs" className="flex-1">
              Repairs
            </Segment.Item>
            <Segment.Item id="visitors" className="flex-1">
              <Segment.Separator />
              Visitors
            </Segment.Item>
          </Segment>
        </div>
      </PhoneTop>

      <PhoneBody>
        {tab === "repairs" ? (
          <>
            <Card render={renderSection} aria-labelledby="rq-h" className="gap-3 p-4">
              <h2 id="rq-h" className="text-[15px] leading-[22px] font-semibold">
                Request a repair
              </h2>
              <NativeSelect fullWidth className="flex flex-col gap-1">
                <Label>What needs fixing?</Label>
                <NativeSelect.Trigger value={category} onChange={(event) => setCategory(event.target.value)}>
                  {categories.map((c) => (
                    <NativeSelect.Option key={c.id} value={c.id}>
                      {c.label}
                    </NativeSelect.Option>
                  ))}
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
              <TextField fullWidth value={desc} onChange={setDesc} className="gap-1">
                <Label htmlFor="rq-d">Describe the problem</Label>
                <TextArea id="rq-d" rows={3} placeholder="Where is it, and since when?" />
              </TextField>
              <div className="flex flex-col gap-[6px]">
                <Label>Photos</Label>
                <div className="flex gap-2">
                  <Button
                    isIconOnly
                    variant="secondary"
                    aria-label="Add a photo"
                    className="size-[72px] rounded-[14px]"
                    onPress={() =>
                      toast.danger(
                        "Adding photos is not available yet. Describe the problem in words; nothing was attached.",
                      )
                    }
                  >
                    <Camera className="size-5" />
                  </Button>
                </div>
              </div>
              <Switch isSelected={entry} onChange={setEntry} className="w-full text-left">
                <Switch.Content className="flex items-center gap-[10px]">
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <span className="text-[14px]">Staff may enter if I am not home</span>
                </Switch.Content>
              </Switch>
              <Button variant="primary" size="lg" fullWidth onPress={submit} isDisabled={!canSend || busy}>
                Send request
              </Button>
              {canSend ? null : <span className="text-[12px] text-muted">Add a short description to send.</span>}
              <span className="text-[12px] leading-4 text-muted">
                For water or electrical emergencies, also call the caretaker at the gate.
              </span>
            </Card>

            <section className="flex flex-col gap-2" aria-labelledby="my-h">
              <SectionTitle id="my-h">My requests</SectionTitle>
              <ListView aria-label="My requests">
                {repairRows.map((r) => (
                  <ListView.Item key={r.id} id={r.id} textValue={r.title} className="items-start">
                    <ListView.ItemContent className="items-start">
                      <Wrench className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title className="whitespace-normal">{r.title}</ListView.Title>
                        <ListView.Description className="whitespace-normal">{r.desc}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                      <ToneChip tone={r.tone} size="sm">
                        {r.state}
                      </ToneChip>
                    </ListView.ItemAction>
                  </ListView.Item>
                ))}
              </ListView>
            </section>
          </>
        ) : (
          <>
            {issued ? (
              <Card render={renderSection} aria-live="polite" className="items-center gap-[10px] p-4 text-center">
                <span className="text-[12px] text-muted">Access code for {issued.name}</span>
                <span className="text-[36px] leading-[44px] font-bold tracking-[6px] tabular">{issued.code}</span>
                <span className="text-[13px]">Valid {issued.when} · expires automatically</span>
                <Button variant="secondary" onPress={shareCode}>
                  <PaperPlane className="size-4" />
                  Share code
                </Button>
              </Card>
            ) : null}

            <Card render={renderSection} aria-labelledby="pv-h" className="gap-3 p-4">
              <h2 id="pv-h" className="text-[15px] leading-[22px] font-semibold">
                Register a visitor
              </h2>
              <TextField fullWidth value={visitorName} onChange={setVisitorName} className="gap-1">
                <Label htmlFor="pv-n">Visitor’s name</Label>
                <Input id="pv-n" placeholder="Full name" />
              </TextField>
              <div className="grid grid-cols-2 gap-[10px]">
                <TextField fullWidth value={visitDate} onChange={setVisitDate} className="gap-1">
                  <Label htmlFor="pv-d">Date</Label>
                  <Input id="pv-d" placeholder="Today" />
                </TextField>
                <TextField fullWidth value={visitTime} onChange={setVisitTime} className="gap-1">
                  <Label htmlFor="pv-t">Time</Label>
                  <Input id="pv-t" placeholder="e.g. 10:00–16:00" />
                </TextField>
              </div>
              <Switch isSelected={overnight} onChange={setOvernight} className="w-full text-left">
                <Switch.Content className="flex items-center gap-[10px]">
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <span className="text-[14px]">Staying overnight</span>
                </Switch.Content>
              </Switch>
              {overnight ? (
                <span className="text-[12px] leading-4 text-muted">
                  Overnight visits longer than {visitorDraft.maxNights} nights need management approval before a code is
                  issued.
                </span>
              ) : null}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onPress={getCode}
                isDisabled={busy || !visitorName.trim() || !visitTime.trim()}
              >
                Get access code
              </Button>
            </Card>

            <section className="flex flex-col gap-2" aria-labelledby="up-h">
              <SectionTitle id="up-h">Upcoming and recent</SectionTitle>
              <ListView aria-label="Upcoming and recent visitors">
                {visitorRows.map((v) => (
                  <ListView.Item key={v.id} id={v.id} textValue={v.name} className="items-start">
                    <ListView.ItemContent className="items-start">
                      <Person className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>{v.name}</ListView.Title>
                        <ListView.Description className="whitespace-normal">{v.desc}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction className="flex flex-col items-end gap-1">
                      <ToneChip tone={v.tone} size="sm">
                        {v.state}
                      </ToneChip>
                      {v.code ? <span className="text-[12px] text-muted tabular">{v.code}</span> : null}
                    </ListView.ItemAction>
                  </ListView.Item>
                ))}
              </ListView>
            </section>
          </>
        )}
      </PhoneBody>
      <PhoneToasts />
    </>
  );
}
