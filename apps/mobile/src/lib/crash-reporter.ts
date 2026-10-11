/**
 * Crash reporting on the phone (ADR-063).
 *
 * The ONLY importer of `@sentry/react-native` (a lint rule fails any other
 * file), and the only reader and writer of the switch on the Privacy screen.
 * Everything a report may carry is decided here, before it leaves the phone:
 * Sentry's own server scrubbing is a backstop, never the guarantee.
 *
 * Three rules hold over every function in this file:
 *
 *   - It never throws. A reporter that crashes the app it watches is worse than
 *     no reporter, so every export catches its own errors.
 *   - Nothing personal leaves. Events are REBUILT from an allowlist of fields
 *     rather than cleaned of a denylist, so a field a future SDK adds is dropped
 *     until someone decides it is safe. Free text passes `redactText`.
 *   - Off means off. The switch is read once at launch, synchronously, before
 *     any route module loads; when it says off, or cannot be read, `Sentry.init`
 *     is never called, so the native SDKs never start either.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Sentry from '@sentry/react-native';
import type {
  Breadcrumb,
  ErrorEvent,
  Event,
  Exception,
  ReactNativeOptions,
  StackFrame,
  TransactionEvent,
} from '@sentry/react-native';
import { redactText } from '@injishi/contracts';

import {
  CRASH_DSN,
  CRASH_ENVIRONMENT,
  DIAGNOSTICS_ALLOWED,
  IS_DEVELOPMENT_BUILD,
  type CrashEnvironment,
} from './crash-env';

type EventHint = Parameters<NonNullable<ReactNativeOptions['beforeSend']>>[1];
type Integration = Extract<NonNullable<ReactNativeOptions['integrations']>, readonly unknown[]>[number];
type NavigationIntegration = ReturnType<typeof Sentry.reactNavigationIntegration>;
type AnyRecord = Record<string, unknown>;

/**
 * The switch on the Privacy screen. Absent means on, the default; only `off` is
 * ever written, and turning reporting back on deletes the key. It belongs to
 * the phone, not the account, so sign out and account deletion never touch it.
 */
export const CRASH_SWITCH_KEY = 'injishi.crash-reports';

/**
 * At most this many error events leave the phone per launch. A crash loop on a
 * tester's phone must not drain the month's quota before the alert email
 * reaches anyone; the project key's hourly limit is the second line.
 */
export const MAX_EVENTS_PER_LAUNCH = 5;

/**
 * The share of screen loads traced, per environment (AC-9). `preview` is absent
 * on purpose: an unset rate means tracing is not installed at all, which is
 * different from a rate of 0.
 */
export const TRACES_SAMPLE_RATE: Readonly<Record<CrashEnvironment, number | undefined>> = {
  preview: undefined,
  beta: 1.0,
  production: 0.1,
};

/**
 * Tags an event may carry. Ours (`surface`, `domain`, `crash_ref`,
 * `diagnostic`), then the SDK's own technical keys, read from the integrations
 * in `@sentry/react-native` 8.29. Every value must also be a short token (see
 * `isTagValue`), so a key can never smuggle free text.
 */
export const ALLOWED_TAGS: readonly string[] = [
  'surface',
  'domain',
  'crash_ref',
  'diagnostic',
  'event.origin',
  'event.environment',
  'hermes',
  'expo.updates.update_id',
  'expo.updates.channel',
  'expo.updates.runtime_version',
  'expo.updates.emergency_launch',
];

/**
 * Contexts an event may carry, and the keys kept inside each. Everything else,
 * `culture` and `expo_constants` included, is dropped. `device.name` is absent
 * on purpose: on an iPhone it is often the owner's name.
 */
export const ALLOWED_CONTEXTS: Readonly<Record<string, readonly string[]>> = {
  app: ['app_version', 'app_build', 'app_identifier', 'app_name', 'app_start_time', 'in_foreground', 'build_type'],
  device: [
    'model',
    'model_id',
    'family',
    'manufacturer',
    'brand',
    'arch',
    'archs',
    'memory_size',
    'free_memory',
    'low_memory',
    'simulator',
  ],
  os: ['name', 'version', 'build', 'kernel_version', 'rooted'],
  runtime: ['name', 'version'],
  // Ids, plus the operation and status a screen load is recognised by (AC-9).
  trace: ['trace_id', 'span_id', 'parent_span_id', 'op', 'status', 'origin'],
  react_native_context: [
    'turbo_module',
    'fabric',
    'react_native_version',
    'expo',
    'js_engine',
    'hermes_version',
    'hermes_debug_info',
    'component_stack',
    'expo_go_version',
  ],
  ota_updates: [
    'is_enabled',
    'is_embedded_launch',
    'is_emergency_launch',
    'update_id',
    'channel',
    'runtime_version',
    'created_at',
    'launch_duration',
  ],
};

