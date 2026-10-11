/**
 * The phone's crash reporter (ADR-063): when it starts, what it sends, and the
 * switch that stops it.
 *
 * `crash-env.ts` reads the build's variables and `__DEV__` once, at import, and
 * the reporter keeps its state in module scope, so each case loads a fresh copy
 * of both with the build it describes (the pattern `env.test.ts` set). The SDK
 * is the mock from `jest.setup.js`, read through `jest.requireMock` inside the
 * same isolated registry, so each case sees only its own calls.
 */
import type { Breadcrumb, ErrorEvent, ReactNativeOptions, TransactionEvent } from '@sentry/react-native';

import { ApiError } from './api';

type Reporter = typeof import('./crash-reporter');
type EventHint = Parameters<NonNullable<ReactNativeOptions['beforeSend']>>[1];
type Integration = { name: string; options?: { shouldCreateSpanForRequest?: (url: string) => boolean } };

interface SentryMock {
  init: jest.Mock;
  close: jest.Mock;
  getClient: jest.Mock;
  captureException: jest.Mock;
  addBreadcrumb: jest.Mock;
  setTag: jest.Mock;
  appLoaded: jest.Mock;
  nativeCrash: jest.Mock;
  reactNavigationIntegration: jest.Mock;
  reactNativeTracingIntegration: jest.Mock;
}

interface StoreMock {
  getItem: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
}

interface Build {
  dsn?: string;
  environment?: string;
  dev?: boolean;
  os?: 'ios' | 'android' | 'web';
}

interface Loaded {
  reporter: Reporter;
  sentry: SentryMock;
  store: StoreMock;
}

const DSN = 'https://public@o1.ingest.de.sentry.io/2';
/** A tester build: release mode, a DSN, a known environment. */
const PREVIEW: Build = { dsn: DSN, environment: 'preview', dev: false, os: 'android' };

const globals = globalThis as unknown as { __DEV__?: boolean };

const CAPTURED_ID = '0123456789abcdef0123456789abcdef';

/**
 * Put both mocks back to a fresh install with a working SDK. `isolateModules`
 * gives each case a fresh reporter but NOT fresh mocks: the factory in
 * `jest.setup.js` runs once per file, so a stored `off` from one case would
 * otherwise reach every case after it.
 */
function resetMocks(store: StoreMock, sentry: SentryMock): void {
  store.getItem.mockReset().mockReturnValue(null);
  store.setItemAsync.mockReset().mockResolvedValue(undefined);
  store.deleteItemAsync.mockReset().mockResolvedValue(undefined);
  for (const fn of [sentry.init, sentry.addBreadcrumb, sentry.setTag, sentry.appLoaded, sentry.nativeCrash]) fn.mockReset();
  sentry.close.mockReset().mockResolvedValue(true);
  sentry.getClient.mockReset().mockReturnValue({ getOptions: () => ({}) });
  sentry.captureException.mockReset().mockReturnValue(CAPTURED_ID);
  sentry.reactNavigationIntegration
    .mockReset()
    .mockImplementation(() => ({ name: 'ReactNavigation', registerNavigationContainer: jest.fn() }));
  sentry.reactNativeTracingIntegration
    .mockReset()
    .mockImplementation((options: unknown) => ({ name: 'ReactNativeTracing', options }));
}

