/**
 * EmptyState and ErrorState — the two things a list says when it has no rows.
 *
 * They are tested in one file because the point is that they are *different*.
 * `ui-screens.md` §6 rules out the misleading zero: rendering "nothing yet"
 * over a read that failed tells the reader their data is gone when it is only
 * unreachable. The roles are what carry that difference to a screen reader —
 * `summary` for a state of the world, `alert` for something that went wrong —
 * so the roles are the assertion, not a styling detail.
 */
import { fireEvent, screen } from '@testing-library/react-native';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { Button } from './button';
import { SCHEMES, enclosingFill, paletteFor, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';

describe.each(SCHEMES)('EmptyState in the %s scheme', (scheme) => {
  const c = paletteFor(scheme);

  it('is one summary node carrying both the title and the body', () => {
    // A reader should hear why the list is empty in one announcement, not as
    // two unrelated fragments.
    renderInScheme(
      <EmptyState title="No stays match that filter" body="Widen it and try again." />,
      scheme,
    );
    expect(
      screen.getByRole('summary', {
        name: 'No stays match that filter. Widen it and try again.',
      }),
    ).toBeTruthy();
  });

  it('never renders as an alert, because an empty list is not a failure', () => {
    renderInScheme(<EmptyState title="No trips yet" body="Book one and it lands here." />, scheme);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('carries the direction out, when there is something the reader can do', () => {
    const onPress = jest.fn();
    renderInScheme(
      <EmptyState
        title="No stays match that filter"
        body="Widen it and try again."
        action={<Button onPress={onPress}>Clear filters</Button>}
      />,
      scheme,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('sits on the surface colour rather than on the app ground', () => {
    renderInScheme(<EmptyState title="Nothing here" body="Yet." />, scheme);
    expect(enclosingFill(screen.getByText('Nothing here'))).toBe(c.surface1);
  });
});

describe.each(SCHEMES)('ErrorState in the %s scheme', (scheme) => {
  it('is an alert, so a failed read is announced as one', () => {
    renderInScheme(<ErrorState title="That did not load" body="Worth another try." />, scheme);
    expect(
      screen.getByRole('alert', { name: 'That did not load. Worth another try.' }),
    ).toBeTruthy();
  });

  it('never renders as a summary, because an unreachable list is not an empty one', () => {
    renderInScheme(<ErrorState title="That did not load" body="Worth another try." />, scheme);
    expect(screen.queryByRole('summary')).toBeNull();
  });

  it('offers the retry, and calls back when it is pressed', () => {
    const onRetry = jest.fn();
    renderInScheme(
      <ErrorState title="That did not load" body="Worth another try." onRetry={onRetry} />,
      scheme,
    );

    fireEvent.press(screen.getByRole('button', { name: en['state.retry'] }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('offers no retry when the caller has nothing to retry with', () => {
    renderInScheme(<ErrorState title="That did not load" body="Worth another try." />, scheme);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the exception underneath the readable message, never instead of it', () => {
    renderInScheme(
      <ErrorState
        title="That did not load"
        body="Worth another try."
        detail="TypeError: undefined is not an object"
      />,
      scheme,
    );

    expect(screen.getByText('Worth another try.')).toBeTruthy();
    expect(screen.getByText('TypeError: undefined is not an object')).toBeTruthy();
  });

  it('hides the detail line when there is no exception to show', () => {
    renderInScheme(<ErrorState title="That did not load" body="Worth another try." />, scheme);
    expect(screen.queryByText(/TypeError/)).toBeNull();
  });
});