/** Trail categories that may leave the phone. `sentry.*` markers are also kept. */
const ALLOWED_BREADCRUMB_CATEGORIES = new Set(['navigation', 'injishi.call', 'app.lifecycle', 'device.event']);

/** Top level event keys passed through untouched. */
const KEPT_EVENT_KEYS = [
  'event_id',
  'timestamp',
  'start_timestamp',
  'type',
  'platform',
  'level',
  'release',
  'dist',
  'environment',
  'sdk',
  // How Sentry finds the source map and native symbols (AC-1, AC-2).
  'debug_meta',
] as const;

/** Stack frame keys kept. Local variables and source lines are not. */
const KEPT_FRAME_KEYS = [
  'filename',
  'abs_path',
  'function',
  'module',
  'lineno',
  'colno',
  'in_app',
  'platform',
  'package',
  'instruction_addr',
  'symbol_addr',
  'image_addr',
  'addr_mode',
] as const;

/** Default integrations removed (ADR-063 init options). */
const DROPPED_DEFAULT_INTEGRATIONS = new Set([
  // A crash screen reference must always name a sent event; repeats are
  // bounded by the per launch cap instead.
  'Dedupe',
  // Replaced below by our own instances, configured.
  'ReactNativeTracing',
  'ReactNavigation',
]);

let started = false;
/** Set the moment reporting is switched off, and checked first by every hook. */
let muted = false;
/** Error events let through this launch, counted toward the cap. */
let eventsThisLaunch = 0;
/** Events the crash screen already counted, so `beforeSend` does not count them twice. */
const reservedEventIds = new Set<string>();
/** The crash screen's reference per error, so a re-render never sends twice. */
const renderReports = new WeakMap<object, string | null>();
let navigation: NavigationIntegration | null = null;
/** The choice on web, where there is no keychain. Kept for this session only. */
let webChoice: 'on' | 'off' = 'on';

function swallow(): void {
  // A reporter failure never reaches the person.
}

/** Whether this build can send reports at all, whatever the switch says. */
export function isCrashReportingPossible(): boolean {
  return Platform.OS !== 'web' && !IS_DEVELOPMENT_BUILD && CRASH_DSN !== null && CRASH_ENVIRONMENT !== null;
}

/** Whether Sentry started this launch and has not been switched off since. */
export function isCrashReportingStarted(): boolean {
  return started && !muted;
}

/**
 * The stored choice, for the Privacy screen. A key that cannot be read reads
 * as off, because in that case reporting did not start this launch.
 */
