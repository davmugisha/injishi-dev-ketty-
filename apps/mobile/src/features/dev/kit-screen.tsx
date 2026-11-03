import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import { ScopedTheme } from "uniwind";
import {
  Avatar,
  Banner,
  BottomInset,
  Bubble,
  Button,
  Card,
  Checkbox,
  Chip,
  Choice,
  Composer,
  CountBadge,
  Dialog,
  Divider,
  Dock,
  Field,
  FilterChips,
  IconButton,
  IconTile,
  Input,
  KeyValue,
  Keypad,
  Kpi,
  ListGroup,
  ListItem,
  LiveDot,
  metrics,
  NavBar,
  OfflineBar,
  OptionTile,
  OtpInput,
  PagerDots,
  Photo,
  PhotoHero,
  PhotoScrim,
  PinDots,
  PlaceMap,
  ProgressBar,
  QrCode,
  Radio,
  Ring,
  RoomCell,
  RoomGrid,
  roomStatuses,
  ScanFrame,
  Screen,
  ScreenHeader,
  SearchBar,
  Section,
  Segmented,
  SheetScreen,
  Sparkline,
  Spinner,
  StatusPill,
  StepBar,
  Stepper,
  Text,
  TextArea,
  TestMoneyTag,
  Tile,
  TileGrid,
  Timeline,
  Toast,
  Toggle,
  useToast,
} from "@/components/ui";
import { appVariantFrom, designSystemAllowed } from "@/lib/app-variant";
import { protoImages } from "@/proto/images";

/**
 * `/dev/kit`: every primitive the prototype port added to the kit (PLAN.md, Kit), drawn with the
 * prototype's own words, in the light or the dark theme (a Uniwind `ScopedTheme`, so the phone's
 * setting is untouched). Development and preview builds only, as the design system screen; any
 * other build goes to the start screen.
 */
export function KitScreen() {
  if (!designSystemAllowed(appVariantFrom(Constants.expoConfig?.extra))) return <Redirect href="/" />;
  return <Kit />;
}

type Theme = "light" | "dark";

const THEMES = [
  { value: "light", label: "Light", icon: "Sun" },
  { value: "dark", label: "Dark", icon: "Moon" },
] as const;

function Kit() {
  const [theme, setTheme] = useState<Theme>("light");
  return (
    <ScopedTheme theme={theme}>
      <Screen header={<NavBar title="Kit" subtitle="Prototype primitives" />}>
        <View className="px-4 pt-2">
          <Segmented label="Theme" options={THEMES} value={theme} onChange={setTheme} />
        </View>
        <TypeDemo />
        <ChromeDemo />
        <CardsDemo />
        <ListsDemo />
        <NoticesDemo />
        <ButtonsDemo />
        <ChipsDemo />
        <FormsDemo />
        <MediaDemo />
        <ProgressDemo />
        <ChatDemo />
        <OverlaysDemo />
        <StaffDemo />
      </Screen>
    </ScopedTheme>
  );
}

/** One family: a heading, then its parts 12 apart, 16 in. */
function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section title={title} className="gap-3 px-4">
      {children}
    </Section>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text role="micro" tone="muted" caps className="mt-2">
      {children}
    </Text>
  );
}

const noop = () => {};

function TypeDemo() {
  return (
    <Demo title="Type: strong and tabular">
      <Text role="callout" strong>
        callout strong: a field label, a key-value figure
      </Text>
      <Text role="caption" strong>
        caption strong: a tile label, a room note
      </Text>
      <Text role="display" tabular>
        07:00 – 15:00
      </Text>
      <Text role="title2" tabular>
        RWF 950,000
      </Text>
    </Demo>
  );
}

