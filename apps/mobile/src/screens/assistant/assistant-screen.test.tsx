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
 *   4. A new conversation opens with the API's greeting and starter questions;
 *      a tapped question is sent exactly as if typed, shown at once beside a
 *      typing indicator.
 *   5. After an answer, the API's follow-up questions are offered, and a
 *      place the answer cites is drawn as a card with its name, district and
 *      base nightly rate.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import { AssistantScreen } from './assistant-screen';

const mockFetchAssistant = jest.fn();
const mockClaim = jest.fn();
const mockSend = jest.fn();
jest.mock('@/data/assistant', () => ({
  fetchAssistant: (...args: unknown[]) => mockFetchAssistant(...args),
  claimAssistant: (...args: unknown[]) => mockClaim(...args),
  sendAssistantMessage: (...args: unknown[]) => mockSend(...args),
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
const GREETING = 'Hi, I am the Injishi assistant. Ask me about stays, prices or bookings.';
const STARTERS = [
  { label: 'Book a stay', message: 'How do I book a stay?' },
  { label: 'Getting paid', message: 'When do hosts get paid?' },
];
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
  suggestions: [],
};

/** An answer that cites one place with card details, and offers two follow-ups. */
const ANSWERED = {
  ...OFFER,
  messages: [
    {
      id: '00000000-0000-4000-8000-0000000000d2',
      role: 'user',
      text: 'How do I book a stay?',
      sources: [],
      proposals: [],
      escalation: null,
      helpful: null,
      createdAt: NOW,
    },
    {
      id: '00000000-0000-4000-8000-0000000000d3',
      role: 'assistant',
      text: 'Pick a place and your dates. Twin Lakes Guesthouse is one option.',
      sources: [
        {
          kind: 'listing',
          id: '00000000-0000-4000-8000-0000000000e1',
          title: 'Twin Lakes Guesthouse',
          href: '/property/twin-lakes-guesthouse',
          listing: {
            district: 'Musanze',
            fromNightlyRateRwf: 45000,
            maxGuests: 4,
            roomTypes: 2,
            photoUrl: null,
          },
        },
        { kind: 'article', id: 'booking-basics', title: 'Booking basics', href: '/help/booking-basics' },
      ],
      proposals: [],
      escalation: null,
      helpful: null,
      createdAt: NOW,
    },
  ],
  suggestions: [
    { label: 'Cancelling', message: 'How do I cancel a booking?' },
    { label: 'Paying', message: 'How can I pay for a stay?' },
  ],
};

function current(conversation: unknown, extra: Record<string, unknown> = {}) {
  return {
    kind: 'ok',
    data: { enabled: true, conversation, claimable: false, greeting: GREETING, suggestions: STARTERS, ...extra },
  };
}

beforeEach(() => {
  mockFetchAssistant.mockReset();
  mockClaim.mockReset();
  mockSend.mockReset();
});

describe('AssistantScreen', () => {
  it('says the assistant is off and offers no field', async () => {
    mockStatus = 'anonymous';
    mockFetchAssistant.mockResolvedValue(current(null, { enabled: false, suggestions: [] }));
    renderInScheme(<AssistantScreen />, 'light');
    expect(await screen.findByText(en['assistant.off'], {}, FIRST_PAINT)).toBeTruthy();
    expect(screen.queryByTestId('assistant-input')).toBeNull();
  });

  it('signed out, says what is kept, and asks for a reply address before sending to support', async () => {
    mockStatus = 'anonymous';
    mockFetchAssistant.mockResolvedValue(current(OFFER));
    renderInScheme(<AssistantScreen />, 'light');
    expect(await screen.findByText(en['assistant.introSignedOut'], {}, FIRST_PAINT)).toBeTruthy();
    expect(screen.getByText(en['assistant.escalateEmail'])).toBeTruthy();
    fireEvent.press(screen.getByText(en['assistant.escalate']));
    expect(await screen.findByText(en['assistant.escalateEmailInvalid'])).toBeTruthy();
  });

  it('signed in, asks before keeping an earlier conversation, and keeps it only on the press', async () => {
    mockStatus = 'authenticated';
    mockFetchAssistant.mockResolvedValue(current(null, { claimable: true }));
    mockClaim.mockResolvedValue({ kind: 'ok', data: { claimed: true, conversation: { ...OFFER, anonymous: false } } });
    renderInScheme(<AssistantScreen />, 'light');
    expect(await screen.findByText(en['assistant.claimTitle'], {}, FIRST_PAINT)).toBeTruthy();
    expect(mockClaim).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText(en['assistant.claimKeep']));
    await waitFor(() => expect(mockClaim).toHaveBeenCalledWith(false));
    expect(await screen.findByText('I could not solve this one.')).toBeTruthy();
    expect(screen.queryByText(en['assistant.claimTitle'])).toBeNull();
  });

  it('with no conversation, shows the greeting and the starter questions as buttons', async () => {
    mockStatus = 'anonymous';
    mockFetchAssistant.mockResolvedValue(current(null));
    renderInScheme(<AssistantScreen />, 'light');
    expect(await screen.findByText(GREETING, {}, FIRST_PAINT)).toBeTruthy();
    for (const s of STARTERS) {
      expect(screen.getByText(s.label)).toBeTruthy();
      // The reader hears the whole question, not the short chip label.
      expect(screen.getByRole('button', { name: s.message })).toBeTruthy();
    }
  });

  it('sends a tapped starter exactly as typed, showing it at once beside the typing indicator', async () => {
    mockStatus = 'anonymous';
    mockFetchAssistant.mockResolvedValue(current(null));
    let answer: (value: unknown) => void = () => {};
    mockSend.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderInScheme(<AssistantScreen />, 'light');
    fireEvent.press(await screen.findByRole('button', { name: STARTERS[0].message }, FIRST_PAINT));

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({ message: STARTERS[0].message });
    expect(await screen.findByText(STARTERS[0].message)).toBeTruthy();
    expect(screen.getByLabelText('Finding a verified answer')).toBeTruthy();

    await act(async () => {
      answer({ kind: 'ok', data: { conversation: ANSWERED, anonToken: null } });
    });
    expect(await screen.findByText(ANSWERED.messages[1].text)).toBeTruthy();
    expect(screen.queryByLabelText('Finding a verified answer')).toBeNull();
  });

  it('after an answer, offers the follow-up questions and draws a cited place as a card', async () => {
    mockStatus = 'anonymous';
    mockFetchAssistant.mockResolvedValue(current(ANSWERED));
    renderInScheme(<AssistantScreen />, 'light');
    expect(await screen.findByText(ANSWERED.messages[1].text, {}, FIRST_PAINT)).toBeTruthy();

    for (const s of ANSWERED.suggestions) {
      expect(screen.getByRole('button', { name: s.message })).toBeTruthy();
    }
    // The starters are for an empty conversation only.
    expect(screen.queryByText(GREETING)).toBeNull();
    expect(screen.queryByRole('button', { name: STARTERS[0].message })).toBeNull();

    expect(screen.getByText('Twin Lakes Guesthouse')).toBeTruthy();
    expect(screen.getByText('Musanze')).toBeTruthy();
    expect(screen.getByText('from RWF 45,000 / night')).toBeTruthy();
    expect(screen.getByText('Sleeps 4')).toBeTruthy();
    expect(screen.getByText('2 room types')).toBeTruthy();
    // A source without card details stays a small label.
    expect(screen.getByText('Booking basics')).toBeTruthy();

    mockSend.mockReturnValue(new Promise(() => {}));
    fireEvent.press(screen.getByRole('button', { name: ANSWERED.suggestions[0].message }));
    expect(mockSend).toHaveBeenCalledWith({ message: ANSWERED.suggestions[0].message });
  });
});
