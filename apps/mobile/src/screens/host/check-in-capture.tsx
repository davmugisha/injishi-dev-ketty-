/**
 * Staffed check-in — F-B08, FL09 path A.
 *
 * Three steps in the order the desk actually works: read the document,
 * photograph it, put them in a room. It deliberately mirrors Session 5's self
 * check-in stepper (`screens/guest/trip-check-in.tsx`) — same `Stepper`, same
 * autosaved draft, same blocked-reason-beside-the-button rule — because a
 * receptionist and a guest are filling in the same four facts and there is no
 * reason for the app to have two shapes for that.
 *
 * ## Where it differs from the guest's, and why
 *
 * **It asks for the name.** A guest checking themselves in is already named on
 * the booking. A desk is reading a document, and the document is the authority:
 * F-B08 captures the full name AS WRITTEN, which is not always what the booking
 * says. So the field is prefilled from the booking and the helper says to change
 * it if the document disagrees.
 *
 * **It assigns a room, and that is the third step rather than an afterthought.**
 * A booking can reach the door with no room (`room: null`), which the operator
 * app handles by sending the desk to the room grid. On a phone the grid is not
 * available, so the choice happens here — over the Work surface's own floor
 * board, so a room this screen assigns is a room housekeeping knows.
 *
 * **It is verified.** F-B08: a staffed capture sets `check_in_mode = staffed`
 * and `verified = true`, because a person looked at the document. A self
 * check-in never is. The last step says so, since that difference is invisible
 * afterwards unless the screen states it.
 *
 * ## The draft
 *
 * In the fixture store, keyed per booking, for the reason `data/check-in.ts`
 * gives: `expo-image-picker` backgrounds the app on some Android builds, and a
 * draft in `useState` is a draft that is gone when the camera comes back. A
 * desk interrupted mid-capture loses nothing.
 */
import { type ReactNode, useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AccountDocumentType } from '@injishi/contracts';
import {
  BackHeader,
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Icon,
  InputField,
  PhotoPicker,
  PressableScale,
  SkeletonList,
  StatusBadge,
  Stepper,
  StickyBar,
  Text,
  todayIso,
  useToast,
  type PickedPhoto,
  WriteError,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey, type Translate } from '@/i18n/i18n';
import { DOCUMENT_LABEL, DOCUMENT_TYPES, normaliseDocumentNumber } from '@/data/check-in';
import { readFixture, useFixtureValue, writeFixture } from '@/data/use-fixture-mutation';
import { useWorkRooms } from '@/screens/work/work-store';
import type { HkStatus, WorkRoom } from '@/screens/work/work-fixtures';
import type { HostBooking } from './host-fixtures';
import { rowStateOf, useHostActions, useHostBooking, useHostBookings } from './host-store';
import { Rule } from './host-chrome';

/* --------------------------------------------------------------- the draft */

export const CAPTURE_STEPS = ['identity', 'photo', 'room'] as const;
export type CaptureStep = (typeof CAPTURE_STEPS)[number];

export const CAPTURE_STEP_LABEL: Record<CaptureStep, MessageKey> = {
  identity: 'host.stepIdentity',
  photo: 'host.stepPhoto',
  room: 'host.stepRoom',
};

export interface CaptureDraft {
  step: number;
  fullName: string;
  documentType: AccountDocumentType;
  documentNumber: string;
  photos: readonly PickedPhoto[];
  room: string | null;
}

export const EMPTY_CAPTURE: CaptureDraft = {
  step: 0,
  fullName: '',
  documentType: 'national_id',
  documentNumber: '',
  photos: [],
  room: null,
};

export function captureDraftKey(bookingId: string): string {
  return `host.capture:${bookingId}`;
}

/**
 * Why a step cannot be left, or `null` when it can.
 *
 * A key rather than a sentence, so the sticky bar and the field beside it read
 * one source. The document rules are `data/check-in.ts`'s own, restated against
 * this draft rather than reimplemented: sixteen digits for a Rwandan national
 * ID, and deliberately loose for a passport, because rejecting a valid foreign
 * passport is worse than accepting a typo the desk can see on the document.
 */
export function captureBlockedKey(draft: CaptureDraft, step: CaptureStep): MessageKey | null {
  if (step === 'identity') {
    if (draft.fullName.trim().length < 2) return 'host.blockedName';
    const number = normaliseDocumentNumber(draft.documentNumber);
    if (number.length === 0) return 'host.blockedNumber';
    if (draft.documentType === 'national_id') {
      if (!/^\d{16}$/.test(number)) return 'host.blockedNid';
    } else if (number.length < 5) {
      return 'host.blockedPassportShort';
    }
    return null;
  }
  if (step === 'photo') return draft.photos.length === 0 ? 'host.blockedPhoto' : null;
  return draft.room === null ? 'host.blockedRoom' : null;
}