export function readCrashReportingChoice(): 'on' | 'off' {
  if (Platform.OS === 'web') return webChoice;
  try {
    return SecureStore.getItem(CRASH_SWITCH_KEY) === null ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

/**
 * Start Sentry, once, if and only if every gate passes: not web, not a
 * development build, a DSN, a known environment, and the switch readable and
 * not off. Called first thing by `crash-boot.ts`.
 */
export function startCrashReporting(): void {
  if (started) return;
  try {
    if (!isCrashReportingPossible() || !CRASH_DSN || !CRASH_ENVIRONMENT) return;
    // Synchronous, so the answer exists before any route module loads. Only an
    // absent key starts the reporter: `off`, any other value, or a throw leave
    // it inert for this launch (fail closed).
    if (SecureStore.getItem(CRASH_SWITCH_KEY) !== null) return;
    Sentry.init(buildSentryOptions({ environment: CRASH_ENVIRONMENT, dsn: CRASH_DSN }));
    started = true;
  } catch {
    // An init that threw part way may have left a client behind. Mute it, so
    // whatever it holds is dropped by the hooks, and close what can be closed.
    muted = true;
    try {
      void Sentry.close().catch(swallow);
    } catch {
      swallow();
    }
  }
}

/**
 * The full `Sentry.init` options (ADR-063, "Mobile init options"). Pure: it
 * returns an object and touches no SDK state; the integrations callback runs
 * only when `Sentry.init` calls it.
 */
export function buildSentryOptions({
  environment,
  dsn,
}: {
  environment: CrashEnvironment;
  dsn: string;
}): ReactNativeOptions {
  const tracesSampleRate = TRACES_SAMPLE_RATE[environment];
  const tracing = tracesSampleRate !== undefined;
  return {
    dsn,
    // Always explicit: the SDK's default environment is `production`.
    environment,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    attachThreads: false,
    enableLogs: false,
    enableAutoSessionTracking: true,
    enableAppHangTracking: true,
    appHangTimeoutInterval: 2,
    maxBreadcrumbs: 50,
    ...(tracing ? { tracesSampleRate } : {}),
    enableNativeFramesTracking: tracing,
    enableUserInteractionTracing: false,
    enableCaptureFailedRequests: false,
    tracePropagationTargets: [],
    // iPhone: the native layer's own request breadcrumbs carry full URLs.
    enableNetworkBreadcrumbs: false,
    integrations: (defaults: Integration[]) => buildIntegrations(defaults, tracing),
    beforeSend,
    beforeSendTransaction,
    beforeBreadcrumb,
  };
}

function buildIntegrations(defaults: Integration[], tracing: boolean): Integration[] {
  navigation = Sentry.reactNavigationIntegration();
  const added: Integration[] = [navigation];
  if (tracing) {
    // No network call is ever timed, so no request gains a header (AC-9).
    added.push(Sentry.reactNativeTracingIntegration({ shouldCreateSpanForRequest: () => false }));
  }
  return [...defaults.filter((integration) => !DROPPED_DEFAULT_INTEGRATIONS.has(integration.name)), ...added];
}

/**
 * Switch reporting on or off from the Privacy screen.
 *
 * Off stops new events, transactions and sessions at once: the live client is
 * disabled and the hooks muted BEFORE the slow write, so a failed write still
 * leaves this run silent. On takes effect at the next launch.
 */
export async function setCrashReportingEnabled(on: boolean): Promise<'saved' | 'notSaved'> {
  if (Platform.OS === 'web') {
    webChoice = on ? 'on' : 'off';
    return 'saved';
  }
  if (!on) {
    muteNow();
    try {
      await SecureStore.setItemAsync(CRASH_SWITCH_KEY, 'off');
      return 'saved';
    } catch {
      return 'notSaved';
    }
  }
  try {
    await SecureStore.deleteItemAsync(CRASH_SWITCH_KEY);
    return 'saved';
  } catch {
    return 'notSaved';
  }
}

function muteNow(): void {
  muted = true;
  try {
    const client = Sentry.getClient();
    if (client) client.getOptions().enabled = false;
  } catch {
    swallow();
  }
  try {
    // Not awaited: the person is looking at a switch, not a spinner.
    void Sentry.close().catch(swallow);
  } catch {
    swallow();
  }
}

/** The short reference the crash screen shows, and the `crash_ref` tag. */
export function crashRef(eventId: string): string {
  return eventId.slice(0, 8).toUpperCase();
}

/**
 * Report an error the root crash screen caught, once per error, as unhandled
 * so its session counts as crashed (AC-3, AC-10). Returns the reference to
 * show, or null when no report was made.
 */
export function reportRenderError(error: unknown): string | null {
  try {
    const key = typeof error === 'object' && error !== null ? error : null;
    if (key && renderReports.has(key)) return renderReports.get(key) ?? null;
    const ref = captureRenderError(error);
    if (key) renderReports.set(key, ref);
    return ref;
  } catch {
    return null;
  }
}

function captureRenderError(error: unknown): string | null {
  if (!isCrashReportingStarted() || eventsThisLaunch >= MAX_EVENTS_PER_LAUNCH) return null;
  const eventId = Sentry.captureException(error, {
    mechanism: { type: 'injishi.crash_screen', handled: false },
  });
  if (typeof eventId !== 'string' || !eventId) return null;
  // Counted now rather than in `beforeSend`, which runs later: the screen must
  // know at once whether it has a reference to show.
  eventsThisLaunch += 1;
  reservedEventIds.add(eventId);
  return crashRef(eventId);
}

// ---------------------------------------------------------------------------
// The hooks. Each checks `muted` first, and each rebuilds rather than cleans.
// ---------------------------------------------------------------------------

function beforeSend(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  if (muted) return null;
  try {
    const id = typeof event.event_id === 'string' ? event.event_id : '';
    if (!reservedEventIds.delete(id)) {
      if (eventsThisLaunch >= MAX_EVENTS_PER_LAUNCH) return null;
      eventsThisLaunch += 1;
    }
    return cleanEvent(event, hint);
  } catch {
    return null;
  }
}

function beforeSendTransaction(event: TransactionEvent): TransactionEvent | null {
  if (muted) return null;
  try {
    return cleanEvent(event, undefined);
  } catch {
    return null;
  }
}

function beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (muted) return null;
  try {
    // The navigation integration's own screen entry ("Navigation to X") is a
    // duplicate of the trail's, which carries no message (see
    // `registerNavigationContainer`).
    if (breadcrumb.category === 'navigation' && typeof breadcrumb.message === 'string') return null;
    return cleanBreadcrumb(breadcrumb);
  } catch {
    return null;
  }
}

/**
 * A new event holding only what "What a mobile event may carry" allows.
 * Exported for the scrubber tests; the SDK reaches it through the hooks.
 */
export function cleanEvent<E extends Event>(event: E, hint: EventHint | undefined): E {
  const source = event as unknown as AnyRecord;
  const out: AnyRecord = {};
  for (const key of KEPT_EVENT_KEYS) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  const values = event.exception?.values;
  if (Array.isArray(values)) {
    out.exception = { values: values.map((value) => cleanException(value, hint)) };
  }
  if (typeof event.message === 'string') out.message = redactText(event.message);
  if (typeof event.transaction === 'string') out.transaction = event.transaction;
  const tags = cleanTags(event.tags, event.event_id);
  if (tags) out.tags = tags;
  const contexts = cleanContexts(event.contexts);
  if (contexts) out.contexts = contexts;
  const userId = event.user?.id;
  if (typeof userId === 'string' || typeof userId === 'number') out.user = { id: userId };
  if (Array.isArray(event.breadcrumbs)) {
    out.breadcrumbs = event.breadcrumbs
      .map(cleanBreadcrumb)
      .filter((crumb): crumb is Breadcrumb => crumb !== null);
  }
  const spans = (event as TransactionEvent).spans;
  if (Array.isArray(spans)) out.spans = spans.map((span) => cleanSpan(span as unknown as AnyRecord));
  if (event.measurements) out.measurements = event.measurements;
  return out as unknown as E;
}

function cleanException(value: Exception, hint: EventHint | undefined): Exception {
  const out: Exception = {};
  if (value.type !== undefined) out.type = value.type;
  if (value.module !== undefined) out.module = value.module;
  if (value.mechanism) {
    const { data: _dropped, ...mechanism } = value.mechanism;
    out.mechanism = mechanism;
  }
  if (Array.isArray(value.stacktrace?.frames)) {
    out.stacktrace = { frames: value.stacktrace.frames.map(cleanFrame) };
  }
  if (typeof value.value === 'string') {
    // Text the server wrote never leaves the phone: an ApiError is reduced to
    // its kind and status.
    out.value = value.type === 'ApiError' ? apiErrorSummary(hint?.originalException) : redactText(value.value);
  }
  return out;
}

function cleanFrame(frame: StackFrame): StackFrame {
  const source = frame as unknown as AnyRecord;
  const out: AnyRecord = {};
  for (const key of KEPT_FRAME_KEYS) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out as StackFrame;
}

/**
 * `refused 422`, read by property rather than `instanceof`: this file must not
 * import `api.ts`, whose own import chain can throw at load.
 */
function apiErrorSummary(original: unknown): string {
  let candidate: unknown = original;
  for (let depth = 0; depth < 5 && candidate && typeof candidate === 'object'; depth += 1) {
    const error = candidate as { name?: unknown; kind?: unknown; httpStatus?: unknown; cause?: unknown };
    if (error.name === 'ApiError' && typeof error.kind === 'string') {
      return typeof error.httpStatus === 'number' ? `${error.kind} ${error.httpStatus}` : error.kind;
    }
    candidate = error.cause;
  }
  return 'ApiError';
}

function isTagValue(value: unknown): value is string | number | boolean {
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(value);
}

function cleanTags(tags: Event['tags'], eventId: string | undefined): Record<string, string | number | boolean> | null {
  const out: Record<string, string | number | boolean> = {};
  if (tags) {
    for (const key of ALLOWED_TAGS) {
      const value = (tags as AnyRecord)[key];
      if (isTagValue(value)) out[key] = value;
    }
  }
  if (typeof eventId === 'string' && eventId) out.crash_ref = crashRef(eventId);
  return Object.keys(out).length ? out : null;
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function cleanContexts(contexts: Event['contexts']): Record<string, AnyRecord> | null {
  if (!contexts) return null;
  const out: Record<string, AnyRecord> = {};
  for (const [name, keys] of Object.entries(ALLOWED_CONTEXTS)) {
    const context = (contexts as AnyRecord)[name];
    if (!context || typeof context !== 'object') continue;
    const kept: AnyRecord = {};
    for (const key of keys) {
      const value = (context as AnyRecord)[key];
      if (isPrimitive(value)) kept[key] = value;
      else if (key === 'archs' && Array.isArray(value)) kept[key] = value.filter(isPrimitive);
    }
    if (Object.keys(kept).length) out[name] = kept;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * One trail entry, or null when its category may not leave the phone. Every
 * string left in it passes `redactText`; a navigation entry is rebuilt from
 * the two route names alone.
 */
export function cleanBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const category = typeof breadcrumb.category === 'string' ? breadcrumb.category : '';
  if (!ALLOWED_BREADCRUMB_CATEGORIES.has(category) && !category.startsWith('sentry.')) return null;
  const out: Breadcrumb = { category };
  if (breadcrumb.type !== undefined) out.type = breadcrumb.type;
  if (breadcrumb.level !== undefined) out.level = breadcrumb.level;
  if (breadcrumb.timestamp !== undefined) out.timestamp = breadcrumb.timestamp;
  if (category === 'navigation') {
    const data: AnyRecord = {};
    for (const key of ['from', 'to'] as const) {
      const value = breadcrumb.data?.[key];
      if (typeof value === 'string') data[key] = redactText(value);
    }
    if (Object.keys(data).length) out.data = data;
    return out;
  }
  if (typeof breadcrumb.message === 'string') out.message = redactText(breadcrumb.message);
  if (breadcrumb.data && typeof breadcrumb.data === 'object') {
    const data: AnyRecord = {};
    for (const [key, value] of Object.entries(breadcrumb.data)) {
      if (typeof value === 'string') data[key] = redactText(value);
      else if (typeof value === 'number' || typeof value === 'boolean') data[key] = value;
    }
    if (Object.keys(data).length) out.data = data;
  }
  return out;
}

function cleanSpan(span: AnyRecord): AnyRecord {
  const { data: _dropped, ...rest } = span;
  if (typeof rest.description === 'string') rest.description = redactText(rest.description);
  return rest;
}

// ---------------------------------------------------------------------------
// The seams the rest of the app calls. Each is a no op when not started.
// ---------------------------------------------------------------------------

/**
 * A path with its query and fragment removed and every segment that is not a
 * plain word (lowercase letters, `-`, `_`, at most 32 characters) replaced by
 * `:id`. An API version segment (`v1`) is kept: it is not an id.
 */
export function maskPath(path: string): string {
  const bare = path.split(/[?#]/, 1)[0] ?? '';
  return bare
    .split('/')
    .map((segment) => (segment === '' || /^[a-z_-]{1,32}$/.test(segment) || /^v\d{1,2}$/.test(segment) ? segment : ':id'))
    .join('/');
}

/** What one API call did, for the trail (AC-6). */
export interface RecordedCall {
  method: string;
  /** Everything after the API origin. */
  path: string;
  httpStatus?: number;
  outcome: 'ok' | 'unauthenticated' | 'refused' | 'failed';
}

/** One `injishi.call` trail entry, with the path masked. */
export function recordCall({ method, path, httpStatus, outcome }: RecordedCall): void {
  if (!isCrashReportingStarted()) return;
  try {
    const data: Record<string, string | number> = {
      method: method.toUpperCase(),
      path: redactText(maskPath(path)),
      outcome,
    };
    if (typeof httpStatus === 'number') data.status_code = httpStatus;
    Sentry.addBreadcrumb({
      category: 'injishi.call',
      type: 'http',
      level: outcome === 'ok' ? 'info' : 'warning',
      data,
    });
  } catch {
    swallow();
  }
}

/** Tag every later event with the active surface and domain (AC-6). */
export function setCrashTags({ surface, domain }: { surface: string; domain: string }): void {
  if (!isCrashReportingStarted()) return;
  try {
    Sentry.setTag('surface', surface);
    Sentry.setTag('domain', domain);
  } catch {
    swallow();
  }
}

/** The parts of Expo Router's navigation container ref the trail reads. */
interface NavigationContainerLike {
  addListener?: (event: 'state', callback: () => void) => unknown;
  isReady?: () => boolean;
  getCurrentRoute?: () => { name?: unknown } | undefined;
}

let trailContainer: unknown = null;
let lastScreen: string | null = null;

/**
 * Hand Expo Router's navigation container to Sentry (screen loads, when
 * tracing is on) and follow it for the trail (AC-6).
 *
 * The trail's screen entries are written HERE rather than by the navigation
 * integration, because the integration writes them only alongside a screen
 * load, and `preview` installs no tracing: there it would leave the trail with
 * no screens at all. Each entry is the React Navigation route name as
 * registered (`lease/[leaseId]/sign`, or `account` inside the tabs), never its
 * params. The integration's own entries are dropped in `beforeBreadcrumb`, so a
 * traced build does not record each screen twice.
 */
export function registerNavigationContainer(ref: unknown): void {
  if (!isCrashReportingStarted()) return;
  try {
    navigation?.registerNavigationContainer(ref);
  } catch {
    swallow();
  }
  try {
    const container = ref as NavigationContainerLike | null;
    if (!container || ref === trailContainer || typeof container.addListener !== 'function') return;
    trailContainer = ref;
    container.addListener('state', () => recordScreen(container));
  } catch {
    swallow();
  }
}

function recordScreen(container: NavigationContainerLike): void {
  if (!isCrashReportingStarted()) return;
  try {
    if (typeof container.isReady === 'function' && !container.isReady()) return;
    const name = container.getCurrentRoute?.()?.name;
    if (typeof name !== 'string' || name === lastScreen) return;
    Sentry.addBreadcrumb({
      category: 'navigation',
      type: 'navigation',
      data: lastScreen === null ? { to: name } : { from: lastScreen, to: name },
    });
    lastScreen = name;
  } catch {
    swallow();
  }
}

/** End the app start measurement when the splash screen hides (AC-9). */
export function markAppLoaded(): void {
  if (!isCrashReportingStarted()) return;
  try {
    Sentry.appLoaded();
  } catch {
    swallow();
  }
}

// ---------------------------------------------------------------------------
// Diagnostics: failures forced on purpose, in tester builds only (AC-7).
// ---------------------------------------------------------------------------

/** The forced JavaScript error, named so it is recognisable in Sentry. */
export class DiagnosticsTestTimerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiagnosticsTestTimerError';
  }
}

/**
 * The canary text the forced error carries (ADR-063 critical scenarios). The
 * event that arrives must hold none of it: that is the on device proof the
 * scrubber runs.
 */
export const DIAGNOSTICS_CANARY =
  'Diagnostics test error for jane@x.rw, +250 788 123 456, ' +
  'file:///data/user/0/rw.injishi.mobile/cache/x.jpg';

function assertDiagnostics(): void {
  if (!DIAGNOSTICS_ALLOWED) throw new Error('Diagnostics is not available in this build.');
}

/** Mark what follows as a test, so it never alerts anyone. */
function tagDiagnostic(): void {
  if (!isCrashReportingStarted()) return;
  try {
    Sentry.setTag('diagnostic', 'true');
  } catch {
    swallow();
  }
}

/**
 * The forced render error, thrown while rendering from state the Diagnostics
 * screen sets, so the crash screen's Reload mounts a fresh tree and recovers.
 */
export class DiagnosticsTestRenderError extends Error {
  constructor() {
    super('Diagnostics test render error');
    this.name = 'DiagnosticsTestRenderError';
  }
}

/** Tag what Diagnostics is about to break as a test. Throws outside a tester build. */
export function markDiagnostic(): void {
  assertDiagnostics();
  tagDiagnostic();
}

/** Throw an unhandled JavaScript error from a timer, outside any React tree. */
export function forceJsError(): void {
  assertDiagnostics();
  tagDiagnostic();
  setTimeout(() => {
    throw new DiagnosticsTestTimerError(DIAGNOSTICS_CANARY);
  }, 0);
}

/** Crash the app in native code. Reported on the next launch. */
export function forceNativeCrash(): void {
  assertDiagnostics();
  tagDiagnostic();
  Sentry.nativeCrash();
}
