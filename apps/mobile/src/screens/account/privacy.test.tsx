/**
 * The Privacy screen (ADR-063 AC-8): what the line under the switch says in
 * every state, because the two directions take effect at different times and
 * the screen is the only place a person learns which one they are in.
 *
 * The reporter is mocked: its own suite proves the switch stops Sentry. This
 * one proves the screen tells the truth about it.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import { PrivacyScreen, resetCrashReportingChoice } from './privacy';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
}));

interface MockReporter {
  possible: boolean;
  started: boolean;
  stored: 'on' | 'off';
  result: 'saved' | 'notSaved';
  setCrashReportingEnabled: jest.Mock<Promise<'saved' | 'notSaved'>, [boolean]>;
}

const mockReporter: MockReporter = {
  possible: true,
  started: true,
  stored: 'on',
  result: 'saved',
  setCrashReportingEnabled: jest.fn(async (_on: boolean): Promise<'saved' | 'notSaved'> => mockReporter.result),
};

jest.mock('@/lib/crash-reporter', () => ({
  isCrashReportingPossible: () => mockReporter.possible,
  isCrashReportingStarted: () => mockReporter.started,
  readCrashReportingChoice: () => mockReporter.stored,
  setCrashReportingEnabled: (on: boolean) => mockReporter.setCrashReportingEnabled(on),
}));

function given(state: Partial<Omit<typeof mockReporter, 'setCrashReportingEnabled'>>): void {
  Object.assign(mockReporter, { possible: true, started: true, stored: 'on', result: 'saved' }, state);
  mockReporter.setCrashReportingEnabled.mockClear();
  resetCrashReportingChoice();
}

function switchControl() {
  return screen.getByTestId('privacy-crash-switch');
}

describe('Privacy', () => {
  it('shows the switch on, with nothing more to say, while reports are running', () => {
    given({});
    renderInScheme(<PrivacyScreen />, 'light');
    expect(screen.getByText(en['privacy.crashReports'])).toBeTruthy();
    expect(screen.getByText(en['privacy.crashReportsBody'])).toBeTruthy();
    expect(screen.getByText(en['privacy.whereStored'])).toBeTruthy();
    expect(switchControl().props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.queryByTestId('privacy-effect')).toBeNull();
  });

  it('turning it off says reports have stopped, and that a saved one waits', async () => {
    given({});
    renderInScheme(<PrivacyScreen />, 'light');
    fireEvent.press(switchControl());
    await waitFor(() => expect(screen.getByText(en['privacy.offNow'])).toBeTruthy());
    expect(mockReporter.setCrashReportingEnabled).toHaveBeenCalledWith(false);
    expect(switchControl().props.accessibilityState).toMatchObject({ checked: false });
  });

  it('a failed save of off says reports stay off until the app closes', async () => {
    given({ result: 'notSaved' });
    renderInScheme(<PrivacyScreen />, 'light');
    fireEvent.press(switchControl());
    await waitFor(() => expect(screen.getByText(en['privacy.saveFailed'])).toBeTruthy());
    expect(switchControl().props.accessibilityState).toMatchObject({ checked: false });
  });

  it('opens off when off is stored, and says so', () => {
    given({ stored: 'off', started: false });
    renderInScheme(<PrivacyScreen />, 'light');
    expect(switchControl().props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByText(en['privacy.offNow'])).toBeTruthy();
  });

  it('turning it on says reports start at the next launch', async () => {
    given({ stored: 'off', started: false });
    renderInScheme(<PrivacyScreen />, 'light');
    fireEvent.press(switchControl());
    await waitFor(() => expect(screen.getByText(en['privacy.onNextLaunch'])).toBeTruthy());
    expect(mockReporter.setCrashReportingEnabled).toHaveBeenCalledWith(true);
    expect(switchControl().props.accessibilityState).toMatchObject({ checked: true });
  });

  it('a failed save of on says so, and the switch stays off', async () => {
    given({ stored: 'off', started: false, result: 'notSaved' });
    renderInScheme(<PrivacyScreen />, 'light');
    fireEvent.press(switchControl());
    await waitFor(() => expect(screen.getByText(en['privacy.saveFailedOn'])).toBeTruthy());
    expect(switchControl().props.accessibilityState).toMatchObject({ checked: false });
  });

  it('a build that cannot report says that, whatever the switch says', async () => {
    given({ possible: false, started: false });
    renderInScheme(<PrivacyScreen />, 'dark');
    expect(screen.getByText(en['privacy.notReporting'])).toBeTruthy();
    fireEvent.press(switchControl());
    await waitFor(() => expect(switchControl().props.accessibilityState).toMatchObject({ checked: false }));
    expect(screen.getByText(en['privacy.notReporting'])).toBeTruthy();
    expect(screen.queryByText(en['privacy.offNow'])).toBeNull();
  });
});
