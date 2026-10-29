"use client";

import { FieldError, Input, Label, TextField } from "@heroui/react";
import { stock } from "@injishi/data/media";
import {
  ActionButton,
  BoundedDatePicker,
  CodeInput,
  CountrySelect,
  DateText,
  EmailInput,
  type EmailTypoState,
  formatRange,
  KeyValueList,
  Money,
  MonthPicker,
  type Period,
  PeriodPicker,
  PhoneInput,
  PhotoGrid,
  type PhotoItem,
  PhotoUploader,
  type PlaceChain,
  PlacePicker,
  placeLine,
  presetPeriod,
  RentCalendar,
  type RentDayItem,
  ResendCodeButton,
  readVideo,
  SectionCard,
  SidePanel,
  SignaturePad,
  StatusChip,
  useResendTimer,
  VideoField,
  type VideoItem,
  YearPicker,
} from "@injishi/ui";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { addDays } from "./kit-data";
import {
  AMAHORO,
  fakeUpload,
  GASABO,
  KIGALI,
  KIMIHURURA,
  kitFlakyLoader,
  kitPlaceLoader,
  makeSampleVideo,
  pickFiles,
  RUGANDO,
  rentDays,
  savedPhoto,
  stockFile,
} from "./kit-inputs-data";
import { Section, Specimen } from "./kit-parts";

const UNIT_PHOTOS: PhotoItem[] = [
  { id: "p1", url: stock.duplexFront.src, alt: "Front" },
  { id: "p2", url: stock.livingRoomFloor.src, alt: "Living room" },
  { id: "p3", url: stock.kitchenAppliances.src, alt: "Kitchen" },
  { id: "p4", url: stock.oneBedroomSuite.src, alt: "Bedroom" },
  { id: "p5", url: stock.deluxeBathroom.src, alt: "Bathroom" },
];

function Grid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 }) {
  return (
    <div className={`grid gap-6 ${cols === 3 ? "md:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2"}`}>{children}</div>
  );
}

function isWeekend(day: string): boolean {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
}

// --- Dates --------------------------------------------------------------------------------------------

export function DatesSection({ today }: { today: string }) {
  const [start, setStart] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>(() => presetPeriod("last_3_months", today));
  const [custom, setCustom] = useState<Period>(() => ({ preset: "custom", start: addDays(today, -44), end: today }));
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(Number(today.slice(0, 4)) - 1);
  return (
    <Section
      id="dates"
      title="Dates and periods"
      description="Date fields offer only valid days: the bounds reach the calendar too, so a day outside them can't be clicked."
    >
      <Grid>
        <Specimen label="BoundedDatePicker, next 90 days">
          <BoundedDatePicker
            label="Lease starts"
            value={start}
            onChange={setStart}
            minValue={today}
            maxValue={addDays(today, 90)}
            description="Within the next 90 days."
          />
        </Specimen>
        <Specimen label="Filled">
          <BoundedDatePicker
            label="Moved out on"
            defaultValue={addDays(today, -3)}
            minValue={addDays(today, -30)}
            maxValue={today}
          />
        </Specimen>
        <Specimen label="Typed outside the bounds">
          <BoundedDatePicker
            label="Notice ends"
            defaultValue={addDays(today, 200)}
            minValue={today}
            maxValue={addDays(today, 90)}
          />
        </Specimen>
        <Specimen label="Weekends unavailable">
          <BoundedDatePicker
            label="Inspection day"
            minValue={today}
            maxValue={addDays(today, 60)}
            isDateUnavailable={isWeekend}
            unavailableMessage="Inspections happen on weekdays. Choose a weekday."
          />
        </Specimen>
        <Specimen label="Error from the API">
          <BoundedDatePicker
            label="Lease starts"
            defaultValue={addDays(today, 10)}
            minValue={today}
            errorMessage="That unit already has a lease from that day."
          />
        </Specimen>
        <Specimen label="Disabled">
          <BoundedDatePicker label="Signed on" defaultValue={addDays(today, -20)} isDisabled />
        </Specimen>
      </Grid>
      <div className="grid gap-6 lg:grid-cols-2">
        <Specimen label="PeriodPicker, presets">
          <PeriodPicker value={period} onChange={setPeriod} today={today} />
          <p className="text-xs text-muted">
            Figures cover {formatRange(period.start, period.end)} ({period.preset.replace(/_/g, " ")}).
          </p>
        </Specimen>
        <Specimen label="PeriodPicker, custom range up to 92 days, nothing after today">
          <PeriodPicker value={custom} onChange={setCustom} today={today} maxDays={92} />
        </Specimen>
        <Specimen label="MonthPicker, from January last year">
          <MonthPicker value={month} onChange={setMonth} today={today} min={`${Number(today.slice(0, 4)) - 1}-01`} />
        </Specimen>
        <Specimen label="YearPicker, at most this year">
          <YearPicker value={year} onChange={setYear} today={today} min={Number(today.slice(0, 4)) - 4} />
        </Specimen>
      </div>
    </Section>
  );
}

