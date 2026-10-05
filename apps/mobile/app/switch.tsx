/**
 * Switch — the persistent workspace switcher of FL16, as frame X4 draws it.
 *
 * A **sheet** rather than a full modal (decision D8): X4 draws it with a
 * grabber over a dimmed Account, and because switching is something you do
 * *from* wherever you are, FL16 §5 Path A expects the surface underneath to
 * survive the switch rather than be popped.
 *
 * ## The four things frame X4 asks of this screen
 *
 * **1. Every seat, with its role line and a check on the active one.** The
 * frame's rows are "Personal — Tenant · My leases, rent, inbox (checked)",
 * "Ingoro Apartments — Landlord · Rent roll, leases, repairs", "Aline K.
 * Brokerage — Broker · Directory, placements, earnings". The org name moved
 * under decision D7a (see `data/personas.ts`); the shape did not. The check is
 * a glyph and a word, never a tint alone — a reader in greyscale has to be able
 * to tell which seat they are in.
 *
 * **2. "Create a business workspace" opens a "continues on the web" sheet.**
 * Session 0 toasted "not wired". It is not unwired — it lives on the web and
 * always will, which is a different sentence; `screens/account/create-workspace`
 * says which and why.
 *
 * **3. Selecting lands on Account of the new surface, with the toast.** Account
 * is the one tab in every set, which is the whole reason it is safe to switch
 * from anywhere: the tab you are standing on is never the one a switch unlinks.
 * The switcher is opened from Account and dismisses back onto it, so the
 * landing is `router.back()` rather than a navigate — a push would leave the
 * old surface's Account underneath in the stack.
 *
 * **4. "Anything half-captured is held, not dropped."** That is FL16 §5 Path A
 * — *switch mid-task → unsaved capture autosaved* — and the footnote no longer
 * promises it (mobile audit 2026-10-05, SA-35). What holds across a switch is
 * the fixture store, which is module state keyed by fixture id and indexed by
 * nothing to do with the active workspace, so a started check-in or booking
 * survives. A draft kept in a screen's own state does not, and that is most of
 * them. The frame's promise is owed a real draft store before it can be
 * printed again. `switchKeepsDrafts()` below asserts the narrow thing that is
 * true.
 *
 * ## The person and the rows say only what is there (SA-01, SA-10)
 *
 * The header names the person from `GET /api/v1/me/profile` through the same
 * three states as the Account card: the name, a skeleton while it loads, or
 * "Name not added yet", with a phone line only when there is a phone. Each row
 * reads its role as a word (`seatRoleLabel`) and joins it to the tab it opens
 * with `joinParts`, which drops an empty part along with its separator. The rig
 * found "owner ·", "Guest · Tenant ·", a lone "·" on the Broker row, and a
 * header read aloud as "Samuel Kayitare, " over an empty line.
 *
 * ## One control, not two
 *
 * An earlier version drew a domain segment above the workspace list, which
 * asked the reader to make the same choice twice: a Landlord seat only exists
 * on Residence, so picking it already picks the domain. The one place the two
 * genuinely come apart is Personal, which spans both (FL25 §9 — Guest and
 * Tenant are one Personal workspace) — so the Personal row, and only the
 * Personal row, offers the two surfaces it holds. **Session 11 removed the
 * matching segment from Account** for the same reason, so the choice now lives
 * in exactly one place.
 *
 * Selecting is the whole interaction — there is no confirm step, because
 * switching back costs one tap and a confirm on a reversible move is noise.
 *
 * ## The rows are the server's answer now (ADR-038 child 0, tasks 8 and 11)
 *
 * They used to be `SWITCHABLE_WORKSPACES`, a constant in `data/personas.ts`.
 * They are whatever `GET /api/v1/me/workspaces` returned, so a seat that was
 * revoked is gone on the next launch and a seat that was granted appears
 * without shipping a build.
 *
 * And selecting one now **asks the server first** (AC-S6). `setWorkspace` posts
 * to `POST /api/v1/me/active-workspace` and the app moves only on success, so
 * the toast announces a switch that actually happened. An unreachable server
 * leaves you where you were and says so, rather than showing you a workspace
 * the server has not agreed you are in.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Icon,
  ListRow,
  PressableScale,
  SectionLabel,
  Sheet,
  Text,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain, surfaceFor } from '@/domain';
import { useT, type MessageKey } from '@/i18n/i18n';
import { useMyIdentity } from '@/queries/profile';
import type { Surface, WorkspaceEntry } from '@/data/rentals';
import { joinParts, seatRoleLabel } from '@/screens/account/account-format';
import { PersonAvatar, PersonName, spokenName } from '@/screens/account/identity-card';

const GROUPS: { key: WorkspaceEntry['type']; label: MessageKey }[] = [
  { key: 'personal', label: 'switch.personal' },
  { key: 'business', label: 'switch.business' },
  { key: 'broker', label: 'switch.broker' },
];

/** The tab set each surface opens, for the row's second line. */
const SURFACE_LABEL: Record<Surface, MessageKey> = {
  guest: 'nav.explore',
  tenant: 'nav.leases',
  landlord: 'nav.rentRoll',
  broker: 'nav.directory',
  work: 'nav.queue',
  host: 'nav.today',
};

