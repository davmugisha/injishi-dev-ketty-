/**
 * Root layout — the bootstrap, everything that has to be true before the first
 * frame, and the one place every route in the app is registered.
 *
 * `ui-screens.md` §6 puts splash and auth bootstrap in the same row: resolve
 * the session and the active workspace **before first paint**. Four things have
 * to land here, and all four for the same reason — each one, resolved late, is
 * a visible flash of the wrong app:
 *
 *   - **fonts**, or the shell paints in the system face and reflows;
 *   - **the stored domain and surface**, or a Landlord watches Explore paint
 *     and swap to Rent roll;
 *   - **the session flag**, or a signed-out visitor sees the shell first;
 *   - **the stored locale**, or a Kinyarwanda reader watches the shell paint in
 *     English and switch (ADR-031 child "locale persistence");
 *   - **the stored appearance**, added by Session 11 with the Appearance
 *     preference: a reader who chose Dark on a phone set to Light would
 *     otherwise watch the whole app flash white on every cold start, which is
 *     the most visible of the five.
 *
 * They resolve in parallel and the splash holds until all of them have. The
 * 1.2s font fallback stays: some web and export environments no-op the loader
 * silently, and a splash that never lifts is worse than a late typeface. It
 * bounds the fonts only — the keychain reads are fast and are awaited.
 *
 * ## The route table
 *
 * **Session 0 registers every route in the prototype, all at once, and this
 * file is frozen until Session 11.** That is the rule that lets eight sessions
 * run in parallel: each one edits the screen behind a route that already
 * exists, so nobody edits this file and nobody collides here. A route with no
 * screen yet renders `ComingSoon`, which names the frame and the session, so
 * the app is fully walkable on day one and a tap never dead-ends.
 *
 * ### Sheets
 *
 * Every sheet is `presentation: 'formSheet'` with `sheetAllowedDetents` and
 * `sheetGrabberVisible` (decision D8). That is a real
 * `UISheetPresentationController` on iOS and the platform sheet on Android, so
 * the detents, the drag, the dismiss and the scroll handoff are the system's
 * and not ours — no sheet library, and none needed. `Sheet` in `src/components`
 * draws what goes INSIDE one.
 *
 * Detents are chosen per route rather than globally: a confirm is a quarter
 * sheet, a form is most of the screen, and a sheet that opens taller than its
 * content is a sheet with a dead zone under the button.
 *
 * `ErrorBoundary` is exported below because Expo Router mounts an export of
 * that name from a layout file as the boundary for everything under it. From
 * the root layout that is the whole app.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useColorScheme,
  useWindowDimensions,
  Platform,
  View,
  ScrollView,
  Pressable,
  Text as RNText,
} from 'react-native';

import { ThemeProvider, readStoredAppearance, useTheme, type Appearance } from '@/theme/theme';
import {
  DomainProvider,
  readStoredDomain,
  readStoredSurface,
  type Domain,
  type Surface,
} from '@/domain';
import { SessionProvider, readStoredSession, useSession, type ResolvedSession } from '@/session';
import { WorkspaceProvider, useWorkspace } from '@/workspace';
import { queryClient } from '@/lib/query-client';
// Registers every queued write's handler at import, before any screen mounts,
// so the drain below can send what a previous process left in the queue.
import '@/data/write-handlers';
import { drain, hydrate } from '@/data/write-queue';
import {
  LocaleProvider,
  readStoredLocale,
  resolveInitialLocale,
  translate,
  type Locale,
} from '@/i18n/i18n';
import { fontMap } from '@/theme/fonts';
import { palettes } from '@/theme/tokens';
import { useReducedMotion } from '@/motion';
import { OfflineBanner, QueueBanner, ToastProvider, useOffline } from '@/components';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** How long the shell will wait on the font loader before painting anyway. */
const FONT_FALLBACK_MS = 1200;

interface Bootstrap {
  domain: Domain;
  surface: Surface | null;
  session: ResolvedSession;
  locale: Locale;
  appearance: Appearance;
}

/*
 * One cache for the app (ADR-038 child 0 task 7) lives in `lib/query-client.ts`,
 * at module scope, with the contract's retry policy. It moved out of this file
 * so the offline queue's handlers, which run with nothing mounted, can
 * invalidate what a replayed write changed.
 */

/* ─────────────────────────────────────────── the web preview frame ────── */

/**
 * The width below which the browser IS a phone and gets the app full bleed.
 *
 * A frame drawn on a 390px window would be a phone inside a phone, with the
 * app served through a letterbox narrower than the screen it is already on.
 * Read on every render rather than at mount, so dragging a desktop window
 * narrow crosses the threshold live.
 */
