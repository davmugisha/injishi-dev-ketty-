/**
 * "Reveal landlord contact" — frame B22's sheet, mounted by
 * `app/directory/[unitId]/reveal.tsx` as a `formSheet` (decision D8).
 *
 * ## Why it is a sheet and not a button
 *
 * Pressing it does three irreversible things: spends one of the broker's reveal
 * credits, writes a row to the reveal log that a landlord's number was handed
 * out, and opens a placement intent with this broker recorded on it (FL18 step
 * 3, FL19 step 1). The canvas rule is that consequences are printed under the
 * button rather than discovered later, so all three are on this sheet: the
 * body says what the intent means, the line above the button says what the
 * credit costs, and the line below says how long the intent runs.
 *
 * ## The four states it can open in
 *
 * A reveal that can go ahead, a balance with no credits left, a contact that was
 * already revealed (which costs nothing to look at again), and a unit that is
 * already let — FL18 path B, where spending a credit would buy a placement
 * nobody can be made into. Each is a whole sheet with its own way out, not a
 * disabled button with an explanation beside it.
 */
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar, Button, Icon, Sheet, Text, WriteError, useToast } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { formatDay } from '@/data/search';
import { getUnit, isPlaceable, useBrokerState, useReveal } from '@/data/broker';
import { INTENT_DAYS, moneyText, unitFee } from './broker-format';

