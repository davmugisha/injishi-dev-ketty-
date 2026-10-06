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
 * Every route is registered here, and every route outside the two always open
 * groups sits inside a `Stack.Protected` keyed on the session and the active
 * surface (mobile audit 2026-10-05, SA-12). `href: null` and an unlinked row
 * only hid a button: any route opened from an `injishi://` link for any seat,
 * and started reading data before anything could refuse it (ADR-066 AC-1). A
 * guarded route that is not open for this seat now redirects to the tabs root
 * before its screen mounts, and a seat switch that closes the screen someone
 * is on takes them home. The routes the owner decided to hide (reviews and
 * lease renewal, P2 in the v1.0 cut; subscription, which no API serves) and
 * the Account rows that showed fixture facts as the person's own sit in a
 * `guard={false}` group: hidden and reversible, not deleted.
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
import {
  Stack,
  router as rootRouter,
  useNavigationContainerRef,
  useRouter,
  useSegments,
  type ErrorBoundaryProps,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
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
  useDomain,
  type Domain,
  type Surface,
} from '@/domain';
import { SessionProvider, readStoredSession, useSession, type ResolvedSession } from '@/session';
import { WorkspaceProvider, useWorkspace } from '@/workspace';
import { queryClient } from '@/lib/query-client';
import { wireQueryLifecycle } from '@/lib/query-lifecycle';
import { DIAGNOSTICS_ALLOWED, IS_DEVELOPMENT_BUILD } from '@/lib/crash-env';
import { markAppLoaded, registerNavigationContainer, reportRenderError } from '@/lib/crash-reporter';
import { usePlatform } from '@/queries/platform';
import { BrandMark } from '@/screens/auth/brand-mark';
// Registers every queued write's handler at import, before any screen mounts,
// so the drain below can send what a previous process left in the queue.
import '@/data/write-handlers';
import { drain, hydrate } from '@/data/write-queue';
import {
  LocaleProvider,
  readStoredLocale,
  resolveInitialLocale,
  translate,
  useT,
  type Locale,
} from '@/i18n/i18n';
import { fontMap } from '@/theme/fonts';
import { palettes } from '@/theme/tokens';
import { useReducedMotion } from '@/motion';
import { ErrorState, OfflineBanner, QueueBanner, ToastProvider, useOffline } from '@/components';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * How long the shell will wait on the font loader before painting anyway.
 *
 * Longer in development, because there the fonts are not in the app: Expo Go
 * and the dev client fetch all six from Metro over the LAN (about 680 KB, most
 * of it Spectral), which on a slow Wi-Fi link takes several seconds. Painting
 * before they land is not a graceful fallback on Android: text laid out before
 * a family registers keeps that layout, so a semibold label drawn once Figtree
 * arrives loses its last letter ("Continu" on sign in, Expo Go, 2026-10-06). A
 * release build carries the fonts in the binary and settles well inside the
 * short cap, which stays as the guard against a font that never arrives.
 */
