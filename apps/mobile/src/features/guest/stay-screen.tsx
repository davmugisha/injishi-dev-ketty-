import { screenHref } from "@injishi/data";
import type { GuestStayRecord, HotelInfoRow, LateCheckoutOption, StayShortcut } from "@injishi/data/fixtures/guest";
import { Link, useLocalSearchParams } from "expo-router";
import { Button, Card, Chip, ListGroup, Radio, RadioGroup } from "heroui-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody } from "@/components/phone";
import { useSession } from "@/lib/session";
import { getCollection } from "@/lib/store";
import { toneColor } from "@/lib/tone";
import {
  formatRwf,
  GuestTop,
  Hint,
  IconTile,
  InitialsAvatar,
  includes,
  KeyValue,
  PhoneSheet,
  param,
  ScreenHeading,
  SectionTitle,
  Segmented,
  SoftChip,
  StatusDot,
  useGuestLang,
} from "./ui";

export type LateCheckout = "none" | "requested" | "approved";
const LATES = ["none", "requested", "approved"] as const;

const COPY = {
  en: { hello: "Good evening, Sarah", sub: "Thursday 15 October · night 2 of 2" },
  rw: { hello: "Mwiriwe, Sarah", sub: "Murakaza neza mu cyumba 204." },
  fr: { hello: "Bonsoir, Sarah", sub: "Mercredi 15 octobre · nuit 2 sur 2" },
} as const;

