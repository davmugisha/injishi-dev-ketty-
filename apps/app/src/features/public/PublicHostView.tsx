"use client";

import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleCheck,
  Clock,
  Comments,
  Display,
  MapPin,
  PaperPlane,
  PersonPlus,
  Signal,
  Wallet,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  FieldError,
  Form,
  Input,
  Label,
  ProgressBar,
  TextField,
} from "@heroui/react";
import { ItemCard, Segment } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { HostFeature, HostFee, HostKind, HostPlan, HostStep, ReadinessItem } from "@injishi/data/fixtures/public";
import { stock } from "@injishi/data/media";
import { GateChip, Icon, LinkButton, StatusDot, TextLink } from "@injishi/ui";
import NextLink from "next/link";
import { type FormEvent, useState } from "react";
import { ChoiceField, filled } from "./fields";
import type { DemoLinks } from "./links";
import {
  CaptionedPhoto,
  PublicFooter,
  PublicHeader,
  PublicMain,
  type PublicVisitor,
  SignInAction,
} from "./PublicChrome";
import { cx, linkTo, Pending, SectionHeading } from "./shared";

export interface PublicHostData {
  steps: HostStep[];
  features: HostFeature[];
  readiness: ReadinessItem[];
  plans: HostPlan[];
  fees: HostFee[];
}

const HERO_CHIPS = [
  { label: "RWF and mobile money", icon: Wallet },
  { label: "English and Kinyarwanda", icon: Comments },
  { label: "Keeps working on weak signal", icon: Signal },
];

const KINDS: { id: HostKind; label: string }[] = [
  { id: "hotel", label: "Hotels" },
  { id: "lodge", label: "Lodges and camps" },
  { id: "residence", label: "Residences" },
  { id: "outlet", label: "Outlets" },
];

const BUSINESS_TYPES = [
  { id: "hotel", label: "Hotel" },
  { id: "lodge", label: "Lodge or tented camp" },
  { id: "guest", label: "Guest house" },
  { id: "residence", label: "Residence or apartments" },
  { id: "outlet", label: "Restaurant, bar or café" },
];

const DISTRICTS = [
  { id: "gasabo", label: "Gasabo" },
  { id: "kicukiro", label: "Kicukiro" },
  { id: "nyarugenge", label: "Nyarugenge" },
  { id: "rubavu", label: "Rubavu" },
  { id: "musanze", label: "Musanze" },
  { id: "huye", label: "Huye" },
  { id: "nyamagabe", label: "Nyamagabe" },
  { id: "other", label: "Another district" },
];

const SOURCES = [
  { id: "agent", label: "A field agent visited" },
  { id: "peer", label: "Another business owner" },
  { id: "psf", label: "PSF or Chamber event" },
  { id: "social", label: "Social media" },
  { id: "radio", label: "Radio" },
  { id: "search", label: "Web search" },
];

const FORMATS = [
  { id: "online", label: "Online", note: "About 45 minutes by video call" },
  { id: "onsite", label: "At my property", note: "A field agent visits where the programme runs in your district" },
];

