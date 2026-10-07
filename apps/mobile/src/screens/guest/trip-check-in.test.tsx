/**
 * Self check-in and the review sheet, rendered.
 *
 * What these two files assert that the pure tests cannot:
 *
 *   - **The draft survives an unmount.** The screen is mounted, typed into,
 *     unmounted and mounted again, and the answer is still there. That is the
 *     whole reason the draft lives in the fixture store rather than in
 *     `useState`, and it is the one behaviour a reader would assume works.
 *   - **Completing flips the trip.** The commit is followed through to
 *     `checked_in`, which is what unlocks the arrival guide.
 *   - **The gate holds on the way in.** A booking outside the window renders
 *     the refusal rather than the form.
 *   - **The review sheet refuses a second review**, which is the client half of
 *     F-B14's one-per-stay-per-side rule.
 */
import { type ReactElement } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderInScheme, SCHEMES } from '@/test-utils';
import { DomainProvider } from '@/domain';
import { ToastProvider } from '@/components';
import {
  MUTATION_LATENCY_MS,
  readFixture,
  resetFixtures,
  writeFixture,
} from '@/data/use-fixture-mutation';
import * as tripsData from '@/data/trips';
import { TRIPS, TRIPS_KEY, type Trip } from '@/data/trips';
import { readCheckInDraft } from '@/data/check-in';
import { REVIEWS_KEY, TRIP_REVIEW_SEEDS, type TripReview } from '@/data/trip-reviews';
import { en } from '@/i18n/messages';
import { TripCheckIn } from './trip-check-in';
import { TripReviewSheet } from './trip-review-sheet';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}));

/**
 * `expo-image-picker` is a native module. The photo step's own permission and
 * denied states belong to `PhotoPicker`, which has its own tests; here the
 * picker only has to hand back an asset so the step can be completed.
 */
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///doc.jpg', width: 1200, height: 800 }],
  })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

const ARRIVING = 'BK-4821';
const EARLY = 'BK-4790';
const COMPLETED = 'BK-4402';
const REVIEWED = 'BK-4310';

function fixture(id: string): Trip {
  const trip = TRIPS.find((t) => t.id === id);
  if (!trip) throw new Error(`no fixture ${id}`);
  return trip;
}

const guest = (ui: ReactElement) => (
  <DomainProvider initial="hospitality" initialSurface="guest">
    <ToastProvider>{ui}</ToastProvider>
  </DomainProvider>
);

