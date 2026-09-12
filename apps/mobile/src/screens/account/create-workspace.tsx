/**
 * "Create a business workspace" — the dashed row at the foot of frame X4.
 *
 * Session 0 wired it to a toast saying it was not built. That is the honest
 * placeholder and it is still the wrong surface, because creating a business
 * workspace is not an unbuilt mobile screen — it is **a flow that lives on the
 * web and always will**, and saying so is a different sentence from saying
 * "later".
 *
 * The reason is in the corpus rather than in a preference. Registering a
 * business here means an RRA taxpayer number, a district and sector, evidence
 * uploads and a review queue an officer works through (F-A03, F-P13). That is a
 * document-heavy verification, and the operator app already runs it. A phone
 * form that collected the first three fields and then handed over would be a
 * flow with two homes and one of them incomplete.
 *
 * So this prints the URL, says what will be asked for, and hands the reader
 * over — which is the useful thing a phone can actually do for somebody who is
 * about to sit down at a computer.
 *
 * The button hands the reader over with `expo-linking`, which Session 5 already
 * uses for maps and which is in the SDK — no new dependency. `openURL` rejects
 * rather than no-oping on a device with no browser handler, so the failure is
 * caught and toasted with the URL still on screen: the same trade
 * `screens/guest/trip-platform.ts` made, for the same reason. The URL itself is
 * `selectable`, so a reader whose device cannot open it can still copy it by
 * hand rather than transcribing it.
 *
 * **`expo-clipboard` is deliberately not added.** A copy button would be the
 * nicer control and this session's prompt names no new dependency; RN's own
 * `Clipboard` export is deprecated and absent on some builds, and reaching for
 * it here would put a second half-working copy path in the app beside the one
 * `trip-platform.ts` already documents.
 */
import { View } from 'react-native';
import * as Linking from 'expo-linking';
import { Button, Icon, Sheet, Text, useToast } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';

/**
 * Where the flow actually lives. Demo and production are separated by hostname
 * rather than by an environment variable (`AGENTS.md` § Deploy), so this is a
 * literal rather than a value read from config — there is no config in this
 * build to read it from, and inventing one would hide the decision.
 */
export const ONBOARDING_URL = 'https://injishi.rw/business/new';

/** What the web flow asks for, so the reader can arrive with it ready. */
const NEEDS: MessageKey[] = [
  'createWorkspace.needTin',
  'createWorkspace.needAddress',
  'createWorkspace.needEvidence',
  'createWorkspace.needReview',
];

/**
 * Opens the web flow. Resolves to whether it opened, so the caller can say so
 * rather than leaving a reader looking at a button that did nothing.
 */
export async function openOnboarding(): Promise<boolean> {
  try {
    await Linking.openURL(ONBOARDING_URL);
    return true;
  } catch {
    return false;
  }
}

export function CreateWorkspaceSheet() {
  const { c, space, radius } = useTheme();
  const t = useT();
  const toast = useToast();

  return (
    <Sheet
      grabber
      title={t('createWorkspace.title')}
      subtitle={t('createWorkspace.subtitle')}
      footer={
        <Button
          block
          size="lg"
          leadingIcon="externalLink"
          onPress={() => void openOnboarding().then((ok) => {
            if (!ok) toast.show(t('createWorkspace.openFailed'), 'warning');
          })}
          accessibilityHint={t('createWorkspace.openHint')}
        >
          {t('createWorkspace.open')}
        </Button>
      }
    >
      <View
        accessible
        accessibilityLabel={`${t('createWorkspace.urlLabel')}: ${ONBOARDING_URL}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          padding: space[4],
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          backgroundColor: c.surface2,
        }}
      >
        <Icon name="globe" size={19} color={c.brand700} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            weight="bold"
            size="2xs"
            color="textMuted"
            style={{ letterSpacing: 1, textTransform: 'uppercase' }}
          >
            {t('createWorkspace.urlLabel')}
          </Text>
          {/* No `numberOfLines`: a URL a reader is being asked to type must not
              be the one string on the screen that clips. */}
          <Text family="mono" weight="medium" size="sm" color="textStrong" selectable>
            {ONBOARDING_URL}
          </Text>
        </View>
      </View>

      <View style={{ gap: space[2] }}>
        <Text
          weight="bold"
          size="2xs"
          color="textMuted"
          style={{ letterSpacing: 1, textTransform: 'uppercase' }}
        >
          {t('createWorkspace.needsTitle')}
        </Text>
        {NEEDS.map((key) => (
          <View
            key={key}
            accessible
            accessibilityLabel={t(key)}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}
          >
            <Icon name="check" size={15} color={c.textMuted} />
            <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 19 }}>
              {t(key)}
            </Text>
          </View>
        ))}
      </View>

      <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
        {t('createWorkspace.whyWeb')}
      </Text>
    </Sheet>
  );
}
