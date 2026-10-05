/**
 * The assistant screen's promises (ADR-061 slice G), asserted through the
 * data module it calls rather than a fetch mock: the wire is
 * `data/assistant.test.ts`'s job.
 *
 *   1. With the API's assistant off, it says so and offers no field.
 *   2. Signed out, it says what is kept and for how long, and an offer of human
 *      support asks for the address the reply goes to.
 *   3. Signed in with an earlier conversation on this phone, it ASKS before
 *      keeping it, and the answer is the person's own press.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import { AssistantScreen } from './assistant-screen';

const mockFetchAssistant = jest.fn();
const mockClaim = jest.fn();
jest.mock('@/data/assistant', () => ({
  fetchAssistant: (...args: unknown[]) => mockFetchAssistant(...args),
  claimAssistant: (...args: unknown[]) => mockClaim(...args),
  sendAssistantMessage: jest.fn(),
  sendAssistantEscalation: jest.fn(),
  sendAssistantFeedback: jest.fn(),
  decideAssistantProposal: jest.fn(),
}));

let mockStatus: 'authenticated' | 'anonymous' = 'anonymous';
jest.mock('@/session', () => ({
  useSession: () => ({ status: mockStatus, signIn: jest.fn(), signOut: jest.fn() }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

/** The first render in a cold Jest worker loads the whole kit; one second is not always enough. */
const FIRST_PAINT = { timeout: 10_000 };

const NOW = '2026-09-30T08:00:00.000Z';
const OFFER = {
  id: '00000000-0000-4000-8000-0000000000c1',
  surface: 'mobile',
  anonymous: true,
  turnsLeft: 39,
  expiresAt: NOW,
  messages: [
    {
      id: '00000000-0000-4000-8000-0000000000d1',
      role: 'assistant',
      text: 'I could not solve this one.',
      sources: [],
      proposals: [],
      escalation: { topic: 'account' },
      helpful: null,
      createdAt: NOW,
    },
  ],
};

beforeEach(() => {
  mockFetchAssistant.mockReset();
  mockClaim.mockReset();
});

describe('AssistantScreen', () => {
  it('says the assistant is off and offers no field', async () => {
    mockStatus = 'anonymous';
    mockFetchAssistant.mockResolvedValue({ kind: 'ok', data: { enabled: false, conversation: null, claimable: false } });
    renderInScheme(<AssistantScreen />, 'light');
    expect(await screen.findByText(en['assistant.off'], {}, FIRST_PAINT)).toBeTruthy();
    expect(screen.queryByTestId('assistant-input')).toBeNull();
  });

  it('signed out, says what is kept, and asks for a reply address before sending to support', async () => {
    mockStatus = 'anonymous';
    mockFetchAssistant.mockResolvedValue({ kind: 'ok', data: { enabled: true, conversation: OFFER, claimable: false } });
    renderInScheme(<AssistantScreen />, 'light');
    expect(await screen.findByText(en['assistant.introSignedOut'], {}, FIRST_PAINT)).toBeTruthy();
    expect(screen.getByText(en['assistant.escalateEmail'])).toBeTruthy();
    fireEvent.press(screen.getByText(en['assistant.escalate']));
    expect(await screen.findByText(en['assistant.escalateEmailInvalid'])).toBeTruthy();
  });

  it('signed in, asks before keeping an earlier conversation, and keeps it only on the press', async () => {
    mockStatus = 'authenticated';
    mockFetchAssistant.mockResolvedValue({ kind: 'ok', data: { enabled: true, conversation: null, claimable: true } });
    mockClaim.mockResolvedValue({ kind: 'ok', data: { claimed: true, conversation: { ...OFFER, anonymous: false } } });
    renderInScheme(<AssistantScreen />, 'light');
    expect(await screen.findByText(en['assistant.claimTitle'], {}, FIRST_PAINT)).toBeTruthy();
    expect(mockClaim).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText(en['assistant.claimKeep']));
    await waitFor(() => expect(mockClaim).toHaveBeenCalledWith(false));
    expect(await screen.findByText('I could not solve this one.')).toBeTruthy();
    expect(screen.queryByText(en['assistant.claimTitle'])).toBeNull();
  });
});