/** Guest · in-stay home (artifact: GuestStay). `?late=` is none, requested or approved. */
export default function GuestStayScreen() {
  const { persona } = useSession();
  const lateParam = param(useLocalSearchParams<{ late?: string }>().late);
  const initialLate: LateCheckout = includes(LATES, lateParam) ? lateParam : "none";
  const stays = getCollection<GuestStayRecord>("guest.stays");
  const shortcuts = getCollection<StayShortcut>("guest.stayShortcuts");
  const lateOptions = getCollection<LateCheckoutOption>("guest.lateCheckoutOptions");
  const info = getCollection<HotelInfoRow>("guest.hotelInfo");
  const stay = stays[0];

  const [lang, setLang] = useGuestLang();
  const [late, setLate] = useState<LateCheckout | null>(null);
  const [sheet, setSheet] = useState(false);
  const [opt, setOpt] = useState(lateOptions.find((o) => o.id === "15")?.id ?? lateOptions[0]?.id ?? "");
  const [pwShown, setPwShown] = useState(false);
  const [infoTab, setInfoTab] = useState<"today" | "info">("today");

  if (!persona || !stay || !shortcuts.length) return null;

  const mode = late ?? initialLate;
  const chosen = lateOptions.find((o) => o.id === opt) ?? lateOptions[0];
  const approved = mode === "approved";
  const keyUntil = approved ? stay.lateApproval.keyUntil : stay.keyUntil;
  const checkoutTime = approved ? stay.lateApproval.until : stay.checkoutTime;
  const rows = info.filter((row) => row.tab === infoTab);
  const copy = COPY[lang];

  return (
    <>
      <GuestTop
        lead={<InitialsAvatar initials={stay.initials} label={stay.property} />}
        title={stay.property}
        sub={`Room ${stay.room} · stay ${stay.id}`}
        lang={lang}
        onLang={setLang}
      />
      <PhoneBody>
        <View className="gap-[14px]">
          <ScreenHeading title={copy.hello.replace("Sarah", persona.firstName)} sub={copy.sub} />

          <Card accessibilityLabel="Your room" className="gap-[14px] p-4">
            <View className="flex-row items-end justify-between gap-3">
              <View>
                <Text className="text-xs leading-4 text-muted">Your room</Text>
                <Text className="text-[40px] leading-[44px] font-semibold text-foreground">{stay.room}</Text>
                <Text className="text-[13px] leading-[18px] text-muted">
                  {stay.roomType} · {stay.floor}
                </Text>
              </View>
              <Link href={screenHref("GuestKey") as never} asChild>
                <Button size="lg" className="min-w-32">
                  <Icon name="Key" tone="accent-foreground" />
                  <Button.Label>Unlock</Button.Label>
                </Button>
              </Link>
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              <Chip size="sm" variant="soft" color="success">
                <StatusDot tone="success" />
                <Chip.Label>Digital key active until {keyUntil}</Chip.Label>
              </Chip>
              <Chip size="sm" variant="soft">
                <Chip.Label>Checked in {stay.checkedIn}</Chip.Label>
              </Chip>
            </View>
          </Card>

          <View accessibilityLabel="Stay shortcuts" className="flex-row flex-wrap gap-2.5">
            {shortcuts.map((shortcut) => (
              <Link key={shortcut.id} href={screenHref(shortcut.board) as never} asChild>
                <Pressable className="w-[48%]">
                  <Card className="gap-2.5 p-3.5">
                    <IconTile name={shortcut.icon} />
                    <View className="gap-0.5">
                      <Text className="font-semibold text-foreground">{shortcut.title}</Text>
                      <Text className="text-xs leading-4 text-muted">{shortcut.desc}</Text>
                    </View>
                  </Card>
                </Pressable>
              </Link>
            ))}
          </View>

          <Card className="gap-2.5 p-4">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-2">
                <Icon name="BroadcastSignal" tone="muted" />
                <SectionTitle>Wi-Fi</SectionTitle>
              </View>
              <Text className="text-xs text-muted">{stay.wifi.where}</Text>
            </View>
            <KeyValue items={[{ label: "Network", value: stay.wifi.network }]} />
            <View className="flex-row items-center justify-between gap-2">
              <Text className="text-[13px] leading-[18px] text-muted">Password</Text>
              <View className="flex-1 flex-row items-center justify-end gap-2">
                <Text className="font-medium text-foreground">{pwShown ? stay.wifi.password : "••••••••••••"}</Text>
                <Button
                  variant="ghost"
                  size="sm"
                  accessibilityState={{ selected: pwShown }}
                  onPress={() => setPwShown((v) => !v)}
                >
                  <Icon name={pwShown ? "EyeSlash" : "Eye"} />
                  <Button.Label>{pwShown ? "Hide" : "Show"}</Button.Label>
                </Button>
              </View>
            </View>
            <Text className="text-xs leading-4 text-muted">
              Changes for each stay. If it drops, message the front desk and we’ll reset your access.
            </Text>
          </Card>

          <Card className="gap-3 p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="gap-0.5">
                <SectionTitle>Checkout</SectionTitle>
                <Text className="text-sm leading-5 text-foreground">
                  Tomorrow, {stay.checkoutDay}, by <Text className="font-semibold">{checkoutTime}</Text>
                </Text>
              </View>
              <Icon name="ArrowRightFromSquare" size={20} tone="muted" />
            </View>
            {mode === "none" ? (
              <>
                <Text className="text-[13px] leading-[18px] text-muted">
                  Need more time? Late checkout depends on tomorrow’s arrivals and has a fee under the hotel’s policy.
                  Nothing is charged unless the front desk approves.
                </Text>
                <Button variant="secondary" className="self-start" onPress={() => setSheet(true)}>
                  <Icon name="Clock" />
                  <Button.Label>Request late checkout</Button.Label>
                </Button>
              </>
            ) : null}
            {mode === "requested" && chosen ? (
              <>
                <Card variant="secondary" className="flex-row items-start gap-3 p-3">
                  <IconTile name="Hourglass" />
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text className="font-semibold text-foreground">Late checkout until {chosen.time}</Text>
                    <Text className="text-xs leading-4 text-muted">
                      {formatRwf(chosen.fee)} if approved. The front desk replies by 09:00 tomorrow. Until then, plan
                      for 11:00.
                    </Text>
                  </View>
                  <SoftChip label="Pending approval" tone="warning" />
                </Card>
                <Button variant="ghost" size="sm" className="self-start" onPress={() => setLate("none")}>
                  <Button.Label>Withdraw request</Button.Label>
                </Button>
              </>
            ) : null}
            {approved ? (
              <Card variant="secondary" className="flex-row items-start gap-3 p-3">
                <IconTile name="CircleCheck" />
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text className="font-semibold text-foreground">
                    Approved until {stay.lateApproval.until} by {stay.lateApproval.by}
                  </Text>
                  <Text className="text-xs leading-4 text-muted">
                    {formatRwf(stay.lateApproval.fee)} is added to your bill. Your digital key now works until{" "}
                    {stay.lateApproval.until}.
                  </Text>
                </View>
                <SoftChip label="Approved" tone="success" />
              </Card>
            ) : null}
            <View className="flex-row flex-wrap items-center gap-2">
              <Link href={screenHref("GuestFolio") as never} asChild>
                <Button variant="tertiary" size="sm">
                  <Icon name="Receipt" />
                  <Button.Label>Review your bill</Button.Label>
                </Button>
              </Link>
              <Text className="min-w-40 flex-1 text-xs leading-4 text-muted">
                Your key stops working at checkout time.
              </Text>
            </View>
          </Card>

          <View className="gap-2.5">
            <View className="flex-row items-center justify-between gap-3">
              <SectionTitle>At the Hotel</SectionTitle>
              <Segmented
                label="Hotel information"
                value={infoTab}
                onChange={(value) => setInfoTab(value === "info" ? "info" : "today")}
                items={[
                  { id: "today", label: "Today" },
                  { id: "info", label: "Info" },
                ]}
              />
            </View>
            <ListGroup accessibilityLabel="At the hotel">
              {rows.map((row, index) => (
                <View key={row.id}>
                  {index > 0 ? <View className="mx-4 h-px bg-separator" /> : null}
                  <ListGroup.Item>
                    <ListGroup.ItemPrefix>
                      <Icon name={row.icon} tone="muted" />
                    </ListGroup.ItemPrefix>
                    <ListGroup.ItemContent>
                      <ListGroup.ItemTitle>{row.title}</ListGroup.ItemTitle>
                      <ListGroup.ItemDescription>{row.text}</ListGroup.ItemDescription>
                    </ListGroup.ItemContent>
                    {row.chip ? (
                      <ListGroup.ItemSuffix>
                        <Chip size="sm" variant="soft" color={toneColor(row.tone)}>
                          <Chip.Label>{row.chip}</Chip.Label>
                        </Chip>
                      </ListGroup.ItemSuffix>
                    ) : null}
                  </ListGroup.Item>
                </View>
              ))}
            </ListGroup>
          </View>
        </View>
      </PhoneBody>

      <PhoneSheet
        isOpen={sheet}
        onOpenChange={setSheet}
        heading="Request late checkout"
        description={`${stay.checkoutDay} · room ${stay.room}. Fees follow the hotel’s policy and are added to your bill only if approved.`}
      >
        <RadioGroup accessibilityLabel="Late checkout time" value={opt} onValueChange={setOpt} className="gap-2">
          {lateOptions.map((option) => (
            <RadioGroup.Item
              key={option.id}
              value={option.id}
              className={`min-h-14 w-full flex-row items-center gap-3 rounded-2xl border bg-surface px-3.5 py-3 ${opt === option.id ? "border-accent" : "border-separator"}`}
            >
              <View className="min-w-0 flex-1">
                <Text className="font-semibold text-foreground">Until {option.time}</Text>
                <Text className="text-xs leading-4 text-muted">
                  {formatRwf(option.fee)} if approved · {option.note}
                </Text>
              </View>
              <Radio />
            </RadioGroup.Item>
          ))}
        </RadioGroup>
        <Hint icon="CircleInfo">Subject to availability. Your key is extended only after approval.</Hint>
        <View className="flex-row gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onPress={() => setSheet(false)}>
            <Button.Label>Cancel</Button.Label>
          </Button>
          <Button
            size="lg"
            className="flex-[2]"
            onPress={() => {
              setSheet(false);
              setLate("requested");
            }}
          >
            <Button.Label>Send request</Button.Label>
          </Button>
        </View>
      </PhoneSheet>
    </>
  );
}