function ChromeDemo() {
  return (
    <Demo title="Chrome: ScreenHeader, NavBar, Dock">
      <Card padding="none">
        <ScreenHeader
          eyebrow="Floor 2 · Mon 12 Oct"
          title="My rooms"
          right={<IconButton icon="Bell" label="Notifications" variant="surface" dot onPress={noop} />}
        />
        <Divider />
        <ScreenHeader
          eyebrow="Tue 13 Oct · Eric on desk"
          title="Ishyamba Forest Lodge"
          onTitlePress={noop}
          titleActionLabel="Switch place"
          left={<Avatar size="m" name="Eric Habimana" />}
        />
        <Divider />
        <NavBar
          title="Room 204"
          subtitle="Checkout · Deluxe Lake View"
          onBack={noop}
          right={<IconButton icon="TriangleExclamation" label="Report a problem" variant="plain" onPress={noop} />}
        />
      </Card>
      <Card padding="none">
        <BottomInset value={0}>
          <Dock note="No signal? The time is saved on this phone and sent later.">
            <Button variant="deep" icon="Clock" onPress={noop}>
              Clock in at 06:58
            </Button>
          </Dock>
        </BottomInset>
      </Card>
    </Demo>
  );
}

function CardsDemo() {
  return (
    <Demo title="Section and Card">
      <Card padding="none">
        <Section title="Tonight at Isangano" action={{ label: "Hotel guide", onPress: noop }} />
        <Section title="Then" detail="6 more" />
      </Card>
      <Card raised>
        <View className="flex-row items-center justify-between">
          <Text role="micro" tone="muted" caps>
            Your shift
          </Text>
          <Chip tone="accent" label="Starts in 2 min" />
        </View>
        <Text role="display" tabular className="mt-2">
          07:00 – 15:00
        </Text>
        <Text role="callout" tone="muted">
          Housekeeping · Floor 2 · break at 11:30
        </Text>
      </Card>
      <Card tone="accent">
        <View className="flex-row items-center gap-3.5">
          <View className="flex-1 gap-0.5">
            <Text role="title3">On shift since 07:02</Text>
            <Text role="caption" tone="muted">
              Ends 15:00 · break at 11:30
            </Text>
            <View className="mt-2">
              <ProgressBar value={42} label="Rooms done" size="thin" />
            </View>
          </View>
          <Ring value={42} size={80} label="5 of 12 rooms done">
            <Text role="title3" tabular>
              5/12
            </Text>
            <Text role="micro" tone="muted">
              rooms
            </Text>
          </Ring>
        </View>
      </Card>
      <View className="flex-row gap-3">
        <Card tone="flat" className="flex-1">
          <Text role="callout" strong>
            flat
          </Text>
        </Card>
        <Card tone="accentSoft" className="flex-1">
          <Text role="callout" strong>
            accentSoft
          </Text>
        </Card>
      </View>
      <View className="flex-row gap-3">
        <Card tone="success" padding="sm" className="flex-1">
          <Text role="callout" strong>
            success
          </Text>
        </Card>
        <Card tone="warning" padding="sm" className="flex-1">
          <Text role="callout" strong>
            warning
          </Text>
        </Card>
      </View>
      <View className="flex-row gap-3">
        <Card tone="danger" padding="sm" className="flex-1" onPress={noop} accessibilityLabel="206 arrival moved">
          <Text role="callout" strong>
            danger, pressable
          </Text>
        </Card>
        <Card tone="info" padding="sm" className="flex-1">
          <Text role="callout" strong>
            info
          </Text>
        </Card>
      </View>
    </Demo>
  );
}