/** Waits out `useFixtureMutation`'s simulated latency. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 50));
  });
}

beforeEach(() => {
  resetFixtures();
  mockPush.mockClear();
  mockReplace.mockClear();
  mockBack.mockClear();
});

afterEach(async () => {
  // A write started by one test lands after the next has mounted, and would
  // write the old test's draft into the new test's store halfway through.
  await settle();
  resetFixtures();
});

describe.each(SCHEMES)('Self check-in in the %s scheme', (scheme) => {
  it('opens on the document step, with the property named above it', async () => {
    renderInScheme(guest(<TripCheckIn bookingId={ARRIVING} />), scheme);

    await waitFor(() => expect(screen.getByText(en['checkin.title'])).toBeTruthy());
    expect(screen.getByText(fixture(ARRIVING).property)).toBeTruthy();
    expect(screen.getByText(en['checkin.documentQuestion'])).toBeTruthy();
  });
});

describe('the step gate', () => {
  it('blocks Continue with the reason, never silently', async () => {
    renderInScheme(guest(<TripCheckIn bookingId={ARRIVING} />), 'light');

    await waitFor(() => expect(screen.getByText(en['checkin.blockedNumberEmpty'])).toBeTruthy());
    // The disabled state and its sentence come from the same source, so they
    // cannot disagree about why.
    expect(screen.getByLabelText(en['checkin.continue']).props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('names the 16-digit rule rather than saying "invalid"', async () => {
    renderInScheme(guest(<TripCheckIn bookingId={ARRIVING} />), 'light');

    await waitFor(() => expect(screen.getByTestId('checkin-number')).toBeTruthy());
    fireEvent.changeText(screen.getByTestId('checkin-number'), '119908');
    await waitFor(() => expect(screen.getByText(en['checkin.blockedNidShape'])).toBeTruthy());
  });

  it('lets a well-formed national ID through, spaces and all', async () => {
    renderInScheme(guest(<TripCheckIn bookingId={ARRIVING} />), 'light');

    await waitFor(() => expect(screen.getByTestId('checkin-number')).toBeTruthy());
    fireEvent.changeText(screen.getByTestId('checkin-number'), '1 1990 8 0012345 6 78');

    await waitFor(() =>
      expect(
        screen.getByLabelText(en['checkin.continue']).props.accessibilityState.disabled,
      ).toBe(false),
    );
  });

  it('swaps the country field in and out with the document type', async () => {
    renderInScheme(guest(<TripCheckIn bookingId={ARRIVING} />), 'light');

    // A Rwandan NID is Rwandan by definition on the contract, so there is no
    // field — and the screen says so rather than leaving a gap.
    await waitFor(() => expect(screen.getByText(en['checkin.nidIsRwandan'])).toBeTruthy());
    expect(screen.queryByTestId('checkin-country')).toBeNull();

    fireEvent.press(screen.getByLabelText(en['checkin.docPassport']));
    await waitFor(() => expect(screen.getByTestId('checkin-country')).toBeTruthy());
  });
});

describe('the draft', () => {
  it('survives leaving the screen — nothing typed is lost', async () => {
    const first = renderInScheme(guest(<TripCheckIn bookingId={ARRIVING} />), 'light');
    await waitFor(() => expect(screen.getByTestId('checkin-number')).toBeTruthy());
    fireEvent.changeText(screen.getByTestId('checkin-number'), '1199080012345678');
    fireEvent.press(screen.getByLabelText(en['checkin.continue']));

    // The picker backgrounds the app on some Android builds; this is the
    // unmount that a draft in `useState` would not come back from.
    await waitFor(() => expect(readCheckInDraft(ARRIVING).step).toBe(1));
    first.unmount();

    renderInScheme(guest(<TripCheckIn bookingId={ARRIVING} />), 'light');
    // Back on the step it was left on, with the answer still in it.
    await waitFor(() => expect(screen.getByText(en['checkin.photoTitle'])).toBeTruthy());
    expect(readCheckInDraft(ARRIVING).documentNumber).toBe('1199080012345678');
  });

  it('keeps one draft per booking, so two open check-ins do not collide', async () => {
    renderInScheme(guest(<TripCheckIn bookingId={ARRIVING} />), 'light');
    await waitFor(() => expect(screen.getByTestId('checkin-number')).toBeTruthy());
    fireEvent.changeText(screen.getByTestId('checkin-number'), '1199080012345678');

    await waitFor(() => expect(readCheckInDraft(ARRIVING).documentNumber).toBe('1199080012345678'));
    expect(readCheckInDraft(EARLY).documentNumber).toBe('');
  });
});

describe('completing the check-in', () => {
  it('flips the booking to checked_in and returns to the trip', async () => {
    // Seeded straight into the draft: the three steps have their own tests
    // above, and driving a camera through the picker to reach the last one
    // would be testing `PhotoPicker`, which has its own.
    writeFixture(`checkin.draft:${ARRIVING}`, {
      documentType: 'national_id',
      documentNumber: '1199080012345678',
      issuingCountry: 'RW',
      photos: [{ uri: 'file:///doc.jpg', width: 1200, height: 800 }],
      address: { country: 'RW', street: 'KG 11 Ave 24', district: 'Gasabo', addressText: '' },
      step: 2,
    });

    renderInScheme(guest(<TripCheckIn bookingId={ARRIVING} />), 'light');
    await waitFor(() => expect(screen.getByText(en['checkin.finish'])).toBeTruthy());
    fireEvent.press(screen.getByLabelText(en['checkin.finish']));

    await settle();
    const trips = readFixture<Trip[]>(TRIPS_KEY, TRIPS);
    expect(trips.find((t) => t.id === ARRIVING)?.state).toBe('checked_in');
    // `replace`, so the back gesture cannot walk into a committed flow.
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/trip/[id]', params: { id: ARRIVING } });
  });

  /**
   * Brief item 1: "You are checked in" only after the write lands. A write
   * that did not land keeps the draft and the screen, unlocks nothing, and
   * says so.
   */
  it('keeps the draft and the screen, and says so, when the write does not land', async () => {
    writeFixture(`checkin.draft:${ARRIVING}`, {
      documentType: 'national_id',
      documentNumber: '1199080012345678',
      issuingCountry: 'RW',
      photos: [{ uri: 'file:///doc.jpg', width: 1200, height: 800 }],
      address: { country: 'RW', street: 'KG 11 Ave 24', district: 'Gasabo', addressText: '' },
      step: 2,
    });
    const spy = jest
      .spyOn(tripsData, 'useCheckInTrip')
      .mockReturnValue({ checkIn: async () => 'error', status: 'idle' });
    try {
      renderInScheme(guest(<TripCheckIn bookingId={ARRIVING} />), 'light');
      await waitFor(() => expect(screen.getByText(en['checkin.finish'])).toBeTruthy());
      fireEvent.press(screen.getByLabelText(en['checkin.finish']));

      await waitFor(() => expect(screen.getByText(en['checkin.saveFailed'])).toBeTruthy());
      expect(screen.queryByText(en['checkin.doneToast'])).toBeNull();
      expect(mockReplace).not.toHaveBeenCalled();
      // Nothing typed is lost.
      expect(readCheckInDraft(ARRIVING).documentNumber).toBe('1199080012345678');
    } finally {
      spy.mockRestore();
    }
  });

  it('clears the draft once it has committed', async () => {
    writeFixture(`checkin.draft:${ARRIVING}`, {
      documentType: 'national_id',
      documentNumber: '1199080012345678',
      issuingCountry: 'RW',
      photos: [{ uri: 'file:///doc.jpg', width: 1200, height: 800 }],
      address: { country: 'RW', street: 'KG 11 Ave 24', district: 'Gasabo', addressText: '' },
      step: 2,
    });

    renderInScheme(guest(<TripCheckIn bookingId={ARRIVING} />), 'light');
    await waitFor(() => expect(screen.getByText(en['checkin.finish'])).toBeTruthy());
    fireEvent.press(screen.getByLabelText(en['checkin.finish']));

    await settle();
    expect(readCheckInDraft(ARRIVING).documentNumber).toBe('');
  });
});