/**
 * Whether a switch clears the fixture store. It does not, and this says so
 * where a test can read it.
 *
 * Nothing in `setWorkspace` or `setDomain` touches the store: they write two
 * keychain values and two pieces of React state. What clears it is
 * `resetFixtures()`, which signing out calls and a switch never does. So a
 * draft kept THERE (a started check-in or booking) holds across a switch by
 * construction.
 *
 * It is narrower than the frame's "anything half-captured is held, not
 * dropped", and that is why the footnote stopped promising it (SA-35): a draft
 * kept in a screen's own state goes when its tab does.
 */
export function switchKeepsDrafts(): boolean {
  return true;
}

/**
 * A row's second line: the role the seat is held in, then the tab it opens.
 *
 * The role is left out when it only repeats the row's title, which is what the
 * server's own label does for a broker seat ("Broker" over "Broker").
 */
function seatLine(entry: WorkspaceEntry, role: string, tab: string): string {
  return joinParts([role === entry.name ? null : role, tab]);
}

export default function SwitchScreen() {
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const { domain, setDomain, setWorkspace, workspace, workspaces, surface } = useDomain();

  /**
   * The header above the seats names the PERSON, and the seats below it are
   * already the server's answer. Reading the person from `ME` while the rows
   * came from `GET /api/v1/me/workspaces` was the remaining half-truth on this
   * sheet: a device signed in as somebody else listed their real seats under a
   * stranger's name. It is `GET /api/v1/me/profile` now, and when that holds no
   * name the header says so rather than borrowing one (SA-01).
   */
  const me = useMyIdentity();

  /** The seats the switcher offers. A parked seat is reachable, never listed. */
  const switchable = workspaces.filter((w) => !w.parked);

  const choose = async (next: WorkspaceEntry) => {
    if (next.id === workspace.id) {
      // Already here. Dismissing without a toast is the honest answer: a
      // "Switched to Personal" for a switch that did not happen teaches a
      // reader that the toast means nothing.
      router.back();
      return;
    }

    // Server first. The same reasoning as the toast above, one layer down: a
    // success announced for a switch the server refused is a lie the person
    // then acts on.
    const took = await setWorkspace(next);
    if (!took) {
      toast.show(t('switch.failed', { name: workspace.name }), 'danger');
      return;
    }

    toast.show(t('switch.switched', { name: next.name }), 'success');
    // Back to Account, which the switcher was opened from. The shell has
    // already swapped its tab set underneath, and Account — the tab in every
    // set — is still the one standing, which is the whole point of the note.
    router.back();
  };

  /**
   * Personal is the one seat holding two surfaces, so it offers both.
   *
   * The Guest/Tenant split is the DEVICE's, not the server's: one Personal
   * workspace spans both (FL25 §9), and the toggle that chooses between them
   * lives in the keychain. So this moves the domain, and only asks the server
   * to switch when the Personal SEAT is not the one already active.
   */
  const choosePersonalSurface = async (next: Surface) => {
    if (surface === next) {
      router.back();
      return;
    }

    const personal = switchable.find((w) => w.type === 'personal');
    if (personal && personal.id !== workspace.id) {
      const took = await setWorkspace(personal);
      if (!took) {
        toast.show(t('switch.failed', { name: workspace.name }), 'danger');
        return;
      }
    }

    setDomain(next === 'guest' ? 'hospitality' : 'residence');
    toast.show(t('switch.switched', { name: t(SURFACE_LABEL[next]) }), 'success');
    router.back();
  };

  return (
    <Sheet grabber title={t('switch.title')} subtitle={t('switch.subtitle')}>
      <View
        accessible
        // Only the parts that are there: a missing phone used to leave the
        // label as "Name, " and an empty line under the name (SA-10).
        accessibilityLabel={joinParts([spokenName(me, t), me.phone], ', ')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          padding: space[3],
          borderRadius: radius.lg,
          backgroundColor: c.surface2,
        }}
      >
        <PersonAvatar me={me} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <PersonName me={me} size="md" />
          {me.phone ? (
            <Text family="mono" size="xs" color="textMuted">
              {me.phone}
            </Text>
          ) : null}
        </View>
      </View>

      {GROUPS.map((group) => {
        const rows = switchable.filter((w) => w.type === group.key);
        if (!rows.length) return null;

        return (
          <View key={group.key} style={{ gap: space[2] }}>
            <SectionLabel>{t(group.label)}</SectionLabel>
            <View
              style={{
                paddingHorizontal: space[3],
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: c.borderSubtle,
                backgroundColor: c.surface1,
              }}
            >
              {rows.map((entry, i) => {
                const active = entry.id === workspace.id;
                const opens = surfaceFor(entry, domain);
                const tab = t(SURFACE_LABEL[opens]);
                const role = seatRoleLabel(entry, opens, t);
                return (
                  <ListRow
                    key={entry.id}
                    title={entry.name}
                    subtitle={seatLine(entry, role, tab) || undefined}
                    avatar={entry.name}
                    divider={i < rows.length - 1}
                    chevron={false}
                    onPress={() => void choose(entry)}
                    // The tab is the hint's to say, so the label is the seat
                    // and its role: "Kayitare Court, Owner".
                    accessibilityLabel={joinParts(
                      [entry.name, role === entry.name ? null : role],
                      ', ',
                    )}
                    accessibilityHint={
                      active ? t('switch.currentHint') : t('switch.opens', { tab })
                    }
                    trailing={
                      active ? (
                        // Frame X4's check. A glyph AND a word, because a state
                        // told only in colour is a state a greyscale or
                        // colour-blind reader does not have (design brief §7.5).
                        //
                        // NOT wrapped in `importantForAccessibility="no-hide-
                        // descendants"`. `ListRow` already puts the whole row's
                        // sentence on its pressable, so the badge is not spoken
                        // twice — and hiding it would take it out of the render
                        // tree's query surface as well as the reader's, which
                        // is how a component becomes untestable by accident.
                        // Session 11's audit made this mistake three times
                        // before noticing the pattern.
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text weight="semibold" size="xs" color="textLink">
                            {t('switch.current')}
                          </Text>
                          <Icon name="checkCircle" size={18} color={c.brand700} />
                        </View>
                      ) : undefined
                    }
                  />
                );
              })}
            </View>

            {/* Personal holds two surfaces and is the only seat that does, so
                it is the only one that asks a second question. */}
            {group.key === 'personal' ? (
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel={t('switch.personalSurfaces')}
                style={{ flexDirection: 'row', gap: space[2] }}
              >
                {(['guest', 'tenant'] as const).map((option) => {
                  const on = surface === option;
                  return (
                    <PressableScale
                      key={option}
                      accessibilityRole="radio"
                      accessibilityLabel={t(
                        option === 'guest' ? 'switch.asGuest' : 'switch.asTenant',
                      )}
                      accessibilityHint={t('switch.opens', { tab: t(SURFACE_LABEL[option]) })}
                      accessibilityState={{ selected: on }}
                      haptic
                      onPress={() => void choosePersonalSurface(option)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        gap: 6,
                        minHeight: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: radius.md,
                        backgroundColor: on ? c.actionSubtle : c.surface1,
                        borderWidth: 1,
                        borderColor: on ? c.borderBrand : c.borderSubtle,
                      }}
                    >
                      {on ? <Icon name="check" size={14} color={c.brand700} /> : null}
                      <Text weight="semibold" size="sm" color={on ? 'textLink' : 'textBody'}>
                        {t(option === 'guest' ? 'switch.asGuest' : 'switch.asTenant')}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}

      <PressableScale
        accessibilityLabel={t('switch.create')}
        accessibilityHint={t('switch.createHint')}
        onPress={() => router.push('/create-workspace')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[2],
          minHeight: 48,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: c.borderStrong,
        }}
      >
        <Icon name="plus" size={16} color={c.textMuted} />
        <Text weight="medium" size="sm" color="textMuted">
          {t('switch.create')}
        </Text>
      </PressableScale>

      {/* The frame's own footnote, and the reason Account is in every tab set. */}
      <Text size="xs" color="textMuted" style={{ lineHeight: 19 }}>
        {t('switch.note')}
      </Text>
    </Sheet>
  );
}