// --- Photos and video ----------------------------------------------------------------------------------

/** Pictures picked automatically once, so the uploading and failed states show without a click. */
function useAutoPick(ref: RefObject<HTMLElement | null>, files: () => Promise<(File | null)[]>, ready = true) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !ready) return;
    done.current = true;
    void files().then((list) =>
      pickFiles(
        ref.current,
        list.filter((f): f is File => Boolean(f)),
      ),
    );
  }, [ref, files, ready]);
}

const photoDone = (file: File) => savedPhoto(file);

export function MediaSection() {
  const [photos, setPhotos] = useState<PhotoItem[]>(UNIT_PHOTOS);
  const [empty, setEmpty] = useState<PhotoItem[]>([]);
  const uploadingRef = useRef<HTMLDivElement>(null);
  const failedRef = useRef<HTMLDivElement>(null);
  const [slowPhotos, setSlowPhotos] = useState<PhotoItem[]>(UNIT_PHOTOS.slice(0, 1));
  const [failedPhotos, setFailedPhotos] = useState<PhotoItem[]>([]);

  const twoPhotos = useMemo(
    () => () =>
      Promise.all([stockFile(stock.bedroomWindow.src, "bedroom.jpg"), stockFile(stock.loftStudio.src, "studio.jpg")]),
    [],
  );
  const failingPhotos = useMemo(
    () => () =>
      Promise.all([
        stockFile(stock.sharedGarden.src, "garden.jpg"),
        Promise.resolve(new File(["%PDF-1.4"], "lease-notes.pdf", { type: "application/pdf" })),
      ]),
    [],
  );
  useAutoPick(uploadingRef, twoPhotos);
  useAutoPick(failedRef, failingPhotos);

  return (
    <Section
      id="media"
      title="Photos and video"
      description="Checked in the browser before anything is sent. Uploads are the caller's: the kit takes a function that reports progress."
    >
      <Grid cols={2}>
        <Specimen label="PhotoUploader, filled: drag to reorder, the first is the cover">
          <PhotoUploader
            label="Unit photos"
            photos={photos}
            max={8}
            upload={fakeUpload({ done: photoDone })}
            onUploaded={(p) => setPhotos((list) => [...list, p])}
            onReorder={setPhotos}
            onRemove={(p) =>
              new Promise<void>((resolve) =>
                setTimeout(() => {
                  setPhotos((list) => list.filter((x) => x.id !== p.id));
                  resolve();
                }, 600),
              )
            }
          />
        </Specimen>
        <Specimen label="Empty">
          <PhotoUploader
            label="Fault photos"
            photos={empty}
            max={4}
            upload={fakeUpload({ done: photoDone })}
            onUploaded={(p) => setEmpty((list) => [...list, p])}
            onReorder={setEmpty}
            onRemove={(p) => setEmpty((list) => list.filter((x) => x.id !== p.id))}
          />
        </Specimen>
        <Specimen label="Uploading (a slow network)">
          <div ref={uploadingRef}>
            <PhotoUploader
              label="Unit photos"
              photos={slowPhotos}
              max={6}
              upload={fakeUpload({ ms: 6000, stallAt: 0.45, done: photoDone })}
              onUploaded={(p) => setSlowPhotos((list) => [...list, p])}
              onReorder={setSlowPhotos}
            />
          </div>
        </Specimen>
        <Specimen label="A failed upload and a refused file">
          <div ref={failedRef}>
            <PhotoUploader
              label="Unit photos"
              photos={failedPhotos}
              max={6}
              upload={fakeUpload({ ms: 1200, failAt: 0.6, done: photoDone })}
              onUploaded={(p) => setFailedPhotos((list) => [...list, p])}
            />
          </div>
        </Specimen>
        <Specimen label="Full, with an error from the form">
          <PhotoUploader
            label="Listing photos"
            photos={UNIT_PHOTOS.slice(0, 3)}
            max={3}
            upload={fakeUpload({ done: photoDone })}
            onUploaded={() => undefined}
            errorMessage="Choose a cover photo that shows the outside."
          />
        </Specimen>
        <Specimen label="Disabled, and PhotoGrid read only">
          <div className="flex flex-col gap-4">
            <PhotoUploader
              label="Unit photos"
              photos={[]}
              max={8}
              upload={fakeUpload({ done: photoDone })}
              onUploaded={() => undefined}
              isDisabled
            />
            <PhotoGrid
              label="Fault photos"
              photos={[
                { id: "f1", url: stock.leakUnderBasin.src, alt: "Leak under the basin" },
                { id: "f2", url: stock.drippingTap.src, alt: "Dripping tap" },
              ]}
              showCover={false}
            />
          </div>
        </Specimen>
      </Grid>
      <VideoSpecimens />
    </Section>
  );
}