/** Public · for hosts (artifact: PublicHost.dc.html) — the marketing page for businesses. */
export function PublicHostView({
  visitor,
  links,
  data,
}: {
  visitor: PublicVisitor | null;
  links: DemoLinks;
  data: PublicHostData;
}) {
  const [kind, setKind] = useState<HostKind>("hotel");
  const [plan, setPlan] = useState("property");

  const [visitAsked, setVisitAsked] = useState(false);
  const [agentApplied, setAgentApplied] = useState(false);

  const [name, setName] = useState("Didier Mugenzi");
  const [business, setBusiness] = useState("Amahoro Hospitality Group");
  const [bizType, setBizType] = useState("hotel");
  const [district, setDistrict] = useState("rubavu");
  const [phone, setPhone] = useState("078 300 1122");
  const [source, setSource] = useState("agent");
  const [format, setFormat] = useState("online");
  const [demoSent, setDemoSent] = useState(false);

  const features = data.features.filter((f) => f.kind === kind);
  const formatNote = FORMATS.find((f) => f.id === format)?.note;

  const sendDemo = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDemoSent(true);
  };

  return (
    <>
      <PublicHeader
        current="hosts"
        actions={
          <>
            <SignInAction visitor={visitor} />
            <LinkButton href={screenHref("Register")} size="sm">
              Register a business
            </LinkButton>
          </>
        }
      />

      <PublicMain className="gap-[44px] sm:pt-[36px]">
        <section className="flex flex-wrap items-center gap-[36px]" aria-labelledby="hero-h">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-[16px]">
            <p className="text-[13px] leading-[18px] font-medium text-muted">
              For hotels, lodges, residences and outlets in Rwanda
            </p>
            <h1
              id="hero-h"
              className="text-[34px] leading-[40px] font-[650] tracking-[-0.025em] sm:text-[42px] sm:leading-[48px]"
            >
              Run the whole property on one platform, and get booked directly.
            </h1>
            <p className="max-w-[600px] text-[16px] leading-[25px] text-muted">
              Front desk, housekeeping, outlets, leases, payments and receipts in one place, with a workspace for every
              role. Guests find you on the Injishi marketplace and pay your business directly.
            </p>
            <div className="flex flex-wrap items-center gap-[10px]">
              <LinkButton href={screenHref("Register")} size="lg">
                Register your business
                <ArrowRight className="size-4" />
              </LinkButton>
              <LinkButton href={linkTo(links, "OwnerHome")} size="lg" variant="secondary">
                <Display className="size-4" />
                Try the demo workspace
              </LinkButton>
            </div>
            <span className="text-[12px] text-muted">
              The demo uses sample data for a fictional hotel group and resets every night. Nothing you do there is
              real.
            </span>
            <div className="flex flex-wrap gap-[8px]">
              {HERO_CHIPS.map((c) => (
                <Chip key={c.label} variant="soft">
                  <c.icon className="size-3" aria-hidden="true" />
                  <Chip.Label>{c.label}</Chip.Label>
                </Chip>
              ))}
            </div>
          </div>

          <div className="relative min-w-0 flex-[1_1_440px]">
            <CaptionedPhoto
              image={stock.frontDeskLakeside}
              caption="Front desk at a lakeside hotel"
              captionAt="top"
              className="h-[400px] rounded-[20px]"
              sizes="(min-width: 1024px) 560px, 100vw"
              priority
            />
            <Card
              aria-hidden="true"
              className="absolute bottom-[28px] left-[10px] w-[220px] gap-[4px] px-[16px] py-[14px] shadow-overlay sm:left-[-20px]"
            >
              <span className="text-[12px] text-muted">Occupancy tonight</span>
              <span className="text-[22px] leading-[28px] font-[650] tabular">78%</span>
              <ProgressBar value={78} aria-label="Occupancy tonight" size="md">
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            </Card>
            <Card
              aria-hidden="true"
              className="absolute top-[64px] right-[10px] w-[250px] gap-[6px] px-[14px] py-[12px] shadow-overlay sm:right-[-12px]"
            >
              <Chip size="sm" variant="soft" color="success" className="self-start">
                Verified
              </Chip>
              <span className="text-[13px] font-semibold">RWF 280,000 · MTN MoMo</span>
              <span className="text-[11px] text-muted tabular">MP261012.1043.C71842 · 10:43</span>
            </Card>
            <Card
              aria-hidden="true"
              className="absolute right-[24px] bottom-[-14px] flex-row items-center gap-[8px] px-[14px] py-[10px] shadow-overlay"
            >
              <StatusDot tone="success" />
              <span className="text-[13px]">Room 204 inspected · ready</span>
            </Card>
          </div>
        </section>

        <section className="flex flex-col gap-[16px]" aria-labelledby="how-h">
          <SectionHeading
            id="how-h"
            title="How it works"
            sub="From sign-up to your first guest, with a checklist that shows the next step."
          />
          <ol className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
            {data.steps.map((h) => (
              <li key={h.id} className="contents">
                <Card variant="secondary" className="gap-[8px] p-[18px]">
                  <div className="flex items-center justify-between gap-[12px]">
                    <Avatar size="sm" variant="soft" color="accent">
                      <Avatar.Fallback>{h.n}</Avatar.Fallback>
                    </Avatar>
                    <span className="text-[12px] text-muted">{h.time}</span>
                  </div>
                  <h3 className="text-[16px] leading-[22px] font-semibold">{h.title}</h3>
                  <p className="text-[13px] leading-[19px] text-muted">{h.desc}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <Card aria-labelledby="mod-h" className="gap-[16px] p-[22px]" render={(p) => <section {...p} />}>
          <div className="flex flex-wrap items-end justify-between gap-[12px]">
            <SectionHeading
              id="mod-h"
              size="md"
              title="Built for How You Host"
              sub="Turn on what your business needs. Each role sees only its own work."
            />
            <Segment aria-label="Business type" selectedKey={kind} onSelectionChange={(k) => setKind(k as HostKind)}>
              {KINDS.map((k, i) => (
                <Segment.Item key={k.id} id={k.id}>
                  {i > 0 ? <Segment.Separator /> : null}
                  {k.label}
                </Segment.Item>
              ))}
            </Segment>
          </div>
          <div className="grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">
            {features.map((f) => (
              <NextLink key={f.id} href={linkTo(links, f.board)} className="block text-inherit no-underline">
                <ItemCard variant="secondary" className="h-full items-start">
                  <ItemCard.Icon>
                    <Icon name={f.icon} />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title className="whitespace-normal">{f.title}</ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">{f.desc}</ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                  </ItemCard.Action>
                </ItemCard>
              </NextLink>
            ))}
          </div>
        </Card>

        <section className="flex flex-col gap-[14px]" aria-labelledby="rw-h">
          <div className="flex flex-wrap items-end gap-x-[16px] gap-y-[8px]">
            <SectionHeading
              id="rw-h"
              title="Ready for Rwanda"
              sub="What we build in, and what still depends on our partners."
              className="flex-[1_1_400px]"
            />
            <TextLink href={`${screenHref("PublicHelp")}#processors`} className="text-[13px]">
              Privacy notice and processor list
            </TextLink>
          </div>
          <div className="grid gap-[12px] [grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr))]">
            {data.readiness.map((r) => (
              <Card key={r.id} variant="secondary" className="gap-[8px] p-[16px]">
                <Icon name={r.icon} className="size-5 text-accent-soft-foreground" />
                <span className="font-semibold">{r.title}</span>
                <span className="flex-1 text-[13px] leading-[19px] text-muted">{r.desc}</span>
                <GateChip
                  icon={<Icon name={r.gateIcon} className="size-3 shrink-0" />}
                  className="h-auto! min-h-[22px] self-start py-[3px] leading-4 whitespace-normal!"
                >
                  {r.gate}
                </GateChip>
              </Card>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-[16px]" aria-labelledby="price-h">
          <div className="flex flex-wrap items-end gap-[12px]">
            <SectionHeading
              id="price-h"
              title="Pricing"
              sub="Prices are being finalised. Nothing is charged until you accept a written quote."
              className="flex-[1_1_400px]"
            />
            <GateChip icon={<Clock className="size-3" />}>Prices awaiting approval</GateChip>
          </div>
          <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
            {data.plans.map((p) => (
              <Card
                key={p.id}
                aria-labelledby={`plan-${p.id}`}
                className={cx("gap-[14px] p-[22px]", plan === p.id && "outline-2 outline-accent")}
                render={(props) => <article {...props} />}
              >
                <div className="flex items-center justify-between gap-[12px]">
                  <h3 id={`plan-${p.id}`} className="text-[17px] leading-[24px] font-[650]">
                    {p.name}
                  </h3>
                  {p.popular ? (
                    <Chip size="sm" variant="soft" color="accent">
                      Most properties
                    </Chip>
                  ) : null}
                </div>
                <p className="text-[13px] leading-[19px] text-muted">{p.audience}</p>
                <div className="flex flex-col gap-[2px]">
                  <Pending className="text-[15px] font-[650]" />
                  <span className="text-[12px] text-muted">per month · {p.unit}</span>
                </div>
                <ul className="flex flex-col gap-[8px] text-[13px]">
                  {p.items.map((t) => (
                    <li key={t} className="flex gap-[8px]">
                      <Check className="mt-[3px] size-3.5 shrink-0 text-accent" aria-hidden="true" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="secondary"
                  className="mt-auto self-start"
                  aria-pressed={plan === p.id}
                  onPress={() => setPlan(p.id)}
                >
                  Ask about {p.name}
                </Button>
              </Card>
            ))}
          </div>
          <Card variant="secondary" className="px-[20px] py-[16px] text-[13px]">
            <dl className="grid gap-x-[24px] gap-y-[12px] [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
              {data.fees.map((fe) => (
                <div key={fe.id} className="flex flex-col gap-[2px]">
                  <dt className="text-muted">{fe.label}</dt>
                  <dd className="font-medium">{fe.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>

        <Card
          aria-labelledby="agent-h"
          className="flex-row flex-wrap items-center gap-[16px] p-[22px]"
          render={(p) => <section {...p} />}
        >
          <CaptionedPhoto
            image={stock.fieldAgentVisit}
            caption="Field agent visit, Musanze"
            className="h-[150px] min-w-0 flex-[0_1_220px] rounded-[20px]"
            sizes="220px"
          />
          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-[8px]">
            <h2 id="agent-h" className="text-[20px] leading-[28px] font-[650]">
              Field Agent Programme
            </h2>
            <p className="text-[14px] leading-[21px] text-muted">
              Prefer help in person? Trained field agents visit your property to help you register, gather documents and
              train staff on the first shifts. Every agent carries a certificate you can check online.
            </p>
            <p className="text-[13px] leading-[19px] text-muted">
              Know hospitality businesses in your district? Join as an agent. Earnings per activated business:{" "}
              <Pending className="text-foreground" />
            </p>
          </div>
          <div className="flex min-w-0 flex-[0_1_230px] flex-col gap-[8px]">
            <Button variant="secondary" isDisabled={visitAsked} onPress={() => setVisitAsked(true)}>
              <MapPin className="size-4" />
              {visitAsked ? "Visit requested · we’ll call you" : "Request an agent visit"}
            </Button>
            <Button variant="tertiary" isDisabled={agentApplied} onPress={() => setAgentApplied(true)}>
              <PersonPlus className="size-4" />
              {agentApplied ? "Application started · check your email" : "Apply as a field agent"}
            </Button>
            <TextLink href={`${screenHref("Training")}#verify`} className="self-center text-[13px]">
              Verify an agent’s certificate
            </TextLink>
          </div>
        </Card>

        <div className="flex flex-wrap items-start gap-[24px]">
          <Card
            aria-labelledby="demo-h"
            className="min-w-0 flex-[1_1_600px] gap-[14px] p-[22px]"
            render={(p) => <section {...p} />}
          >
            <SectionHeading
              id="demo-h"
              size="md"
              title="Request a Demo"
              sub="We walk you through your own kind of property, online or on site."
            />
            {demoSent ? (
              <>
                <Alert status="success" role="status">
                  <Alert.Indicator>
                    <CircleCheck />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Request received · DEM-1042</Alert.Title>
                    <Alert.Description>
                      A team member will call {phone} within 2 working days to agree a time. This is a request, not a
                      booked slot yet.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
                <Button variant="ghost" size="sm" className="self-start" onPress={() => setDemoSent(false)}>
                  Edit request
                </Button>
              </>
            ) : (
              <Form aria-labelledby="demo-h" className="flex flex-col gap-[14px]" onSubmit={sendDemo}>
                <div className="grid gap-[12px] [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
                  <TextField
                    variant="secondary"
                    value={name}
                    onChange={setName}
                    validate={filled("Enter your name.")}
                    className="gap-[4px]"
                  >
                    <Label>Your name</Label>
                    <Input />
                    <FieldError />
                  </TextField>
                  <TextField
                    variant="secondary"
                    value={business}
                    onChange={setBusiness}
                    validate={filled("Enter the business name.")}
                    className="gap-[4px]"
                  >
                    <Label>Business name</Label>
                    <Input />
                    <FieldError />
                  </TextField>
                  <ChoiceField
                    id="d-type"
                    label="Business type"
                    value={bizType}
                    onChange={setBizType}
                    options={BUSINESS_TYPES}
                  />
                  <ChoiceField
                    id="d-dist"
                    label="District"
                    value={district}
                    onChange={setDistrict}
                    options={DISTRICTS}
                  />
                  <TextField
                    variant="secondary"
                    value={phone}
                    onChange={setPhone}
                    validate={filled("Enter a phone number we can call.")}
                    className="gap-[4px]"
                  >
                    <Label>Phone</Label>
                    <Input type="tel" inputMode="tel" />
                    <FieldError />
                  </TextField>
                  <ChoiceField
                    id="d-src"
                    label="How did you hear about us?"
                    value={source}
                    onChange={setSource}
                    options={SOURCES}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-[16px]">
                  <Label id="d-format">Demo</Label>
                  <Segment
                    aria-labelledby="d-format"
                    selectedKey={format}
                    onSelectionChange={(k) => setFormat(String(k))}
                  >
                    {FORMATS.map((f, i) => (
                      <Segment.Item key={f.id} id={f.id}>
                        {i > 0 ? <Segment.Separator /> : null}
                        {f.label}
                      </Segment.Item>
                    ))}
                  </Segment>
                  <span className="text-[12px] text-muted" aria-live="polite">
                    {formatNote}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-[12px]">
                  <span className="max-w-[420px] text-[12px] text-muted">
                    We use these details only to arrange your demo. See the privacy notice in the help centre.
                  </span>
                  <Button type="submit">
                    <PaperPlane className="size-4" />
                    Request demo
                  </Button>
                </div>
              </Form>
            )}
          </Card>
        </div>
      </PublicMain>

      <PublicFooter
        links={[
          { label: "Help centre", href: screenHref("PublicHelp") },
          { label: "Privacy notice", href: `${screenHref("PublicHelp")}?doc=privacy#policies` },
          { label: "Terms", href: `${screenHref("PublicHelp")}?doc=terms#policies` },
          { label: "Training", href: screenHref("Training") },
          { label: "Find a stay", href: screenHref("MarketExplore") },
        ]}
      />
    </>
  );
}