function ListsDemo() {
  const [allowed, setAllowed] = useState(true);
  return (
    <Demo title="ListGroup, ListItem, KeyValue, Tiles">
      <ListGroup>
        <ListItem icon="Person" title="Personal details" subtitle="Name as on ID, phone, nationality" onPress={noop} />
        <ListItem icon="CreditCard" title="Payment numbers" subtitle="MTN MoMo •••• 4471" onPress={noop} />
        <ListItem icon="Globe" title="Language" subtitle="English" value="More soon" />
        <ListItem
          icon="Smartphone"
          title="Signed-in devices"
          subtitle="This Pixel 9 and a laptop browser"
          trailing={<CountBadge count={2} tone="default" />}
          onPress={noop}
        />
        <ListItem
          title="Staff may enter if I am not home"
          subtitle="They come with management and leave a note"
          trailing={<Toggle value={allowed} onValueChange={setAllowed} label="Staff may enter if I am not home" />}
        />
        <ListItem
          size="lg"
          leading={
            <Photo source={protoImages["leak-under-basin"]} width={metrics.thumb} height={metrics.thumb} radius="sm" />
          }
          title="Kitchen sink leaking"
          subtitle="WO-345 · plumber Tue 27 Oct, 10:00"
          meta={<Chip tone="info" label="Assigned" />}
          onPress={noop}
        />
        <ListItem icon="TrashBin" tone="danger" title="Delete my account" titleTone="danger" onPress={noop} />
      </ListGroup>
      <Card>
        <KeyValue
          rows={[
            { label: "Paid to", value: "Amahoro Residences Ltd" },
            { label: "From", value: "MTN MoMo · 0788 ••• 412" },
            { label: "Paid", value: "RWF 140,000 deposit", tone: "success" },
            { label: "Matches booking", value: "Yes", tone: "success", icon: "CircleCheck" },
          ]}
          total={{ label: "Total", value: "RWF 950,000" }}
        />
      </Card>
      <TileGrid>
        <Tile icon="Cup" label="Order" caption="to room" onPress={noop} />
        <Tile icon="BroadcastSignal" label="Wi-Fi" caption="tap to copy" onPress={noop} />
        <Tile icon="Comments" label="Ask" caption="desk · 24 h" onPress={noop} />
        <Tile icon="Receipt" label="Bill" caption="47,500 due" badge onPress={noop} />
      </TileGrid>
      <View className="flex-row items-center gap-3">
        <IconTile icon="LayoutCells" />
        <IconTile icon="Receipt" tone="success" />
        <IconTile icon="TriangleExclamation" tone="warning" />
        <IconTile icon="Gift" tone="info" size="lg" />
      </View>
    </Demo>
  );
}

function NoticesDemo() {
  const toast = useToast();
  return (
    <Demo title="Banner, OfflineBar, Toast, Divider">
      <Banner
        tone="info"
        title="Briefing from Beatrice"
        body="VIP returning guest in 204 at 14:00, lake-view pillows. Lift B is out of order."
      />
      <Banner tone="warning" icon="Droplet" title="Water off Thursday, 09:00–12:00" body="Block B tank cleaning." />
      <Banner tone="success" title="Rent paid" body="MTN confirmed your payment at 09:43." />
      <Banner
        tone="danger"
        title="Water, power, lock or safety?"
        body="Call the caretaker first, then report it."
        onPress={noop}
      />
      <Banner body="Proof you paid. Not a tax invoice. Your landlord issues the fiscal receipt." />
      <OfflineBar className="" message="No signal. Keep working, ticks are saved on this phone." />
      <Toast
        icon="ArrowUturnCcwLeft"
        message="Returned · not sellable"
        action={{ label: "Undo · 0:52", onPress: noop }}
      />
      <Divider className="my-1" />
      <Button
        variant="secondary"
        onPress={() =>
          toast.show({ icon: "CircleCheck", message: "Saved on this phone", action: { label: "Undo", onPress: noop } })
        }
      >
        Show a toast
      </Button>
    </Demo>
  );
}

function ButtonsDemo() {
  return (
    <Demo title="Button and IconButton">
      <Button onPress={noop}>Finish check-in</Button>
      <Button variant="deep" icon="CirclePlay" onPress={noop}>
        Start cleaning 204
      </Button>
      <View className="flex-row gap-2.5">
        <Button variant="secondary" className="flex-1" onPress={noop}>
          Retake
        </Button>
        <Button variant="outline" className="flex-1" onPress={noop}>
          Take cash instead
        </Button>
      </View>
      <Button variant="dangerSoft" onPress={noop}>
        Keep blocked
      </Button>
      <Label>sm: a 36 pill in a 48 press area</Label>
      <View className="flex-row flex-wrap items-center gap-2">
        <Button size="sm" onPress={noop}>
          Unlock
        </Button>
        <Button size="sm" variant="secondary" onPress={noop}>
          Take now
        </Button>
        <Button size="sm" variant="danger" onPress={noop}>
          Rush
        </Button>
        <Button size="sm" variant="outline" onPress={noop}>
          Part
        </Button>
      </View>
      <Label>On a photo: onPhoto and glass</Label>
      <Photo source={protoImages["isangano-terrace"]} height={metrics.photo.banner} scrim="bottom">
        <View className="flex-1 justify-between p-3">
          <View className="flex-row justify-between">
            <IconButton icon="ChevronLeft" label="Back" variant="glass" onPress={noop} />
            <View className="flex-row">
              <IconButton icon="ArrowShapeTurnUpRight" label="Share" variant="glass" onPress={noop} />
              <IconButton icon="Heart" label="Save" variant="glass" onPress={noop} />
            </View>
          </View>
          <Button variant="onPhoto" size="sm" className="self-start" onPress={noop}>
            See all 24 photos
          </Button>
        </View>
      </Photo>
      <Label>IconButton: default, surface, plain, with a dot and a count</Label>
      <View className="flex-row flex-wrap items-center gap-1">
        <IconButton icon="Gear" label="Settings" onPress={noop} />
        <IconButton icon="Bell" label="Notifications" variant="surface" dot onPress={noop} />
        <IconButton icon="Comments" label="Inbox" variant="surface" count={3} onPress={noop} />
        <IconButton icon="Xmark" label="Close" variant="plain" onPress={noop} />
        <IconButton icon="Sliders" label="Filters" variant="surface" tone="accent" onPress={noop} />
      </View>
    </Demo>
  );
}

