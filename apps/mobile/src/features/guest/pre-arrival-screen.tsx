import { screenHref } from "@injishi/data";
import type {
  ArrivalSlot,
  GuestBooking,
  GuestOption,
  IdDocumentType,
  IdPrivacyPoint,
  PreArrivalForm,
  PreArrivalNextStep,
} from "@injishi/data/fixtures/guest";
import { Link, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  ListGroup,
  Radio,
  RadioGroup,
  Select,
  Switch,
  TextArea,
  TextField,
} from "heroui-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody } from "@/components/phone";
import { getCollection, getDocument } from "@/lib/store";
import { toneColor } from "@/lib/tone";
import {
  BackLink,
  ChevronLink,
  ChoiceChips,
  GuestTimeline,
  GuestTop,
  IconRow,
  IconTile,
  includes,
  param,
  StatusAlert,
  StepDots,
  StepHeading,
  useGuestLang,
} from "./ui";

export type PreArrivalStep = "id" | "arrival" | "preferences" | "contact" | "done";
const ORDER: PreArrivalStep[] = ["id", "arrival", "preferences", "contact", "done"];
const STEP_LABELS = [
  { id: "id", label: "ID" },
  { id: "arrival", label: "Arrival" },
  { id: "preferences", label: "Preferences" },
  { id: "contact", label: "Contact" },
] as const;

const TITLES = {
  en: "Pre-arrival check-in",
  rw: "Kwiyandikisha mbere yo kuhagera",
  fr: "Enregistrement anticipé",
} as const;

