/**
 * The mobile assistant's identity on the wire (ADR-061 D-c, slice G).
 *
 * This app has no cookie jar, so a signed out conversation is named by a
 * token the API hands a NATIVE client alone. These tests hold the four things
 * that must stay true: every assistant call names itself native, a started
 * conversation's token goes into the keychain and comes back as a header, a
 * claim forgets it, and a refusal keeps the server's code.
 */
import {
  ASSISTANT_TOKEN_KEY,
  claimAssistant,
  fetchAssistant,
  resetAssistantTokenCache,
  sendAssistantMessage,
} from './assistant';

/** The keychain, as a map (the same stand in `write-queue.test.ts` uses). */
const mockKeychain = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockKeychain.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockKeychain.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockKeychain.delete(key);
  },
}));

interface SentInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

const mockFetch = jest.fn();
const realFetch = globalThis.fetch;

function answer(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, headers: { get: () => null } };
}

const TOKEN = 'a'.repeat(43);
const NOW = '2026-09-30T08:00:00.000Z';
const CONVERSATION = {
  id: '00000000-0000-4000-8000-0000000000c1',
  surface: 'mobile',
  anonymous: true,
  messages: [
    {
      id: '00000000-0000-4000-8000-0000000000d1',
      role: 'assistant',
      text: 'Hello',
      sources: [],
      proposals: [],
      escalation: null,
      helpful: null,
      createdAt: NOW,
    },
  ],
  turnsLeft: 39,
  expiresAt: NOW,
};

function sent(index: number): SentInit {
  return mockFetch.mock.calls[index][1] as SentInit;
}

beforeAll(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeEach(() => {
  mockFetch.mockReset();
  mockKeychain.clear();
  resetAssistantTokenCache();
});

describe('the mobile assistant client', () => {
  it('names itself native on every call, and sends no token before one exists', async () => {
    mockFetch.mockResolvedValue(answer(200, { enabled: true, conversation: null, claimable: false }));
    const result = await fetchAssistant();
    expect(result.kind).toBe('ok');
    expect(sent(0).headers?.['x-assistant-client']).toBe('native');
    expect(sent(0).headers).not.toHaveProperty('x-assistant-token');
  });

  it('keeps a started conversation’s token in the keychain and sends it back as a header', async () => {
    mockFetch.mockResolvedValueOnce(answer(200, { conversation: CONVERSATION, anonToken: TOKEN }));
    await sendAssistantMessage({ message: 'what is injishi' });
    expect(mockKeychain.get(ASSISTANT_TOKEN_KEY)).toBe(TOKEN);
    expect(JSON.parse(sent(0).body ?? '{}')).toEqual({ message: 'what is injishi', surface: 'mobile' });

    // A relaunch reads it from the keychain, not from memory.
    resetAssistantTokenCache();
    mockFetch.mockResolvedValueOnce(answer(200, { conversation: CONVERSATION }));
    await sendAssistantMessage({ message: 'when do I get paid' });
    expect(sent(1).headers?.['x-assistant-token']).toBe(TOKEN);
    expect(mockKeychain.get(ASSISTANT_TOKEN_KEY)).toBe(TOKEN);
  });

  it('forgets the token after a claim, and keeps it when the claim never reached the API', async () => {
    mockKeychain.set(ASSISTANT_TOKEN_KEY, TOKEN);
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    expect((await claimAssistant(false)).kind).toBe('failed');
    expect(mockKeychain.get(ASSISTANT_TOKEN_KEY)).toBe(TOKEN);

    mockFetch.mockResolvedValueOnce(answer(200, { claimed: true, conversation: { ...CONVERSATION, anonymous: false } }));
    expect((await claimAssistant(false)).kind).toBe('ok');
    expect(sent(1).headers?.['x-assistant-token']).toBe(TOKEN);
    expect(mockKeychain.has(ASSISTANT_TOKEN_KEY)).toBe(false);
  });

  it('keeps the server’s code on a refusal, so a full conversation can start a new one', async () => {
    mockFetch.mockResolvedValueOnce(
      answer(409, { code: 'conversation_full', message: 'This conversation is full. Start a new one to keep going.' }),
    );
    const result = await sendAssistantMessage({ message: 'one more' });
    expect(result).toEqual({
      kind: 'refused',
      code: 'conversation_full',
      message: 'This conversation is full. Start a new one to keep going.',
    });
  });

  it('treats an answer the contract rejects as a failure, and stores no token from it', async () => {
    mockFetch.mockResolvedValueOnce(answer(200, { conversation: { id: 'not-a-uuid' }, anonToken: TOKEN }));
    expect((await sendAssistantMessage({ message: 'hi' })).kind).toBe('failed');
    expect(mockKeychain.has(ASSISTANT_TOKEN_KEY)).toBe(false);
  });
});