const STAYS = [
  { value: "all", label: "All stays" },
  { value: "hotel", label: "Hotel" },
  { value: "lodge", label: "Lodge" },
  { value: "camp", label: "Tented camp" },
] as const;

const INBOX = [
  { value: "all", label: "All" },
  { value: "alerts", label: "Alerts", count: 3 },
  { value: "guests", label: "Guests" },
  { value: "team", label: "Team" },
] as const;

function ChipsDemo() {
  const [stay, setStay] = useState<(typeof STAYS)[number]["value"]>("all");
  const [box, setBox] = useState<(typeof INBOX)[number]["value"]>("alerts");
  return (
    <Demo title="Chips, filters and status">
      <View className="flex-row flex-wrap gap-2">
        <Chip tone="success" icon="CloudCheck" label="All sent" />
        <Chip tone="warning" icon="CloudSlash" label="2 waiting" size="lg" />
        <Chip tone="accent" variant="solid" label="Sellable" />
        <Chip tone="danger" variant="solid" label="Overdue" />
        <Chip tone="info" label="On the way" />
        <TestMoneyTag />
      </View>
      <View className="-mx-4">
        <FilterChips label="Kind of stay" options={STAYS} value={stay} onChange={setStay} />
      </View>
      <View className="-mx-4">
        <FilterChips label="Inbox" options={INBOX} value={box} onChange={setBox} />
      </View>
      <View className="flex-row flex-wrap items-center gap-3">
        <LiveDot label="Live" />
        <LiveDot tone="warning" label="Signal weak" />
        <LiveDot tone="danger" label="Offline" />
        <CountBadge count={4} />
        <CountBadge count={120} />
      </View>
      <View className="flex-row flex-wrap gap-2">
        {roomStatuses.map((status) => (
          <StatusPill key={status} status={status} label={status === "dnd" ? "DND 11:00" : undefined} />
        ))}
      </View>
    </Demo>
  );
}

const URGENCY = [
  { value: "wait", label: "Can wait" },
  { value: "today", label: "Today" },
  { value: "urgent", label: "Urgent" },
] as const;

const PROBLEMS = [
  { icon: "Droplet", label: "Plumbing" },
  { icon: "Thunderbolt", label: "Electrical" },
  { icon: "Snowflake", label: "AC" },
  { icon: "Hammer", label: "Furniture" },
  { icon: "ShieldCheck", label: "Safety" },
  { icon: "Ellipsis", label: "Other" },
] as const;