const FRAME_MIN_WINDOW = 640;

/** A phone, roughly: 384 × 824 with a 36pt corner. Layout, not colour. */
const FRAME_WIDTH = 384;
const FRAME_HEIGHT = 824;
const FRAME_RADIUS = 36;

/** Breathing room above and below the frame so it does not touch the window. */
const FRAME_MARGIN = 48;

/**
 * The document, when there is one.
 *
 * The test environment is node and native has no DOM at all, so this is read
 * defensively rather than assumed. Declared as the two style-carrying elements
 * this actually writes to, because that is the whole of what it needs and a
 * full DOM type would be a claim about an environment that may not exist.
 */
interface PageStyles {
  documentElement: { style: { overflow?: string } };
  body: { style: { overflow?: string } };
}

function pageStyles(): PageStyles | null {
  const page = (globalThis as { document?: PageStyles }).document;
  return page?.documentElement && page.body ? page : null;
}

/**
 * `expo start --web` in a phone-shaped box, so the app can be driven against a
 * local API without a simulator (ADR-038).
 *
 * **Native adds no node.** This is a runtime `Platform.OS` branch inside a file
 * that ships in the native bundle, so the wrapper has to be a true no-op there
 * — not a `View` with no style, which would still change what every layout
 * below it measures against. The fragment is the whole of the native path, and
 * the hooks live one component down so that path calls none of them and needs
 * no provider above it.
 */
export function WebPreviewFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return <BrowserFrame>{children}</BrowserFrame>;
}

function BrowserFrame({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const { height, width } = useWindowDimensions();
  const framed = width >= FRAME_MIN_WINDOW;

  /**
   * The PAGE must not scroll — the frame must.
   *
   * Two writes rather than one: browsers take the scroller from either
   * `documentElement` or `body` depending on the engine, and pinning only one
   * of them leaves the frame sliding off the top of the window as soon as a
   * screen is taller than the viewport. At that point the preview is worse than
   * no preview, because the thing you are trying to look at is off screen.
   *
   * Restored on unmount, and skipped entirely when the window is phone sized:
   * there the app is full bleed and taking the page's scroll away would strand
   * anything below the fold.
   */
  useEffect(() => {
    const page = pageStyles();
    if (!page) return;

    const previous = {
      root: page.documentElement.style.overflow,
      body: page.body.style.overflow,
    };
    page.documentElement.style.overflow = framed ? 'hidden' : '';
    page.body.style.overflow = framed ? 'hidden' : '';

    return () => {
      page.documentElement.style.overflow = previous.root ?? '';
      page.body.style.overflow = previous.body ?? '';
    };
  }, [framed]);

  if (!framed) return <>{children}</>;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceSunken,
      }}
    >
      {/* `overflow: hidden` is what makes the rounded corners cut the content
          rather than merely decorate the box. Without it a full-bleed image
          header squares off the top two corners and the frame stops reading as
          a device. */}
      <View
        style={{
          width: FRAME_WIDTH,
          height: Math.min(height - FRAME_MARGIN, FRAME_HEIGHT),
          borderRadius: FRAME_RADIUS,
          overflow: 'hidden',
          backgroundColor: c.surface1,
        }}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * Everything the shell needs before it can paint, resolved once. Returns
 * `undefined` while it is still resolving, which is what holds the splash.
 */
