// The session guard's import chain reaches Better Auth, which ships as ESM Jest
// does not transform. The guard is overridden below, so the auth package is
// stood in for the way `upload-throttler.guard.spec.ts` does it.
jest.mock('@injishi/auth', () => ({
  DEMO_OTP_CODE: '123456',
  DEMO_COOKIE_PREFIX: 'injishi-demo',
  createAuth: (config: unknown) => ({ config }),
}));

import { ForbiddenException, UnauthorizedException, VersioningType, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';

import type { AssistantMode } from '../../../modules/assistant/application/assistant-settings';
import { AssistantService } from '../../../modules/assistant/application/assistant.service';
import {
  type AssistantModelPort,
  ModelUnavailableError,
} from '../../../modules/assistant/domain/model-port';
import { MockAssistantModel } from '../../../modules/assistant/infrastructure/mock-model.adapter';
import { ToolSet } from '../../../modules/assistant/application/assistant-tools';
import { FakeConversations } from '../../../modules/assistant/testing/fake-conversations';
import { defaultProposals, defaultRoomTypes } from '../../../modules/assistant/testing/fake-actions';
import { GUEST_A, GUEST_B, fakeReads } from '../../../modules/assistant/testing/fake-listings';
import { MUSANZE, OPS_WORKSPACE, scoped } from '../../../modules/assistant/testing/fake-operator';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { WorkspaceGuard } from '../../../shared/auth/workspace.guard';
import { ActionApprovalService } from '../../../modules/assistant/application/action-approval.service';
import { resolveTrustProxy } from '../../../shared/config/trust-proxy';
import { OptionalSessionGuard } from '../support/optional-session.guard';
import { ASSISTANT_COOKIE, type AssistantCookieOptions } from './assistant-cookie';
import { AssistantController } from './assistant.controller';
import {
  ASSISTANT_CLIENT_LIMIT,
  ASSISTANT_CONVERSATION_LIMIT,
} from './assistant-throttler.guard';
import { OperatorScopeResolver } from './operator-scope';
import { FakeUsage } from '../../../modules/assistant/testing/fake-usage';

const MESSAGES = '/api/v1/assistant/messages';
const CURRENT = '/api/v1/assistant/conversations/current?surface=web';
const CLAIM = '/api/v1/assistant/conversations/claim';

interface SetCookieCall {
  name: string;
  value: string;
  options: AssistantCookieOptions;
}

/**
 * A stand in for `@fastify/cookie`, which loads its parser through a dynamic
 * `import()` that Jest cannot run without `--experimental-vm-modules`. It
 * parses the `Cookie` header onto `request.cookies` as the plugin does, and
 * RECORDS every `reply.setCookie` call, so these tests assert the exact
 * options the controller passes. Serialising those options into a header is
 * the plugin's own contract; the live run in ADR-061 verify.md checks it.
 */
interface CookieRequest {
  headers: { cookie?: string };
  cookies?: Record<string, string | undefined>;
}

interface CookieReply {
  header(name: string, value: string): unknown;
}

/** The three Fastify instance methods the stand in uses, and nothing else. */
interface DecoratableFastify {
  decorateRequest(name: string, value: unknown): void;
  decorateReply(name: string, value: unknown): void;
  addHook(name: 'onRequest', hook: (req: CookieRequest) => Promise<void>): void;
}

function standInCookies(app: NestFastifyApplication): { calls: SetCookieCall[]; cleared: string[] } {
  const calls: SetCookieCall[] = [];
  const cleared: string[] = [];
  const fastify = app.getHttpAdapter().getInstance() as unknown as DecoratableFastify;
  fastify.decorateRequest('cookies', null);
  fastify.addHook('onRequest', async (req) => {
    const pairs = (req.headers.cookie ?? '').split(';').map((pair: string) => pair.trim().split('='));
    req.cookies = Object.fromEntries(
      pairs.filter((parts: string[]) => parts[0]).map((parts: string[]) => [parts[0], parts.slice(1).join('=')]),
    );
  });
  fastify.decorateReply(
    'setCookie',
    function (this: CookieReply, name: string, value: string, options: AssistantCookieOptions) {
      calls.push({ name, value, options });
      this.header('set-cookie', `${name}=${value}`);
      return this;
    },
  );
  fastify.decorateReply('clearCookie', function (this: CookieReply, name: string) {
    cleared.push(name);
    this.header('set-cookie', `${name}=; Max-Age=0`);
    return this;
  });
  return { calls, cleared };
}

/**
 * The assistant's HTTP surface end to end inside one process (ADR-061 slice
 * A): the real controller, validation pipe, throttler and service, over the
 * in memory repository and the deterministic mock model. The optional
 * session guard is replaced by one that reads `x-test-user`.
 */
async function boot(options: {
  mode?: AssistantMode;
  nodeEnv?: string;
  model?: AssistantModelPort;
  scope?: OperatorScopeResolver['resolve'];
} = {}): Promise<{ app: NestFastifyApplication; repo: FakeConversations; cookies: SetCookieCall[]; cleared: string[] }> {
  const repo = new FakeConversations();
  const service = new AssistantService(
    options.model ?? new MockAssistantModel(),
    { mode: options.mode ?? 'mock', model: 'claude-sonnet-5-5' },
    repo.asRepository(),
    new ToolSet(fakeReads),
    defaultProposals,
    new FakeUsage(),
  );
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ name: 'money', ttl: 60_000, limit: 5 }])],
    controllers: [AssistantController],
    providers: [
      { provide: AssistantService, useValue: service },
      { provide: ActionApprovalService, useValue: new ActionApprovalService(defaultProposals.asRepository(), defaultRoomTypes) },
      { provide: OperatorScopeResolver, useValue: { resolve: options.scope ?? (() => Promise.resolve({ workspace: null, stepUpNeeded: false })) } },
      {
        provide: ConfigService,
        useValue: { get: (key: string) => (key === 'NODE_ENV' ? (options.nodeEnv ?? 'development') : undefined) },
      },
    ],
  })
    .overrideGuard(OptionalSessionGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
        const id = req.headers['x-test-user'];
        if (id) req.user = { id, email: `${id}@example.rw` };
        return true;
      },
    })
    .overrideGuard(WorkspaceGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<{ headers: Record<string, string>; workspace?: unknown }>();
        const perms = req.headers['x-test-permissions'];
        if (!perms) throw new ForbiddenException('That workspace is not available to you.');
        req.workspace = scoped(perms.split(',') as never);
        return true;
      },
    })
    .overrideGuard(SessionGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
        const id = req.headers['x-test-user'];
        if (!id) throw new UnauthorizedException();
        req.user = { id, email: `${id}@example.rw` };
        return true;
      },
    })
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ trustProxy: resolveTrustProxy('1') }),
  );
  const { calls: cookies, cleared } = standInCookies(app);
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return { app, repo, cookies, cleared };
}