const FONT_FALLBACK_MS = __DEV__ ? 10_000 : 1200;

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
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    if (!boot) return;
    SplashScreen.hideAsync().catch(() => {});
    // ADR-063 AC-9: app start ends where the person first sees the app.
    markAppLoaded();
  }, [boot]);

  // ADR-063 AC-6: the screens visited, by route name, on the crash trail.
  useEffect(() => {
    registerNavigationContainer(navigationRef);
  }, [navigationRef]);

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
  const { surface } = useDomain();
  const { isDemo } = usePlatform();
  const reduced = useReducedMotion();
  const router = useRouter();
  const segments = useSegments();

  // TanStack Query learns when the app is in front and when the phone is
  // online. Without this nothing ever refetched (mobile audit SA-09, XC-14).
  useEffect(() => wireQueryLifecycle(), []);

  // **Session 1's one edit to this file: the redirect.** An anonymous session
  // goes to `(auth)/sign-in`, which is now a real screen rather than the
  // placeholder that stood here.
  //
  // Two details are load-bearing:
  //
  //   - **It is guarded on the group, not fired on mount**, so it cannot bounce
  //     somebody already standing on a signed-out screen.
  //   - **The navigator stays mounted.** Verify navigates into `(tabs)` at the
  //     moment the session flips, and a route tree assembled by that same flip
  //     is a route tree the hand-off navigates into before it exists.
  const inAuth = segments[0] === '(auth)';
  useEffect(() => {
    if (status === 'anonymous' && !inAuth) router.replace('/(auth)/sign-in');
  }, [status, inAuth, router]);

  /**
   * Which routes are open, by session and surface (mobile audit SA-12).
   *
   * Presentation, not authorization: the API refuses what a seat may not do,
   * whatever this allows. It exists so a link cannot open a screen that reads
   * another seat's data, and so a hidden route refuses before its reads start.
   */
  const signedIn = status === 'authenticated';
  const on = (...surfaces: Surface[]) => signedIn && surfaces.includes(surface);

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
  const { twoFactor, isResolving, error: seatsError, workspaces, refetch } = useWorkspace();
  const owesStepUp = twoFactor.required && !twoFactor.verified;
  useEffect(() => {
    if (status !== 'authenticated' || isResolving || inAuth) return;
    if (owesStepUp) router.replace('/(auth)/step-up');
  }, [status, isResolving, inAuth, owesStepUp, router]);

  /**
   * What covers the tabs until this person's seats are known.
   *
   * The surface is a guess until `/me/workspaces` answers: the stored one, or
   * Tenant on a first sign in. Drawing it meant a stranger saw Tenant fixture
   * cards under an empty seat chip and a lone "·", then watched the app flip to
   * their real seat (device rig 2026-10-01; mobile audit SA-08). So the guess is
   * covered, not drawn. And if the answer never comes, the cover says so with a
   * retry, where it used to leave an empty chip and screens that never loaded
   * until the app was killed (SA-09).
   */
  const cover: 'opening' | 'failed' | null =
    !signedIn || inAuth
      ? null
      : isResolving
        ? 'opening'
        : seatsError && workspaces.length === 0
          ? 'failed'
          : null;

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
        <Stack.Protected guard={on('guest')}>
          <Stack.Screen name="search" options={FORM_SHEET} />
          <Stack.Screen name="listing/[id]/index" options={{ presentation: 'card' }} />
          <Stack.Screen name="listing/[id]/amenities" options={FORM_SHEET} />
          <Stack.Screen name="listing/[id]/policy" options={FORM_SHEET} />
          <Stack.Screen name="book/[roomTypeId]/index" options={{ presentation: 'card' }} />
          <Stack.Screen name="book/[roomTypeId]/confirmed" options={{ presentation: 'card' }} />
          <Stack.Screen name="trip/[id]/index" options={{ presentation: 'card' }} />
          <Stack.Screen name="trip/[id]/arrival-guide" options={{ presentation: 'card' }} />
          <Stack.Screen name="order" options={{ presentation: 'card' }} />
          <Stack.Screen name="order-placed" options={{ presentation: 'card' }} />
          <Stack.Screen name="self-check-in/[bookingId]" options={{ presentation: 'card' }} />
        </Stack.Protected>
        {/* The two surfaces whose tab set carries the Inbox. */}
        <Stack.Protected guard={on('guest', 'tenant')}>
          <Stack.Screen name="thread/[threadId]" options={{ presentation: 'card' }} />
        </Stack.Protected>

        {/* Residence — the lease aggregate, both seats. Decision D6 keeps the
            repo's `[id]` / `[leaseId]` split rather than renaming folders. */}
        <Stack.Protected guard={on('tenant', 'landlord')}>
          <Stack.Screen name="lease/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="lease/[leaseId]/contract" options={{ presentation: 'card' }} />
          <Stack.Screen name="lease/[leaseId]/visitors" options={{ presentation: 'card' }} />
        </Stack.Protected>
        <Stack.Protected guard={on('tenant')}>
          <Stack.Screen name="lease/[leaseId]/sign" options={{ presentation: 'card' }} />
          <Stack.Screen name="lease/[leaseId]/move-out" options={{ presentation: 'card' }} />
          <Stack.Screen name="lease/[leaseId]/maintenance/new" options={{ presentation: 'card' }} />
        </Stack.Protected>
        {/* Money that moves on a timer rather than a rail is the demo's alone
            (ADR-066 AC-4): a production build hides pay rent until a gateway
            works, and `isDemo` is false in every production build. */}
        <Stack.Protected guard={on('tenant') && isDemo}>
          <Stack.Screen name="pay-rent" options={FORM_SHEET} />
        </Stack.Protected>
        <Stack.Protected guard={on('landlord')}>
          <Stack.Screen name="lease/new" options={{ presentation: 'card' }} />
          <Stack.Screen name="lease/[leaseId]/caution" options={{ presentation: 'card' }} />
          <Stack.Screen name="lease/[leaseId]/filing" options={{ presentation: 'card' }} />
          {/* Records rent received; moves no money, so no demo gate. */}
          <Stack.Screen name="record-payment" options={CONFIRM_SHEET} />
        </Stack.Protected>

        {/* Broker */}
        <Stack.Protected guard={on('broker')}>
          <Stack.Screen name="directory/[unitId]/index" options={{ presentation: 'card' }} />
          <Stack.Screen name="directory/[unitId]/reveal" options={CONFIRM_SHEET} />
          <Stack.Screen name="reveal-credits" options={{ presentation: 'card' }} />
        </Stack.Protected>

        {/* Work · Housekeeping */}
        <Stack.Protected guard={on('work')}>
          <Stack.Screen name="task/[taskId]" options={{ presentation: 'card' }} />
          <Stack.Screen name="inspection" options={{ presentation: 'card' }} />
          {/* Tall: frame W6 is photos, two chip groups and a line of text, and
              the room behind it is what the reporter is looking at. */}
          <Stack.Screen name="report-fault" options={TALL_SHEET} />
          {/* Frame W4's tile opens a sheet of four housekeeping states. A
              confirm sheet rather than a form one: four rows and an escape,
              and a taller detent would open a dead zone under the last one. */}
          <Stack.Screen name="room-status" options={CONFIRM_SHEET} />
        </Stack.Protected>

        {/* Host. Parked in the switcher, and still the surface a hospitality
            owner, manager or receptionist resolves to (scope feature 17). */}
        <Stack.Protected guard={on('host')}>
          <Stack.Screen name="reservation/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="reservation/[id]/check-in" options={{ presentation: 'card' }} />
        </Stack.Protected>

        {/* Every signed-in seat: the Account tab's rows and the switcher. A
            card is for something with a list on it, a sheet is for one fact
            and one escape. */}
        <Stack.Protected guard={signedIn}>
          {/* The licence chain's other half: the full attribution the CC BY
              and CC BY-SA licences ask to travel with the work. */}
          <Stack.Screen name="photo-credits" options={{ presentation: 'card' }} />
          <Stack.Screen name="personal-details" options={{ presentation: 'card' }} />
          <Stack.Screen name="security" options={{ presentation: 'card' }} />
          <Stack.Screen name="privacy" options={{ presentation: 'card' }} />
          {/* Three rows and an escape. */}
          <Stack.Screen name="appearance" options={CONFIRM_SHEET} />
          <Stack.Screen name="sign-out" options={CONFIRM_SHEET} />
          {/* Opened from the switcher rather than from Account, and therefore
              a sheet over a sheet, which the platform handles and a modal would
              not. */}
          <Stack.Screen name="create-workspace" options={FORM_SHEET} />
          {/* Reached from wherever you are, so it overlays the surface it
              switches away from rather than replacing it (FL16). */}
          <Stack.Screen name="switch" options={FORM_SHEET} />
        </Stack.Protected>

        {/* ADR-063 AC-7: forced failures, in development and tester builds
            only. The route file also refuses on its own, for a direct link. */}
        <Stack.Protected guard={DIAGNOSTICS_ALLOWED}>
          <Stack.Screen name="diagnostics" options={{ presentation: 'card' }} />
        </Stack.Protected>

        {/* Hidden, not deleted (mobile audit 2026-10-05):
              - trip review and lease renewal are P2, hidden by the owner's
                v1.0 cut of 2026-10-01;
              - subscription has no API, and the owner chose to unlink it;
              - organisation, payout account and staff showed a fixture
                company, payout and team as the person's own (SA-03, SA-04,
                HO-05). Each comes back when its read exists (ADR-038 child 7)
                or the v1.0 cut (scope feature 16) says otherwise. */}
        <Stack.Protected guard={false}>
          <Stack.Screen name="trip/[id]/review" options={FORM_SHEET} />
          <Stack.Screen name="lease/[leaseId]/renew" options={{ presentation: 'card' }} />
          <Stack.Screen name="subscription" options={{ presentation: 'card' }} />
          <Stack.Screen name="organisation" options={{ presentation: 'card' }} />
          <Stack.Screen name="payout-account" options={FORM_SHEET} />
          <Stack.Screen name="staff" options={{ presentation: 'card' }} />
        </Stack.Protected>
      </Stack>

      {cover ? <ShellCover kind={cover} onRetry={refetch} /> : null}

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
 * What sits over the tabs while this person's seats are unknown: the brand
 * mark and a spinner, or the failure with a retry. A sibling ABOVE the Stack,
 * not a replacement for it, because the navigator has to stay mounted (see the
 * redirect in `Shell`). Modal to assistive tech, so a screen reader cannot
 * wander into the guessed surface underneath.
 */