/**
 * Which rooms the desk may put someone in tonight.
 *
 * Only rooms that are actually free: `out_of_order` is excluded outright (F-P04
 * — the front desk cannot re-sell a room a fault has taken out), and a room
 * another booking is already in is excluded too. A dirty room IS offered, with
 * its state shown, because a desk checking someone in at 16:00 for a room being
 * cleaned right now is an ordinary Tuesday and refusing it would be the app
 * overruling the person who can see the corridor.
 */
export function assignableRooms(
  rooms: readonly WorkRoom[],
  bookings: readonly HostBooking[],
  bookingId: string,
  today: string,
): WorkRoom[] {
  const taken = new Set(
    bookings
      .filter((b) => b.id !== bookingId && b.checkedInAt !== null && b.checkedOutAt === null)
      .map((b) => b.room)
      .filter((room): room is string => room !== null),
  );
  return rooms.filter((room) => room.status !== 'out_of_order' && !taken.has(room.id));
}

const ROOM_STATE_LABEL: Record<HkStatus, MessageKey> = {
  clean: 'host.roomFree',
  dirty: 'host.roomNeedsCleaning',
  in_progress: 'host.roomBeingCleaned',
  inspected: 'host.roomFree',
  out_of_order: 'host.roomOutOfOrder',
};

/* -------------------------------------------------------------- the screen */