function FormsDemo() {
  const [email, setEmail] = useState("sarah.kimani@gmail.com");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("Water drips under the kitchen sink when the tap is on.");
  const [urgency, setUrgency] = useState<(typeof URGENCY)[number]["value"]>("today");
  const [pay, setPay] = useState<"full" | "part">("full");
  const [checked, setChecked] = useState(true);
  const [problem, setProblem] = useState<string>("Electrical");
  const [adults, setAdults] = useState(2);
  const [code, setCode] = useState("4812");
  const [pin, setPin] = useState("12");
  return (
    <Demo title="Forms">
      <Field label="Email" hint="We send a 6-digit code to this address.">
        <Input
          value={email}
          onChangeText={setEmail}
          leading="Envelope"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </Field>
      <Field label="Type the code we emailed you" error="That code has expired. Ask for a new one.">
        <Input placeholder="6-digit code" keyboardType="number-pad" />
      </Field>
      <Field label="Describe it" hint="Where it is, and since when. A few words is enough.">
        <TextArea value={note} onChangeText={setNote} />
      </Field>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search help" />
      <SearchBar
        title="Rubavu, Lake Kivu"
        subtitle="Wed 14 – Fri 16 Oct · 2 adults"
        onPress={noop}
        trailing={<IconButton icon="Sliders" label="Filters" variant="surface" onPress={noop} />}
      />
      <Segmented label="How urgent?" options={URGENCY} value={urgency} onChange={setUrgency} />
      <Choice
        title="Full amount"
        subtitle="Clears November"
        selected={pay === "full"}
        onPress={() => setPay("full")}
        trailing={
          <Text role="callout" strong tabular>
            950,000
          </Text>
        }
      />
      <Choice
        title="Part payment"
        subtitle="Pay some now; the rest stays due"
        selected={pay === "part"}
        onPress={() => setPay("part")}
      />
      <Choice
        indicator="none"
        title="Forest Tent"
        subtitle="2 guests · 4 free tonight"
        leading={<IconTile icon="House" />}
        selected
        onPress={noop}
      />
      <View className="flex-row items-center gap-1">
        <Radio selected label="Morning" onPress={noop} />
        <Radio selected={false} label="Evening" onPress={noop} />
        <Checkbox checked={checked} onChange={setChecked} label="Toilet cleaned and disinfected" />
        <Checkbox checked tone="danger" label="Failed" onChange={noop} />
      </View>
      <TileGrid columns={3}>
        {PROBLEMS.map((p) => (
          <OptionTile
            key={p.label}
            icon={p.icon}
            label={p.label}
            selected={problem === p.label}
            onPress={() => setProblem(p.label)}
          />
        ))}
      </TileGrid>
      <View className="flex-row items-center justify-between">
        <View>
          <Text role="headline">Adults</Text>
          <Text role="caption" tone="muted">
            Age 13+
          </Text>
        </View>
        <Stepper label="Adults" value={adults} onChange={setAdults} min={1} max={6} />
      </View>
      <OtpInput value={code} onChange={setCode} />
      <PinDots length={4} filled={pin.length} />
      <Keypad
        onKey={(digit) => setPin((p) => (p.length < 4 ? p + digit : p))}
        onDelete={() => setPin((p) => p.slice(0, -1))}
        extra={{ icon: "Fingerprint", label: "Use fingerprint", onPress: noop }}
      />
    </Demo>
  );
}

const PINS = [
  { x: 34, y: 42, label: "140k", onPress: noop },
  { x: 46, y: 62, label: "150k", icon: "HeartFill", active: true, onPress: noop },
  { x: 58, y: 28, label: "45k", onPress: noop },
  { x: 76, y: 70, label: "120k", onPress: noop },
  { x: 82, y: 22, label: "260k", onPress: noop },
] as const;

