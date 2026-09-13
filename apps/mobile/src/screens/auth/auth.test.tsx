/**
 * The three auth screens, in both schemes and through their real states.
 *
 * `expo export` proves these BUNDLE; a screen that throws on render bundles
 * perfectly. What is asserted here is the behaviour a reviewer would otherwise
 * have to walk on a device: that Continue stays off until the address could
 * actually be one, that the error waits for blur, that six digits submit
 * themselves, that a wrong code is refused without signing anyone in, and that
 * activating lands on the lease sign screen with the Tenant surface active.
 *
 * ## What ADR-038 child 1b changed here
 *
 * Eleven tests asserted a digit ladder and the Rwandan network prefix rule.
 * Those behaviours are gone with the phone field, so the tests went with them
 * rather than being migrated into assertions about a shape they no longer
 * describe. `phone.test.ts` is untouched and still passes, because `pay-rent`
 * and Account still use `phone.ts`.
 *
 * The failure branches are new. The prototype's tests never had them, because
 * the prototype had no server to fail: a wrong code, a resend the server
 * refuses as too quick, and a send that cannot reach Injishi at all are three
 * different answers and the screen has to tell them apart.
 *
 * The router is mocked to a recorder. What matters about a navigation here is
 * where it was aimed, and mounting a real navigator would make this a test of
 * Expo Router. `src/lib/auth.ts` is mocked for the same reason: it is proved
 * against a real API by the seam's own device walkthrough, and what these
 * assert is how the SCREEN reacts to each of its four answers.
 */
import { type ReactElement } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en, rw, type Locale } from '@/i18n/messages';
import { SessionProvider, useSession, type ResolvedSession } from '@/session';
import { DomainProvider, useDomain } from '@/domain';
import { Text, ToastProvider } from '@/components';
import type { ColorScheme } from '@/theme/palette';
import type { DemoPersona } from '@/queries/demo';
import { SignInScreen } from './sign-in';
import { VerifyOtpScreen } from './verify-otp';
import { ActivateScreen } from './activate';
import { INVITE, invitedLease } from './invite';
import { DEMO_CODE, RESEND_SECONDS } from './otp';

/** `mock`-prefixed so the names may cross `jest.mock`'s hoist. */
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

const mockRequestSignInCode = jest.fn();
const mockVerifySignInCode = jest.fn();

jest.mock('@/lib/auth', () => ({
  requestSignInCode: (...args: unknown[]) => mockRequestSignInCode(...args),
  verifySignInCode: (...args: unknown[]) => mockVerifySignInCode(...args),
  // `session.tsx` imports these two from the same module.
  readStoredToken: jest.fn(async () => null),
  signOut: jest.fn(async () => ({ serverConfirmed: false })),
}));

/**
 * The demo host signal.
 *
 * Off by default, which is production and is the state every test here wants
 * except the two that are about the demo. Mocked rather than driven through
 * `fetch` because what is being asserted is the SCREEN's two branches, not the
 * query's, and `demo.ts` has its own reasons for each of its outcomes.
 */
let mockDemo: { personas: unknown; isDemoHost: boolean } = {
  personas: null,
  isDemoHost: false,
};

jest.mock('@/queries/demo', () => ({
  useDemoPersonas: () => mockDemo,
}));

/** Reads back what the shell would have branched on after a hand-off. */
function Probe() {
  const { status } = useSession();
  const { surface } = useDomain();
  return <Text testID="probe">{`${status}/${surface}`}</Text>;
}

function renderAuth(
  node: ReactElement,
  scheme: ColorScheme,
  { session = 'anonymous' as ResolvedSession, locale }: { session?: ResolvedSession; locale?: Locale } = {},
) {
  return renderInScheme(
    <SessionProvider initial={session}>
      <DomainProvider initial="residence">
        <ToastProvider>
          {node}
          <Probe />
        </ToastProvider>
      </DomainProvider>
    </SessionProvider>,
    scheme,
    { locale },
  );
}