/** The kit's video upload takes the facts read from the file too; the fake one does not need them. */
function asVideoUpload(
  upload: (file: File, onProgress: (fraction: number) => void, signal: AbortSignal) => Promise<VideoItem>,
) {
  return (file: File, _facts: unknown, onProgress: (fraction: number) => void, signal: AbortSignal) =>
    upload(file, onProgress, signal);
}

interface Sample {
  file: File;
  video: VideoItem;
}

function VideoSpecimens() {
  const [sample, setSample] = useState<Sample | null | "none">(null);
  const [saved, setSaved] = useState<VideoItem | null>(null);
  const [fresh, setFresh] = useState<VideoItem | null>(null);
  const uploadingRef = useRef<HTMLDivElement>(null);
  const failedRef = useRef<HTMLDivElement>(null);
  const longRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const file = await makeSampleVideo(stock.livingRoomFloor.src, 4);
        if (!file) return live && setSample("none");
        const facts = await readVideo(file);
        const video: VideoItem = {
          url: URL.createObjectURL(file),
          posterUrl: facts.poster ? URL.createObjectURL(facts.poster) : null,
          durationS: facts.durationS,
        };
        if (!live) return;
        setSample({ file, video });
        setSaved(video);
      } catch {
        if (live) setSample("none");
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const ready = sample !== null && sample !== "none";
  const sampleFile = useMemo(() => () => Promise.resolve([ready ? sample.file : null]), [ready, sample]);
  useAutoPick(uploadingRef, sampleFile, ready);
  useAutoPick(failedRef, sampleFile, ready);
  useAutoPick(longRef, sampleFile, ready);

  const videoDone = (file: File): VideoItem => ({
    url: URL.createObjectURL(file),
    posterUrl: ready ? sample.video.posterUrl : null,
    durationS: ready ? sample.video.durationS : 4,
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        {sample === null
          ? "Making a 4 second sample video in this browser for the video specimens…"
          : sample === "none"
            ? "This browser can't record a sample video: pick one to try the field."
            : "The sample video was recorded in this browser from a stock photo."}
      </p>
      <Grid>
        <Specimen label="VideoField, filled: plays inline">
          <VideoField
            video={saved}
            upload={asVideoUpload(fakeUpload({ ms: 3000, done: videoDone }))}
            onUploaded={setSaved}
            onRemove={() =>
              new Promise<void>((resolve) =>
                setTimeout(() => {
                  setSaved(null);
                  resolve();
                }, 600),
              )
            }
          />
        </Specimen>
        <Specimen label="Empty">
          <VideoField
            video={fresh}
            upload={asVideoUpload(fakeUpload({ ms: 3000, done: videoDone }))}
            onUploaded={setFresh}
            onRemove={() => setFresh(null)}
          />
        </Specimen>
        <Specimen label="Uploading">
          <div ref={uploadingRef}>
            <VideoField
              video={null}
              upload={asVideoUpload(fakeUpload({ ms: 9000, stallAt: 0.62, done: videoDone }))}
              onUploaded={() => undefined}
            />
          </div>
        </Specimen>
        <Specimen label="Upload failed">
          <div ref={failedRef}>
            <VideoField
              video={null}
              upload={asVideoUpload(fakeUpload({ ms: 1500, failAt: 0.3, done: videoDone }))}
              onUploaded={() => undefined}
            />
          </div>
        </Specimen>
        <Specimen label="Too long (this one allows 2 seconds)">
          <div ref={longRef}>
            <VideoField
              video={null}
              maxSeconds={2}
              upload={asVideoUpload(fakeUpload({ done: videoDone }))}
              onUploaded={() => undefined}
            />
          </div>
        </Specimen>
        <Specimen label="Disabled">
          <VideoField
            video={null}
            isDisabled
            upload={asVideoUpload(fakeUpload({ done: videoDone }))}
            onUploaded={() => undefined}
          />
        </Specimen>
      </Grid>
    </div>
  );
}

// --- Signing and codes -----------------------------------------------------------------------------------

export function SigningSection() {
  const [png, setPng] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [code, setCode] = useState("");
  const [checks, setChecks] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const timer = useResendTimer(30);
  const [resending, setResending] = useState(false);
  return (
    <Section
      id="signing"
      title="Signing and codes"
      description="A drawn signature beside the typed name, and the emailed code that confirms it. A pasted code is checked once."
    >
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SectionCard title="Sign the lease" description="The typed name is the signature; the drawing is optional.">
          <TextField value={typed} onChange={setTyped} className="gap-1">
            <Label>Your full name</Label>
            <Input placeholder="As on the lease" autoComplete="name" />
            <FieldError />
          </TextField>
          <SignaturePad onChange={setPng} description="Draw with a finger, a pen or a mouse. Optional." />
          <div className="flex items-center gap-3 text-xs text-muted">
            <span>Exported PNG</span>
            {png ? (
              // biome-ignore lint/performance/noImgElement: a data URL from the pad
              <img
                src={png}
                alt="The drawn signature as exported"
                className="h-12 rounded border border-border bg-white px-2"
              />
            ) : (
              <span>None yet</span>
            )}
          </div>
        </SectionCard>
        <div className="flex flex-col gap-6">
          <Specimen label="SignaturePad, with an error">
            <SignaturePad errorMessage="Draw your signature, or type your name above." />
          </Specimen>
          <Specimen label="Disabled">
            <SignaturePad isDisabled />
          </Specimen>
        </div>
        <SectionCard
          title="Confirm with the code"
          description="Paste the code from the email: it fills every box and is checked once."
        >
          <CodeInput
            value={code}
            onChange={setCode}
            onComplete={(c) => {
              setChecks((list) => [...list, c]);
              setChecking(true);
              setTimeout(() => setChecking(false), 900);
            }}
            description="We sent it to aline.uwase@example.com."
            isDisabled={checking}
          />
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              intent="primary"
              size="sm"
              isPending={checking}
              isDisabled={code.length !== 6}
              onPress={() => setChecks((list) => [...list, code])}
            >
              Confirm and sign
            </ActionButton>
            <ResendCodeButton
              timer={timer}
              isPending={resending}
              onResend={() => {
                setResending(true);
                setTimeout(() => {
                  setResending(false);
                  timer.restart(30);
                }, 700);
              }}
            />
          </div>
          <p className="text-xs text-muted" data-testid="code-checks">
            {checks.length === 0
              ? "No code checked yet."
              : `Checked ${checks.length} ${checks.length === 1 ? "time" : "times"}: ${checks.join(", ")}`}
          </p>
        </SectionCard>
        <div className="flex flex-col gap-6">
          <Specimen label="CodeInput, filled">
            <CodeInput defaultValue="047600" label="Code from your email" />
          </Specimen>
          <Specimen label="Wrong code">
            <CodeInput defaultValue="123456" errorMessage="That code is not right. Check the email and try again." />
          </Specimen>
          <Specimen label="Disabled">
            <CodeInput isDisabled />
          </Specimen>
        </div>
      </div>
    </Section>
  );
}

// --- Places and contacts -----------------------------------------------------------------------------------

export function PlacesSection({ today }: { today: string }) {
  const loader = useMemo(() => kitPlaceLoader(), []);
  const flaky = useMemo(() => kitFlakyLoader(), []);
  const [place, setPlace] = useState<PlaceChain>({});
  const [flakyPlace, setFlakyPlace] = useState<PlaceChain>({ province: KIGALI });
  const [home, setHome] = useState<PlaceChain>({});
  const [country, setCountry] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [typo, setTypo] = useState<EmailTypoState>({ suggestion: null, kept: false });
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestFrom, setGuestFrom] = useState<PlaceChain>({});
  const [saved, setSaved] = useState<string | null>(null);

  const levels: { label: string; chain: PlaceChain }[] = [
    { label: "Province chosen", chain: { province: KIGALI } },
    { label: "District chosen", chain: { province: KIGALI, district: GASABO } },
    { label: "Sector chosen", chain: { province: KIGALI, district: GASABO, sector: KIMIHURURA } },
    { label: "Cell chosen", chain: { province: KIGALI, district: GASABO, sector: KIMIHURURA, cell: RUGANDO } },
    {
      label: "Complete",
      chain: { province: KIGALI, district: GASABO, sector: KIMIHURURA, cell: RUGANDO, village: AMAHORO },
    },
  ];

  return (
    <Section
      id="places"
      title="Places and contacts"
      description="Places come from the geography cascade, never typed. Each box appears once the one above is chosen; from a tablet up the room is kept, so nothing jumps."
    >
      <Grid cols={2}>
        <Specimen label="PlacePicker, try it: pick through the levels">
          <PlacePicker
            label="Where the home is"
            value={place}
            onChange={setPlace}
            loadPlaces={loader}
            name="villageId"
          />
          <p className="text-xs text-muted" data-testid="place-line">
            {placeLine(place) || "Nothing chosen yet."}
          </p>
        </Specimen>
        {levels.map((l) => (
          <Specimen key={l.label} label={`PlacePicker, ${l.label.toLowerCase()}`}>
            <StaticPlace chain={l.chain} loader={loader} />
          </Specimen>
        ))}
        <Specimen label="A level that failed to load">
          <PlacePicker value={flakyPlace} onChange={setFlakyPlace} loadPlaces={flaky} depth="sector" />
        </Specimen>
        <Specimen label="To the district only (a broker's home district), with an error">
          <PlacePicker
            label="Home district"
            value={home}
            onChange={setHome}
            loadPlaces={loader}
            depth="district"
            errorMessage={home.district ? null : "Choose the district you work from."}
          />
        </Specimen>
      </Grid>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Specimen label="CountrySelect, Rwanda first">
          <CountrySelect label="Nationality" value={country} onChange={setCountry} />
        </Specimen>
        <Specimen label="Filled">
          <CountrySelect label="Coming from" defaultValue="UG" />
        </Specimen>
        <Specimen label="Error">
          <CountrySelect label="Nationality" errorMessage="Choose the guest's nationality." />
        </Specimen>
        <Specimen label="Disabled, no flags">
          <CountrySelect label="Country" defaultValue="KE" isDisabled showFlags={false} />
        </Specimen>
        <Specimen label="PhoneInput">
          <PhoneInput label="Mobile number" value={phone} onChange={(e164) => setPhone(e164)} />
          <p className="text-xs text-muted tabular">{phone ? `Saved as ${phone}` : "Not a number yet."}</p>
        </Specimen>
        <Specimen label="Filled">
          <PhoneInput label="Mobile number" defaultValue="+250788123456" />
        </Specimen>
        <Specimen label="Not a Rwandan mobile">
          <PhoneInput label="Mobile number" defaultValue="0752 123 45" />
        </Specimen>
        <Specimen label="Other countries allowed">
          <PhoneInput label="Phone" defaultValue="+256772123456" allowInternational />
        </Specimen>
        <Specimen label="EmailInput">
          <EmailInput label="Tenant's email" value={email} onChange={setEmail} onTypoChange={setTypo} />
          <p className="text-xs text-muted">
            {typo.suggestion
              ? typo.kept
                ? "Kept as typed: confirmEmail is sent."
                : "A likely typo."
              : "No typo found."}
          </p>
        </Specimen>
        <Specimen label="A likely typo, with the fix">
          <EmailInput label="Tenant's email" defaultValue="aline@gmial.com" />
        </Specimen>
        <Specimen label="Not an address">
          <EmailInput label="Email" defaultValue="aline.uwase" />
        </Specimen>
        <Specimen label="Disabled">
          <EmailInput label="Email" defaultValue="aline@injishi.rw" isDisabled />
        </Specimen>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ActionButton icon="PersonPlus" onPress={() => setGuestOpen(true)}>
          Register a guest
        </ActionButton>
        {saved ? (
          <p role="status" className="text-sm text-muted">
            {saved}
          </p>
        ) : null}
      </div>
      <SidePanel
        isOpen={guestOpen}
        onOpenChange={setGuestOpen}
        title="Register a guest"
        description="Shared with your village leader."
        submitLabel="Register"
        submitIcon="PersonPlus"
        onSubmit={(event) => {
          event.preventDefault();
          setGuestOpen(false);
          setSaved(
            `Guest registered (gallery only, nothing was saved). Coming from ${placeLine(guestFrom) || "abroad"}.`,
          );
        }}
      >
        <TextField name="name" className="gap-1">
          <Label>Full name</Label>
          <Input />
          <FieldError />
        </TextField>
        <CountrySelect label="Nationality" name="nationality" defaultValue="RW" />
        <PhoneInput label="Phone" name="phone" allowInternational />
        <EmailInput label="Email (optional)" name="email" />
        <PlacePicker
          label="Coming from"
          value={guestFrom}
          onChange={setGuestFrom}
          loadPlaces={loader}
          name="fromVillageId"
        />
        <BoundedDatePicker
          label="Arrives"
          name="arrives"
          minValue={today}
          maxValue={addDays(today, 90)}
          description="Within the lease, at most 90 days ahead."
        />
      </SidePanel>
    </Section>
  );
}