/** Guest · pre-arrival check-in. `?step=` is id, arrival, preferences, contact or done. */
export default function GuestPreArrivalScreen() {
  const stepParam = param(useLocalSearchParams<{ step?: string }>().step);
  const initial: PreArrivalStep = includes(ORDER, stepParam) ? stepParam : "id";
  const form = getDocument<PreArrivalForm>("guest.preArrival", "BK-20431");
  const documents = getCollection<IdDocumentType>("guest.idDocuments");
  const privacy = getCollection<IdPrivacyPoint>("guest.idPrivacy");
  const slots = getCollection<ArrivalSlot>("guest.arrivalSlots");
  const travelModes = getCollection<GuestOption>("guest.travelModes");
  const pillows = getCollection<GuestOption>("guest.pillows");
  const diets = getCollection<GuestOption>("guest.diets");
  const countries = getCollection<GuestOption>("guest.countries");
  const next = getCollection<PreArrivalNextStep>("guest.preArrivalNext");
  const booking = form ? getDocument<GuestBooking>("guest.bookings", form.id) : undefined;

  const [lang, setLang] = useGuestLang();
  const [step, setStep] = useState<PreArrivalStep | null>(null);
  const [doc, setDoc] = useState(form?.document ?? "");
  const [file, setFile] = useState<boolean | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [slot, setSlot] = useState(form?.slot ?? "");
  const [travel, setTravel] = useState(form?.travel ?? "");
  const [plate, setPlate] = useState(form?.plate ?? "");
  const [pillow, setPillow] = useState(form?.pillow ?? "");
  const [dietOn, setDietOn] = useState<string[]>(form?.diets ?? []);
  const [note, setNote] = useState("");
  const [keep, setKeep] = useState(form?.remember ?? false);
  const [name, setName] = useState(form?.fullName ?? "");
  const [phone, setPhone] = useState(form?.phone ?? "");
  const [email, setEmail] = useState(form?.email ?? "");
  const [country, setCountry] = useState(form?.country ?? "");

  if (!form || !booking || !documents.length || !slots.length) return null;

  const current = step ?? initial;
  const idx = ORDER.indexOf(current);
  const hasFile = file !== null ? file : !skipped && idx > 0;
  const docType = documents.find((item) => item.id === doc) ?? documents[0];
  const countryName = countries.find((item) => item.id === country)?.label ?? form.issuedBy;
  const docName = `${docType.label} · ${countryName}`;
  const chosenSlot = slots.find((item) => item.id === slot) ?? slots[0];
  const travelLabel = (travelModes.find((item) => item.id === travel)?.label ?? travel).toLowerCase();
  const pillowLabel = pillows.find((item) => item.id === pillow)?.label ?? pillow;
  const prefBits = [
    `${pillowLabel} pillow`,
    ...diets.filter((item) => dietOn.includes(item.id)).map((item) => item.label),
  ];
  const countryOption = countries.find((item) => item.id === country);

  const summary = [
    hasFile
      ? {
          id: "id",
          icon: "Passport",
          label: "ID",
          value: `${docName} · ending ${form.documentEnding}`,
          chip: "Desk to review",
          tone: "default" as const,
          step: "id" as const,
        }
      : {
          id: "id",
          icon: "Passport",
          label: "ID",
          value: "Not sent. Bring it to the desk.",
          chip: "At the desk",
          tone: "warning" as const,
          step: "id" as const,
        },
    {
      id: "arrival",
      icon: "Clock",
      label: "Arrival",
      value: `${booking.checkIn.day}, ${chosenSlot.label} · ${travelLabel}`,
      chip: "Shared",
      tone: "default" as const,
      step: "arrival" as const,
    },
    {
      id: "preferences",
      icon: "Moon",
      label: "Preferences",
      value: prefBits.join(" · "),
      chip: keep ? "Saved" : "This stay",
      tone: "default" as const,
      step: "preferences" as const,
    },
    {
      id: "contact",
      icon: "Handset",
      label: "Contact",
      value: `${phone} · email`,
      chip: "Shared",
      tone: "default" as const,
      step: "contact" as const,
    },
  ];

  return (
    <>
      <GuestTop
        lead={<BackLink href={screenHref("GuestTrip")} label="Back to your trip" />}
        title={TITLES[lang]}
        sub={`${booking.shortName} · ${booking.id}`}
        lang={lang}
        onLang={setLang}
      />
      <PhoneBody>
        <View className="gap-[14px]">
          {current !== "done" ? (
            <StepDots
              label="Pre-arrival steps"
              steps={[...STEP_LABELS]}
              current={idx}
              onStep={(index) => {
                const nextStep = ORDER[index];
                if (nextStep && nextStep !== "done") setStep(nextStep);
              }}
            />
          ) : null}

          {current === "id" ? (
            <View className="gap-[14px]">
              <StepHeading
                title="Add your ID"
                sub="The hotel registers everyone who stays. Send yours now and the desk only has to compare it with the original."
              />
              <ChoiceChips
                label="Document"
                options={documents.map((item) => ({ id: item.id, label: item.label }))}
                selected={[doc]}
                onChange={(next) => {
                  if (next[0]) setDoc(next[0]);
                }}
              />
              {hasFile ? (
                <Card className="flex-row items-start gap-3 p-3.5">
                  <IconTile name="Passport" />
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="font-semibold text-foreground">{docName}</Text>
                    <Text className="text-xs leading-4 text-muted">
                      Number ending {form.documentEnding} · photo {form.photoSize}
                    </Text>
                    <Chip size="sm" variant="soft" className="self-start">
                      <Icon name="Lock" size={12} />
                      <Chip.Label>Uploaded · encrypted · waiting for desk review</Chip.Label>
                    </Chip>
                  </View>
                  <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    accessibilityLabel="Remove and choose another photo"
                    onPress={() => setFile(false)}
                  >
                    <Icon name="TrashBin" />
                  </Button>
                </Card>
              ) : (
                <Card variant="secondary" className="items-center gap-2 px-4 py-[22px]">
                  <Icon name="Camera" size={28} tone="muted" />
                  <Text className="text-center font-medium text-foreground">{docType.prompt}</Text>
                  <Text className="text-center text-xs leading-4 text-muted">
                    JPG, PNG or PDF · up to 10 MB · all four corners visible
                  </Text>
                  <Button onPress={() => setFile(true)}>
                    <Icon name="ArrowUpFromLine" tone="accent-foreground" />
                    <Button.Label>Take or choose a photo</Button.Label>
                  </Button>
                </Card>
              )}
              <Card variant="secondary" className="gap-3 px-4 py-3.5">
                <Text accessibilityRole="header" className="text-sm leading-5 font-semibold text-foreground">
                  How your ID is used
                </Text>
                {privacy.map((point) => (
                  <IconRow key={point.id} icon={point.icon} title={point.title} text={point.text} />
                ))}
                <ChevronLink href={screenHref("GuestAccount")}>
                  Ask for a copy, correction or deletion in your account
                </ChevronLink>
              </Card>
              {form.companions.map((companion) => (
                <Card key={companion.id} className="flex-row items-start gap-3 p-3.5">
                  <IconTile name="Person" />
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text className="font-semibold text-foreground">{companion.label}</Text>
                    <Text className="text-xs leading-4 text-muted">{companion.note}</Text>
                  </View>
                  <Chip size="sm" variant="soft">
                    <Chip.Label>{companion.status}</Chip.Label>
                  </Chip>
                </Card>
              ))}
              <View className="gap-2">
                <Button size="lg" isDisabled={!hasFile} onPress={() => setStep("arrival")}>
                  <Button.Label>Continue</Button.Label>
                </Button>
                {!hasFile ? (
                  <Text className="text-center text-xs text-muted">Add a photo to continue, or skip this step.</Text>
                ) : null}
                <Button
                  variant="ghost"
                  onPress={() => {
                    setSkipped(true);
                    setFile(false);
                    setStep("arrival");
                  }}
                >
                  <Button.Label>Skip, I’ll show it at the desk</Button.Label>
                </Button>
              </View>
            </View>
          ) : null}

          {current === "arrival" ? (
            <View className="gap-[14px]">
              <StepHeading
                title="When will you arrive?"
                sub="Wednesday 14 October. Check-in is from 14:00 and the front desk is open 24 hours."
              />
              <RadioGroup
                accessibilityLabel="Expected arrival time"
                value={slot}
                onValueChange={setSlot}
                className="flex-row flex-wrap gap-2"
              >
                {slots.map((item) => (
                  <RadioGroup.Item
                    key={item.id}
                    value={item.id}
                    className={`min-h-16 w-[48%] flex-row items-start gap-2 rounded-2xl border bg-surface px-3.5 py-3 ${slot === item.id ? "border-accent" : "border-separator"}`}
                  >
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold text-foreground">{item.label}</Text>
                      <Text className="text-xs leading-4 text-muted">{item.hint}</Text>
                    </View>
                    <Radio />
                  </RadioGroup.Item>
                ))}
              </RadioGroup>
              {chosenSlot.noteTitle && chosenSlot.noteText ? (
                <StatusAlert
                  status="default"
                  icon="CircleInfo"
                  title={chosenSlot.noteTitle}
                  description={chosenSlot.noteText}
                />
              ) : null}
              <ChoiceChips
                label="How are you travelling?"
                options={travelModes}
                selected={[travel]}
                onChange={(next) => {
                  if (next[0]) setTravel(next[0]);
                }}
              />
              {travel === "car" ? (
                <TextField>
                  <Label>Plate number (optional)</Label>
                  <Input value={plate} onChangeText={setPlate} />
                  <Description>Only used for the hotel car park list. Deleted after checkout.</Description>
                </TextField>
              ) : null}
              <View className="flex-row gap-2">
                <Button variant="secondary" size="lg" className="flex-1" onPress={() => setStep("id")}>
                  <Button.Label>Back</Button.Label>
                </Button>
                <Button size="lg" className="flex-[2]" onPress={() => setStep("preferences")}>
                  <Button.Label>Continue</Button.Label>
                </Button>
              </View>
            </View>
          ) : null}

          {current === "preferences" ? (
            <View className="gap-[14px]">
              <StepHeading
                title="Make the room yours"
                sub="These are requests, not promises. The desk confirms what’s possible when you check in."
              />
              <ChoiceChips
                label="Pillow"
                options={pillows}
                selected={[pillow]}
                onChange={(next) => {
                  if (next[0]) setPillow(next[0]);
                }}
              />
              <View className="gap-1">
                <ChoiceChips label="Dietary needs" options={diets} selected={dietOn} onChange={setDietOn} multiple />
                <Text className="text-xs leading-4 text-muted">
                  Allergies go to the Isangano Terrace kitchen with your orders. Please tell your server too.
                </Text>
              </View>
              <TextField>
                <Label>Anything else?</Label>
                <TextArea
                  value={note}
                  onChangeText={setNote}
                  numberOfLines={3}
                  placeholder="Celebrating something? Travelling with a baby?"
                />
              </TextField>
              <Card variant="secondary" className="gap-2 px-4 py-3.5">
                <View className="min-h-[52px] flex-row items-center gap-3">
                  <Text className="flex-1 text-sm font-medium text-foreground">Remember these for future stays</Text>
                  <Switch
                    isSelected={keep}
                    onSelectedChange={setKeep}
                    accessibilityLabel="Remember these for future stays"
                  />
                </View>
                <Text className="text-xs leading-[17px] text-muted">
                  {keep
                    ? "Saved to your guest profile with Amahoro Hospitality’s hotels, so Isangano and Ishyamba can prepare them next time. Turn this off any time in your account."
                    : "Used for this stay only and removed after checkout."}
                </Text>
              </Card>
              <View className="flex-row gap-2">
                <Button variant="secondary" size="lg" className="flex-1" onPress={() => setStep("arrival")}>
                  <Button.Label>Back</Button.Label>
                </Button>
                <Button size="lg" className="flex-[2]" onPress={() => setStep("contact")}>
                  <Button.Label>Continue</Button.Label>
                </Button>
              </View>
            </View>
          ) : null}

          {current === "contact" ? (
            <View className="gap-[14px]">
              <StepHeading
                title="How can we reach you?"
                sub="For this stay only: room ready, requests and your bill."
              />
              <TextField>
                <Label>Full name, as on your ID</Label>
                <Input value={name} onChangeText={setName} />
              </TextField>
              <TextField>
                <Label>Mobile number</Label>
                <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              </TextField>
              <TextField>
                <Label>Email</Label>
                <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              </TextField>
              <View className="gap-1">
                <Label>Country of residence</Label>
                <Select
                  value={countryOption ? { value: countryOption.id, label: countryOption.label } : undefined}
                  onValueChange={(option) => {
                    if (option && !Array.isArray(option)) setCountry(option.value);
                  }}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Country of residence" />
                    <Select.TriggerIndicator />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Overlay />
                    <Select.Content presentation="popover">
                      {countries.map((item) => (
                        <Select.Item key={item.id} value={item.id} label={item.label} />
                      ))}
                    </Select.Content>
                  </Select.Portal>
                </Select>
              </View>
              <Card variant="secondary" className="flex-row items-start gap-3 p-3.5">
                <IconTile name="Bell" />
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text className="font-semibold text-foreground">Updates in the app and by email</Text>
                  <Text className="text-xs leading-4 text-muted">
                    You can add SMS or WhatsApp from Requests after check-in.
                  </Text>
                </View>
              </Card>
              <View className="flex-row gap-2">
                <Button variant="secondary" size="lg" className="flex-1" onPress={() => setStep("preferences")}>
                  <Button.Label>Back</Button.Label>
                </Button>
                <Button size="lg" className="flex-[2]" onPress={() => setStep("done")}>
                  <Icon name="PaperPlane" tone="accent-foreground" />
                  <Button.Label>Send to the hotel</Button.Label>
                </Button>
              </View>
            </View>
          ) : null}

          {current === "done" ? (
            <View className="gap-4">
              <View className="items-center gap-1.5 px-2 pt-3">
                <View className="size-14 items-center justify-center rounded-full bg-success-soft">
                  <Icon name="Check" size={28} tone="success" />
                </View>
                <Text
                  accessibilityRole="header"
                  className="text-center text-[22px] leading-7 font-semibold text-foreground"
                >
                  Sent to {booking.shortName}
                </Text>
                <Text className="text-center text-[13px] leading-[18px] text-muted">
                  Received {form.receivedAt}. You can change anything until you check in.
                </Text>
              </View>
              <StatusAlert
                status="accent"
                title="The front desk will still check your ID when you arrive"
                description="Pre-arrival check-in and linking your booking speed things up, but they don’t prove who you are. Bring the original document."
              />
              <ListGroup accessibilityLabel="Your answers">
                {summary.map((row, index) => (
                  <View key={row.id}>
                    {index > 0 ? <View className="mx-4 h-px bg-separator" /> : null}
                    <ListGroup.Item>
                      <ListGroup.ItemPrefix>
                        <Icon name={row.icon} tone="muted" />
                      </ListGroup.ItemPrefix>
                      <ListGroup.ItemContent>
                        <ListGroup.ItemTitle>{row.label}</ListGroup.ItemTitle>
                        <ListGroup.ItemDescription>{row.value}</ListGroup.ItemDescription>
                      </ListGroup.ItemContent>
                      <ListGroup.ItemSuffix>
                        <Chip size="sm" variant="soft" color={toneColor(row.tone)}>
                          <Chip.Label>{row.chip}</Chip.Label>
                        </Chip>
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          accessibilityLabel={`Edit ${row.label}`}
                          onPress={() => setStep(row.step)}
                        >
                          <Icon name="Pencil" />
                        </Button>
                      </ListGroup.ItemSuffix>
                    </ListGroup.Item>
                  </View>
                ))}
              </ListGroup>
              <View className="gap-2.5 rounded-2xl border border-separator p-4">
                <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
                  What Happens Next
                </Text>
                <GuestTimeline items={next} />
              </View>
              <Link href={screenHref("GuestTrip") as never} asChild>
                <Button size="lg">
                  <Button.Label>Back to my trip</Button.Label>
                </Button>
              </Link>
            </View>
          ) : null}
        </View>
      </PhoneBody>
    </>
  );
}