/** The label a `Button` announces itself by is its own text. */
const button = (label: string) => screen.getByLabelText(label);
const isDisabled = (label: string) =>
  button(label).props.accessibilityState?.disabled === true;

const ADDRESS = 'samuel@kayitare.rw';

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockDemo = { personas: null, isDemoHost: false };
  mockRequestSignInCode.mockResolvedValue({ status: 'ok' });
  mockVerifySignInCode.mockResolvedValue({ status: 'ok' });
});

/* ------------------------------------------------------------- X1 sign in */

describe.each(SCHEMES)('sign in, frame X1, %s scheme', (scheme) => {
  it('draws the two-line display title, the field and both routes in', () => {
    renderAuth(<SignInScreen />, scheme);

    expect(
      screen.getByText(`${en['auth.signInTitleA']}\n${en['auth.signInTitleB']}`),
    ).toBeTruthy();
    expect(screen.getByText(en['auth.emailLabel'])).toBeTruthy();
    // No prefix segment any more, so the field announces its label alone.
    expect(screen.getByTestId('email-field').props.accessibilityLabel).toBe(
      en['auth.emailLabel'],
    );
    expect(screen.getByText(en['auth.emailFootnote'])).toBeTruthy();
    expect(screen.getByText(en['auth.or'])).toBeTruthy();
    expect(button(en['auth.google'])).toBeTruthy();
    expect(screen.getByText(en['auth.noDocuments'])).toBeTruthy();
  });

  it('opens idle: the hint, and Continue off', () => {
    renderAuth(<SignInScreen />, scheme);

    expect(screen.getByText(en['auth.emailHint'])).toBeTruthy();
    expect(isDisabled(en['auth.continue'])).toBe(true);
  });
});