function MediaDemo() {
  return (
    <Demo title="Media">
      <View className="-mx-4 overflow-hidden">
        <PhotoHero
          source={protoImages["isangano-hotel-exterior"]}
          height={metrics.photo.hero}
          scrim="bleed"
          underStatusBar={false}
          label="Isangano Lakeside Hotel"
          top={
            <>
              <Chip variant="glass" icon="MapPin" label="Isangano Lakeside · Rubavu" />
              <IconButton icon="Bell" label="Notifications" variant="glass" dot onPress={noop} />
            </>
          }
        >
          <Chip variant="glass" icon="Calendar" label="In 2 days" />
          <Text role="title1">Your lake weekend starts Wednesday</Text>
          <Text role="callout" tone="muted">
            Wed 14 – Fri 16 Oct · 2 nights · BK-20431
          </Text>
        </PhotoHero>
      </View>
      <Photo
        source={protoImages["private-pool-villa"]}
        height={metrics.photo.card}
        label="Pool at Isangano Lakeside Hotel"
        topLeft={<Chip variant="glass" icon="Thunderbolt" label="Instant booking" />}
        topRight={<IconButton icon="HeartFill" label="Saved" variant="glass" tone="danger" onPress={noop} />}
        bottom={<PagerDots count={5} index={0} />}
      />
      <View className="flex-row gap-3">
        <Photo source={protoImages["deluxe-lake-view-room"]} aspect={1} radius="md" className="flex-1" scrim="bottom">
          <View className="absolute inset-x-2 bottom-2">
            <Text role="caption" strong>
              Deluxe Lake View
            </Text>
          </View>
        </Photo>
        <Photo source={protoImages["tents-on-the-shore"]} aspect={1} radius="md" className="flex-1" scrim="top" />
      </View>
      <View className="flex-row items-end gap-3">
        <Avatar size="s" name="Jeanne Nyiraneza" />
        <Avatar size="m" source={protoImages["staff-portrait"]} name="Jeanne N." />
        <Avatar size="l" name="Olivier K" tone="success" />
        <Avatar size="xl" name="Aline Uwase" />
      </View>
      <Label>Scrims: bottom under a caption, fade into the page</Label>
      <Photo source={protoImages["lake-view-terrace-sunset"]} height={metrics.photo.tile} radius="md">
        <PhotoScrim preset="fade" />
      </Photo>
      <PagerDots count={4} index={1} tone="default" />
      <PlaceMap pins={PINS} lakeLabel="Lake Kivu" label="Map of stays around Lake Kivu" />
    </Demo>
  );
}

function ProgressDemo() {
  return (
    <Demo title="Progress and numbers">
      <ProgressBar value={80} label="Checks done" />
      <ProgressBar value={62} tone="warning" label="Rent paid" />
      <ProgressBar value={18} tone="danger" size="thin" label="Card share" />
      <StepBar total={2} step={1} />
      <StepBar total={4} step={3} />
      <Card>
        <Timeline
          steps={[
            {
              title: "Booking confirmed",
              detail: "Deposit RWF 140,000 paid · held by Injishi until check-in",
              state: "done",
            },
            {
              title: "Send your ID and arrival time",
              detail: "2 minutes · the desk only compares it on arrival",
              state: "now",
              icon: "ShieldCheck",
            },
            {
              title: "Key on your phone",
              detail: "Ready on Wednesday, after the ID check",
              state: "todo",
              icon: "Key",
            },
          ]}
        />
      </Card>
      <View className="flex-row items-center gap-4">
        <Ring value={84} size={86} stroke={8} label="148 of 176 hours">
          <Text role="title3" tabular>
            148
          </Text>
          <Text role="micro" tone="muted">
            of 176 h
          </Text>
        </Ring>
        <Ring value={100} tone="success" label="Rent paid" />
        <Spinner size="sm" />
        <Spinner size="md" />
        <Spinner size="lg" label="Waiting for MTN" />
      </View>
      <Sparkline values={[12, 18, 15, 22, 19, 26, 31]} label="Revenue, last 7 days" />
      <View className="flex-row gap-2.5">
        <View className="flex-1">
          <Kpi label="Occupancy tonight" value="82%" caption="+6 pts vs last Tue" trend={[5, 6, 5, 7, 6, 8, 9]} />
        </View>
        <View className="flex-1">
          <Kpi
            label="Revenue today"
            value="4.8"
            unit="M"
            caption="RWF · rooms, F&B, Kivu Hall"
            trend={[3, 4, 4, 5, 4, 6, 8]}
          />
        </View>
      </View>
      <View className="flex-row gap-2.5">
        <View className="flex-1">
          <Kpi label="Arrivals" value="9" unit="/ 14" caption="checked in · 2 VIP" onPress={noop} />
        </View>
        <View className="flex-1">
          <Kpi label="Rooms ready" value="21" unit="/ 26" caption="5 being cleaned" />
        </View>
      </View>
    </Demo>
  );
}

function ChatDemo() {
  const [message, setMessage] = useState("");
  return (
    <Demo title="Bubble and Composer">
      <View className="gap-2">
        <Bubble from="them" author="Front desk" text="Good evening Sarah, your towels are on the way." time="19:42" />
        <Bubble from="me" text="Thank you! Could we also get two more pillows?" time="19:43 · Read" />
        <Bubble from="them" text="Of course, Jeanne is bringing them now." time="19:44" />
      </View>
      <Card padding="none">
        <BottomInset value={0}>
          <Composer
            value={message}
            onChangeText={setMessage}
            onSend={() => setMessage("")}
            leading={<IconButton icon="Paperclip" label="Attach a photo" variant="plain" onPress={noop} />}
          />
        </BottomInset>
      </Card>
    </Demo>
  );
}

