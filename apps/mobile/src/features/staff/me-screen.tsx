import { screenHref } from "@injishi/data";
import type {
  HelpTicket,
  HelpTopic,
  LeaveBalance,
  LoanedAsset,
  Payslip,
  StaffDocument,
  StaffProfile,
  StaffRequest,
} from "@injishi/data/fixtures/staff";
import { Link, useLocalSearchParams } from "expo-router";
import { Avatar, Button, Card, Chip, Label, TextArea, TextField } from "heroui-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody, PhoneTop } from "@/components/phone";
import { useSession } from "@/lib/session";
import { getCollection, getDocument } from "@/lib/store";
import { toneColor } from "@/lib/tone";
import { formatRwf, PhoneSheet, param, SectionTitle, Segmented, StatusDot, ToneTile } from "./ui";

const COPY = {
  en: {
    me: "Me",
    payslips: "Payslips",
    leave: "Leave",
    docs: "My documents",
    assets: "Assets on loan",
    help: "Help desk",
    lang: "Language",
    signout: "Sign out",
  },
  rw: {
    me: "Njye",
    payslips: "Impapuro z’umushahara",
    leave: "Ikiruhuko",
    docs: "Inyandiko zanjye",
    assets: "Ibikoresho nahawe",
    help: "Ubufasha",
    lang: "Ururimi",
    signout: "Sohoka",
  },
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "bio", "0", "del"] as const;