describe('sign in, the email field', () => {
  const scheme: ColorScheme = 'light';

  it('opens the email keyboard and refuses to capitalise or correct (AC-E1)', () => {
    renderAuth(<SignInScreen />, scheme);
    const field = screen.getByTestId('email-field');

    // Autocorrect is the quiet one: it changes the address without the person
    // seeing it happen, and the result is a code sent nowhere.
    expect(field.props.keyboardType).toBe('email-address');
    expect(field.props.autoCapitalize).toBe('none');
    expect(field.props.autoCorrect).toBe(false);
    expect(field.props.textContentType).toBe('emailAddress');
    expect(field.props.autoComplete).toBe('email');
  });

  it('is empty on every launch, because nothing is remembered (AC-E10)', () => {
    renderAuth(<SignInScreen />, scheme);
    expect(screen.getByTestId('email-field').props.value).toBe('');
  });

  it('typing: keeps the neutral hint and Continue off (AC-E2)', () => {
    renderAuth(<SignInScreen />, scheme);
    fireEvent.changeText(screen.getByTestId('email-field'), 'sam');

    expect(screen.getByText(en['auth.emailHint'])).toBeTruthy();
    expect(screen.queryByText(en['auth.emailError'])).toBeNull();
    expect(isDisabled(en['auth.continue'])).toBe(true);
  });

  it('plausible: says "Looks right" and turns Continue on', () => {
    renderAuth(<SignInScreen />, scheme);
    fireEvent.changeText(screen.getByTestId('email-field'), ADDRESS);

    expect(screen.getByText(en['auth.emailHintOk'])).toBeTruthy();
    expect(isDisabled(en['auth.continue'])).toBe(false);
  });

  it('never shows the error while typing, only after blur (AC-E2)', () => {
    renderAuth(<SignInScreen />, scheme);
    const field = screen.getByTestId('email-field');

    // An address is invalid for almost all of the time it takes to type one.
    // A field that says so at every keystroke has shouted nine times and told
    // the person nothing.
    fireEvent.changeText(field, 'rayan@@example');
    expect(screen.queryByText(en['auth.emailError'])).toBeNull();

    fireEvent(field, 'blur');
    expect(screen.getByText(en['auth.emailError'])).toBeTruthy();
    expect(isDisabled(en['auth.continue'])).toBe(true);
  });

  it('the next keystroke clears the error (AC-E2)', () => {
    renderAuth(<SignInScreen />, scheme);
    const field = screen.getByTestId('email-field');

    fireEvent.changeText(field, 'rayan@@example');
    fireEvent(field, 'blur');
    expect(screen.getByText(en['auth.emailError'])).toBeTruthy();

    fireEvent.changeText(field, 'rayan@example.rw');
    expect(screen.queryByText(en['auth.emailError'])).toBeNull();
  });

  it('blurring an EMPTY field returns to idle, never to error (AC-E2)', () => {
    renderAuth(<SignInScreen />, scheme);
    const field = screen.getByTestId('email-field');

    // Somebody who tapped the field and changed their mind has done nothing
    // wrong, and a red field is not the thing to leave them looking at.
    fireEvent(field, 'blur');

    expect(screen.queryByText(en['auth.emailError'])).toBeNull();
    expect(screen.getByText(en['auth.emailHint'])).toBeTruthy();
  });

  it('carries the address to verify trimmed but NOT lowercased (AC-E4, AC-E5)', async () => {
    renderAuth(<SignInScreen />, scheme);
    fireEvent.changeText(screen.getByTestId('email-field'), '  Rayan@Demo.Injishi.COM ');
    fireEvent.press(button(en['auth.continue']));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    // Verify has to print back what the person actually typed, so the typo
    // stays visible to them. `requestSignInCode()` is what lowercases the
    // value on the wire, and `lower(email)` uniqueness is what guarantees the
    // two spellings reach one account.
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(auth)/verify-otp',
      params: { email: 'Rayan@Demo.Injishi.COM' },
    });
    expect(mockRequestSignInCode).toHaveBeenCalledWith('  Rayan@Demo.Injishi.COM ');
  });

  it('behaves identically for an address the system has never seen (AC-E3)', async () => {
    renderAuth(<SignInScreen />, scheme);
    fireEvent.changeText(screen.getByTestId('email-field'), 'nobody-has-this@example.rw');
    fireEvent.press(button(en['auth.continue']));

    // No "no such account" answer exists to leak, because a first verified
    // sign-in creates the user (F-S01, and `disableSignUp` is unset on
    // `emailOTP`). The screen must never grow one.
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(auth)/verify-otp',
        params: { email: 'nobody-has-this@example.rw' },
      }),
    );
    expect(screen.queryByText(en['auth.sendFailedTitle'])).toBeNull();
  });

  it('says out loud that Google is drawn and not wired', () => {
    renderAuth(<SignInScreen />, 'light');
    fireEvent.press(button(en['auth.google']));

    // And no longer claims the prototype signs in by phone (AC-E9).
    expect(screen.getByText(en['auth.googleNotWired'])).toBeTruthy();
    expect(en['auth.googleNotWired']).not.toMatch(/phone/i);
  });
});

