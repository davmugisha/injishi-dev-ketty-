/**
 * ComingSoon — the screen behind a route that is registered but not yet built.
 *
 * Session 0 registers every route in the pack on day one, so the tab bar is
 * complete from the first launch and a tap never dead-ends. This is what those
 * routes render until their session lands.
 *
 * **It says what it is, where it is drawn and who builds it.** A stub that says
 * "coming soon" and nothing else is a screen a reviewer cannot act on. This one
 * prints the canvas frame id and the session number, which is exactly what a
 * reviewer needs to open the right artboard and the right prompt — and what a
 * later session needs to find its own placeholder.
 *
 * It is deliberately NOT a blank page with a centred sentence. It carries the
 * page's own title block, a bordered card, the two identifiers as chips, an
 * index of the surface's other routes, and a way out. That is the minimum a
 * placeholder owes: the shell around it is real, so the tab reads as a real tab
 * with nothing in it yet rather than as a screen that failed to load.
 *
 * **The index is the part that earns its place.** A stub with a bullet list of
 * prose would need a message key per line in both catalogues — fifty keys of
 * placeholder copy nobody will read twice, and fifty Kinyarwanda strings nobody
 * can review. Listing the surface's OTHER registered routes instead costs no
 * new copy at all (the labels are the tab names, already keyed), and it turns
 * the stub into something a reviewer can actually walk: from an unbuilt Rent
 * roll you can still reach Leases, Repairs and Account in one tap.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, SectionLabel } from './screen';
import { Text } from './text';
import { Icon, type IconName } from './icon';
import { Badge } from './badge';
import { Button } from './button';
import { ListRow } from './list-row';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';

export interface ComingSoonProps {
  /**
   * The canvas frame id: `W3`, `R12`, `B21`, `X4`. Omitted for the two optional
   * surfaces — Host and government oversight — which the canvas does not draw
   * at all. Saying "frame undefined" would be worse than saying nothing, so
   * the copy changes rather than the value.
   */
  frame?: string;
  /** The session in MOBILE-PROTOTYPE-PROMPTS.md Part 5 that builds it. */
  session: number;
  /** The tab or screen name, so the page keeps its own title. */
  title: string;
  icon?: IconName;
  /**
   * The surface's other routes, so the stub is a junction rather than a wall.
   * Labels arrive translated: the caller already holds `t`, and these are the
   * tab names it is naming anyway.
   */
  related?: readonly { label: string; href: string; icon?: IconName }[];
  /** Names the section above the index. Defaults to nothing. */
  relatedLabel?: string;
}

export function ComingSoon({
  frame,
  session,
  title,
  icon = 'layers',
  related = [],
  relatedLabel,
}: ComingSoonProps) {
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const t = useT();

  return (
    <Screen title={title} greeting={t('comingSoon.eyebrow')}>
      <View
        style={{
          gap: space[4],
          padding: space[5],
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          backgroundColor: c.surface1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.surface2,
            }}
          >
            <Icon name={icon} size={20} color={c.textMuted} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text family="display" weight="semibold" size="lg" color="textStrong">
              {t('comingSoon.title')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {frame ? <Badge tone="brand">{t('comingSoon.frame', { frame })}</Badge> : null}
              <Badge tone="neutral">{t('comingSoon.session', { session })}</Badge>
            </View>
          </View>
        </View>

        <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
          {frame
            ? t('comingSoon.body', { frame, session })
            : t('comingSoon.bodyUndrawn', { session })}
        </Text>
      </View>

      {related.length ? (
        <View style={{ gap: space[3] }}>
          {relatedLabel ? <SectionLabel>{relatedLabel}</SectionLabel> : null}
          <View
            style={{
              paddingHorizontal: space[4],
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: c.borderSubtle,
              backgroundColor: c.surface1,
            }}
          >
            {related.map((row, i) => (
              <ListRow
                key={row.href}
                title={row.label}
                icon={row.icon}
                divider={i < related.length - 1}
                onPress={() => router.push(row.href as Parameters<typeof router.push>[0])}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Button variant="outline" size="lg" block leadingIcon="arrowLeft" onPress={() => router.replace('/')}>
        {t('comingSoon.action')}
      </Button>
    </Screen>
  );
}