export function UnitReveal({ id }: { id: string }) {
  const { c, space, radius } = useTheme();
  const t = useT();
  const router = useRouter();
  const toast = useToast();

  const unit = getUnit(id);
  const { credits, reveals, isRevealed } = useBrokerState();
  const { reveal, saving, failed, reset } = useReveal();
  // Held locally as well as on the mutation, so the button stays disabled
  // through the navigation that follows rather than flickering back to enabled
  // for the frame between the write landing and the sheet dismissing.
  const [done, setDone] = useState(false);

  const close = useCallback(() => router.back(), [router]);

  // A sheet opened against a unit that is not there. The route resolves the id
  // itself, so this is a bad link rather than a failed read, and the whole
  // answer is "there is nothing here" plus the way back.
  if (!unit) {
    return (
      <Sheet title={t('unit.notFoundTitle')} grabber onClose={close}>
        <Text size="sm" color="textBody" style={{ lineHeight: 21 }}>
          {t('unit.notFoundBody')}
        </Text>
      </Sheet>
    );
  }

  const revealed = isRevealed(unit.id);
  const revealedOn = reveals.find((r) => r.unitId === unit.id)?.day;

  /* ------------------------------------------------------------- already let */

  if (!isPlaceable(unit)) {
    return (
      <Sheet
        title={t('reveal.unavailableTitle')}
        grabber
        onClose={close}
        footer={
          <Button variant="outline" size="lg" block onPress={close}>
            {t('reveal.spentAction')}
          </Button>
        }
      >
        <Text size="sm" color="textBody" style={{ lineHeight: 21 }}>
          {t('reveal.unavailableBody')}
        </Text>
      </Sheet>
    );
  }

  /* -------------------------------------------------------- already revealed */

  if (revealed) {
    return (
      <Sheet
        title={t('reveal.alreadyTitle')}
        grabber
        onClose={close}
        footer={
          <Button variant="primary" size="lg" block leadingIcon="eye" onPress={close}>
            {t('reveal.alreadyAction')}
          </Button>
        }
      >
        <Text size="sm" color="textBody" style={{ lineHeight: 21 }}>
          {t('reveal.alreadyBody', {
            day: revealedOn ? formatDay(revealedOn, t) : t('unit.availableNow'),
          })}
        </Text>
        <LandlordRow org={unit.landlord.org} line={unit.landlord.phone} masked={false} />
      </Sheet>
    );
  }

  /* --------------------------------------------------------- no credits left */

  if (credits === 0) {
    return (
      <Sheet
        title={t('reveal.spentTitle')}
        grabber
        onClose={close}
        footer={
          <Button variant="outline" size="lg" block onPress={close}>
            {t('reveal.spentAction')}
          </Button>
        }
      >
        <Text size="sm" color="textBody" style={{ lineHeight: 21 }}>
          {t('reveal.spentBody')}
        </Text>
      </Sheet>
    );
  }

  /* ----------------------------------------------------------- the real ask */

  /**
   * Spending the credit (gaps.md §5.2, P1 — the screen scored zero on every
   * state, and it is the one that spends money).
   *
   * The write is idempotent per unit in `useReveal`, so a double-fired press
   * cannot spend twice. The toast and the navigation wait for the write, so a
   * failure does not report a reveal that did not happen — which on this
   * screen means a broker who believes they have paid for a number they were
   * never given. And `done` is released on failure, because a permanently
   * disabled button on a sheet with no error is indistinguishable from the app
   * hanging.
   *
   * **It branches on what `reveal` RETURNS** (mobile audit 2026-10-05, BR-02).
   * It used to read `failed` after the `await`, which is the value from the
   * render that pressed the button: a failure toasted "Contact revealed" and
   * closed, and a retry that then succeeded was treated as failed. Offline it
   * toasted the same success over a reveal that was only queued; it now says
   * the contact is revealed when the phone reconnects.
   */
  const onConfirm = async () => {
    setDone(true);
    reset();
    const outcome = await reveal(unit);
    if (outcome === 'queued') {
      toast.show(t('reveal.queued'), 'warning');
      router.back();
      return;
    }
    if (outcome !== 'done') {
      setDone(false);
      return;
    }
    toast.show(t('reveal.toast'), 'success');
    router.back();
  };

  return (
    <Sheet
      title={t('reveal.title')}
      grabber
      onClose={close}
      footer={
        <>
          <Button
            variant="primary"
            size="lg"
            block
            leadingIcon="eye"
            disabled={saving || done}
            onPress={onConfirm}
          >
            {saving || done ? t('reveal.working') : t('reveal.confirm')}
          </Button>
          {/* A spend that did not happen. On this sheet more than any other,
              because the thing it failed to buy costs money and the broker has
              no other way to tell. */}
          {failed ? (
            <WriteError
              title="reveal.failedTitle"
              body="reveal.failedBody"
              onRetry={() => void onConfirm()}
              secondary={{ label: 'reveal.cancel', onPress: close }}
            />
          ) : null}
          {/* The consequence, under the button. Both halves of it: what the
              press spends, and how long what it buys lasts. */}
          <Text size="xs" color="textMuted" center style={{ lineHeight: 16 }}>
            {t('reveal.consequence', { days: INTENT_DAYS })}
          </Text>
          <Button variant="ghost" size="md" block disabled={saving || done} onPress={close}>
            {t('reveal.cancel')}
          </Button>
        </>
      }
    >
      <Text size="sm" color="textBody" style={{ lineHeight: 21 }}>
        {t('reveal.body')}
      </Text>

      <LandlordRow org={unit.landlord.org} line={t('unit.landlordMasked')} masked />

      <View style={{ gap: 10 }}>
        <View
          accessible
          accessibilityLabel={
            credits === 1 ? t('reveal.creditsOne') : t('reveal.credits', { count: credits })
          }
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[2],
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: radius.md,
            backgroundColor: c.bgTint,
          }}
        >
          <Icon name="eye" size={15} color={c.brand700} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text size="xs" color="textBody">
              {credits === 1 ? t('reveal.creditsOne') : t('reveal.credits', { count: credits })}
            </Text>
            {/* The balance BEFORE and AFTER, which benchmarks.md §8.4 takes
                from the destructive-action literature: the count is the only
                thing that makes the decision informed, and it is the piece a
                generic confirm dialog leaves out. "Reveal this contact?" tells
                a broker nothing they did not already know. */}
            <Text family="mono" size="2xs" weight="semibold" color="textMuted">
              {t('reveal.balanceAfter', {
                before: String(credits),
                after: String(Math.max(0, credits - 1)),
              })}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
          <Icon name="shield" size={14} color={c.textSubtle} />
          <Text size="xs" color="textMuted" style={{ flex: 1, lineHeight: 17 }}>
            {t('reveal.logged')}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
          <Icon name="percent" size={14} color={c.textSubtle} />
          <Text size="xs" color="textMuted" style={{ flex: 1, lineHeight: 17 }}>
            {`${t('directory.feeLabel')} · ${moneyText(unitFee(unit))}`}
          </Text>
        </View>
      </View>
    </Sheet>
  );
}

/**
 * The card frame B22 draws: the letting entity's initials, its name, and the
 * number either hidden or shown.
 *
 * The masked form is a MASK, not a blurred real number — the same rule the unit
 * detail states at length. Nothing here holds the digits until the reveal has
 * landed.
 */
function LandlordRow({ org, line, masked }: { org: string; line: string; masked: boolean }) {
  const { c, radius, space } = useTheme();
  const t = useT();

  return (
    <View
      accessible
      accessibilityLabel={masked ? `${org}. ${t('unit.landlordHidden')}` : `${org}. ${line}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        padding: 12,
        borderRadius: radius.md,
        backgroundColor: c.surface2,
        borderWidth: 1,
        borderColor: c.borderSubtle,
      }}
    >
      <Avatar name={org} size={38} square />
      <View style={{ flex: 1, gap: 3 }}>
        <Text weight="semibold" size="sm" color="textStrong" numberOfLines={1}>
          {org}
        </Text>
        <Text family="mono" size="sm" color={masked ? 'textSubtle' : 'textBody'}>
          {line}
        </Text>
      </View>
      <Icon name={masked ? 'eyeOff' : 'phone'} size={17} color={c.textSubtle} />
    </View>
  );
}
