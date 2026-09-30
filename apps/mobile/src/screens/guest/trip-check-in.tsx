/**
 * Self check-in — F-B09, FL09's self path. Guest canvas artboard 11
 * (`SelfCheckIn.dc.html`, `selfCheckIn` in `screens-b.mjs`).
 *
 * Three steps in the artboard's order, with the artboard's own copy: which
 * document, then the photograph, then where you live. What differs from the
 * artboard, and why:
 *
 *   - **The permission gate is the kit's `PhotoPicker`, not a card of its own.**
 *     The artboard draws an "Allow camera access" card that the guest presses
 *     before the camera is asked for. `PhotoPicker` asks on TAP instead, which
 *     is the rule its own header states: requesting the camera the moment a
 *     screen renders is how an app trains people to say no. Its denied state is
 *     an explanation with two ways out, which is what the artboard's card was
 *     reaching for.
 *   - **Issuing country is collected**, which the artboard does not draw. The
 *     prompt asks for it and `IdentityDocumentInput` requires it on a passport —
 *     and pins it to `RW` on a national ID, which is why the field appears and
 *     disappears with the choice rather than sitting there greyed out.
 *   - **The step rail is the kit's `Stepper`**, whose completed steps take a
 *     check rather than their number. The artboard's dots carry the state in
 *     fill alone, which is the one thing design brief §7.5 rules out.
 *
 * ## Nothing is lost by leaving
 *
 * Every field writes straight through to the draft in the fixture store, keyed
 * per booking. That is not a nicety: `expo-image-picker` backgrounds the app on
 * some Android builds, and a draft in `useState` would be gone when the camera
 * came back. The step index is in the draft too, so backing out to the trip and
 * returning lands on the step the guest left.
 */
import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { countryName, isKnownCountry, type AccountDocumentType } from '@injishi/contracts';
import {
  BackHeader,
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Icon,
  InputField,
  PhotoPicker,
  SkeletonList,
  Stepper,
  StickyBar,
  Text,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type Translate } from '@/i18n/i18n';
import { checkInGate, useCheckInTrip, useTrip, type Trip } from '@/data/trips';
import { isRealBooking, submitSelfCheckIn } from '@/data/self-check-in';
import {
  CHECK_IN_STEPS,
  DOCUMENT_LABEL,
  DOCUMENT_TYPES,
  STEP_LABEL,
  stepBlockedKey,
  useCheckInDraft,
  type CheckInDraftHandle,
} from '@/data/check-in';
import { useNow } from './trip-clock';