/** Staff member's own page: profile, payslips, leave, documents, assets, help (artifact: StaffMe). */
export default function StaffMeScreen() {
  const { persona, signOut } = useSession();
  const unlockedParam = param(useLocalSearchParams<{ payslips?: string }>().payslips) === "unlocked";
  const profile =
    (persona ? getDocument<StaffProfile>("staff.profiles", persona.id) : undefined) ??
    getDocument<StaffProfile>("staff.profiles", "housekeeper");
  const payslips = getCollection<Payslip>("staff.payslips");
  const balance = getDocument<LeaveBalance>("staff.leaveBalances", "housekeeper");
  const requests = getCollection<StaffRequest>("staff.requests");
  const storedDocs = getCollection<StaffDocument>("staff.documents");
  const assets = getCollection<LoanedAsset>("staff.assets");
  const storedTickets = getCollection<HelpTicket>("staff.helpTickets");
  const topics = getCollection<HelpTopic>("staff.helpTopics");

  const [unlocked, setUnlocked] = useState(unlockedParam);
  const [sheet, setSheet] = useState<"" | "pin" | "help">("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [openSlip, setOpenSlip] = useState<string | null>("sep");
  const [pdfSaved, setPdfSaved] = useState(false);
  const [lang, setLang] = useState<"en" | "rw">("en");
  const [topic, setTopic] = useState("uniform");
  const [question, setQuestion] = useState(() => topics.find((t) => t.id === "uniform")?.draft ?? "");
  const [docAdded, setDocAdded] = useState(false);
  const [helpSent, setHelpSent] = useState<string | null>(null);

  if (!persona || !profile || !balance || !topics.length) return null;

  const t = COPY[lang];
  const pending = payslips.find((p) => p.status === "pending");
  const available = payslips.filter((p) => p.status === "available");
  const cur = available.find((p) => p.id === openSlip);
  const asked = requests.filter((q) => q.status === "manager").reduce((a, q) => a + q.days, 0);
  const topicDoc = topics.find((x) => x.id === topic) ?? topics[0];

  const documents: StaffDocument[] = docAdded
    ? [
        {
          id: "doctor-note",
          icon: "FileArrowUp",
          name: "Doctor’s note",
          meta: "Photo taken just now · sending on weak signal",
          chip: "Sending",
          tone: "warning",
        },
        ...storedDocs,
      ]
    : storedDocs;
  const tickets: HelpTicket[] = helpSent
    ? [
        {
          id: "HD-0931",
          title: `${helpSent} question`,
          meta: "HD-0931 · sent just now",
          chip: "Sent",
          tone: "default",
        },
        ...storedTickets,
      ]
    : storedTickets;

  const press = (d: string) => {
    const next = (pin + d).slice(0, 4);
    if (next.length < 4) {
      setPin(next);
      setPinError(false);
      return;
    }
    if (next === "0000") {
      setPin("");
      setPinError(true);
      return;
    }
    setPin("");
    setPinError(false);
    setUnlocked(true);
    setSheet("");
  };

  const closeSheet = () => {
    setSheet("");
    setPin("");
  };

  const pickTopic = (id: string) => {
    setTopic(id);
    setQuestion(topics.find((x) => x.id === id)?.draft ?? "");
  };

  return (
    <View className="flex-1">
      <PhoneTop>
        <Text accessibilityRole="header" className="flex-1 text-[22px] leading-7 font-semibold text-foreground">
          {t.me}
        </Text>
        <Chip color="success" variant="soft">
          <StatusDot tone="success" />
          <Chip.Label>In since {profile.clockedInAt}</Chip.Label>
        </Chip>
      </PhoneTop>

      <PhoneBody>
        <Card accessibilityLabel="Profile" className="flex-row items-center gap-3 p-4">
          <Avatar size="lg" variant="soft" color="accent" alt={persona.name}>
            <Avatar.Fallback>{persona.initials}</Avatar.Fallback>
          </Avatar>
          <View className="min-w-0 flex-1">
            <Text className="text-base leading-[22px] font-semibold text-foreground">{persona.name}</Text>
            <Text className="text-[13px] leading-[18px] text-muted">
              {persona.role} · {profile.workplace}
            </Text>
            <Text className="text-xs leading-4 text-muted">
              Staff no. {profile.staffNo} · since {profile.since}
            </Text>
          </View>
        </Card>

        <View className="gap-2">
          <View className="min-h-11 flex-row items-center justify-between">
            <SectionTitle>{t.payslips}</SectionTitle>
            {unlocked ? (
              <Button
                variant="ghost"
                className="min-h-11"
                onPress={() => {
                  setUnlocked(false);
                  setOpenSlip("sep");
                }}
              >
                <Icon name="Lock" />
                <Button.Label>Lock</Button.Label>
              </Button>
            ) : null}
          </View>
          {!unlocked ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Payslips are locked"
              onPress={() => {
                setSheet("pin");
                setPin("");
                setPinError(false);
              }}
            >
              <Card className="min-h-16 flex-row items-center gap-3 p-4">
                <Icon name="Lock" />
                <View className="min-w-0 flex-1">
                  <Text className="font-medium text-foreground">Payslips are locked</Text>
                  <Text className="text-[13px] leading-[18px] text-muted">
                    Enter your PIN to see your pay. It locks again when you leave.
                  </Text>
                </View>
                <Icon name="ChevronRight" tone="muted" />
              </Card>
            </Pressable>
          ) : (
            <>
              <View accessibilityLabel="Payslips" className="gap-2">
                {pending ? (
                  <Card className="min-h-16 flex-row items-start gap-3 p-4">
                    <Icon name="Hourglass" tone="muted" />
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text className="font-medium text-foreground">{pending.month}</Text>
                      <Text className="text-xs leading-4 text-muted">{pending.note}</Text>
                    </View>
                    <Chip size="sm" variant="soft">
                      <Chip.Label>Not released yet</Chip.Label>
                    </Chip>
                  </Card>
                ) : null}
                {available.map((p) => (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityLabel={p.month}
                    onPress={() => setOpenSlip((o) => (o === p.id ? null : p.id))}
                  >
                    <Card className="min-h-[60px] flex-row items-center gap-3 px-4 py-3">
                      <Icon name="FileText" />
                      <View className="min-w-0 flex-1">
                        <Text className="font-medium text-foreground">{p.month}</Text>
                        <Text className="text-[13px] leading-[18px] text-muted">
                          Net {formatRwf(p.net ?? 0)} · paid {p.paid}
                        </Text>
                      </View>
                      <Chip size="sm" variant="soft" color="success">
                        <Chip.Label>Available</Chip.Label>
                      </Chip>
                      <Icon name={openSlip === p.id ? "ChevronUp" : "ChevronDown"} tone="muted" />
                    </Card>
                  </Pressable>
                ))}
              </View>
              {cur ? (
                <Card className="gap-2.5 p-4">
                  <View>
                    <Text
                      accessibilityRole="header"
                      className="text-[15px] leading-[22px] font-semibold text-foreground"
                    >
                      {cur.month} payslip
                    </Text>
                    <Text className="text-xs leading-4 text-muted">{cur.employer}</Text>
                  </View>
                  <View className="gap-1.5">
                    {cur.lines.map((l) => {
                      const strong = l.kind === "total" || l.kind === "subtotal";
                      const muted = l.kind === "earning" || l.kind === "deduction";
                      return (
                        <View
                          key={l.label}
                          className={`flex-row items-center justify-between gap-2 ${
                            l.kind === "total" ? "text-base" : ""
                          } ${strong ? "border-t border-separator pt-1.5" : ""}`}
                        >
                          <Text
                            className={`${strong ? "font-semibold" : ""} ${muted ? "text-muted" : "text-foreground"} ${l.kind === "total" ? "text-base" : "text-[13px]"}`}
                          >
                            {l.label}
                          </Text>
                          <Text
                            className={`${strong ? "font-semibold" : ""} ${muted ? "text-muted" : "text-foreground"} ${l.kind === "total" ? "text-base" : "text-[13px]"}`}
                          >
                            {l.kind === "deduction" ? `− ${formatRwf(l.amount)}` : formatRwf(l.amount)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  <View className="flex-row items-start gap-2">
                    <Icon name="CircleCheck" tone="muted" />
                    <Text className="flex-1 text-xs leading-4 text-muted">
                      Paid {cur.paid} to {cur.payTo} · ref {cur.ref}
                    </Text>
                  </View>
                  <Text className="text-xs leading-4 text-muted">
                    {cur.rules}. Run confirmed by {cur.confirmedBy} on {cur.confirmed}.
                  </Text>
                  <View className="flex-row gap-2">
                    <Button variant="secondary" size="lg" className="min-h-12 flex-1" onPress={() => setPdfSaved(true)}>
                      <Icon name="ArrowDownToLine" />
                      <Button.Label>Save PDF</Button.Label>
                    </Button>
                    <Button
                      variant="ghost"
                      size="lg"
                      className="min-h-12 flex-1"
                      onPress={() => {
                        pickTopic("pay");
                        setHelpSent(null);
                        setSheet("help");
                      }}
                    >
                      <Icon name="CircleQuestion" />
                      <Button.Label>Ask about it</Button.Label>
                    </Button>
                  </View>
                  {pdfSaved ? (
                    <Text className="text-xs leading-4 text-muted">
                      Saved to this phone. The PDF opens without internet and needs your PIN.
                    </Text>
                  ) : null}
                </Card>
              ) : null}
            </>
          )}
        </View>

        <View className="gap-2">
          <SectionTitle>{t.leave}</SectionTitle>
          <Link href={screenHref("StaffSchedule") as never} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="Annual leave">
              <Card className="min-h-16 flex-row items-center gap-3 p-4">
                <Icon name="Suitcase" />
                <View className="min-w-0 flex-1">
                  <Text className="font-medium text-foreground">{balance.left} days of annual leave left</Text>
                  <Text className="text-[13px] leading-[18px] text-muted">
                    {asked} days asked for · waiting for {balance.waitingFor}
                  </Text>
                </View>
                <Icon name="ChevronRight" tone="muted" />
              </Card>
            </Pressable>
          </Link>
        </View>

        <View className="gap-2">
          <View className="min-h-11 flex-row items-center justify-between">
            <SectionTitle>{t.docs}</SectionTitle>
            <Button variant="ghost" className="min-h-11" onPress={() => setDocAdded(true)}>
              <Icon name="Camera" />
              <Button.Label>Add</Button.Label>
            </Button>
          </View>
          <View accessibilityLabel={t.docs} className="gap-2">
            {documents.map((d) => (
              <Card key={d.id} className="min-h-14 flex-row items-center gap-3 px-4 py-3">
                <Icon name={d.icon} />
                <View className="min-w-0 flex-1">
                  <Text className="font-medium text-foreground">{d.name}</Text>
                  <Text className="text-[13px] leading-[18px] text-muted">{d.meta}</Text>
                </View>
                <Chip size="sm" variant="soft" color={toneColor(d.tone)}>
                  <Chip.Label>{d.chip}</Chip.Label>
                </Chip>
              </Card>
            ))}
          </View>
          <Text className="text-xs leading-4 text-muted">Only you and HR can see these.</Text>
        </View>

        <View className="gap-2">
          <SectionTitle>{t.assets}</SectionTitle>
          <View accessibilityLabel={t.assets} className="gap-2">
            {assets.map((a) => (
              <Card key={a.id} className="min-h-14 flex-row items-center gap-3 px-4 py-3">
                <Icon name={a.icon} />
                <View className="min-w-0 flex-1">
                  <Text className="font-medium text-foreground">{a.name}</Text>
                  <Text className="text-[13px] leading-[18px] text-muted">{a.meta}</Text>
                </View>
                <Chip size="sm" variant="soft" color={toneColor(a.tone)}>
                  <Chip.Label>{a.chip}</Chip.Label>
                </Chip>
              </Card>
            ))}
          </View>
        </View>

        <View className="gap-2">
          <SectionTitle>{t.help}</SectionTitle>
          <View accessibilityLabel={t.help} className="gap-2">
            {tickets.map((k) => (
              <Card key={k.id} className="min-h-14 flex-row items-center gap-3 px-4 py-3">
                <Icon name="LifeRing" />
                <View className="min-w-0 flex-1">
                  <Text className="font-medium text-foreground">{k.title}</Text>
                  <Text className="text-[13px] leading-[18px] text-muted">{k.meta}</Text>
                </View>
                <Chip size="sm" variant="soft" color={toneColor(k.tone)}>
                  <Chip.Label>{k.chip}</Chip.Label>
                </Chip>
              </Card>
            ))}
          </View>
          <Button
            variant="secondary"
            size="lg"
            className="min-h-14 w-full"
            onPress={() => {
              setHelpSent(null);
              setSheet("help");
            }}
          >
            <Icon name="Comment" />
            <Button.Label>Ask HR or IT</Button.Label>
          </Button>
        </View>

        <View className="gap-2">
          <SectionTitle>{t.lang}</SectionTitle>
          <Segmented
            label={t.lang}
            value={lang}
            onChange={(k) => setLang(k === "rw" ? "rw" : "en")}
            items={[
              { id: "en", label: "English" },
              { id: "rw", label: "Kinyarwanda" },
            ]}
          />
          {lang === "rw" ? (
            <Text className="text-xs leading-4 text-muted">Some screens are still in English.</Text>
          ) : null}
        </View>

        <Button variant="danger-soft" size="lg" className="min-h-14 w-full" onPress={signOut}>
          <Icon name="ArrowRightFromSquare" tone="danger" />
          <Button.Label>{t.signout}</Button.Label>
        </Button>
        <Text className="text-center text-xs leading-4 text-muted">
          Shared phone? Sign out at the end of every shift.
        </Text>
      </PhoneBody>

      <PhoneSheet
        isOpen={sheet === "pin"}
        onOpenChange={(open) => !open && closeSheet()}
        centered
        media={<ToneTile tone="accent" icon="ShieldKeyhole" />}
        heading="Enter your PIN"
        description="Payslips show your salary, so we check it is you."
      >
        <View
          accessibilityLabel={`${pin.length} of 4 digits entered`}
          className="flex-row items-center justify-center gap-3.5"
        >
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              className={`size-3.5 rounded-full border border-border ${i < pin.length ? "bg-foreground" : ""}`}
            />
          ))}
        </View>
        {pinError ? (
          <Text className="text-center text-[13px] text-danger">That PIN is not right. 2 tries left.</Text>
        ) : null}
        <View className="flex-row flex-wrap gap-2">
          {KEYS.map((k) =>
            k === "bio" ? (
              <Button
                key={k}
                variant="ghost"
                accessibilityLabel="Use fingerprint"
                className="h-14 min-w-[30%] flex-1"
                onPress={() => {
                  setPin("");
                  setUnlocked(true);
                  setSheet("");
                }}
              >
                <Icon name="Fingerprint" size={20} />
              </Button>
            ) : k === "del" ? (
              <Button
                key={k}
                variant="ghost"
                accessibilityLabel="Delete last digit"
                className="h-14 min-w-[30%] flex-1"
                onPress={() => setPin((p) => p.slice(0, -1))}
              >
                <Icon name="ArrowLeft" size={20} />
              </Button>
            ) : (
              <Button
                key={k}
                variant="secondary"
                accessibilityLabel={k}
                className="h-14 min-w-[30%] flex-1"
                onPress={() => press(k)}
              >
                <Button.Label>{k}</Button.Label>
              </Button>
            ),
          )}
        </View>
        <View className="flex-row items-center justify-between">
          <Button variant="ghost" className="min-h-11" onPress={closeSheet}>
            <Button.Label>Cancel</Button.Label>
          </Button>
          <Text className="text-xs text-muted">Forgot it? Ask Diane in HR.</Text>
        </View>
      </PhoneSheet>

      <PhoneSheet
        isOpen={sheet === "help"}
        onOpenChange={(open) => !open && closeSheet()}
        heading="Ask HR or IT"
        description="Diane Ingabire (HR) answers here and by SMS, usually within a day."
      >
        <View accessibilityLabel="Topic" className="flex-row flex-wrap gap-1.5">
          {topics.map((q) => (
            <Button
              key={q.id}
              variant={topic === q.id ? "primary" : "secondary"}
              className="h-11"
              onPress={() => pickTopic(q.id)}
            >
              <Button.Label>{q.label}</Button.Label>
            </Button>
          ))}
        </View>
        <TextField>
          <Label>Your question</Label>
          <TextArea value={question} onChangeText={setQuestion} numberOfLines={3} />
        </TextField>
        <View className="flex-row gap-2">
          <Button variant="secondary" size="lg" className="min-h-14 flex-1" onPress={closeSheet}>
            <Button.Label>Cancel</Button.Label>
          </Button>
          <Button
            size="lg"
            className="min-h-14 flex-[2]"
            onPress={() => {
              setHelpSent(topicDoc.label);
              setSheet("");
            }}
          >
            <Icon name="PaperPlane" tone="accent-foreground" />
            <Button.Label>Send</Button.Label>
          </Button>
        </View>
      </PhoneSheet>
    </View>
  );
}
