/**
 * Sign in - frame X1, on the email address the product actually uses.
 *
 * ## The canvas was wrong here, and this is where it was corrected
 *
 * Frame X1 draws an `RW +250` prefix segment, nine digits and an SMS code, and
 * its footnote names an "SMS adapter mock". None of that ever had anything
 * behind it: the login has been an email since F-S01, `users_email_lower_uk`
 * enforces one account per address, `lease_invitations.email` keys the
 * invitation, and `packages/auth` registers exactly one plugin, `emailOTP`.
 * There is no SMS sender anywhere in the codebase and there never was, so the
 * screen's promise to text you a code was never true.
 *
 * ADR-038 child 1b settles it: the FIELD changes, the composition does not.
 * X1's ink canvas, bird mark, two-line display title and accent Continue all
 * survive intact. Phone numbers stay everywhere they are genuinely used —
 * mobile money in `pay-rent`, the contact row in Account — which is why
 * `phone.ts` still exists beside this file and still passes its own tests.
 *
 * ## The five states the field and the button move through
 *
 *   idle      empty                  the neutral hint             Continue off
 *   typing    not yet plausible      the same neutral hint        Continue off
 *   plausible looks like an address  "Looks right"                Continue on
 *   error     blurred implausible    the error message            Continue off
 *   sending   submitted              the button says what it does Continue off
 *
 * **The error waits for blur, and that is the whole judgement call in here.**
 * An address is invalid for almost all of the time it takes to type one. A
 * field that turns red at `r`, `ra`, `ray` and stays red until the final
 * character has told the person nothing and shouted at them nine times to do
 * it. So: any keystroke leaves `error` immediately, blur on an EMPTY field
 * returns to `idle` rather than to `error`, and Continue is enabled only from
 * `plausible` — which means there is no submit path that can raise a shape
 * error at all.
 *
 * Colour is never the only signal in any of the five; each carries its own
 * words (design brief 7.5).
 *
 * ## What it talks to
 *
 * `requestSignInCode()` in `src/lib/auth.ts`, which trims and lowercases the
 * address before sending it and was proved end to end from a physical LAN
 * address while building the seam. The four outcomes it can answer are mapped
 * below, one arm each.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatMarketDateTime } from '@injishi/utils/format';
import {
  Button,
  ErrorState,
  Icon,
  InputField,
  ListRow,
  SectionLabel,
  Text,
  useOffline,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';
import { requestSignInCode } from '@/lib/auth';
import { useDemoPersonas, type DemoPersona } from '@/queries/demo';
import { consumeSignOutReason } from '@/session';
import { AuthCanvas } from './auth-canvas';
import { BrandMark } from './brand-mark';
import { isPlausibleEmail, trimEmail } from './email';
import { DEMO_CODE } from './otp';

export function SignInScreen() {
  const { space } = useTheme();
  const t = useT();
  const router = useRouter();
  /**
   * Why the last session ended, read once (mobile audit SA-34): somebody
   * dropped here by an expired session, or signed out with no signal, is told
   * so rather than left to guess whether the app broke.
   */
  const [signedOut] = useState(() => consumeSignOutReason());

  /** Exactly what the person typed. Trimmed where it is read, never as they type. */
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  /**
   * The shape error, and it is a separate flag from `failed` on purpose.
   *
   * One says the address cannot be right; the other says the send did not
   * happen. Merging them would let a network failure clear itself the moment
   * somebody edits an address that was fine.
   */
  const [shapeError, setShapeError] = useState(false);
  /** A local message key, when the app has its own words for what went wrong. */
  const [failed, setFailed] = useState<MessageKey | null>(null);
  /** The server's own message, for a refusal the app has no words for (AC-S8). */
  const [refusal, setRefusal] = useState<string | null>(null);
  const offline = useOffline();

  // The demo signal comes from `GET /api/v1/platform` (ADR-043, AC-21); the
  // roster is asked only on the demo, so on production the list is ABSENT
  // rather than hidden (AC-S10).
  const { personas, isDemoHost, seededAt } = useDemoPersonas();

  const plausible = isPlausibleEmail(email);

  const onChangeEmail = (next: string) => {
    setEmail(next);
    // Any keystroke leaves the error state. Somebody correcting a mistake
    // should not keep being told about it.
    if (shapeError) setShapeError(false);
    if (failed) setFailed(null);
    if (refusal) setRefusal(null);
  };

  /**
   * Blur is the only way into the error state.
   *
   * An EMPTY field returns to idle: somebody who tapped the field and changed
   * their mind has done nothing wrong, and a red field is not the thing to
   * leave them looking at.
   */
  const onBlurEmail = () => {
    setShapeError(trimEmail(email).length > 0 && !plausible);
  };

  /**
   * Ask for the code, and map all four outcomes (AC-E13).
   *
   * A sign-in code is deliberately NOT queued when offline — a code that
   * arrives twenty minutes later has expired, and offering to send one later
   * would be offering nothing. That is the same reasoning `offline-submit.ts`
   * uses to refuse a rent payment rather than queue it.
   */
  const submit = async () => {
    if (!plausible || sending) return;
    setFailed(null);
    setRefusal(null);

    if (offline) {
      setFailed('auth.sendFailedOffline');
      return;
    }

    setSending(true);
    const outcome = await requestSignInCode(email);
    setSending(false);

    if (outcome.status === 'ok') {
      // The TRIMMED but not lowercased string, so verify can print back what
      // the person actually typed and the typo stays visible to them.
      // `requestSignInCode()` lowercases what it sends; the database's
      // `lower(email)` uniqueness is what guarantees one account either way.
      router.push({
        pathname: '/(auth)/verify-otp',
        params: { email: trimEmail(email) },
      });
      return;
    }

    if (outcome.status === 'refused') {
      // 429 is the one refusal the app answers in its own words. Better Auth
      // replies in English, and an English sentence dropped into a translated
      // screen is the single case where "show the server's own message" yields.
      // The server never publishes how long to wait, so there is no number to
      // read out of it either.
      if (/too many|rate limit|429/i.test(outcome.message)) {
        setFailed('auth.resendTooSoon');
        return;
      }
      setRefusal(outcome.message);
      return;
    }

    // Reachability. Separated from a refusal the same way `api.ts`'s four
    // branch result keeps them apart: one means "we could not ask", and the
    // person can act on that by moving.
    setFailed('auth.sendFailedBody');
  };

  /**
   * The demo picker fills the address; Continue sends the code (AC-S10).
   *
   * Two taps, which is what the criterion asks for. It deliberately does not
   * submit for you: a presenter watching the address land in the field can see
   * which persona they picked before the screen moves.
   */
  const pickPersona = (persona: DemoPersona) => {
    setEmail(persona.email);
    setShapeError(false);
    setFailed(null);
    setRefusal(null);
  };

  /**
   * The helper line, for the states that take one. `plausible` renders its own
   * affirmative row below instead, because a tick in `success600` is a
   * different thing from a muted hint and `InputField` has one muted slot.
   */
  const helper = plausible || shapeError ? undefined : t('auth.emailHint');

  return (
    <AuthCanvas>
      <BrandMark width={44} />

      <View style={{ marginTop: space[6], gap: space[3] }}>
        <Text
          accessibilityRole="header"
          family="display"
          weight="semibold"
          size="2xl"
          color="textStrong"
          style={{ letterSpacing: -0.6 }}
        >
          {`${t('auth.signInTitleA')}\n${t('auth.signInTitleB')}`}
        </Text>
        <Text size="md" color="textMuted">
          {t('auth.signInBody')}
        </Text>
      </View>

      {signedOut ? (
        <View
          accessible
          accessibilityRole="alert"
          style={{ marginTop: space[5], gap: space[1] }}
          testID="signed-out-notice"
        >
          <Text weight="semibold" size="sm" color="textStrong">
            {t('session.signedOutTitle')}
          </Text>
          <Text size="sm" color="textMuted">
            {signedOut === 'offline' ? t('session.signedOutOffline') : t('session.signedOutBody')}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: space[6], gap: space[3] }}>
        <InputField
          label={t('auth.emailLabel')}
          value={email}
          onChangeText={onChangeEmail}
          onBlur={onBlurEmail}
          placeholder={t('auth.emailPlaceholder')}
          helper={helper}
          error={shapeError ? t('auth.emailError') : undefined}
          keyboardType="email-address"
          // The three that decide whether a typed address survives the
          // keyboard. Autocorrect on an address is the quiet one: it changes
          // the value without the person seeing it happen.
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          autoComplete="email"
          // **Nothing is remembered between launches** (AC-E10). The field is
          // empty on every cold start, because a remembered address on a demo
          // handset tells the next presenter who was signed in last, and sign
          // out clears everything else. The platform's own keyboard may still
          // offer an address it saved; that is the operating system's store,
          // not the app's.
          editable={!sending}
          testID="email-field"
        />

        {plausible && !shapeError ? <LooksRight label={t('auth.emailHintOk')} /> : null}

        {/* Above the button and below the field, which is where the eye is
            after a press that did nothing. It names what did NOT happen — no
            code sent — because the first thing somebody does after a failed
            sign-in is wonder whether to try a different address. */}
        {failed || refusal ? (
          <ErrorState
            title={t('auth.sendFailedTitle')}
            // A refusal shows the SERVER's own message; everything else shows
            // the app's own words (AC-S8, AC-E13).
            body={refusal ?? t(failed as MessageKey)}
            onRetry={failed === 'auth.sendFailedOffline' ? undefined : submit}
          />
        ) : null}

        <Button
          variant="primary"
          size="lg"
          block
          disabled={!plausible || sending}
          onPress={submit}
        >
          {sending ? t('auth.sendingCode') : t('auth.continue')}
        </Button>

        {/* The canvas rule: the consequence is printed under the button, not
            discovered after it. On the demo host it names the published code
            rather than claiming an email was sent, which is the honest split —
            the phone cannot see the API's mail configuration and nothing
            exposes it, so the environment is what it can truthfully key on. */}
        <Text size="xs" color="textMuted">
          {isDemoHost
            ? t('auth.emailFootnoteDemo', { code: DEMO_CODE })
            : t('auth.emailFootnote')}
        </Text>
        {/* When the demo data was last rebuilt (ADR-043, AC-19), in Kigali
            time, so a presenter knows what the visitor is looking at. */}
        {isDemoHost && seededAt ? (
          <Text size="xs" color="textMuted">
            {t('auth.demoLastReset', { when: formatMarketDateTime(new Date(seededAt)) })}
          </Text>
        ) : null}
      </View>

      {personas && personas.length > 0 ? (
        <DemoPersonas personas={personas} onPick={pickPersona} />
      ) : null}

      {/* No "Sign in with Google": v1.0 signs in with an emailed code only
          (owner, 2026-10-01), and the button only ever toasted "not wired"
          (device rig 2026-10-01; mobile audit SA-13). Google returns when its
          deep link return is solved (scope, Deferred). */}

      {/* Pushes the closing note to the foot of the canvas on a tall phone and
          simply follows the content on a short one. */}
      <View style={{ flexGrow: 1, minHeight: space[6] }} />

      {/* "I can't sign in" is the question the assistant has to be reachable
          for, so its signed out route sits inside (auth) (ADR-061 slice G). */}
      <Button variant="ghost" size="sm" leadingIcon="message" onPress={() => router.push('/(auth)/assistant')}>
        {t('assistant.entrySignIn')}
      </Button>

      <Text size="xs" color="textMuted">
        {t('auth.noDocuments')}
      </Text>
    </AuthCanvas>
  );
}