function OverlaysDemo() {
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  return (
    <Demo title="SheetScreen and Dialog">
      <Text role="callout" tone="muted">
        A sheet route renders SheetScreen as its whole body; here one is drawn in a frame. Drag its heading down, or
        press the scrim, to close it.
      </Text>
      <Button variant="secondary" onPress={() => setSheet((open) => !open)}>
        {sheet ? "Hide the sheet" : "Show a sheet"}
      </Button>
      {sheet ? (
        <View className="overflow-hidden rounded-3xl border border-separator" style={{ height: metrics.photo.bleed }}>
          <SheetScreen
            title="Found an item"
            subtitle="It goes to Lost and found with you as the first person holding it."
            right={<Chip tone="accent" label="Room 204" />}
            onClose={() => setSheet(false)}
            maxHeight={0.4}
            dock={
              <Dock>
                <Button onPress={() => setSheet(false)}>Log the item</Button>
              </Dock>
            }
          >
            <Field label="What is it?">
              <Input defaultValue="Black phone charger, USB-C" />
            </Field>
          </SheetScreen>
        </View>
      ) : null}
      <Button variant="dangerSoft" onPress={() => setDialog(true)}>
        Open a dialog
      </Button>
      <Dialog
        isOpen={dialog}
        onClose={() => setDialog(false)}
        icon="TrashBin"
        tone="danger"
        title="Delete your Injishi account?"
        body="Your profile, saved IDs and messages are deleted now. Fiscal receipts stay with the hotels, by law."
        actions={
          <>
            <Button variant="danger" onPress={() => setDialog(false)}>
              Delete my account
            </Button>
            <Button variant="ghost" onPress={() => setDialog(false)}>
              Keep my account
            </Button>
          </>
        }
      />
    </Demo>
  );
}

function StaffDemo() {
  return (
    <Demo title="Staff and codes">
      <View className="flex-row items-center justify-around">
        <QrCode seed="ishyamba-BK-20461-F2" label="Check-in code for Amina Wanjiru" />
        <QrCode seed="ebm-ishyamba-A8812" size={metrics.iconTileLarge * 2} label="Fiscal receipt code" />
      </View>
      <RoomGrid>
        <RoomCell
          room="206"
          status="dirty"
          note="12:00 · DND"
          flag="Clock"
          flagLabel="arrival at 12:00"
          onPress={noop}
        />
        <RoomCell room="201" status="clean" note="13:00 · check" onPress={noop} />
        <RoomCell room="204" status="cleaning" note="14:00 · Jeanne" flag="Star" onPress={noop} />
        <RoomCell room="207" status="blocked" note="Shower leak" flag="Wrench" onPress={noop} />
        <RoomCell room="203" status="ready" note="16:00 · ready" onPress={noop} />
        <RoomCell room="T-01" status="occupied" note="Mukamana" onPress={noop} />
        <RoomCell room="T-06" status="arriving" note="Nkurunziza" onPress={noop} />
        <RoomCell room="F-2" status="ready" note="Ready · cot" selected onPress={noop} />
        <RoomCell room="F-3" status="vacant" note="In house" isDisabled />
        <RoomCell room="212" status="dnd" note="DND 11:00" />
      </RoomGrid>
      <ScanFrame
        photo={protoImages["front-desk-lakeside"]}
        label="Fit the ID inside the frame"
        size={metrics.scanFrame.size}
        status={<Chip tone="success" variant="solid" icon="CircleCheck" label="Passport read · sharp" />}
      >
        <Card tone="accentSoft" padding="sm">
          <View className="flex-row gap-3">
            <Avatar size="l" name="Amina Wanjiru" tone="warning" />
            <View className="gap-1">
              <Text role="callout" strong>
                WANJIRU, AMINA
              </Text>
              <Text role="caption" tabular>
                AK4410•••
              </Text>
            </View>
          </View>
        </Card>
      </ScanFrame>
    </Demo>
  );
}