describe('a trip read that failed', () => {
  it('is an error with a retry, not "this check-in is not open" (GK-17)', async () => {
    const spy = jest.spyOn(tripsData, 'useTrip').mockReturnValue({
      trip: undefined,
      status: 'error',
      error: new Error('Not Found'),
      retry: jest.fn(),
    });
    try {
      renderInScheme(guest(<TripCheckIn bookingId={ARRIVING} />), 'light');
      await waitFor(() => expect(screen.getByText(en['state.errorTitle'])).toBeTruthy());
      expect(screen.queryByText(en['checkin.notFoundTitle'])).toBeNull();
      expect(screen.getByText(en['state.retry'])).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('is an error with a retry on the review sheet too (GK-17)', async () => {
    const spy = jest.spyOn(tripsData, 'useTrip').mockReturnValue({
      trip: undefined,
      status: 'error',
      error: new Error('Not Found'),
      retry: jest.fn(),
    });
    try {
      renderInScheme(guest(<TripReviewSheet id={COMPLETED} />), 'light');
      await waitFor(() => expect(screen.getByText(en['state.errorTitle'])).toBeTruthy());
      expect(screen.queryByText(en['review.notFoundTitle'])).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('the check-in gate on the way in', () => {
  it('refuses a booking whose window has not opened', async () => {
    // Reachable by a deep link, or by a booking that moved under a stale
    // screen. The gate is asked here rather than assumed from the caller.
    renderInScheme(guest(<TripCheckIn bookingId={EARLY} />), 'light');

    await waitFor(() => expect(screen.getByText(en['checkin.notFoundTitle'])).toBeTruthy());
    expect(screen.queryByText(en['checkin.documentQuestion'])).toBeNull();
  });

  it('refuses a booking that is already checked in', async () => {
    writeFixture<Trip[]>(TRIPS_KEY, [{ ...fixture(ARRIVING), state: 'checked_in' }]);
    renderInScheme(guest(<TripCheckIn bookingId={ARRIVING} />), 'light');

    await waitFor(() => expect(screen.getByText(en['checkin.notFoundTitle'])).toBeTruthy());
  });
});

describe.each(SCHEMES)('The review sheet in the %s scheme', (scheme) => {
  it('asks the six categories and explains the double blind before the button', async () => {
    renderInScheme(guest(<TripReviewSheet id={COMPLETED} />), scheme);

    await waitFor(() => expect(screen.getByText(en['review.cleanliness'])).toBeTruthy());
    expect(screen.getByText(en['review.title'])).toBeTruthy();
    for (const label of [
      en['review.cleanliness'],
      en['review.accuracy'],
      en['review.checkIn'],
      en['review.communication'],
      en['review.location'],
      en['review.value'],
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText(en['review.doubleBlindTitle'])).toBeTruthy();
  });
});

describe('the review sheet', () => {
  const rateAll = () => {
    for (const label of [
      en['review.cleanliness'],
      en['review.accuracy'],
      en['review.checkIn'],
      en['review.communication'],
      en['review.location'],
      en['review.value'],
    ]) {
      fireEvent.press(
        screen.getByLabelText(
          en['review.a11ySetStars'].replace('{category}', label).replace('{count}', '4'),
        ),
      );
    }
  };

  it('holds submit until all six are rated, and counts what is left', async () => {
    renderInScheme(guest(<TripReviewSheet id={COMPLETED} />), 'light');

    await waitFor(() =>
      expect(screen.getByText(en['review.blockedMany'].replace('{count}', '6'))).toBeTruthy(),
    );
    expect(screen.getByLabelText(en['review.submit']).props.accessibilityState.disabled).toBe(true);
  });

  it('names no reviewer the server has not given, never the fixture persona', async () => {
    renderInScheme(guest(<TripReviewSheet id={COMPLETED} />), 'light');
    await waitFor(() => expect(screen.getByText(en['review.doubleBlindTitle'])).toBeTruthy());
    // No session here, so no server name: the name line is left out entirely.
    expect(screen.queryByText(/Yours appears as/)).toBeNull();
    expect(screen.queryByText(/Samuel/)).toBeNull();
  });

  it('writes a review that is not published, and says so', async () => {
    renderInScheme(guest(<TripReviewSheet id={COMPLETED} />), 'light');
    await waitFor(() => expect(screen.getByText(en['review.cleanliness'])).toBeTruthy());

    rateAll();
    await waitFor(() =>
      expect(screen.getByLabelText(en['review.submit']).props.accessibilityState.disabled).toBe(
        false,
      ),
    );
    fireEvent.press(screen.getByLabelText(en['review.submit']));

    await settle();
    const written = readFixture<TripReview[]>(REVIEWS_KEY, TRIP_REVIEW_SEEDS).find(
      (r) => r.bookingId === COMPLETED,
    );
    expect(written?.scores.cleanliness).toBe(4);
    // The pair publishes when the host submits or the window closes, and this
    // app cannot observe either — so it never claims it has.
    expect(written?.published).toBe(false);
    expect(mockBack).toHaveBeenCalled();
  });

  it('refuses a second review of the same stay (F-B14: one per side)', async () => {
    writeFixture(REVIEWS_KEY, TRIP_REVIEW_SEEDS);
    renderInScheme(guest(<TripReviewSheet id={REVIEWED} />), 'light');

    await waitFor(() => expect(screen.getByText(en['review.alreadyTitle'])).toBeTruthy());
    expect(screen.queryByText(en['review.submit'])).toBeNull();
  });

  it('refuses to open on a stay that was never completed', async () => {
    renderInScheme(guest(<TripReviewSheet id={ARRIVING} />), 'light');
    await waitFor(() => expect(screen.getByText(en['review.notFoundTitle'])).toBeTruthy());
  });
});