function ShellCover({ kind, onRetry }: { kind: 'opening' | 'failed'; onRetry: () => void }) {
  const { c } = useTheme();
  const t = useT();
  return (
    <View
      accessibilityViewIsModal
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 24,
        backgroundColor: c.bgApp,
      }}
    >
      {kind === 'opening' ? (
        <>
          <BrandMark width={56} />
          <ActivityIndicator color={c.textMuted} accessibilityLabel={t('shell.opening')} />
        </>
      ) : (
        <View style={{ alignSelf: 'stretch' }}>
          <ErrorState
            title={t('shell.loadErrorTitle')}
            body={t('shell.loadErrorBody')}
            onRetry={onRetry}
          />
        </View>
      )}
    </View>
  );
}

/**
 * Expo Router mounts this for any render that throws below the root layout.
 * It renders *instead of* the provider tree — a boundary that needs the thing
 * that crashed is not a boundary — so it reads the palette from the OS scheme
 * directly and takes its copy from `translate()`, the provider-free half of the
 * message catalogue.
 *
 * ADR-063 AC-3: the error is reported from here, once, as unhandled, so the
 * session counts as crashed. `reportRenderError` is memoised per error, so a
 * re-render (the phone's theme changing under it) shows the same reference and
 * never sends twice. A release build never prints the message: it may hold
 * text the server wrote or something the person typed. It shows the reference
 * instead, which finds exactly this event in Sentry (`crash_ref:<reference>`),
 * or says plainly that no report was sent.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = palettes[scheme];
  const reference = reportRenderError(error);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp, justifyContent: 'center' }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
        <RawText color={c.textStrong} size={22} weight="600">
          {translate('state.crashTitle')}
        </RawText>
        <RawText color={c.textMuted} size={14}>
          {translate('state.crashBody')}
        </RawText>
        {reference ? (
          <View style={{ gap: 4 }}>
            <RawText testID="crash-ref" selectable color={c.textStrong} size={14} weight="600">
              {translate('state.crashRef', { ref: reference })}
            </RawText>
            <RawText color={c.textMuted} size={14}>
              {translate('state.crashRefHint')}
            </RawText>
            <RawText color={c.textMuted} size={14}>
              {translate('state.crashOffline')}
            </RawText>
          </View>
        ) : (
          <RawText testID="crash-no-report" color={c.textMuted} size={14}>
            {translate('state.crashNoReport')}
          </RawText>
        )}
        {IS_DEVELOPMENT_BUILD ? (
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
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate('state.crashRetry')}
          onPress={retry}
          style={{
            alignSelf: 'flex-start',
            minHeight: 44,
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
        {/* The way out of an error that recurs on every render, where Reload
            only loops and killing the app was the only escape (mobile audit
            SA-29). Navigation first, so the retry renders the tabs root rather
            than the screen that threw. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate('state.notFoundAction')}
          onPress={() => {
            try {
              rootRouter.replace('/');
            } catch {
              // No navigator to ask: the retry below is still the best offer.
            }
            retry();
          }}
          style={{
            alignSelf: 'flex-start',
            minHeight: 44,
            justifyContent: 'center',
            paddingHorizontal: 20,
          }}
        >
          <RawText color={c.textStrong} size={14} weight="600">
            {translate('state.notFoundAction')}
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
  selectable,
  testID,
}: {
  children: React.ReactNode;
  color: string;
  size: number;
  weight?: '400' | '600';
  selectable?: boolean;
  testID?: string;
}) {
  return (
    <RNText
      testID={testID}
      selectable={selectable}
      style={{ color, fontSize: size, fontWeight: weight ?? '400', lineHeight: size * 1.5 }}
    >
      {children}
    </RNText>
  );
}