export function TripCheckIn({ bookingId }: { bookingId: string | undefined }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const toast = useToast();

  const { trip, status } = useTrip(bookingId);
  const now = useNow();
  const handle = useCheckInDraft(bookingId ?? 'unknown');
  const { checkIn, status: writeStatus } = useCheckInTrip();
  const [committing, setCommitting] = useState(false);

  const step = CHECK_IN_STEPS[handle.draft.step] ?? CHECK_IN_STEPS[0];
  const index = CHECK_IN_STEPS.indexOf(step);
  const blocked = stepBlockedKey(handle.draft, step);
  const last = index === CHECK_IN_STEPS.length - 1;
  const saving = committing || writeStatus === 'saving';

  if (status === 'loading') {
    return (
      <Frame insetsTop={insets.top}>
        <SkeletonList rows={3} label={t('state.loadingList', { label: t('checkin.title') })} />
      </Frame>
    );
  }

  // Reachable by a deep link, or by a booking that moved under a stale screen.
  // The gate is asked here rather than assumed from the caller, the same way
  // the arrival guide asks it.
  const gate = trip ? checkInGate(trip, now) : undefined;
  if (!trip || gate?.kind !== 'ready') {
    return (
      <Frame insetsTop={insets.top}>
        <EmptyState
          icon="lock"
          title={t('checkin.notFoundTitle')}
          body={t('checkin.notFoundBody')}
          action={
            <Button
              variant="outline"
              size="md"
              onPress={() =>
                trip
                  ? router.replace({ pathname: '/trip/[id]', params: { id: trip.id } })
                  : router.replace('/trips')
              }
            >
              {t('trip.backToTrips')}
            </Button>
          }
        />
      </Frame>
    );
  }

  const advance = () => {
    if (blocked) return;
    if (!last) {
      handle.patch({ step: index + 1 });
      return;
    }
    void commit();
  };

  const commit = async () => {
    setCommitting(true);
    // A real booking sends the document and its photo to the API (ADR-060);
    // a fixture trip has no booking on the server to send to. A send that
    // fails keeps the draft and the screen, so nothing typed is lost.
    if (isRealBooking(trip.id)) {
      const sent = await submitSelfCheckIn(trip.id, handle.draft);
      if (sent.status !== 'ok') {
        setCommitting(false);
        toast.show(t('checkin.sendFailed'), 'danger');
        return;
      }
    }
    await checkIn(trip.id);
    handle.clear();
    toast.show(t('checkin.doneToast'), 'success');
    setCommitting(false);
    // Back to the trip, where the arrival guide is now unlocked. `replace` so
    // the back gesture does not walk into a flow that has already committed.
    router.replace({ pathname: '/trip/[id]', params: { id: trip.id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <View
        style={{
          paddingTop: insets.top + 52,
          paddingHorizontal: space[4],
          paddingBottom: space[4],
          gap: space[4],
        }}
      >
        <View style={{ gap: 2 }}>
          <Text
            weight="bold"
            size="2xs"
            color="textMuted"
            style={{ letterSpacing: 1, textTransform: 'uppercase' }}
          >
            {trip.property}
          </Text>
          <Text
            family="display"
            weight="semibold"
            size="2xl"
            color="textStrong"
            style={{ letterSpacing: -0.4 }}
          >
            {t('checkin.title')}
          </Text>
        </View>

        <Stepper steps={CHECK_IN_STEPS.map((s) => t(STEP_LABEL[s]))} current={index} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[4],
          paddingBottom: insets.bottom + 140,
          gap: space[4],
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'document' ? <DocumentStep handle={handle} t={t} /> : null}
        {step === 'photo' ? <PhotoStep handle={handle} t={t} /> : null}
        {step === 'address' ? <AddressStep handle={handle} trip={trip} t={t} /> : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon name="checkCircle" size={14} color={c.textSubtle} />
          <Text size="xs" color="textSubtle" style={{ flex: 1, lineHeight: 17 }}>
            {t('checkin.autosaved')}
          </Text>
        </View>
      </ScrollView>

      <StickyBar>
        <View style={{ flex: 1, gap: blocked ? 10 : 0 }}>
          {/* A disabled control always carries its reason (design brief §7.5),
              and the reason is `stepBlockedKey`'s, so the bar and the field
              cannot disagree about why. */}
          {blocked ? (
            <View
              accessible
              accessibilityRole="alert"
              accessibilityLabel={t(blocked)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Icon name="alertCircle" size={15} color={c.warning600} />
              <Text size="xs" color="textBody" style={{ flex: 1, lineHeight: 18 }}>
                {t(blocked)}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Button
              variant="ghost"
              size="lg"
              onPress={() =>
                index === 0
                  ? router.back()
                  : handle.patch({ step: index - 1 })
              }
            >
              {t('checkin.back')}
            </Button>
            <View style={{ flex: 1 }} />
            <Button
              variant="primary"
              size="lg"
              leadingIcon={last ? 'check' : undefined}
              disabled={!!blocked || saving}
              onPress={advance}
            >
              {saving ? t('checkin.finishing') : last ? t('checkin.finish') : t('checkin.continue')}
            </Button>
          </View>
        </View>
      </StickyBar>

      <BackHeader />
    </View>
  );
}

/** The page under the header, for the states that have no stepper. */
function Frame({ children, insetsTop }: { children: React.ReactNode; insetsTop: number }) {
  const { c, space } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <View style={{ paddingTop: insetsTop + 52, paddingHorizontal: space[4] }}>{children}</View>
      <BackHeader />
    </View>
  );
}

/* ------------------------------------------------------------- step one --- */

function DocumentStep({ handle, t }: { handle: CheckInDraftHandle; t: Translate }) {
  const { c, space } = useTheme();
  const { draft, patch } = handle;
  const nid = draft.documentType === 'national_id';

  return (
    <View style={{ gap: space[4] }}>
      <Text weight="semibold" size="md" color="textStrong">
        {t('checkin.documentQuestion')}
      </Text>

      {/* The legend is the short label, not the question: the heading above
          already asks it, and printing the same sentence twice is noise a
          screen reader hears twice over. */}
      <ChipGroup
        legend={t('checkin.documentTypeLegend')}
        items={DOCUMENT_TYPES.map((value) => ({ value, label: t(DOCUMENT_LABEL[value]) }))}
        value={draft.documentType}
        // Changing the type clears the number: the two are validated together
        // and a passport number left behind on a national ID would fail a rule
        // the guest could not see the cause of.
        onChange={(value) =>
          patch({ documentType: value as AccountDocumentType, documentNumber: '' })
        }
      />

      <InputField
        label={t('checkin.numberLabel')}
        value={draft.documentNumber}
        onChangeText={(documentNumber) => patch({ documentNumber })}
        placeholder={t(nid ? 'checkin.numberPlaceholderNid' : 'checkin.numberPlaceholderPassport')}
        helper={t(nid ? 'checkin.numberHelperNid' : 'checkin.numberHelperPassport')}
        keyboardType={nid ? 'number-pad' : 'default'}
        autoCapitalize="characters"
        testID="checkin-number"
      />

      {nid ? (
        // The contract pins a Rwandan NID to Rwanda, so there is no field —
        // and the screen says why rather than leaving a gap where one was.
        <Card variant="tint">
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Icon name="info" size={15} color={c.brand700} />
            <Text size="sm" color="brand900" style={{ flex: 1, lineHeight: 19 }}>
              {t('checkin.nidIsRwandan')}
            </Text>
          </View>
        </Card>
      ) : (
        <InputField
          label={t('checkin.countryLabel')}
          value={draft.issuingCountry}
          onChangeText={(issuingCountry) => patch({ issuingCountry: issuingCountry.toUpperCase() })}
          placeholder={t('checkin.countryPlaceholder')}
          helper={
            isKnownCountry(draft.issuingCountry)
              ? countryName(draft.issuingCountry)
              : t('checkin.countryHelper')
          }
          autoCapitalize="characters"
          maxLength={2}
          testID="checkin-country"
        />
      )}

      <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
        {t('checkin.notAnIdentityCheck')}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------- step two --- */

function PhotoStep({ handle, t }: { handle: CheckInDraftHandle; t: Translate }) {
  const { space } = useTheme();
  const { draft, patch } = handle;

  return (
    <View style={{ gap: space[4] }}>
      <View style={{ gap: 6 }}>
        <Text weight="semibold" size="md" color="textStrong">
          {t('checkin.photoTitle')}
        </Text>
        <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
          {t('checkin.photoBody')}
        </Text>
      </View>

      {/* The kit owns the camera, the library, the permission-denied state and
          the 44pt targets. One photograph is enough for a document, so `max`
          is 1 and the empty tile disappears once it is taken. */}
      <PhotoPicker
        value={draft.photos}
        onChange={(photos) => patch({ photos })}
        max={1}
        hint={t('checkin.photoHint')}
      />

      <View style={{ gap: space[2] }}>
        <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
          {t('checkin.photoQueue')}
        </Text>
        <Text size="xs" color="textSubtle" style={{ lineHeight: 18 }}>
          {t('checkin.photoUploadNote')}
        </Text>
      </View>
    </View>
  );
}

/* ----------------------------------------------------------- step three --- */

function AddressStep({
  handle,
  trip,
  t,
}: {
  handle: CheckInDraftHandle;
  trip: Trip;
  t: Translate;
}) {
  const { space } = useTheme();
  const { draft, setAddress } = handle;
  const rwandan = draft.address.country === 'RW';

  return (
    <View style={{ gap: space[4] }}>
      <Text weight="semibold" size="md" color="textStrong">
        {t('checkin.addressTitle')}
      </Text>

      <InputField
        label={t('checkin.countryOfResidence')}
        value={draft.address.country}
        onChangeText={(country) => setAddress({ country: country.toUpperCase() })}
        placeholder={t('checkin.countryPlaceholder')}
        helper={
          isKnownCountry(draft.address.country)
            ? countryName(draft.address.country)
            : t('checkin.countryHelper')
        }
        autoCapitalize="characters"
        maxLength={2}
        testID="checkin-residence-country"
      />

      {/* Rwanda gets the hierarchy and everywhere else gets one block, which is
          the `Address` union's own discriminator rather than a layout choice. */}
      {rwandan ? (
        <>
          <InputField
            label={t('checkin.streetLabel')}
            value={draft.address.street}
            onChangeText={(street) => setAddress({ street })}
            placeholder={t('checkin.streetPlaceholder')}
            autoCapitalize="words"
            testID="checkin-street"
          />
          <InputField
            label={t('checkin.districtLabel')}
            value={draft.address.district}
            onChangeText={(district) => setAddress({ district })}
            helper={t('checkin.districtHelper')}
            autoCapitalize="words"
            testID="checkin-district"
          />
        </>
      ) : (
        <InputField
          label={t('checkin.addressTextLabel')}
          value={draft.address.addressText}
          onChangeText={(addressText) => setAddress({ addressText })}
          placeholder={t('checkin.addressTextPlaceholder')}
          autoCapitalize="words"
          testID="checkin-address-text"
        />
      )}

      <Card variant="tint">
        <View style={{ gap: 8 }}>
          <Text weight="semibold" size="sm" color="brand900">
            {t('checkin.reviewTitle')}
          </Text>
          <Text size="sm" color="brand900" style={{ lineHeight: 19 }}>
            {t('checkin.reviewBody', { property: trip.property })}
          </Text>
        </View>
      </Card>

      <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
        {t('checkin.attested')}
      </Text>
    </View>
  );
}
