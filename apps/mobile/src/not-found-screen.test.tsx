/**
 * The 404: plain words, and a way home a screen reader can reach.
 *
 * It had no test of its own (gaps.md §0.1), and its copy said the screen "may
 * never have shipped", a sentence about the prototype rather than to the
 * reader (mobile audit 2026-10-05, SA-31). The action matters as much as the
 * words: `EmptyState` used to fold its action into one accessible card, which
 * hid "Go to the start" from VoiceOver (XC-02).
 */
import { fireEvent, screen } from '@testing-library/react-native';
import { en } from '@/i18n/messages';
import { renderInScheme } from '@/test-utils';
import NotFoundScreen from '../app/+not-found';

const mockReplace = jest.fn();

jest.mock('expo-router', () => {
  const Stack = () => null;
  Stack.Screen = () => null;
  return {
    Stack,
    useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  };
});

beforeEach(() => mockReplace.mockClear());

describe('the 404', () => {
  it('says what happened in the reader’s words', () => {
    renderInScheme(<NotFoundScreen />, 'light');

    expect(screen.getByText(en['state.notFoundTitle'])).toBeTruthy();
    expect(screen.getByText(en['state.notFoundBody'])).toBeTruthy();
    expect(en['state.notFoundBody']).not.toMatch(/shipped|prototype|build/i);
  });

  it('offers the way home as a control of its own, outside the summary', () => {
    renderInScheme(<NotFoundScreen />, 'dark');

    const home = screen.getByRole('button', { name: en['state.notFoundAction'] });
    // Not inside the accessible summary, or iOS would fold it into one stop.
    expect(screen.getByRole('summary').findAll((n) => n === home)).toHaveLength(0);

    fireEvent.press(home);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