function useBootstrap(): Bootstrap | undefined {
  const [fontsLoaded, fontError] = useFonts(fontMap);
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  const [stored, setStored] = useState<Bootstrap>();

  useEffect(() => {
    const timer = setTimeout(() => setFontsTimedOut(true), FONT_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      readStoredDomain(),
      readStoredSurface(),
      readStoredSession(),
      readStoredLocale(),
      readStoredAppearance(),
    ]).then(([domain, surface, session, locale, appearance]) => {
      if (!cancelled) {
        setStored({
          domain: domain ?? 'residence',
          surface,
          session,
          // Stored choice first, device language second. `readStoredLocale`
          // already returns null on a failed or unrecognised read, so this
          // arm is the fallback the failure case lands in too.
          locale: resolveInitialLocale(locale),
          // `system` is what somebody who has never chosen would have had, so
          // it is also the right answer for a read that could not happen.
          appearance: appearance ?? 'system',
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fontsSettled = fontsLoaded || !!fontError || fontsTimedOut;
  return fontsSettled && stored ? stored : undefined;
}

export default function RootLayout() {
  const boot = useBootstrap();

  useEffect(() => {
    if (boot) SplashScreen.hideAsync().catch(() => {});
  }, [boot]);

  if (!boot) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider initial={boot.appearance}>
          {/* Inside the theme, because the ground behind the frame is a palette
              colour; outside everything else, because the frame is the viewport
              the whole app lays out inside on web. A no-op on a phone. */}
          <WebPreviewFrame>
          <LocaleProvider initial={boot.locale}>
            {/* Above SessionProvider, because signing out clears the whole
                cache and the session is what triggers that; a provider cannot
                use a client mounted below it. */}
            <QueryClientProvider client={queryClient}>
              <SessionProvider initial={boot.session}>
                {/* Below the session, because it only fetches once somebody is
                    signed in, and above the domain, because which surface the
                    shell draws is derived from the workspace it resolves. */}
                <WorkspaceProvider>
                  <DomainProvider initial={boot.domain} initialSurface={boot.surface}>
                    {/* Under the providers, so a toast can read the palette and the
                        locale; above the Stack, so it survives navigation and a
                        screen that pushes on save still shows what it said. */}
                    <ToastProvider>
                      <Shell />
                    </ToastProvider>
                  </DomainProvider>
                </WorkspaceProvider>
              </SessionProvider>
            </QueryClientProvider>
          </LocaleProvider>
          </WebPreviewFrame>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * The three sheet shapes, as `NativeStackNavigationOptions` rather than
 * `as const` objects: `sheetAllowedDetents` is typed `number[]`, and a
 * `readonly` tuple is not assignable to it.
 */
type SheetOptions = ComponentProps<typeof Stack.Screen>['options'];

/** A sheet that confirms one thing. Quarter height, no scroll, no dead zone. */
const CONFIRM_SHEET: SheetOptions = {
  presentation: 'formSheet',
  sheetAllowedDetents: [0.34],
  sheetGrabberVisible: true,
};

/** A sheet holding a short form or a list: half, expandable to full. */
const FORM_SHEET: SheetOptions = {
  presentation: 'formSheet',
  sheetAllowedDetents: [0.55, 0.95],
  sheetGrabberVisible: true,
};

/** A sheet holding a long form. Frame W6's "Report a fault" is the tall one. */
const TALL_SHEET: SheetOptions = {
  presentation: 'formSheet',
  sheetAllowedDetents: [0.92],
  sheetGrabberVisible: true,
};

/**
 * Inside the providers, so it can read the session and the motion preference.
 * The offline banner is mounted here rather than per screen — it is a property
 * of the app, and a screen can forget it.
 */
function Shell() {
  // **Session 11: the scheme comes from the theme, not from the OS.** The
  // Appearance preference means `useColorScheme()` is no longer the answer —
  // a reader on Dark with a light phone would get a light status bar over a
  // dark app and a light background flash behind every push.
  const { scheme } = useTheme();
  const { status } = useSession();
  const reduced = useReducedMotion();
  const router = useRouter();
  const segments = useSegments();

  // **Session 1's one edit to this file: the redirect.** An anonymous session
  // goes to `(auth)/sign-in`, which is now a real screen rather than the
  // placeholder that stood here.
  //
  // Two details are load-bearing:
  //
  //   - **It is guarded on the group, not fired on mount.** An invite link
  //     opens `(auth)/activate` directly, and a redirect that did not ask
  //     where it already was would bounce that reader to sign-in and lose the
  //     invitation.
  //   - **The navigator stays mounted.** `(auth)/activate` hands off to
  //     `lease/[leaseId]/sign` at the moment the session flips, and a route
  //     tree that is assembled by that same flip is a route tree the hand-off
  //     navigates into before it exists.
  const inAuth = segments[0] === '(auth)';
  useEffect(() => {
    if (status === 'anonymous' && !inAuth) router.replace('/(auth)/sign-in');
  }, [status, inAuth, router]);

  /**
   * **ADR-038 child 0 task 10: the step-up gate (AC-S7).**
   *
   * `WorkspaceGuard` on the API refuses an operator route when the session has
   * not passed the emailed step-up. That refusal is correct and it is a
   * terrible thing to meet: you tap Rent roll, the screen loads, and then tells
   * you no. So the app reads `twoFactor` off the same `/me/workspaces` answer
   * it learns its seats from, and asks BEFORE the surface renders.
   *
   * Three details are load-bearing, and two of them mirror the redirect above:
   *
   *   - **The client never decides whether the step-up applies.** The server
   *     says `{ required, verified }` and this only reacts. Computing it here
   *     would be the app inventing an authorization rule (ADR-012 AC-4).
   *   - **It is guarded on the group**, so it cannot bounce somebody who is
   *     already standing on the step-up screen, or on sign-in.
   *   - **It waits for the answer.** `isResolving` is true until
   *     `/me/workspaces` has replied once, and firing on the default
   *     `{ required: false }` would send nobody, then send them a frame later —
   *     which is a visible flash of the operator surface this exists to
   *     prevent.
   */
  const { twoFactor, isResolving } = useWorkspace();
  const owesStepUp = twoFactor.required && !twoFactor.verified;
  useEffect(() => {
    if (status !== 'authenticated' || isResolving || inAuth) return;
    if (owesStepUp) router.replace('/(auth)/step-up');
  }, [status, isResolving, inAuth, owesStepUp, router]);

  /**
   * The offline queue, after a cold start.
   *
   * The queue persists to the keychain, and nothing used to read it back: a
   * message queued in a lift and then killed by memory pressure sat in the
   * keychain until some later write happened to overwrite the journal. So the
   * journal is read once here, and drained once there is a network and a
   * signed-in session with its workspace resolved. The handlers are already
   * registered, by the `write-handlers` import at the top of this file, so the
   * drain does not depend on which screen happens to be open.
   */
  const offline = useOffline();
  const [queueHydrated, setQueueHydrated] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void hydrate().then(() => {
      if (!cancelled) setQueueHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!queueHydrated || offline || status !== 'authenticated' || isResolving) return;
    void drain();
  }, [queueHydrated, offline, status, isResolving]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palettes[scheme].bgApp },
          // Reduced motion drops the travel and keeps the feedback: `fade` is
          // the same transition with the slide taken out, so a push still
          // registers as a change of screen (design brief §7.6).
          animation: reduced ? 'fade' : 'default',
        }}
      >
        {/* The shell, and the signed-out stack beside it. Both are always
            registered; `SignedOut` below decides which one is shown, because
            redirecting during bootstrap races the splash. */}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />

        {/* Guest */}
        <Stack.Screen name="search" options={FORM_SHEET} />
        <Stack.Screen name="listing/[id]/index" options={{ presentation: 'card' }} />
        <Stack.Screen name="listing/[id]/amenities" options={FORM_SHEET} />
        <Stack.Screen name="listing/[id]/policy" options={FORM_SHEET} />
        <Stack.Screen name="book/[roomTypeId]/index" options={{ presentation: 'card' }} />
        <Stack.Screen name="book/[roomTypeId]/confirmed" options={{ presentation: 'card' }} />
        <Stack.Screen name="trip/[id]/index" options={{ presentation: 'card' }} />
        <Stack.Screen name="trip/[id]/arrival-guide" options={{ presentation: 'card' }} />
        <Stack.Screen name="trip/[id]/review" options={FORM_SHEET} />
        <Stack.Screen name="order" options={{ presentation: 'card' }} />
        <Stack.Screen name="order-placed" options={{ presentation: 'card' }} />
        <Stack.Screen name="self-check-in/[bookingId]" options={{ presentation: 'card' }} />
        <Stack.Screen name="thread/[threadId]" options={{ presentation: 'card' }} />

        {/* Residence — the lease aggregate, both seats. Decision D6 keeps the
            repo's `[id]` / `[leaseId]` split rather than renaming folders. */}
        <Stack.Screen name="lease/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="lease/new" options={{ presentation: 'card' }} />
        <Stack.Screen name="lease/[leaseId]/sign" options={{ presentation: 'card' }} />
        <Stack.Screen name="lease/[leaseId]/move-out" options={{ presentation: 'card' }} />
        <Stack.Screen name="lease/[leaseId]/renew" options={{ presentation: 'card' }} />
        <Stack.Screen name="lease/[leaseId]/visitors" options={{ presentation: 'card' }} />
        <Stack.Screen name="lease/[leaseId]/maintenance/new" options={{ presentation: 'card' }} />
        <Stack.Screen name="lease/[leaseId]/contract" options={{ presentation: 'card' }} />
        <Stack.Screen name="lease/[leaseId]/caution" options={{ presentation: 'card' }} />
        <Stack.Screen name="lease/[leaseId]/filing" options={{ presentation: 'card' }} />

        {/* Broker */}
        <Stack.Screen name="directory/[unitId]/index" options={{ presentation: 'card' }} />
        <Stack.Screen name="directory/[unitId]/reveal" options={CONFIRM_SHEET} />

        {/* Work · Housekeeping */}
        <Stack.Screen name="task/[taskId]" options={{ presentation: 'card' }} />
        <Stack.Screen name="inspection" options={{ presentation: 'card' }} />
        {/* Tall: frame W6 is photos, two chip groups and a line of text, and
            the room behind it is what the reporter is looking at. */}
        <Stack.Screen name="report-fault" options={TALL_SHEET} />
        {/* **Session 10's one edit to this file.** Frame W4's tile opens a
            sheet of four housekeeping states, and the route was missing from
            Session 0's table. A confirm sheet rather than a form one: four
            rows and an escape, and a taller detent would open a dead zone
            under the last option. */}
        <Stack.Screen name="room-status" options={CONFIRM_SHEET} />

        {/* Money. Both say on the screen that they move none. */}
        <Stack.Screen name="pay-rent" options={FORM_SHEET} />
        <Stack.Screen name="record-payment" options={CONFIRM_SHEET} />

        {/* The licence chain's other half: the full attribution the CC BY and
            CC BY-SA licences ask to travel with the work, which does not fit
            on a tile. Session 11 mounts the Account row that opens it. */}
        <Stack.Screen name="photo-credits" options={{ presentation: 'card' }} />

        {/* Account, and the ten places its rows go. **Session 11's own half of
            this table**, registered when the freeze lifted. Which of them is a
            sheet and which is a card is a per-route decision rather than a
            house style: a card is for something with a list on it, a sheet is
            for one fact and one escape. */}
        <Stack.Screen name="payout-account" options={FORM_SHEET} />
        <Stack.Screen name="organisation" options={{ presentation: 'card' }} />
        <Stack.Screen name="staff" options={{ presentation: 'card' }} />
        <Stack.Screen name="subscription" options={{ presentation: 'card' }} />
        <Stack.Screen name="reveal-credits" options={{ presentation: 'card' }} />
        <Stack.Screen name="personal-details" options={{ presentation: 'card' }} />
        <Stack.Screen name="security" options={{ presentation: 'card' }} />
        {/* Three rows and an escape. F0 gave this its own taller detent for a
            fourth row, White; that row is gone, so it is back on the shared one. */}
        <Stack.Screen name="appearance" options={CONFIRM_SHEET} />
        <Stack.Screen name="sign-out" options={CONFIRM_SHEET} />
        {/* Opened from the switcher rather than from Account, and therefore a
            sheet over a sheet — which the platform handles and a modal would
            not. */}
        <Stack.Screen name="create-workspace" options={FORM_SHEET} />

        {/* The workspace switcher is reached from wherever you are, so it
            overlays the surface it switches away from rather than replacing it
            (FL16). A sheet rather than a modal since frame X4, which draws it
            with a grabber over a dimmed Account. */}
        <Stack.Screen name="switch" options={FORM_SHEET} />
      </Stack>

      <OfflineBanner />
      {/* Under the offline banner, and the pairing is the point: that one says
          the app cannot reach the network, this one says what the app is
          holding on the person's behalf because of it. A banner that only
          reports the radio leaves someone wondering whether the message they
          just sent exists anywhere (data-seam.md §5). */}
      <QueueBanner />
    </>
  );
}

/**
 * Expo Router mounts this for any render that throws below the root layout.
 * It renders *instead of* the provider tree — a boundary that needs the thing
 * that crashed is not a boundary — so it reads the palette from the OS scheme
 * directly and takes its copy from `translate()`, the provider-free half of the
 * message catalogue.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = palettes[scheme];

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp, justifyContent: 'center' }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
        <RawText color={c.textStrong} size={22} weight="600">
          {translate('state.crashTitle')}
        </RawText>
        <RawText color={c.textMuted} size={14}>
          {translate('state.crashBody')}
        </RawText>
        <View
          style={{
            padding: 14,
            borderRadius: 10,
            backgroundColor: c.surface2,
            borderWidth: 1,
            borderColor: c.borderSubtle,
          }}
        >
          <RawText color={c.danger600} size={12.5}>
            {error.message}
          </RawText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate('state.crashRetry')}
          onPress={retry}
          style={{
            alignSelf: 'flex-start',
            height: 44,
            justifyContent: 'center',
            paddingHorizontal: 20,
            borderRadius: 10,
            backgroundColor: c.action,
          }}
        >
          <RawText color={c.bgApp} size={14} weight="600">
            {translate('state.crashRetry')}
          </RawText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/**
 * The boundary cannot use `@/components`' `Text`: that resolves a brand font
 * through `useTheme()`, and a provider that failed to mount is one of the
 * things this has to be able to report. System face, no context.
 */
function RawText({
  children,
  color,
  size,
  weight,
}: {
  children: React.ReactNode;
  color: string;
  size: number;
  weight?: '400' | '600';
}) {
  return (
    <RNText style={{ color, fontSize: size, fontWeight: weight ?? '400', lineHeight: size * 1.5 }}>
      {children}
    </RNText>
  );
}