/** A picker frozen at one level, to show what each level looks like. */
function StaticPlace({ chain, loader }: { chain: PlaceChain; loader: ReturnType<typeof kitPlaceLoader> }) {
  const [value, setValue] = useState(chain);
  return <PlacePicker value={value} onChange={setValue} loadPlaces={loader} />;
}

// --- Rent calendar -------------------------------------------------------------------------------------------

export function CalendarSection({ today }: { today: string }) {
  const items = useMemo(() => rentDays(today), [today]);
  const [open, setOpen] = useState<RentDayItem | null>(null);
  return (
    <Section
      id="calendar"
      title="Rent calendar"
      description="Due days with a dot per state, and the chosen day's rent. Days are Kigali days."
    >
      <SectionCard title="Rent in the next 30 days">
        <RentCalendar items={items} today={today} onItemPress={setOpen} />
      </SectionCard>
      <div className="max-w-md">
        <Specimen label="Narrow: the day's list goes under the month">
          <SectionCard>
            <RentCalendar items={items} today={today} defaultSelectedDay={addDays(today, 7)} />
          </SectionCard>
        </Specimen>
      </div>
      <SidePanel
        isOpen={open !== null}
        onOpenChange={(o) => (o ? undefined : setOpen(null))}
        title={open ? `${open.title}` : ""}
        description={open ? String(open.detail ?? "") : undefined}
        headerExtra={open ? <StatusChip kind="charge" status={open.status} /> : null}
      >
        {open ? (
          <KeyValueList
            items={[
              { label: "Amount", value: <Money value={open.amount} /> },
              { label: "Due", value: <DateText value={open.day} style="long" /> },
            ]}
          />
        ) : null}
      </SidePanel>
    </Section>
  );
}
