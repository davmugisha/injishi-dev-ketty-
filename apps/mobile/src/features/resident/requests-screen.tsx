import type {
  RepairCategory,
  RepairDraft,
  RepairRequest,
  Tenancy,
  VisitorDraft,
  VisitorPass,
} from "@injishi/data/fixtures/resident";
import { Button, Card, Input, Label, Switch, TextArea, TextField, useToast } from "heroui-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody, PhoneTop } from "@/components/phone";
import { useSession } from "@/lib/session";
import { getCollection } from "@/lib/store";
import { ChoiceField, copyText, PhoneTitle, PhotoThumb, RowList, SectionTitle, Segmented } from "./ui";

type Tab = "repairs" | "visitors";

/** Repairs and visitor codes for the resident's unit (artifact: TenantRequests). */
export default function TenantRequestsScreen() {
  const { persona } = useSession();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("repairs");
  const [category, setCategory] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState<boolean | null>(null);
  const [entry, setEntry] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState<RepairRequest[]>([]);
  const [visitorName, setVisitorName] = useState<string | null>(null);
  const [visitDate, setVisitDate] = useState<string | null>(null);
  const [visitTime, setVisitTime] = useState<string | null>(null);
  const [overnight, setOvernight] = useState(false);
  const [codeReady, setCodeReady] = useState(false);

  const tenancies = getCollection<Tenancy>("resident.tenancies");
  const categories = getCollection<RepairCategory>("resident.repairCategories");
  const drafts = getCollection<RepairDraft>("resident.repairDrafts");
  const repairs = getCollection<RepairRequest>("resident.repairs");
  const visitorDrafts = getCollection<VisitorDraft>("resident.visitorDrafts");
  const visitors = getCollection<VisitorPass>("resident.visitors");

  const tenancy = tenancies.find((item) => item.persona === persona?.id) ?? tenancies[0];
  const draft = drafts[0];
  const visitorDraft = visitorDrafts[0];
  if (!tenancy || !draft || !visitorDraft || !categories.length) return null;

  const categoryId = category ?? draft.category;
  const photoOn = photo ?? true;
  const entryOn = entry ?? draft.staffMayEnter;
  const name = visitorName ?? visitorDraft.name;
  const date = visitDate ?? visitorDraft.date;
  const time = visitTime ?? visitorDraft.time;
  const repairRows = [...submitted, ...repairs];
  const issued: VisitorPass[] = codeReady
    ? [
        {
          id: `local-${visitorDraft.code}`,
          name,
          desc: `${visitorDraft.date}, ${visitorDraft.time} · registered just now`,
          state: "Code issued",
          tone: "info",
          code: visitorDraft.code,
        },
      ]
    : [];
  const visitorRows = [...issued, ...visitors];
  const canSend = desc.trim().length > 0;

  const submit = () => {
    const text = desc.trim();
    if (!text) return;
    setSubmitted((items) => [
      {
        id: `local-${items.length + 1}`,
        title: text.slice(0, 60),
        desc: "Sent just now · management will reply here",
        state: "Submitted",
        tone: "warning",
        sentAt: new Date().toISOString(),
        category: categoryId,
        staffMayEnter: entryOn,
        photos: photoOn ? 1 : 0,
      },
      ...items,
    ]);
    setDesc("");
    toast.show({
      variant: "success",
      label: "Request sent to management",
      icon: <Icon name="CircleCheck" tone="success" />,
    });
  };

  const shareCode = async () => {
    const copied = await copyText(visitorDraft.code);
    toast.show(copied ? `Code ${visitorDraft.code} copied` : `Code ${visitorDraft.code}`);
  };

  return (
    <>
      <PhoneTop>
        <View className="min-w-0 w-full flex-1 gap-[10px]">
          <PhoneTitle title="Requests" sub={`Unit ${tenancy.unit} · ${tenancy.property}`} />
          <Segmented
            label="Request type"
            value={tab}
            onChange={(value) => {
              if (value === "repairs" || value === "visitors") setTab(value);
            }}
            items={[
              { id: "repairs", label: "Repairs" },
              { id: "visitors", label: "Visitors" },
            ]}
          />
        </View>
      </PhoneTop>

      <PhoneBody>
        {tab === "repairs" ? (
          <>
            <Card className="gap-3 p-4">
              <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
                Request a repair
              </Text>
              <ChoiceField
                label="What needs fixing?"
                value={categoryId}
                onChange={setCategory}
                options={categories.map((item) => ({ id: item.id, label: item.label }))}
              />
              <TextField>
                <Label>Describe the problem</Label>
                <TextArea
                  accessibilityLabel="Describe the problem"
                  value={desc}
                  onChangeText={setDesc}
                  numberOfLines={3}
                  placeholder="Where is it, and since when?"
                  style={{ height: 72 }}
                />
              </TextField>
              <View className="gap-[6px]">
                <Label>Photos</Label>
                <View className="flex-row gap-2">
                  {photoOn ? <PhotoThumb image={draft.photo} className="size-[72px] rounded-[14px]" /> : null}
                  <Button
                    variant="secondary"
                    isIconOnly
                    accessibilityLabel="Add a photo"
                    className="size-[72px] rounded-[14px]"
                    onPress={() => setPhoto(true)}
                  >
                    <Icon name="Camera" size={20} />
                  </Button>
                </View>
              </View>
              <View className="flex-row items-center gap-[10px]">
                <Switch
                  isSelected={entryOn}
                  onSelectedChange={setEntry}
                  accessibilityLabel="Staff may enter if I am not home"
                />
                <Text className="flex-1 text-sm text-foreground" onPress={() => setEntry(!entryOn)}>
                  Staff may enter if I am not home
                </Text>
              </View>
              <Button size="lg" className="w-full" onPress={submit} isDisabled={!canSend}>
                <Button.Label>Send request</Button.Label>
              </Button>
              {canSend ? null : <Text className="text-xs text-muted">Add a short description to send.</Text>}
              <Text className="text-xs leading-4 text-muted">
                For water or electrical emergencies, also call the caretaker at the gate.
              </Text>
            </Card>

            <View className="gap-2">
              <SectionTitle>My requests</SectionTitle>
              <RowList
                label="My requests"
                rows={repairRows.map((row) => ({
                  id: row.id,
                  icon: "Wrench",
                  title: row.title,
                  desc: row.desc,
                  chip: row.state,
                  tone: row.tone,
                }))}
              />
            </View>
          </>
        ) : (
          <>
            {codeReady ? (
              <Card accessibilityLiveRegion="polite" className="items-center gap-[10px] p-4">
                <Text className="text-xs text-muted">Access code for {name}</Text>
                <Text className="text-[36px] leading-[44px] font-bold tracking-[6px] text-foreground">
                  {visitorDraft.code}
                </Text>
                <Text className="text-center text-[13px] text-foreground">
                  Valid {visitorDraft.dateLong}, {visitorDraft.time} · expires automatically
                </Text>
                <Button variant="secondary" onPress={shareCode}>
                  <Icon name="PaperPlane" />
                  <Button.Label>Share code</Button.Label>
                </Button>
              </Card>
            ) : null}

            <Card className="gap-3 p-4">
              <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
                Register a visitor
              </Text>
              <TextField>
                <Label>Visitor’s name</Label>
                <Input accessibilityLabel="Visitor’s name" value={name} onChangeText={setVisitorName} />
              </TextField>
              <View className="flex-row gap-[10px]">
                <TextField className="flex-1">
                  <Label>Date</Label>
                  <Input accessibilityLabel="Date" value={date} onChangeText={setVisitDate} />
                </TextField>
                <TextField className="flex-1">
                  <Label>Time</Label>
                  <Input accessibilityLabel="Time" value={time} onChangeText={setVisitTime} />
                </TextField>
              </View>
              <View className="flex-row items-center gap-[10px]">
                <Switch isSelected={overnight} onSelectedChange={setOvernight} accessibilityLabel="Staying overnight" />
                <Text className="flex-1 text-sm text-foreground" onPress={() => setOvernight((value) => !value)}>
                  Staying overnight
                </Text>
              </View>
              {overnight ? (
                <Text className="text-xs leading-4 text-muted">
                  Overnight visits longer than {visitorDraft.maxNights} nights need management approval before a code is
                  issued.
                </Text>
              ) : null}
              <Button size="lg" className="w-full" onPress={() => setCodeReady(true)}>
                <Button.Label>Get access code</Button.Label>
              </Button>
            </Card>

            <View className="gap-2">
              <SectionTitle>Upcoming and recent</SectionTitle>
              <RowList
                label="Upcoming and recent visitors"
                rows={visitorRows.map((row) => ({
                  id: row.id,
                  icon: "Person",
                  title: row.name,
                  desc: row.desc,
                  chip: row.state,
                  tone: row.tone,
                  extra: row.code || undefined,
                }))}
              />
            </View>
          </>
        )}
      </PhoneBody>
    </>
  );
}