describe('sign in, when the send does not work (AC-E13)', () => {
  const scheme: ColorScheme = 'light';

  const send = () => {
    fireEvent.changeText(screen.getByTestId('email-field'), ADDRESS);
    fireEvent.press(button(en['auth.continue']));
  };

  it('shows the server’s own message for a refusal it has no words for', async () => {
    mockRequestSignInCode.mockResolvedValue({
      status: 'refused',
      message: 'That address is blocked.',
    });
    renderAuth(<SignInScreen />, scheme);
    send();

    expect(await screen.findByText('That address is blocked.')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows the app’s own words for a too-fast resend, not the server’s English', async () => {
    mockRequestSignInCode.mockResolvedValue({
      status: 'refused',
      message: 'Too many requests. Please try again later.',
    });
    renderAuth(<SignInScreen />, scheme);
    send();

    // The one case where AC-S8's "show the server's own message" has to yield:
    // an English sentence from Better Auth dropped into a translated screen is
    // a broken screen.
    expect(await screen.findByText(en['auth.resendTooSoon'])).toBeTruthy();
    expect(screen.queryByText('Too many requests. Please try again later.')).toBeNull();
  });

  it('says it could not reach Injishi, and does not navigate', async () => {
    mockRequestSignInCode.mockResolvedValue({ status: 'failed' });
    renderAuth(<SignInScreen />, scheme);
    send();

    expect(await screen.findByText(en['auth.sendFailedBody'])).toBeTruthy();
    expect(screen.getByText(en['auth.sendFailedTitle'])).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('sign in, the demo persona picker (AC-S10)', () => {
  const scheme: ColorScheme = 'light';

  const PERSONAS = [
    {
      email: 'josephine@demo.injishi.com',
      name: 'Josephine Uwimana',
      seats: [{ label: 'Kayitare Court', surface: 'landlord', role: 'Owner', roleKey: 'owner', detail: null }],
    },
    {
      email: 'samuel@demo.injishi.com',
      name: 'Samuel Kayitare',
      seats: [
        { label: 'Personal', surface: 'personal', role: 'Guest / tenant', roleKey: 'personal', detail: null },
        { label: 'Kayitare Court', surface: 'landlord', role: 'Owner', roleKey: 'owner', detail: null },
        { label: 'Aline K. Brokerage', surface: 'broker', role: 'Broker', roleKey: 'broker', detail: null },
        { label: 'Kivu Crest Hotel', surface: 'work', role: 'Housekeeper', roleKey: 'housekeeper', detail: null },
        { label: 'Umurage Guesthouse', surface: 'host', role: 'Owner', roleKey: 'owner', detail: null },
      ],
    },
    {
      email: 'claudine@demo.injishi.com',
      name: 'Claudine Mukamana',
      // A government officer holds no workspace; the oversight seat is what
      // puts her on the roster at all.
      seats: [
        { label: 'MINALOC · Gasabo district', surface: 'oversight', role: 'Approver', roleKey: 'business_approver', detail: 'BDO' },
      ],
    },
  ] satisfies DemoPersona[];

  it('is ABSENT on a non-demo host, not hidden', () => {
    renderAuth(<SignInScreen />, scheme);

    expect(screen.queryByText(en['auth.demoPersonasTitle'])).toBeNull();
    expect(screen.queryByText('Samuel Kayitare')).toBeNull();
    // And the footnote makes no claim about a published code.
    expect(screen.getByText(en['auth.emailFootnote'])).toBeTruthy();
  });

  it('lists every persona, and names the published code in the footnote', () => {
    mockDemo = { personas: PERSONAS, isDemoHost: true };
    renderAuth(<SignInScreen />, scheme);

    expect(screen.getByText(en['auth.demoPersonasTitle'])).toBeTruthy();
    expect(screen.getByText('Josephine Uwimana')).toBeTruthy();
    expect(screen.getByText('Samuel Kayitare')).toBeTruthy();
    expect(
      screen.getByText(en['auth.emailFootnoteDemo'].replace('{code}', DEMO_CODE)),
    ).toBeTruthy();
  });

  it('lists a multi-seat persona’s seats rather than flattening them to one', () => {
    mockDemo = { personas: PERSONAS, isDemoHost: true };
    renderAuth(<SignInScreen />, scheme);

    // Samuel holds five and is exactly the persona a presenter reaches for to
    // show the switcher. Reducing him to one role would misrepresent the
    // account the picker most needs to get right.
    expect(
      screen.getByText(
        `${en['auth.demoPersonaSeats'].replace('{count}', '5')} · Guest / tenant, Personal · Owner, Kayitare Court · Broker, Aline K. Brokerage · Housekeeper, Kivu Crest Hotel · Owner, Umurage Guesthouse`,
      ),
    ).toBeTruthy();
  });

  it('names the role in each seat, and lists a government officer', () => {
    mockDemo = { personas: PERSONAS, isDemoHost: true };
    renderAuth(<SignInScreen />, scheme);

    expect(screen.getByText('Owner, Kayitare Court')).toBeTruthy();
    expect(screen.getByText('Claudine Mukamana')).toBeTruthy();
    expect(screen.getByText('Approver, MINALOC · Gasabo district')).toBeTruthy();
  });

  it('fills the address, so Continue is the second tap', () => {
    mockDemo = { personas: PERSONAS, isDemoHost: true };
    renderAuth(<SignInScreen />, scheme);

    fireEvent.press(screen.getByLabelText('Samuel Kayitare, samuel@demo.injishi.com'));

    expect(screen.getByTestId('email-field').props.value).toBe('samuel@demo.injishi.com');
    expect(isDisabled(en['auth.continue'])).toBe(false);
  });
});

/* --------------------------------------------------------- X2 verify code */

describe.each(SCHEMES)('verify code, frame X2, %s scheme', (scheme) => {
  it('names the address the code went to, unmasked and as typed (AC-E5)', () => {
    mockParams = { email: 'Rayan@Demo.Injishi.COM' };
    renderAuth(<VerifyOtpScreen />, scheme);

    // Unmasked on purpose. The person typed it ten seconds ago: masking their
    // own input hides nothing from an attacker and hides the typo from them.
    expect(
      screen.getByText(en['auth.verifyBody'].replace('{email}', 'Rayan@Demo.Injishi.COM')),
    ).toBeTruthy();
    expect(screen.getByText(en['auth.rateLimit'])).toBeTruthy();
  });
});

describe('verify code, the states', () => {
  const scheme: ColorScheme = 'light';

  beforeEach(() => {
    mockParams = { email: ADDRESS };
  });

  it('auto-submits at six digits and shows that it is verifying', () => {
    renderAuth(<VerifyOtpScreen />, scheme);
    fireEvent.changeText(screen.getByTestId('code-field'), '123456');

    expect(screen.getByText(en['auth.verifying'])).toBeTruthy();
    expect(mockVerifySignInCode).toHaveBeenCalledWith(ADDRESS, '123456');
  });

  it('takes a pasted six-digit string as the whole code', async () => {
    renderAuth(<VerifyOtpScreen />, scheme);
    // One event carrying all six, which is what a paste and an autofill both
    // deliver. Six separate fields would keep the first digit only.
    fireEvent.changeText(screen.getByTestId('code-field'), '123456');

    await waitFor(() =>
      expect(screen.getByTestId('probe').props.children).toBe('authenticated/tenant'),
    );
  });

  it('takes the code out of the sentence an email arrives as', async () => {
    renderAuth(<VerifyOtpScreen />, scheme);
    const field = screen.getByTestId('code-field');

    // A `maxLength` of six would truncate this to "Your I" before the
    // sanitiser ever saw a digit.
    expect(field.props.maxLength).toBeUndefined();
    fireEvent.changeText(field, 'Your Injishi code is 123456');

    await waitFor(() =>
      expect(screen.getByTestId('probe').props.children).toBe('authenticated/tenant'),
    );
  });

  it('signs in and goes to the shell on the right code', async () => {
    renderAuth(<VerifyOtpScreen />, scheme);
    fireEvent.changeText(screen.getByTestId('code-field'), '123456');

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
  });

  it('refuses a wrong code, in words, and signs nobody in (AC-E13)', async () => {
    mockVerifySignInCode.mockResolvedValue({
      status: 'refused',
      message: 'Invalid OTP',
    });
    renderAuth(<VerifyOtpScreen />, scheme);
    fireEvent.changeText(screen.getByTestId('code-field'), '654321');

    // Better Auth answers 401 for a wrong code AND an expired one and they
    // cannot be told apart, so the app's own sentence covers both.
    expect(await screen.findByText(en['auth.codeWrong'])).toBeTruthy();
    expect(screen.getByTestId('probe').props.children).toBe('anonymous/tenant');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('says it could not reach Injishi rather than calling the code wrong', async () => {
    mockVerifySignInCode.mockResolvedValue({ status: 'failed' });
    renderAuth(<VerifyOtpScreen />, scheme);
    fireEvent.changeText(screen.getByTestId('code-field'), '123456');

    // The code may be perfectly good. Telling somebody it is wrong when the
    // network failed sends them to check their email for no reason.
    expect(await screen.findByText(en['auth.sendFailedBody'])).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('lets the reader try again after a refusal, without retyping the address', async () => {
    mockVerifySignInCode.mockResolvedValue({ status: 'refused', message: 'Invalid OTP' });
    renderAuth(<VerifyOtpScreen />, scheme);
    const field = screen.getByTestId('code-field');

    fireEvent.changeText(field, '654321');
    expect(await screen.findByText(en['auth.codeWrong'])).toBeTruthy();

    // Editing clears the refusal rather than leaving it under a fresh entry.
    fireEvent.changeText(field, '1');
    expect(screen.queryByText(en['auth.codeWrong'])).toBeNull();
    // The address is still the one from the route param; nothing to retype.
    expect(
      screen.getByText(en['auth.verifyBody'].replace('{email}', ADDRESS)),
    ).toBeTruthy();
  });

  it('counts down before it offers a resend', () => {
    jest.useFakeTimers();
    try {
      renderAuth(<VerifyOtpScreen />, scheme);

      expect(screen.queryByLabelText(en['auth.resend'])).toBeNull();

      act(() => {
        jest.advanceTimersByTime(RESEND_SECONDS * 1000 + 1000);
      });

      expect(screen.getByLabelText(en['auth.resend'])).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('a refused resend shows the app’s words and does not restart the countdown (AC-E6)', async () => {
    mockRequestSignInCode.mockResolvedValue({
      status: 'refused',
      message: 'Too many requests. Please try again later.',
    });
    // Fake timers to reach the resend control, real ones to await the call.
    // The countdown is wall-clock, and waiting it out would put RESEND_SECONDS
    // of real time into the suite for no extra coverage.
    jest.useFakeTimers();
    try {
      renderAuth(<VerifyOtpScreen />, scheme);
      act(() => {
        jest.advanceTimersByTime(RESEND_SECONDS * 1000 + 1000);
      });
    } finally {
      jest.useRealTimers();
    }

    fireEvent.press(screen.getByLabelText(en['auth.resend']));

    expect(await screen.findByText(en['auth.resendTooSoon'])).toBeTruthy();
    // Still offered, because locking the only action on the screen behind a
    // countdown that was never earned would strand the person.
    expect(screen.getByLabelText(en['auth.resend'])).toBeTruthy();
  });

  it('prints the demo code only where the API says this is a demo (AC-E14)', () => {
    renderAuth(<VerifyOtpScreen />, scheme);
    // Production: no code printed. It used to be printed unconditionally,
    // which on a real host is a screen naming a code that will not work.
    expect(
      screen.queryByText(en['auth.demoCode'].replace('{code}', DEMO_CODE)),
    ).toBeNull();
  });

  it('sends a deep link with no address back to the screen that collects one', () => {
    mockParams = {};
    renderAuth(<VerifyOtpScreen />, scheme);

    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
  });

  it('lets an implausible address through, because the server is the authority', () => {
    mockParams = { email: 'not-an-address' };
    renderAuth(<VerifyOtpScreen />, scheme);

    // Refusing it here would be the client deciding something only sending to
    // the address can settle.
    expect(mockReplace).not.toHaveBeenCalledWith('/(auth)/sign-in');
    expect(
      screen.getByText(en['auth.verifyBody'].replace('{email}', 'not-an-address')),
    ).toBeTruthy();
  });
});

/* ------------------------------------------------------------ X3 activate */

describe.each(SCHEMES)('activate, frame X3, %s scheme', (scheme) => {
  it('draws the invitation off the lease it points at', () => {
    const lease = invitedLease();
    expect(lease).toBeDefined();

    renderAuth(<ActivateScreen />, scheme);

    expect(screen.getByText(en['auth.activateTitle'])).toBeTruthy();
    expect(
      screen.getByText(
        en['auth.activateBody'].replace('{org}', lease?.landlordOrg ?? ''),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        en['auth.unitLine']
          .replace('{unit}', lease?.unit ?? '')
          .replace('{org}', lease?.landlordOrg ?? ''),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(en['auth.termMonths'].replace('{count}', String(INVITE.termMonths))),
    ).toBeTruthy();
    expect(screen.getByText(en['auth.activateFootnote'])).toBeTruthy();
  });
});

describe('activate, the hand-off', () => {
  const scheme: ColorScheme = 'light';

  it('prefills the signed-in person and fixes the EMAIL from the invite (AC-E8)', () => {
    renderAuth(<ActivateScreen />, scheme);

    expect(screen.getByTestId('name-field').props.value).toBe(INVITE.invitedName);
    // `lease_invitations.email` is the column the table actually carries. It
    // has no phone column at all, and the screen used to show one.
    const invited = screen.getByTestId('invite-email-field');
    expect(invited.props.value).toBe(INVITE.invitedEmail);
    expect(invited.props.editable).toBe(false);
  });

  it('prints the consequence under the button rather than after it', () => {
    renderAuth(<ActivateScreen />, scheme);
    expect(screen.getByText(en['auth.activateConsequence'])).toBeTruthy();
  });

  it('refuses to activate a lease with no name on it', () => {
    renderAuth(<ActivateScreen />, scheme);
    fireEvent.changeText(screen.getByTestId('name-field'), '');

    expect(screen.getByText(en['auth.nameError'])).toBeTruthy();
    expect(isDisabled(en['auth.activateAction'])).toBe(true);
  });

  it('lands on the lease sign screen, signed in, on the Tenant surface', () => {
    jest.useFakeTimers();
    try {
      renderAuth(<ActivateScreen />, scheme);
      fireEvent.press(button(en['auth.activateAction']));

      expect(button(en['auth.activating'])).toBeTruthy();

      act(() => {
        jest.runAllTimers();
      });

      expect(screen.getByTestId('probe').props.children).toBe('authenticated/tenant');
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/lease/[leaseId]/sign',
        params: { leaseId: INVITE.leaseId },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('offers a way out for someone the invite is not for', () => {
    renderAuth(<ActivateScreen />, scheme);
    fireEvent.press(button(en['auth.notYou']));

    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
  });
});

/* ---------------------------------------------------------------- bilingual */

/**
 * The Kinyarwanda pass, which checks the LAYOUT and not the wording.
 *
 * The `rw` entries for this child are placeholders that keep the record
 * complete and the build compiling; Kinyarwanda is not in v1.0
 * (`mobile-v1/gaps.md` X6), so nothing here is translated or reviewed. What
 * this catches is the two failures that look identical to a reviewer scrolling
 * past: a key present in one catalogue only, and a string hardcoded in English.
 *
 * It cannot prove a line does not clip — that needs the device walkthrough.
 */
describe('in Kinyarwanda', () => {
  it('draws sign in from the RW catalogue', () => {
    renderAuth(<SignInScreen />, 'dark', { locale: 'rw' });

    expect(
      screen.getByText(`${rw['auth.signInTitleA']}\n${rw['auth.signInTitleB']}`),
    ).toBeTruthy();
    expect(screen.getByText(rw['auth.emailLabel'])).toBeTruthy();
    expect(button(rw['auth.continue'])).toBeTruthy();
    expect(button(rw['auth.google'])).toBeTruthy();
  });

  it('draws verify code from the RW catalogue', () => {
    mockParams = { email: ADDRESS };
    renderAuth(<VerifyOtpScreen />, 'dark', { locale: 'rw' });

    expect(screen.getByText(rw['auth.verifyTitle'])).toBeTruthy();
    expect(screen.getByText(rw['auth.codeHint'])).toBeTruthy();
  });

  it('draws activate from the RW catalogue', () => {
    renderAuth(<ActivateScreen />, 'dark', { locale: 'rw' });

    expect(screen.getByText(rw['auth.activateTitle'])).toBeTruthy();
    expect(button(rw['auth.activateAction'])).toBeTruthy();
  });
});