export function HostCheckInCapture({ id }: { id: string | undefined }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const toast = useToast();

  const { booking, status } = useHostBooking(id);
  const all = useHostBookings();
  const roomList = useWorkRooms();
  const actions = useHostActions();
  const today = todayIso();

  const key = captureDraftKey(id ?? 'unknown');
  const draft = useFixtureValue<CaptureDraft>(key, () => ({
    ...EMPTY_CAPTURE,
    fullName: booking?.guest.name ?? '',
    room: booking?.room ?? null,
  }));

  const patch = useCallback(
    (next: Partial<CaptureDraft>) => {
      const current = readFixture<CaptureDraft>(key, draft);
      writeFixture<CaptureDraft>(key, { ...current, ...next });
    },
    [draft, key],
  );

  const [committing, setCommitting] = useState(false);

  if (status === 'loading') {
    return (
      <Framed insetsTop={insets.top}>
        <SkeletonList rows={3} label={t('state.loadingList', { label: t('host.checkIn') })} />
      </Framed>
    );
  }

  // Reachable by a deep link, or by a booking that moved under a stale screen.
  // The gate is asked here rather than assumed from the caller, exactly as the
  // guest's own check-in does.
  const state = booking ? rowStateOf(booking, today) : undefined;
  if (!booking || state !== 'arriving') {
    return (
      <Framed insetsTop={insets.top}>
        <EmptyState
          icon="lock"
          title={t('host.checkInClosedTitle')}
          body={t('host.checkInClosedBody')}
          action={
            <Button
              variant="outline"
              size="md"
              onPress={() =>
                booking
                  ? router.replace({ pathname: '/reservation/[id]', params: { id: booking.id } })
                  : router.replace('/reservations')
              }
            >
              {t('host.notFoundAction')}
            </Button>
          }
        />
      </Framed>
    );
  }

  const step = CAPTURE_STEPS[draft.step] ?? CAPTURE_STEPS[0];
  const index = CAPTURE_STEPS.indexOf(step);
  const blocked = captureBlockedKey(draft, step);
  const last = index === CAPTURE_STEPS.length - 1;
  const saving = committing || actions.saving;

  const free = assignableRooms(roomList.rows, all.rows, booking.id, today);

  const advance = () => {
    if (blocked) return;
    if (!last) {
      patch({ step: index + 1 });
      return;
    }
    void commit();
  };

  const commit = async () => {
    if (!draft.room) return;
    setCommitting(true);
    await actions.checkIn({
      bookingId: booking.id,
      fullName: draft.fullName.trim(),
      documentType: draft.documentType,
      documentNumber: normaliseDocumentNumber(draft.documentNumber),
      photos: draft.photos,
      room: draft.room,
      at: Date.now(),
    });
    setCommitting(false);

    // The capture did not save. The room is not assigned and nobody is checked
    // in, so the draft is KEPT — the photographs are the expensive part and a
    // front desk that has to ask for an ID twice has already lost the guest's
    // patience.
    if (actions.checkInFailed) return;

    writeFixture<CaptureDraft>(key, EMPTY_CAPTURE);
    toast.show(
      actions.checkInQueued
        ? t('host.checkInQueued')
        : t('host.checkedInToast', { guest: booking.guest.name, room: draft.room }),
      actions.checkInQueued ? 'warning' : 'success',
    );
    // `replace` so the back gesture does not walk into a flow that has already
    // committed — the same call the guest's check-in makes for the same reason.
    router.replace({ pathname: '/reservation/[id]', params: { id: booking.id } });
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
        {/* A capture that did not save (gaps.md §6, P1). At the top of the
            flow, because the alternative — a front desk that believes the guest
            is checked in — means a room handed out with no record of who took
            it. The draft is still here, so retrying costs nothing. */}
        {actions.checkInFailed ? (
          <WriteError
            title="host.checkInFailedTitle"
            body="host.checkInFailedBody"
            onRetry={() => void commit()}
          />
        ) : null}

        <View style={{ gap: 3 }}>
          <Text
            weight="bold"
            size="2xs"
            color="textMuted"
            style={{ letterSpacing: 1, textTransform: 'uppercase' }}
          >
            {booking.id}
          </Text>
          <Text
            family="display"
            weight="semibold"
            size="xl"
            color="textStrong"
            style={{ letterSpacing: -0.4 }}
          >
            {t('host.checkInTitle', { guest: booking.guest.name })}
          </Text>
        </View>

        <Stepper steps={CAPTURE_STEPS.map((s) => t(CAPTURE_STEP_LABEL[s]))} current={index} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[4],
          paddingBottom: insets.bottom + 150,
          gap: space[4],
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'identity' ? (
          <IdentityStep booking={booking} draft={draft} patch={patch} t={t} />
        ) : null}
        {step === 'photo' ? <PhotoStep draft={draft} patch={patch} t={t} /> : null}
        {step === 'room' ? (
          <RoomStep draft={draft} patch={patch} rooms={free} loading={roomList.status === 'loading'} t={t} />
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon name="checkCircle" size={14} color={c.textSubtle} />
          <Text size="xs" color="textSubtle" style={{ flex: 1, lineHeight: 17 }}>
            {t('host.checkInAutosaved')}
          </Text>
        </View>
      </ScrollView>

      <StickyBar>
        <View style={{ flex: 1, gap: blocked ? 10 : 0 }}>
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
              onPress={() => (index === 0 ? router.back() : patch({ step: index - 1 }))}
            >
              {t('host.checkInBack')}
            </Button>
            <View style={{ flex: 1 }} />
            <Button
              variant="primary"
              size="lg"
              leadingIcon={last ? 'key' : undefined}
              disabled={!!blocked || saving}
              onPress={advance}
            >
              {saving
                ? t('host.checkInFinishing')
                : last
                  ? t('host.checkInFinish')
                  : t('host.checkInContinue')}
            </Button>
          </View>
        </View>
      </StickyBar>

      <BackHeader />
    </View>
  );
}

/* ---------------------------------------------------------------- step one */

function IdentityStep({
  booking,
  draft,
  patch,
  t,
}: {
  booking: HostBooking;
  draft: CaptureDraft;
  patch: (next: Partial<CaptureDraft>) => void;
  t: Translate;
}) {
  const { space } = useTheme();
  const nid = draft.documentType === 'national_id';

  return (
    <View style={{ gap: space[4] }}>
      <View style={{ gap: 6 }}>
        <Text weight="semibold" size="md" color="textStrong">
          {t('host.identityTitle')}
        </Text>
        <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
          {t('host.identityBody')}
        </Text>
      </View>

      <InputField
        label={t('host.nameLabel')}
        value={draft.fullName}
        onChangeText={(fullName) => patch({ fullName })}
        placeholder={t('host.namePlaceholder')}
        helper={t('host.nameHelper', { name: booking.guest.name })}
        autoCapitalize="words"
        testID="host-capture-name"
      />

      <ChipGroup
        legend={t('host.stepIdentity')}
        items={DOCUMENT_TYPES.map((value) => ({ value, label: t(DOCUMENT_LABEL[value]) }))}
        value={draft.documentType}
        // Changing the type clears the number: the two are validated together,
        // and a passport number left behind on a national ID would fail a rule
        // the desk could not see the cause of.
        onChange={(value) =>
          patch({ documentType: value as AccountDocumentType, documentNumber: '' })
        }
      />

      <InputField
        label={t('host.numberLabel')}
        value={draft.documentNumber}
        onChangeText={(documentNumber) => patch({ documentNumber })}
        helper={t(nid ? 'host.numberHelperNid' : 'host.numberHelperPassport')}
        keyboardType={nid ? 'number-pad' : 'default'}
        autoCapitalize="characters"
        testID="host-capture-number"
      />
    </View>
  );
}

/* ---------------------------------------------------------------- step two */

function PhotoStep({
  draft,
  patch,
  t,
}: {
  draft: CaptureDraft;
  patch: (next: Partial<CaptureDraft>) => void;
  t: Translate;
}) {
  const { space } = useTheme();

  return (
    <View style={{ gap: space[4] }}>
      <View style={{ gap: 6 }}>
        <Text weight="semibold" size="md" color="textStrong">
          {t('host.photoTitle')}
        </Text>
        <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
          {t('host.photoBody')}
        </Text>
      </View>

      {/* The kit owns the camera, the library, the permission-denied state and
          the 44pt targets. One photograph is enough for a document. */}
      <PhotoPicker
        value={draft.photos}
        onChange={(photos) => patch({ photos })}
        max={1}
        hint={t('host.photoHint')}
      />
    </View>
  );
}

/* -------------------------------------------------------------- step three */

function RoomStep({
  draft,
  patch,
  rooms,
  loading,
  t,
}: {
  draft: CaptureDraft;
  patch: (next: Partial<CaptureDraft>) => void;
  rooms: readonly WorkRoom[];
  loading: boolean;
  t: Translate;
}) {
  const { c, space, radius } = useTheme();

  return (
    <View style={{ gap: space[4] }}>
      <View style={{ gap: 6 }}>
        <Text weight="semibold" size="md" color="textStrong">
          {t('host.roomTitle')}
        </Text>
        <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
          {t('host.roomBody')}
        </Text>
      </View>

      {loading ? (
        <SkeletonList rows={4} label={t('state.loadingList', { label: t('host.stepRoom') })} />
      ) : rooms.length === 0 ? (
        <EmptyState
          icon="bed"
          title={t('host.noRoomsFree')}
          body={t('host.noRoomsFreeBody')}
        />
      ) : (
        <View style={{ gap: space[2] }}>
          {rooms.map((room) => {
            const on = draft.room === room.id;
            const stateLabel = t(ROOM_STATE_LABEL[room.status]);
            return (
              <PressableScale
                key={room.id}
                accessibilityRole="radio"
                accessibilityLabel={`${t('host.roomClean', { room: room.id, type: room.type })}, ${stateLabel}`}
                accessibilityState={{ selected: on, checked: on }}
                onPress={() => patch({ room: room.id })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[3],
                  minHeight: 56,
                  paddingHorizontal: space[3],
                  paddingVertical: space[3],
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: on ? c.borderBrand : c.borderSubtle,
                  backgroundColor: on ? c.actionSubtle : c.surface1,
                }}
              >
                {/* A radio, drawn: colour is never the only signal, so the
                    chosen row carries a filled dot as well as a tinted fill. */}
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: radius.pill,
                    borderWidth: 2,
                    borderColor: on ? c.action : c.borderStrong,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: radius.pill,
                        backgroundColor: c.action,
                      }}
                    />
                  ) : null}
                </View>

                <View style={{ flex: 1, gap: 2 }}>
                  <Text weight="semibold" size="sm" color="textStrong">
                    {t('host.roomClean', { room: room.id, type: room.type })}
                  </Text>
                  <Text size="xs" color="textMuted">
                    {stateLabel}
                  </Text>
                </View>

                <StatusBadge domain="housekeeping" state={room.status} />
              </PressableScale>
            );
          })}
        </View>
      )}

      <Rule />

      <Card variant="tint">
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Icon name="shield" size={15} color={c.brand700} />
          <Text size="sm" color="brand900" style={{ flex: 1, lineHeight: 19 }}>
            {t('host.checkInVerified')}
          </Text>
        </View>
      </Card>
    </View>
  );
}

/* ---------------------------------------------------------------- the frame */

function Framed({ children, insetsTop }: { children: ReactNode; insetsTop: number }) {
  const { c, space } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <View style={{ paddingTop: insetsTop + 52, paddingHorizontal: space[4] }}>{children}</View>
      <BackHeader />
    </View>
  );
}