/**
 * The demo roster (AC-S10).
 *
 * Rendered only where `GET /api/v1/demo/personas` answered, which is the demo
 * host and nowhere else. On any other host this whole block is ABSENT rather
 * than hidden, because the route 404s and the query holds `null`.
 *
 * **Every seat is listed, never flattened to one.** Samuel holds five and is
 * exactly the persona a presenter reaches for to show the switcher; reducing
 * him to a single role would misrepresent the account the picker most needs to
 * get right. A one-seat persona renders one role line, and Samuel renders a
 * role line plus a count, from the same field.
 */
function DemoPersonas({
  personas,
  onPick,
}: {
  personas: DemoPersona[];
  onPick: (persona: DemoPersona) => void;
}) {
  const { c, space, radius } = useTheme();
  const t = useT();

  return (
    <View style={{ marginTop: space[5], gap: space[2] }}>
      <SectionLabel>{t('auth.demoPersonasTitle')}</SectionLabel>
      <Text size="xs" color="textMuted">
        {t('auth.demoPersonasHint')}
      </Text>

      <View
        style={{
          paddingHorizontal: space[3],
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          backgroundColor: c.surface1,
        }}
      >
        {personas.map((persona, i) => {
          // The role leads each seat ("Owner, Umurage Guesthouse"): the demo is
          // where access control is shown, and a bare org name hides it.
          const seats = persona.seats.map((s) => `${s.role}, ${s.label}`).join(' · ');
          return (
            <ListRow
              key={persona.email}
              title={persona.name}
              subtitle={
                persona.seats.length > 1
                  ? `${t('auth.demoPersonaSeats', { count: persona.seats.length })} · ${seats}`
                  : seats
              }
              avatar={persona.name}
              divider={i < personas.length - 1}
              onPress={() => onPick(persona)}
              accessibilityLabel={`${persona.name}, ${persona.email}`}
              accessibilityHint={seats}
            />
          );
        })}
      </View>
    </View>
  );
}

/**
 * The `plausible` state, as a word and a glyph rather than as a colour. Frame
 * X1's hint text turns to "Looks right" once the value could be an address;
 * this is that line, in the affirmative tone the muted helper slot cannot
 * carry.
 */
function LooksRight({ label }: { label: string }) {
  const { c } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -6 }}
    >
      <Icon name="checkCircle" size={14} color={c.success600} />
      <Text size="xs" color="success600">
        {label}
      </Text>
    </View>
  );
}