function cookieFrom(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : (setCookie ?? '');
  return header.split(';')[0].split('=').slice(1).join('=');
}

describe('AssistantController (ADR-061 slice A)', () => {
  let app: NestFastifyApplication;

  /**
   * The throttle tests send dozens of turns through the full HTTP stack. Alone
   * they take about a second; under the whole suite on a busy machine they
   * outlived the 5 s default, so they get a ceiling that is about load, not logic.
   */
  const LOOP_TIMEOUT_MS = 30_000;

  afterEach(async () => {
    await app?.close();
  });

  function post(payload: object, headers: Record<string, string> = {}): ReturnType<NestFastifyApplication['inject']> {
    return app.inject({
      method: 'POST',
      url: MESSAGES,
      payload,
      headers: { 'x-forwarded-for': '203.0.113.10', ...headers },
    });
  }

  it('answers an anonymous question and sets an HttpOnly, lax, path scoped cookie', async () => {
    let cookies: SetCookieCall[];
    ({ app, cookies } = await boot());
    const response = await post({ message: "I can't publish my property", surface: 'web' });

    expect(response.statusCode).toBe(200);
    expect(cookies).toHaveLength(1);
    expect(cookies[0].name).toBe(ASSISTANT_COOKIE);
    expect(cookies[0].value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cookies[0].options).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/api/v1/assistant',
      maxAge: 604800,
    });

    const { conversation } = response.json();
    expect(conversation.anonymous).toBe(true);
    expect(conversation.messages[1].sources[0].id).toBe('cannot-publish-listing');
  });

  it('marks the cookie Secure in production', async () => {
    let cookies: SetCookieCall[];
    ({ app, cookies } = await boot({ nodeEnv: 'production', mode: 'mock' }));
    await post({ message: 'what is injishi', surface: 'web' });
    expect(cookies[0].options.secure).toBe(true);
  });

  it('returns the same conversation to the same cookie, and none without it', async () => {
    ({ app } = await boot());
    expect((await app.inject({ method: 'GET', url: CURRENT })).json()).toMatchObject({ enabled: true, conversation: null, claimable: false });

    const first = await post({ message: 'what is injishi', surface: 'web' });
    const cookie = `${ASSISTANT_COOKIE}=${cookieFrom(first.headers['set-cookie'])}`;
    const again = await app.inject({ method: 'GET', url: CURRENT, headers: { cookie } });
    expect(again.json().conversation.id).toBe(first.json().conversation.id);
  });

  it('sets the same cookie again on a continued conversation, so its lifetime slides', async () => {
    let cookies: SetCookieCall[];
    ({ app, cookies } = await boot());
    await post({ message: 'what is injishi', surface: 'web' });
    const token = cookies[0].value;
    await post({ message: 'when do I get paid', surface: 'web' }, { cookie: `${ASSISTANT_COOKIE}=${token}` });
    expect(cookies).toHaveLength(2);
    expect(cookies[1]).toEqual(cookies[0]);
  });

  it('gives a signed in caller an owned conversation and no cookie', async () => {
    ({ app } = await boot());
    const response = await post({ message: 'what is injishi', surface: 'web' }, { 'x-test-user': 'user-1' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.json().conversation.anonymous).toBe(false);
  });

  describe('the mobile app (ADR-061 D-c, slice G)', () => {
    const NATIVE = { 'x-assistant-client': 'native' };

    it('returns the token in the body to a native client, and sets no cookie', async () => {
      let cookies: SetCookieCall[];
      ({ app, cookies } = await boot());
      const response = await post({ message: 'what is injishi', surface: 'mobile' }, NATIVE);
      expect(response.statusCode).toBe(200);
      expect(response.json().anonToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(cookies).toHaveLength(0);
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('never returns the token in the body to a web request', async () => {
      let cookies: SetCookieCall[];
      ({ app, cookies } = await boot());
      const response = await post({ message: 'what is injishi', surface: 'web' });
      expect(response.json()).not.toHaveProperty('anonToken');
      expect(cookies).toHaveLength(1);
    });

    it('continues the same conversation from the token header, handing no new token', async () => {
      ({ app } = await boot());
      const first = await post({ message: 'what is injishi', surface: 'mobile' }, NATIVE);
      const token = first.json().anonToken as string;
      const again = await post({ message: 'when do I get paid', surface: 'mobile' }, { ...NATIVE, 'x-assistant-token': token });
      expect(again.json().conversation.id).toBe(first.json().conversation.id);
      expect(again.json()).not.toHaveProperty('anonToken');
      const current = await app.inject({
        method: 'GET',
        url: '/api/v1/assistant/conversations/current?surface=mobile',
        headers: { ...NATIVE, 'x-assistant-token': token },
      });
      expect(current.json().conversation.messages).toHaveLength(4);
    });

    it('never reads the cookie for a native request, so the header cannot lift an HttpOnly value', async () => {
      let cookies: SetCookieCall[];
      ({ app, cookies } = await boot());
      await post({ message: 'what is injishi', surface: 'mobile' });
      const cookie = `${ASSISTANT_COOKIE}=${cookies[0].value}`;
      // Positive control: the cookie alone opens that conversation.
      const web = await app.inject({ method: 'GET', url: '/api/v1/assistant/conversations/current?surface=mobile', headers: { cookie } });
      expect(web.json().conversation).not.toBeNull();

      const native = await app.inject({
        method: 'GET',
        url: '/api/v1/assistant/conversations/current?surface=mobile',
        headers: { ...NATIVE, cookie },
      });
      expect(native.json().conversation).toBeNull();
      const sent = await post({ message: 'hi', surface: 'mobile' }, { ...NATIVE, cookie });
      expect(sent.json().anonToken).not.toBe(cookies[0].value);
    });

    it('counts a native conversation by its token header against the per conversation limit', async () => {
      ({ app } = await boot());
      const first = await post({ message: 'hi', surface: 'mobile' }, NATIVE);
      const headers = { ...NATIVE, 'x-assistant-token': first.json().anonToken as string };
      // The first message carried no token yet, so it counted against the address.
      for (let i = 0; i < ASSISTANT_CONVERSATION_LIMIT; i++) {
        expect((await post({ message: 'hi', surface: 'mobile' }, headers)).statusCode).toBe(200);
      }
      expect((await post({ message: 'hi', surface: 'mobile' }, headers)).statusCode).toBe(429);
      // Another conversation from the same address is not affected.
      expect((await post({ message: 'hi', surface: 'mobile' }, NATIVE)).statusCode).toBe(200);
    }, LOOP_TIMEOUT_MS);

    it('claims a native conversation from the token header and clears no cookie', async () => {
      let cleared: string[];
      ({ app, cleared } = await boot());
      const first = await post({ message: 'what is injishi', surface: 'mobile' }, NATIVE);
      const token = first.json().anonToken as string;
      const headers = { ...NATIVE, 'x-assistant-token': token, 'x-test-user': 'user-9' };
      const current = await app.inject({ method: 'GET', url: '/api/v1/assistant/conversations/current?surface=mobile', headers });
      expect(current.json().claimable).toBe(true);
      const claim = await app.inject({ method: 'POST', url: CLAIM, payload: { surface: 'mobile' }, headers });
      expect(claim.statusCode).toBe(200);
      expect(claim.json().conversation.id).toBe(first.json().conversation.id);
      expect(cleared).toHaveLength(0);
    });
  });

  it('offers the admin console no operator tool, and the operator app its tools', async () => {
    const offered: string[][] = [];
    const mock = new MockAssistantModel();
    const model: AssistantModelPort = {
      kind: 'mock',
      createTurn: (request) => {
        offered.push(request.tools.map((t) => t.name));
        return mock.createTurn(request);
      },
    };
    const OPERATOR_TOOLS = ['rooms_on_dates', 'list_reservations', 'publish_blockers', 'propose_room_price'];
    ({ app } = await boot({
      model,
      scope: (input) =>
        Promise.resolve(
          input.workspaceId ? { workspace: scoped(['listing.manage', 'reservation.assign']), stepUpNeeded: false } : { workspace: null, stepUpNeeded: false },
        ),
    }));

    // Explanation questions, so they reach the model (D-q) and its tool list
    // can be read; simpler questions are answered by the router without one.
    await post({ message: 'explain how listing approval works', surface: 'admin' }, { 'x-test-user': 'staff-1' });
    expect(offered.length).toBeGreaterThan(0);
    const asked = offered.length;
    expect(offered.at(-1)).toEqual(expect.arrayContaining(['search_help']));
    for (const name of OPERATOR_TOOLS) expect(offered.at(-1)).not.toContain(name);

    // Positive control: the same person in a workspace is offered them.
    await post(
      { message: 'explain which rooms I should sell first', surface: 'app' },
      { 'x-test-user': 'staff-1', 'x-workspace-id': OPS_WORKSPACE },
    );
    expect(offered.length).toBeGreaterThan(asked);
    expect(offered.at(-1)).toEqual(expect.arrayContaining(['rooms_on_dates', 'propose_room_price']));
  });

  it.each([
    ['an unknown key that claims a requester', { message: 'hi', surface: 'web', userId: 'u1' }],
    ['a message over the cap', { message: 'x'.repeat(2001), surface: 'web' }],
    ['an empty message', { message: '   ', surface: 'web' }],
    ['an unknown surface', { message: 'hi', surface: 'kiosk' }],
    ['a page path that is a url', { message: 'hi', surface: 'web', pagePath: 'https://x.rw/a' }],
  ])('refuses %s with 400', async (_label, payload) => {
    ({ app } = await boot());
    expect((await post(payload)).statusCode).toBe(400);
  });

  it(`refuses message ${ASSISTANT_CONVERSATION_LIMIT + 1} in one conversation within the hour`, async () => {
    ({ app } = await boot());
    const cookie = `${ASSISTANT_COOKIE}=conversation-a`;
    for (let i = 0; i < ASSISTANT_CONVERSATION_LIMIT; i++) {
      expect((await post({ message: 'what is injishi', surface: 'web' }, { cookie })).statusCode).toBe(200);
    }
    expect((await post({ message: 'what is injishi', surface: 'web' }, { cookie })).statusCode).toBe(429);
  }, LOOP_TIMEOUT_MS);

  it(`refuses message ${ASSISTANT_CLIENT_LIMIT + 1} from one address, however many conversations`, async () => {
    ({ app } = await boot());
    for (let i = 0; i < ASSISTANT_CLIENT_LIMIT; i++) {
      const cookie = `${ASSISTANT_COOKIE}=conversation-${i}`;
      expect((await post({ message: 'hi', surface: 'web' }, { cookie })).statusCode).toBe(200);
    }
    const cookie = `${ASSISTANT_COOKIE}=conversation-new`;
    expect((await post({ message: 'hi', surface: 'web' }, { cookie })).statusCode).toBe(429);
    // A different address is not affected.
    expect((await post({ message: 'hi', surface: 'web' }, { cookie, 'x-forwarded-for': '198.51.100.7' })).statusCode).toBe(200);
  }, LOOP_TIMEOUT_MS);

  it('claims an anonymous conversation on sign in, and clears the cookie', async () => {
    let cleared: string[];
    ({ app, cleared } = await boot());
    const first = await post({ message: 'what is injishi', surface: 'web' });
    const cookie = `${ASSISTANT_COOKIE}=${cookieFrom(first.headers['set-cookie'])}`;
    const signedIn = { cookie, 'x-test-user': 'user-1' };

    const before = await app.inject({ method: 'GET', url: CURRENT, headers: signedIn });
    expect(before.json()).toMatchObject({ claimable: true, conversation: null });

    const claim = await app.inject({ method: 'POST', url: CLAIM, payload: { surface: 'web' }, headers: signedIn });
    expect(claim.statusCode).toBe(200);
    expect(claim.json()).toMatchObject({ claimed: true, conversation: { id: first.json().conversation.id, anonymous: false } });
    expect(cleared).toEqual([ASSISTANT_COOKIE]);

    const after = await app.inject({ method: 'GET', url: CURRENT, headers: { 'x-test-user': 'user-1' } });
    expect(after.json()).toMatchObject({ claimable: false, conversation: { id: first.json().conversation.id } });
  });

  it('never moves a conversation that already has an owner to a second account', async () => {
    ({ app } = await boot());
    const first = await post({ message: 'what is injishi', surface: 'web' });
    const cookie = `${ASSISTANT_COOKIE}=${cookieFrom(first.headers['set-cookie'])}`;
    await app.inject({ method: 'POST', url: CLAIM, payload: { surface: 'web' }, headers: { cookie, 'x-test-user': 'user-1' } });
    const replay = await app.inject({ method: 'POST', url: CLAIM, payload: { surface: 'web' }, headers: { cookie, 'x-test-user': 'user-2' } });
    expect(replay.json()).toEqual({ claimed: false, conversation: null });
  });

  it('closes a disowned conversation without attaching it, and clears the cookie', async () => {
    let cleared: string[];
    ({ app, cleared } = await boot());
    const first = await post({ message: 'what is injishi', surface: 'web' });
    const cookie = `${ASSISTANT_COOKIE}=${cookieFrom(first.headers['set-cookie'])}`;
    const signedIn = { cookie, 'x-test-user': 'user-1' };
    const discard = await app.inject({ method: 'POST', url: CLAIM, payload: { surface: 'web', discard: true }, headers: signedIn });
    expect(discard.json()).toEqual({ claimed: false, conversation: null });
    expect(cleared).toEqual([ASSISTANT_COOKIE]);
    // Nobody can claim it afterwards, not even with the old cookie.
    const again = await app.inject({ method: 'POST', url: CLAIM, payload: { surface: 'web' }, headers: signedIn });
    expect(again.json()).toEqual({ claimed: false, conversation: null });
  });

  it('resolves the operator workspace from the request headers and answers room questions from it', async () => {
    const seen: unknown[] = [];
    ({ app } = await boot({
      scope: (input) => {
        seen.push(input);
        return Promise.resolve({ workspace: scoped(['stay.checkin']), stepUpNeeded: false });
      },
    }));
    const response = await post(
      { message: 'which rooms are free on 2026-10-10', surface: 'app' },
      { 'x-test-user': 'user-1', 'x-workspace-id': OPS_WORKSPACE, 'x-branch-id': MUSANZE },
    );
    expect(seen).toEqual([
      { userId: 'user-1', sessionId: null, workspaceId: OPS_WORKSPACE, branchHeader: MUSANZE },
    ]);
    expect(response.json().conversation.messages[1].text).toBe('Held: 204, K1. Free: 205.');
  });

  it('runs no operator tool when the session still owes the step up code', async () => {
    ({ app } = await boot({ scope: () => Promise.resolve({ workspace: null, stepUpNeeded: true }) }));
    const response = await post(
      { message: 'which rooms are free on 2026-10-10', surface: 'app' },
      { 'x-test-user': 'user-1', 'x-workspace-id': OPS_WORKSPACE },
    );
    expect(response.json().conversation.messages[1].text).toBe(
      'I can only check rooms from the operator app, in a business you work in.',
    );
  });

  it('prepares a price change as a card on the answer, then executes it only on the approve request', async () => {
    defaultRoomTypes.price = 60000;
    ({ app } = await boot({ scope: () => Promise.resolve({ workspace: scoped(['listing.manage']), stepUpNeeded: false }) }));
    const asked = await post(
      { message: 'change the Double room price from 60,000 to 70,000', surface: 'app' },
      { 'x-test-user': 'user-owner', 'x-workspace-id': OPS_WORKSPACE },
    );
    const reply = asked.json().conversation.messages[1];
    expect(reply.text).toMatch(/Nothing has changed yet/);
    expect(reply.proposals).toEqual([
      expect.objectContaining({ title: 'Double room: price per night', current: '60,000 RWF', proposed: '70,000 RWF', state: 'proposed' }),
    ]);
    expect(defaultRoomTypes.price).toBe(60000);

    const id = reply.proposals[0].id;
    const approveHeaders = { 'x-test-user': 'user-owner', 'x-test-permissions': 'listing.manage' };
    const noKey = await app.inject({ method: 'POST', url: `/api/v1/assistant/actions/${id}/approve`, headers: approveHeaders });
    expect(noKey.statusCode).toBe(400);
    expect(defaultRoomTypes.price).toBe(60000);

    const approved = await app.inject({
      method: 'POST',
      url: `/api/v1/assistant/actions/${id}/approve`,
      headers: { ...approveHeaders, 'idempotency-key': '7b2e9d3a-0c4f-4e5a-9b32-2345678901cd' },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({ proposal: { id, state: 'executed' } });
    expect(defaultRoomTypes.price).toBe(70000);

    // The card on the conversation now shows the proposal as executed.
    const view = await app.inject({ method: 'GET', url: '/api/v1/assistant/conversations/current?surface=app', headers: { 'x-test-user': 'user-owner' } });
    expect(view.json().conversation.messages[1].proposals[0].state).toBe('executed');
  });

  it('refuses the approve route to a caller the workspace guard refuses', async () => {
    ({ app } = await boot());
    const refused = await app.inject({
      method: 'POST',
      url: '/api/v1/assistant/actions/00000000-0000-4000-8000-000000000001/approve',
      headers: { 'x-test-user': 'user-1', 'idempotency-key': '8c3f0e4b-1d5a-4f6b-8c43-3456789012de' },
    });
    expect(refused.statusCode).toBe(403);
  });

  it('sends an escalation only with a reply address when signed out, behind the support throttle', async () => {
    ({ app } = await boot());
    const first = await post({ message: 'I want to talk to a person', surface: 'web' });
    expect(first.json().conversation.messages[1].escalation).toEqual({ topic: 'other' });
    const cookie = `${ASSISTANT_COOKIE}=${cookieFrom(first.headers['set-cookie'])}`;
    const send = (payload: object): ReturnType<NestFastifyApplication['inject']> =>
      app.inject({ method: 'POST', url: '/api/v1/assistant/escalations', payload, headers: { cookie, 'x-forwarded-for': '203.0.113.55' } });

    expect((await send({ surface: 'web', topic: 'other' })).statusCode).toBe(400);
    expect((await send({ surface: 'web', topic: 'other', email: 'not-an-address' })).statusCode).toBe(400);
    const sent = await send({ surface: 'web', topic: 'other', email: 'aline@example.rw' });
    expect(sent.statusCode).toBe(201);
    expect(sent.json()).toEqual({ ticketId: expect.any(String) });
    // The support intake's per mailbox limit is 3 an hour; this is the 4th for the address.
    for (let i = 0; i < 2; i++) await send({ surface: 'web', topic: 'other', email: 'aline@example.rw' });
    expect((await send({ surface: 'web', topic: 'other', email: 'aline@example.rw' })).statusCode).toBe(429);
  }, LOOP_TIMEOUT_MS);

  it('refuses a claim without a session', async () => {
    ({ app } = await boot());
    expect((await app.inject({ method: 'POST', url: CLAIM, payload: { surface: 'web' } })).statusCode).toBe(401);
  });

  it('offers listings on every host, the production API host included', async () => {
    ({ app } = await boot());
    const hosts: Record<string, string>[] = [
      { host: 'localhost:8000' },
      { host: 'api.injishi.com', 'x-forwarded-for': '198.51.100.9' },
    ];
    for (const headers of hosts) {
      const sent = await post({ message: 'places to stay in Musanze', surface: 'web' }, headers);
      expect(sent.json().conversation.messages[1].sources.map((s: { kind: string }) => s.kind)).toEqual(['listing', 'listing']);
    }
  });

  it('reports enabled false and refuses sends with 503 assistant_off when off', async () => {
    ({ app } = await boot({ mode: 'off' }));
    expect((await app.inject({ method: 'GET', url: CURRENT })).json()).toEqual({ enabled: false, conversation: null, claimable: false, greeting: '', suggestions: [] });
    const response = await post({ message: 'hi', surface: 'web' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: 'assistant_off' });
  });

  it('answers 200 by fallback when the model fails, never 502 (D-u)', async () => {
    const failing: AssistantModelPort = {
      kind: 'mock',
      createTurn: () => Promise.reject(new ModelUnavailableError('down')),
    };
    let repo: FakeConversations;
    ({ app, repo } = await boot({ model: failing }));
    const response = await post({ message: 'could you sort this out for me somehow', surface: 'web' });
    expect(response.statusCode).toBe(200);
    const answer = response.json().conversation.messages.at(-1);
    expect(answer.role).toBe('assistant');
    expect(answer.text.length).toBeGreaterThan(10);
    // A new anonymous conversation was started, so it gets its cookie.
    expect(response.headers['set-cookie']).toBeDefined();
    expect([...repo.messages.values()].flat().at(-1)?.route).toBe('fallback:model_unavailable');
  });
  /**
   * The Phase 1 success journeys (ADR-061 feature 12), each driven end to end
   * over HTTP with the deterministic model: what a visitor, a guest, a business
   * user and anyone can get from the assistant, and that an action happens
   * only on the person's own approval. The live model is judged against the
   * same journeys in the owner's live run (root gate R3).
   */
  describe('Phase 1 journeys (ADR-061 feature 12)', () => {
    const answerOf = (response: Awaited<ReturnType<typeof post>>): { text: string; sources: { id: string; kind: string }[] } =>
      response.json().conversation.messages.at(-1);

    it('answers every journey question from Injishi’s own data with no model call, and hands only an explanation to the model (D-q)', async () => {
      let modelCalls = 0;
      const inner = new MockAssistantModel();
      const counting: AssistantModelPort = {
        kind: 'mock',
        createTurn: (request) => {
          modelCalls += 1;
          return inner.createTurn(request);
        },
      };
      defaultRoomTypes.price = 60000;
      let repo: FakeConversations;
      ({ app, repo } = await boot({
        model: counting,
        scope: () => Promise.resolve({ workspace: scoped(['stay.checkin', 'listing.manage']), stepUpNeeded: false }),
      }));
      const operator = { 'x-test-user': 'user-owner', 'x-workspace-id': OPS_WORKSPACE };
      const asked: [object, Record<string, string>][] = [
        [{ message: "I can't publish my property", surface: 'web' }, { host: 'localhost:8000', 'x-forwarded-for': '198.51.100.31' }],
        [{ message: 'places to stay in Musanze', surface: 'web' }, { host: 'localhost:8000', 'x-forwarded-for': '198.51.100.32' }],
        [{ message: 'show my trips', surface: 'web' }, { 'x-test-user': GUEST_A }],
        [{ message: 'how do I check a guest in', surface: 'app' }, operator],
        [{ message: 'which rooms are free on 2026-10-10', surface: 'app' }, operator],
        [{ message: 'change the Double room price from 60,000 to 70,000', surface: 'app' }, operator],
        [{ message: 'I want to talk to a person', surface: 'web' }, { 'x-forwarded-for': '198.51.100.33' }],
      ];
      for (const [body, headers] of asked) expect((await post(body, headers)).statusCode).toBe(200);
      expect(modelCalls).toBe(0);
      const routes = (): (string | null)[] => [...repo.messages.values()].flat().filter((m) => m.role === 'assistant').map((m) => m.route);
      expect(routes().every((route) => route?.startsWith('direct:'))).toBe(true);
      expect(routes()).toHaveLength(asked.length);

      // An explanation is the model's job, and the only question here that reaches it.
      await post({ message: 'explain how listing approval works', surface: 'web' }, { 'x-forwarded-for': '198.51.100.34' });
      expect(modelCalls).toBeGreaterThan(0);
      expect(routes().at(-1)).toBe('ai:analysis');
    });

    it('journey 1: an anonymous visitor gets a sourced answer about Injishi and finds published places', async () => {
      ({ app } = await boot());
      const help = answerOf(await post({ message: "I can't publish my property", surface: 'web' }, { host: 'localhost:8000' }));
      expect(help.sources.map((s) => s.id)).toContain('cannot-publish-listing');
      const places = answerOf(await post({ message: 'places to stay in Musanze', surface: 'web' }, { host: 'localhost:8000', 'x-forwarded-for': '198.51.100.21' }));
      expect(places.text).toMatch(/^I found \d+ places? in Musanze: /);
      expect(places.sources.every((s) => s.kind === 'listing')).toBe(true);
    });

    it('journey 2: a signed in guest reads their own trips, and never another guest\u2019s', async () => {
      ({ app } = await boot());
      const mine = answerOf(await post({ message: 'show my trips', surface: 'web' }, { 'x-test-user': GUEST_A }));
      expect(mine.text).toMatch(/BK-(PAST01|NEXT02)/);
      expect(mine.text).not.toContain('BK-OTHER3');
      const theirs = answerOf(await post({ message: 'show my trips', surface: 'web' }, { 'x-test-user': GUEST_B, 'x-forwarded-for': '198.51.100.22' }));
      expect(theirs.text).toContain('BK-OTHER3');
      expect(theirs.text).not.toMatch(/BK-(PAST01|NEXT02)/);
    });

    it('journey 3: a business user gets steps for a task and live answers within their grant', async () => {
      ({ app } = await boot({ scope: () => Promise.resolve({ workspace: scoped(['stay.checkin']), stepUpNeeded: false }) }));
      const headers = { 'x-test-user': 'user-desk', 'x-workspace-id': OPS_WORKSPACE };
      const guide = answerOf(await post({ message: 'how do I check a guest in', surface: 'app' }, headers));
      expect(guide.text).toMatch(/1\. .+ 2\. /);
      const rooms = answerOf(await post({ message: 'which rooms are free on 2026-10-10', surface: 'app' }, headers));
      expect(rooms.text).toBe('Held: 204, K1. Free: 205.');
    });

    it('journey 4: anyone the assistant cannot help reaches a person, and only by their own send', async () => {
      ({ app } = await boot());
      const first = await post({ message: 'I want to talk to a person', surface: 'web' });
      expect(first.json().conversation.messages[1].escalation).not.toBeNull();
      const cookie = `${ASSISTANT_COOKIE}=${cookieFrom(first.headers['set-cookie'])}`;
      const sent = await app.inject({
        method: 'POST',
        url: '/api/v1/assistant/escalations',
        payload: { surface: 'web', topic: 'other', email: 'visitor@example.rw' },
        headers: { cookie, 'x-forwarded-for': '203.0.113.77' },
      });
      expect(sent.statusCode).toBe(201);
    });

    it('journey 5: an action is prepared by the assistant and happens only when the person approves it', async () => {
      defaultRoomTypes.price = 60000;
      ({ app } = await boot({ scope: () => Promise.resolve({ workspace: scoped(['listing.manage']), stepUpNeeded: false }) }));
      const asked = await post(
        { message: 'change the Double room price from 60,000 to 70,000', surface: 'app' },
        { 'x-test-user': 'user-owner', 'x-workspace-id': OPS_WORKSPACE },
      );
      const proposal = asked.json().conversation.messages[1].proposals[0];
      expect(proposal.state).toBe('proposed');
      expect(defaultRoomTypes.price).toBe(60000);
      const approved = await app.inject({
        method: 'POST',
        url: `/api/v1/assistant/actions/${proposal.id}/approve`,
        headers: { 'x-test-user': 'user-owner', 'x-test-permissions': 'listing.manage', 'idempotency-key': '0d4b7c1e-8a2f-4c3d-9e5f-1a2b3c4d5e6f' },
      });
      expect(approved.json().proposal.state).toBe('executed');
      expect(defaultRoomTypes.price).toBe(70000);
    });
  });
});