/** Load the reporter as `build` would see it. `before` runs on the reset mocks first. */
function load(build: Build, before?: (mocks: { store: StoreMock; sentry: SentryMock }) => void): Loaded {
  const saved = {
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT,
    dev: globals.__DEV__,
  };
  const put = (key: 'EXPO_PUBLIC_SENTRY_DSN' | 'EXPO_PUBLIC_SENTRY_ENVIRONMENT', value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  let loaded: Loaded | undefined;
  try {
    put('EXPO_PUBLIC_SENTRY_DSN', build.dsn);
    put('EXPO_PUBLIC_SENTRY_ENVIRONMENT', build.environment);
    globals.__DEV__ = build.dev ?? true;
    jest.isolateModules(() => {
      // The reporter reads only `Platform.OS` from React Native. jest-expo's
      // own Platform cannot be swapped per case, so this load gets its own.
      jest.doMock('react-native', () => ({ Platform: { OS: build.os ?? 'ios' } }));
      const store = jest.requireMock('expo-secure-store') as StoreMock;
      const sentry = jest.requireMock('@sentry/react-native') as SentryMock;
      resetMocks(store, sentry);
      before?.({ store, sentry });
      loaded = { reporter: require('./crash-reporter') as Reporter, sentry, store };
    });
  } finally {
    put('EXPO_PUBLIC_SENTRY_DSN', saved.dsn);
    put('EXPO_PUBLIC_SENTRY_ENVIRONMENT', saved.environment);
    globals.__DEV__ = saved.dev;
  }
  if (!loaded) throw new Error('the reporter did not load');
  return loaded;
}

/** A started reporter, and the options it handed to `Sentry.init`. */
function started(build: Build = PREVIEW): Loaded & { options: ReactNativeOptions } {
  const loaded = load(build);
  loaded.reporter.startCrashReporting();
  expect(loaded.sentry.init).toHaveBeenCalledTimes(1);
  return { ...loaded, options: loaded.sentry.init.mock.calls[0][0] as ReactNativeOptions };
}

function send(options: ReactNativeOptions, event: ErrorEvent, hint: EventHint = {}): ErrorEvent | null {
  return options.beforeSend!(event, hint) as ErrorEvent | null;
}

let ids = 0;
/** A fresh event id, hex, with no digit run the leak checks look for. */
function nextId(): string {
  ids += 1;
  return `fedcba98${String(ids).padStart(4, 'a')}aaaabbbbccccddddeeee`.slice(0, 32);
}

afterEach(() => {
  jest.useRealTimers();
});

afterAll(() => {
  jest.dontMock('react-native');
});

describe('when the reporter starts (AC-7, AC-8)', () => {
  it('starts in a tester build with a DSN, an environment and the switch on', () => {
    const { reporter, sentry } = load(PREVIEW);
    reporter.startCrashReporting();
    reporter.startCrashReporting();
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init.mock.calls[0][0]).toMatchObject({ dsn: DSN, environment: 'preview' });
    expect(reporter.isCrashReportingStarted()).toBe(true);
  });

  it.each<[string, Build]>([
    ['a development build', { ...PREVIEW, dev: true }],
    ['a build with no DSN', { ...PREVIEW, dsn: undefined }],
    ['a build with a blank DSN', { ...PREVIEW, dsn: '   ' }],
    ['a build with a DSN and no environment', { ...PREVIEW, environment: undefined }],
    ['a build whose environment is not one of the three', { ...PREVIEW, environment: 'staging' }],
    ['web', { ...PREVIEW, os: 'web' }],
  ])('stays inert in %s', (_name, build) => {
    const { reporter, sentry, store } = load(build);
    reporter.startCrashReporting();
    expect(sentry.init).not.toHaveBeenCalled();
    expect(reporter.isCrashReportingStarted()).toBe(false);
    if (build.os === 'web') expect(store.getItem).not.toHaveBeenCalled();
  });

  it('stays inert when the switch is off', () => {
    const { reporter, sentry, store } = load(PREVIEW, ({ store: s }) => s.getItem.mockReturnValue('off'));
    reporter.startCrashReporting();
    expect(store.getItem).toHaveBeenCalledWith('injishi.crash-reports');
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('stays inert when the stored value is anything but absent', () => {
    const { reporter, sentry } = load(PREVIEW, ({ store }) => store.getItem.mockReturnValue('on'));
    reporter.startCrashReporting();
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('fails closed when the switch cannot be read', () => {
    const { reporter, sentry } = load(PREVIEW, ({ store }) =>
      store.getItem.mockImplementation(() => {
        throw new Error('keychain locked');
      }),
    );
    expect(() => reporter.startCrashReporting()).not.toThrow();
    expect(sentry.init).not.toHaveBeenCalled();
    expect(reporter.isCrashReportingStarted()).toBe(false);
  });

  it('survives an init that throws, and then sends nothing', () => {
    const { reporter, sentry } = load(PREVIEW, ({ sentry: s }) =>
      s.init.mockImplementation((options: ReactNativeOptions) => {
        // A client half made before the throw still runs our hooks.
        (globalThis as { __hooks?: ReactNativeOptions }).__hooks = options;
        throw new Error('native init failed');
      }),
    );
    expect(() => reporter.startCrashReporting()).not.toThrow();
    expect(reporter.isCrashReportingStarted()).toBe(false);
    expect(sentry.close).toHaveBeenCalled();
    const hooks = (globalThis as { __hooks?: ReactNativeOptions }).__hooks!;
    expect(send(hooks, { event_id: nextId(), type: undefined })).toBeNull();
    expect(reporter.reportRenderError(new Error('render'))).toBeNull();
    delete (globalThis as { __hooks?: ReactNativeOptions }).__hooks;
  });
});

describe('the init options (AC-4, AC-5, AC-9)', () => {
  function optionsFor(environment: 'preview' | 'beta' | 'production'): ReactNativeOptions {
    return load(PREVIEW).reporter.buildSentryOptions({ environment, dsn: DSN });
  }

  function integrationsOf(options: ReactNativeOptions): Integration[] {
    const defaults: Integration[] = [
      { name: 'ReactNativeErrorHandlers' },
      { name: 'Dedupe' },
      { name: 'Breadcrumbs' },
      { name: 'ReactNativeTracing' },
      { name: 'DeviceContext' },
    ];
    const build = options.integrations as unknown as (d: Integration[]) => Integration[];
    return build(defaults);
  }

  it.each(['preview', 'beta', 'production'] as const)('keeps everything personal off in %s', (environment) => {
    const options = optionsFor(environment);
    expect(options).toMatchObject({
      dsn: DSN,
      environment,
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      attachThreads: false,
      enableLogs: false,
      enableAutoSessionTracking: true,
      maxBreadcrumbs: 50,
      enableUserInteractionTracing: false,
      enableCaptureFailedRequests: false,
      tracePropagationTargets: [],
      enableNetworkBreadcrumbs: false,
    });
    for (const absent of [
      'replaysSessionSampleRate',
      'replaysOnErrorSampleRate',
      'profilesSampleRate',
      'tracesSampler',
      'enableNative',
      'enableNativeCrashHandling',
      'autoInitializeNativeSdk',
    ]) {
      expect(options).not.toHaveProperty(absent);
    }
    expect(typeof options.beforeSend).toBe('function');
    expect(typeof options.beforeSendTransaction).toBe('function');
    expect(typeof options.beforeBreadcrumb).toBe('function');
  });

  it('tracks iPhone app hangs with an explicit timeout', () => {
    expect(optionsFor('production')).toMatchObject({ enableAppHangTracking: true, appHangTimeoutInterval: 2 });
  });

  it('samples screen loads per environment, and installs no tracing in preview', () => {
    expect(optionsFor('beta')).toMatchObject({ tracesSampleRate: 1, enableNativeFramesTracking: true });
    expect(optionsFor('production')).toMatchObject({ tracesSampleRate: 0.1, enableNativeFramesTracking: true });
    const preview = optionsFor('preview');
    expect(preview).not.toHaveProperty('tracesSampleRate');
    expect(preview.enableNativeFramesTracking).toBe(false);
  });

  it('drops Dedupe, adds navigation, and never times a network call', () => {
    for (const environment of ['beta', 'production'] as const) {
      const integrations = integrationsOf(optionsFor(environment));
      const names = integrations.map((integration) => integration.name);
      expect(names).not.toContain('Dedupe');
      expect(names).toContain('ReactNavigation');
      expect(names.filter((name) => name === 'ReactNativeTracing')).toHaveLength(1);
      const tracing = integrations.find((integration) => integration.name === 'ReactNativeTracing')!;
      expect(tracing.options?.shouldCreateSpanForRequest?.('https://api.injishi.com/api/v1/me')).toBe(false);
    }
    const preview = integrationsOf(optionsFor('preview')).map((integration) => integration.name);
    expect(preview).not.toContain('ReactNativeTracing');
    expect(preview).not.toContain('Dedupe');
    for (const name of ['MobileReplay', 'Feedback', 'HermesProfiling', 'Screenshot', 'ViewHierarchy']) {
      expect(preview).not.toContain(name);
    }
  });
});

describe('what an event may carry (AC-5, AC-6)', () => {
  const UUID = '3f0c2a9e-1b2c-4d5e-8f90-a1b2c3d4e5f6';
  const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl';
  const SESSION = 'Ab3dEf5hIj7lMn9pQr1tUv3xYz5bCd7f.Xy%2BzW1v%2Fu2t3s4r5q6p%3D';
  const RANDOM = 'aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1fG3hI5jK7lM9nO1pQ3r';
  const FIXTURES = [
    'jane@x.rw',
    'jane%40x.rw',
    '+250 788 123 456',
    '0781234567',
    '073 123 4567',
    '(+250) 788-123-456',
    '250791234567',
    '788123456',
    'TIN 999031001',
    'ID 1 1990 8 0012345 6 78',
    'ID 1199080012345678',
    'otp123456',
    'code=123456',
    'Bearer s3cr3t-value',
    JWT,
    SESSION,
    RANDOM,
    `https://api.injishi.com/api/v1/leases/${UUID}/sign`,
    'https://api.injishi.com/api/v1/search?q=Jane',
    'file:///data/user/0/rw.injishi.mobile/cache/x.jpg',
    '/data/user/0/rw.injishi.mobile/cache/ImagePicker/x.jpg',
  ].join(' | ');
  const LEAKS = [
    'jane',
    'Jane',
    'Mukamana',
    'Kimihurura',
    '788',
    '781234567',
    '123 4567',
    '791234567',
    '999031001',
    '1990',
    '1199080012345678',
    '123456',
    's3cr3t',
    'eyJ',
    'Ab3dEf5h',
    'aB3dE5fG',
    '3f0c2a9e',
    'cache/x.jpg',
    'ImagePicker',
    '196.12',
    'Africa/Kigali',
    'Pay now',
    'Authorization',
    'phone-of',
    'local-var',
  ];
  const PROSE = 'Why did it fail? See #4';
  const CONSTRAINT = 'stay_refund_requests_one_open_per_stay_uk';
  const FRAME = { filename: 'app:///index.android.bundle', function: 'fetchLease', lineno: 4242, colno: 17, in_app: true };
  const DEBUG_META = {
    images: [{ type: 'sourcemap', code_file: 'app:///index.android.bundle', debug_id: 'abcdefab-cdef-4abc-8def-abcdefabcdef' }],
  };

  function dirtyEvent(eventId: string): ErrorEvent {
    return {
      type: undefined,
      event_id: eventId,
      timestamp: 1700000000,
      platform: 'javascript',
      level: 'error',
      release: 'rw.injishi.mobile@0.1.0+5',
      dist: '5',
      environment: 'preview',
      message: `${PROSE}: ${CONSTRAINT} ${FIXTURES}`,
      logentry: { message: 'failed for %s', params: ['jane@x.rw'] },
      exception: {
        values: [
          {
            type: 'Error',
            value: `caused by ${FIXTURES}`,
            stacktrace: { frames: [{ ...FRAME, vars: { email: 'jane@x.rw' }, context_line: 'local-var' }] },
          },
          {
            type: 'ApiError',
            value: 'Jane Mukamana is not a member of Kimihurura cell',
            mechanism: { type: 'onunhandledrejection', handled: false, data: { reason: 'jane@x.rw' } },
            stacktrace: { frames: [{ ...FRAME, pre_context: ['local-var'], post_context: ['local-var'] }] },
          },
        ],
      },
      tags: {
        surface: 'guest',
        'event.origin': 'javascript',
        note: 'Jane said hi',
        'expo.updates.channel': 'Jane Mukamana',
      },
      user: { id: 'install-7f3a', email: 'jane@x.rw', ip_address: '196.12.1.1', username: 'jane' },
      contexts: {
        device: { name: 'phone-of-Jane', model: 'Pixel 7', family: 'Android', memory_size: 4096 },
        culture: { locale: 'en_RW', timezone: 'Africa/Kigali' },
        app: { app_version: '0.1.0', app_build: '5', device_app_hash: 'phone-of-hash' },
        trace: { trace_id: 'aaaabbbbccccddddeeeeffff00001111', span_id: 'aaaabbbbccccdddd', data: { email: 'jane@x.rw' } },
        expo_constants: { session_id: 'phone-of-session' },
      },
      extra: { email: 'jane@x.rw' },
      request: { url: 'https://api.injishi.com/api/v1/search?q=Jane', headers: { Authorization: JWT } },
      fingerprint: ['jane@x.rw'],
      modules: { 'phone-of-module': '1.0' },
      server_name: 'phone-of-jane',
      debug_meta: DEBUG_META,
      breadcrumbs: [
        { category: 'console', message: 'jane@x.rw signed in', level: 'log' },
        { category: 'touch', message: 'Pay now', data: { target: 'Pay now' } },
        { category: 'fetch', data: { url: 'https://api.injishi.com/api/v1/search?q=Jane' } },
        { category: 'xhr', data: { url: 'https://api.injishi.com/api/v1/search?q=Jane' } },
        {
          category: 'navigation',
          type: 'navigation',
          message: `Navigation to lease/${UUID}/sign`,
          data: { from: 'account', to: 'lease/[leaseId]/sign', params: { leaseId: UUID, email: 'jane@x.rw' } },
        },
        {
          category: 'injishi.call',
          type: 'http',
          data: { method: 'GET', path: '/api/v1/leases/:id', status_code: 200, outcome: 'ok' },
        },
        { category: 'sentry.event', message: 'Error: jane@x.rw failed' },
      ],
    } as unknown as ErrorEvent;
  }

  it('the critical scenario fixtures leave nothing personal, and keep what reads the stack', () => {
    const { options } = started();
    const eventId = nextId();
    const hint: EventHint = {
      originalException: new ApiError('refused', 'Jane Mukamana is not a member of Kimihurura cell', 422),
    };
    const clean = send(options, dirtyEvent(eventId), hint)!;
    const serialised = JSON.stringify(clean);
    for (const leak of LEAKS) expect(serialised).not.toContain(leak);

    expect(clean.message).toContain(PROSE);
    expect(clean.message).toContain(CONSTRAINT);
    expect(clean.exception!.values![1].value).toBe('refused 422');
    expect(clean.exception!.values![1].mechanism).toEqual({ type: 'onunhandledrejection', handled: false });
    expect(clean.exception!.values![0].stacktrace!.frames).toEqual([FRAME]);
    expect(clean.exception!.values![1].stacktrace!.frames).toEqual([FRAME]);
    expect(clean.event_id).toBe(eventId);
    expect(clean.release).toBe('rw.injishi.mobile@0.1.0+5');
    expect(clean.debug_meta).toEqual(DEBUG_META);
    expect(clean.contexts!.trace).toEqual({ trace_id: 'aaaabbbbccccddddeeeeffff00001111', span_id: 'aaaabbbbccccdddd' });
    expect(clean.contexts!.device).toEqual({ model: 'Pixel 7', family: 'Android', memory_size: 4096 });
    expect(clean.user).toEqual({ id: 'install-7f3a' });
    for (const gone of ['extra', 'request', 'fingerprint', 'modules', 'server_name', 'logentry']) {
      expect(clean).not.toHaveProperty(gone);
    }
    expect(clean.contexts).not.toHaveProperty('culture');
    expect(clean.contexts).not.toHaveProperty('expo_constants');
  });

  it('keeps only the allowed tags, sets the reference, and refuses free text in an allowed key', () => {
    const { options } = started();
    const eventId = nextId();
    const clean = send(options, dirtyEvent(eventId))!;
    expect(clean.tags).toEqual({
      surface: 'guest',
      'event.origin': 'javascript',
      crash_ref: eventId.slice(0, 8).toUpperCase(),
    });
  });

  it('keeps the screens and calls on the trail, and nothing else', () => {
    const { options } = started();
    const clean = send(options, dirtyEvent(nextId()))!;
    expect(clean.breadcrumbs).toEqual([
      { category: 'navigation', type: 'navigation', data: { from: 'account', to: 'lease/[leaseId]/sign' } },
      {
        category: 'injishi.call',
        type: 'http',
        data: { method: 'GET', path: '/api/v1/leases/:id', status_code: 200, outcome: 'ok' },
      },
      { category: 'sentry.event', message: 'Error: [email] failed' },
    ]);
  });

  it('cleans each trail entry before it enters the scope', () => {
    const { options } = started();
    const before = (crumb: Breadcrumb) => options.beforeBreadcrumb!(crumb, undefined);
    expect(before({ category: 'console', message: 'jane@x.rw' })).toBeNull();
    expect(before({ category: 'touch', message: 'Pay now' })).toBeNull();
    expect(before({ category: 'ui.click', message: 'Pay now' })).toBeNull();
    expect(before({ category: 'http', data: { url: 'https://x.rw/?q=Jane' } })).toBeNull();
    expect(
      before({ category: 'navigation', data: { from: 'account', to: 'search', params: { q: 'Jane' } } }),
    ).toEqual({ category: 'navigation', data: { from: 'account', to: 'search' } });
    expect(before({ category: 'device.event', data: { action: 'BATTERY_LOW', level: 14 } })).toEqual({
      category: 'device.event',
      data: { action: 'BATTERY_LOW', level: 14 },
    });
  });

  it('keeps a transaction readable and drops the data on its spans', () => {
    const { options } = started({ ...PREVIEW, environment: 'beta' });
    const transaction = {
      type: 'transaction',
      event_id: nextId(),
      transaction: 'lease/[leaseId]/sign',
      start_timestamp: 1700000000,
      timestamp: 1700000001,
      contexts: { trace: { trace_id: 'aaaabbbbccccddddeeeeffff00001111', span_id: 'aaaabbbbccccdddd', op: 'navigation' } },
      spans: [{ span_id: 'bbbbccccddddeeee', description: 'app start', op: 'app.start.cold', data: { url: 'jane@x.rw' } }],
      measurements: { app_start_cold: { value: 1200, unit: 'millisecond' } },
      request: { url: 'https://x.rw/?q=Jane' },
    } as unknown as TransactionEvent;
    const clean = options.beforeSendTransaction!(transaction, {}) as TransactionEvent;
    expect(clean.transaction).toBe('lease/[leaseId]/sign');
    expect(clean.spans).toEqual([{ span_id: 'bbbbccccddddeeee', description: 'app start', op: 'app.start.cold' }]);
    expect(clean.measurements).toEqual({ app_start_cold: { value: 1200, unit: 'millisecond' } });
    expect(clean.contexts!.trace).toMatchObject({ op: 'navigation' });
    expect(clean).not.toHaveProperty('request');
  });

  it('sends at most five error events a launch', () => {
    const { options } = started();
    const sent = Array.from({ length: 7 }, () => send(options, { type: undefined, event_id: nextId() }));
    expect(sent.filter(Boolean)).toHaveLength(5);
    // Transactions are not errors, and are never capped by it.
    expect(options.beforeSendTransaction!({ type: 'transaction', event_id: nextId() } as TransactionEvent, {})).not.toBeNull();
  });
});

describe('the crash screen reference (AC-3)', () => {
  it('reports once per error, unhandled, and returns the same reference', () => {
    const { reporter, sentry, options } = started();
    const error = new Error('render failed');
    const first = reporter.reportRenderError(error);
    const again = reporter.reportRenderError(error);
    expect(first).toBe('01234567');
    expect(again).toBe(first);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(error, {
      mechanism: { type: 'injishi.crash_screen', handled: false },
    });
    // The event it made is counted once, not again when it reaches beforeSend.
    const forEvent = send(options, { type: undefined, event_id: '0123456789abcdef0123456789abcdef' });
    expect(forEvent!.tags!.crash_ref).toBe('01234567');
  });

  it('has no reference when reporting never started', () => {
    const { reporter, sentry } = load({ ...PREVIEW, dsn: undefined });
    reporter.startCrashReporting();
    expect(reporter.reportRenderError(new Error('render failed'))).toBeNull();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('has no reference once reporting is switched off', async () => {
    const { reporter } = started();
    await reporter.setCrashReportingEnabled(false);
    expect(reporter.reportRenderError(new Error('render failed'))).toBeNull();
  });

  it('has no reference once the launch has used its five events', () => {
    const { reporter, options } = started();
    for (let i = 0; i < 5; i += 1) send(options, { type: undefined, event_id: nextId() });
    expect(reporter.reportRenderError(new Error('render failed'))).toBeNull();
  });

  it('has no reference when the capture throws', () => {
    const { reporter, sentry } = started();
    sentry.captureException.mockImplementation(() => {
      throw new Error('capture failed');
    });
    expect(reporter.reportRenderError(new Error('render failed'))).toBeNull();
  });

  it('is the first eight characters of the event id, upper case', () => {
    expect(load(PREVIEW).reporter.crashRef('abcdef0123456789abcdef0123456789')).toBe('ABCDEF01');
  });
});

describe('the switch (AC-8)', () => {
  it('reads absent as on, off as off, and an unreadable key as off', () => {
    expect(load(PREVIEW).reporter.readCrashReportingChoice()).toBe('on');
    expect(load(PREVIEW, ({ store }) => store.getItem.mockReturnValue('off')).reporter.readCrashReportingChoice()).toBe(
      'off',
    );
    const unreadable = load(PREVIEW, ({ store }) =>
      store.getItem.mockImplementation(() => {
        throw new Error('locked');
      }),
    );
    expect(unreadable.reporter.readCrashReportingChoice()).toBe('off');
  });

  it('turning it off stops everything at once, then saves', async () => {
    const { reporter, sentry, store, options } = started();
    const clientOptions: { enabled?: boolean } = {};
    sentry.getClient.mockReturnValue({ getOptions: () => clientOptions });
    await expect(reporter.setCrashReportingEnabled(false)).resolves.toBe('saved');
    expect(clientOptions.enabled).toBe(false);
    expect(sentry.close).toHaveBeenCalled();
    expect(store.setItemAsync).toHaveBeenCalledWith('injishi.crash-reports', 'off');
    expect(reporter.isCrashReportingStarted()).toBe(false);
    expect(send(options, { type: undefined, event_id: nextId() })).toBeNull();
    expect(options.beforeSendTransaction!({ type: 'transaction', event_id: nextId() } as TransactionEvent, {})).toBeNull();
    expect(options.beforeBreadcrumb!({ category: 'navigation', data: { to: 'search' } }, undefined)).toBeNull();
  });

  it('stays off for this run when saving off fails', async () => {
    const { reporter, store, options } = started();
    store.setItemAsync.mockRejectedValue(new Error('disk full'));
    await expect(reporter.setCrashReportingEnabled(false)).resolves.toBe('notSaved');
    expect(reporter.isCrashReportingStarted()).toBe(false);
    expect(send(options, { type: undefined, event_id: nextId() })).toBeNull();
  });

  it('turning it on deletes the key and waits for the next launch', async () => {
    const { reporter, store, sentry } = load(PREVIEW, ({ store: s }) => s.getItem.mockReturnValue('off'));
    reporter.startCrashReporting();
    await expect(reporter.setCrashReportingEnabled(true)).resolves.toBe('saved');
    expect(store.deleteItemAsync).toHaveBeenCalledWith('injishi.crash-reports');
    expect(sentry.init).not.toHaveBeenCalled();
    expect(reporter.isCrashReportingStarted()).toBe(false);
  });

  it('says so when turning it on could not be saved', async () => {
    const { reporter } = load(PREVIEW, ({ store }) => store.deleteItemAsync.mockRejectedValue(new Error('locked')));
    await expect(reporter.setCrashReportingEnabled(true)).resolves.toBe('notSaved');
  });

  it('keeps the choice in memory on web', async () => {
    const { reporter, store } = load({ ...PREVIEW, os: 'web' });
    expect(reporter.readCrashReportingChoice()).toBe('on');
    await expect(reporter.setCrashReportingEnabled(false)).resolves.toBe('saved');
    expect(reporter.readCrashReportingChoice()).toBe('off');
    expect(store.setItemAsync).not.toHaveBeenCalled();
  });

  it('says whether this build can report at all', () => {
    expect(load(PREVIEW).reporter.isCrashReportingPossible()).toBe(true);
    expect(load({ ...PREVIEW, dev: true }).reporter.isCrashReportingPossible()).toBe(false);
    expect(load({ ...PREVIEW, os: 'web' }).reporter.isCrashReportingPossible()).toBe(false);
    expect(load({ ...PREVIEW, dsn: undefined }).reporter.isCrashReportingPossible()).toBe(false);
  });
});

describe('the trail seams (AC-6)', () => {
  it('masks every id in a path, and drops its query', () => {
    const { reporter } = load(PREVIEW);
    expect(reporter.maskPath(`/api/v1/leases/3f0c2a9e-1b2c-4d5e-8f90-a1b2c3d4e5f6/sign?x=1#y`)).toBe(
      '/api/v1/leases/:id/sign',
    );
    expect(reporter.maskPath('/api/auth/sign-in/email-otp')).toBe('/api/auth/sign-in/email-otp');
    expect(reporter.maskPath('/api/v1/bookings/BK-DEMO-001')).toBe('/api/v1/bookings/:id');
    expect(reporter.maskPath('/api/v1/rooms/42/status')).toBe('/api/v1/rooms/:id/status');
    expect(reporter.maskPath(`/api/v1/${'a'.repeat(33)}`)).toBe('/api/v1/:id');
  });

  it('records a call with its masked path, status and outcome', () => {
    const { reporter, sentry } = started();
    reporter.recordCall({ method: 'post', path: '/api/v1/leases/123/sign?draft=jane@x.rw', httpStatus: 422, outcome: 'refused' });
    expect(sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'injishi.call',
      type: 'http',
      level: 'warning',
      data: { method: 'POST', path: '/api/v1/leases/:id/sign', status_code: 422, outcome: 'refused' },
    });
  });

  it('records each screen by its route name, once per change, without its params', () => {
    const { reporter, sentry, options } = started();
    let onState: (() => void) | undefined;
    let route = 'account';
    const container = {
      addListener: jest.fn((_event: string, callback: () => void) => {
        onState = callback;
      }),
      isReady: () => true,
      getCurrentRoute: () => ({ name: route, params: { leaseId: '3f0c2a9e-1b2c-4d5e-8f90-a1b2c3d4e5f6' } }),
    };
    reporter.registerNavigationContainer(container);
    reporter.registerNavigationContainer(container);
    expect(container.addListener).toHaveBeenCalledTimes(1);

    onState!();
    route = 'lease/[leaseId]/sign';
    onState!();
    onState!();
    expect(sentry.addBreadcrumb.mock.calls.map(([crumb]) => crumb)).toEqual([
      { category: 'navigation', type: 'navigation', data: { to: 'account' } },
      { category: 'navigation', type: 'navigation', data: { from: 'account', to: 'lease/[leaseId]/sign' } },
    ]);
    // The SDK's own screen entry would be a duplicate, and is dropped.
    expect(
      options.beforeBreadcrumb!({ category: 'navigation', message: 'Navigation to account', data: { to: 'account' } }, undefined),
    ).toBeNull();
  });

  it('does nothing when reporting has not started', () => {
    const { reporter, sentry } = load({ ...PREVIEW, dsn: undefined });
    reporter.startCrashReporting();
    reporter.recordCall({ method: 'GET', path: '/api/v1/me', outcome: 'failed' });
    reporter.setCrashTags({ surface: 'guest', domain: 'hospitality' });
    reporter.markAppLoaded();
    expect(sentry.addBreadcrumb).not.toHaveBeenCalled();
    expect(sentry.setTag).not.toHaveBeenCalled();
    expect(sentry.appLoaded).not.toHaveBeenCalled();
  });
});

describe('Diagnostics (AC-1, AC-7)', () => {
  it('throws the canary from a timer, tagged as a test', () => {
    jest.useFakeTimers();
    const { reporter, sentry } = started();
    reporter.forceJsError();
    expect(sentry.setTag).toHaveBeenCalledWith('diagnostic', 'true');
    expect(() => jest.runOnlyPendingTimers()).toThrow(reporter.DIAGNOSTICS_CANARY);
  });

  it('refuses in a production build', () => {
    const { reporter, sentry } = started({ ...PREVIEW, environment: 'production' });
    expect(() => reporter.forceJsError()).toThrow('Diagnostics is not available in this build.');
    expect(() => reporter.forceNativeCrash()).toThrow('Diagnostics is not available in this build.');
    expect(sentry.nativeCrash).not.toHaveBeenCalled();
  });
});
