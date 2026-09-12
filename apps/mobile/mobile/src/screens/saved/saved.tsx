/**
 * Saved — the Guest's grid of kept stays (ADR-032 child "the Saved surface").
 *
 * The screen knows about saved properties; the database knows about
 * collections. `/me/saved` is the seam, and it is deliberately the only thing
 * this screen sees: no list picker, no sort, no segmenting. F-B16's full
 * collections UI lands later as pure addition rather than as a migration.
 *
 * ## Two columns, and where the ADR and the prompt disagree
 *
 * The ADR says "the single column rhythm Explore uses". This session's prompt
 * says a two column grid, and the grid wins for a reason the ADR could not have
 * weighed: Explore is a place you READ, one card at a time, and Saved is a
 * place you SCAN for something you already know is there. Every product that
 * has both draws the second one denser. The change is layout only — the same
 * `ListingCard`, the same order, the same states — so nothing in the ADR's
 * contract moves. It is named here because the two documents now differ and
 * Session 12 should correct one of them.
 *
 * `Screen.List` virtualizes one column, so a row here is a PAIR of stays and
 * the grid is laid out inside it. Two cards side by side in one virtualized row
 * is one measured row rather than two, which is what FlashList wants, and it
 * keeps the scaffold's header, empty slot and separator working untouched.
 *
 * ## Unsaving, and why it is not a plain toast
 *
 * The heart writes through the same `useSavedStays` store Explore and the
 * listing page write, so the card leaves the grid immediately. That is correct
 * and it is also the moment the reader loses the only pointer they had to a
 * place they liked — "tap the heart again" is no help once the card is gone. So
 * the unsave carries a real undo for the toast's own dwell time, in `UndoBar`,
 * and the restore goes back through the same store rather than through a second
 * path.
 *
 * ## The unavailable card
 *
 * A saved property whose listing is unpublished stays in the list and renders
 * as unavailable, with no price and no reserve affordance, still tappable so it
 * can be opened and unsaved (AC-10). It is not filtered out, because a list
 * that silently shrinks is data loss the reader notices only when they go
 * looking for something they know they saved. `virunga-tea-retreat` is the
 * fixture behind it: `active: false` in `src/data/stays.ts`, which Explore
 * already excludes and this deliberately does not.
 */
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  ListingCard,
  Screen,
  Text,
  UndoBar,
  useOffline,
  useToast,
  WorkspaceChip,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT } from '@/i18n/i18n';
import { useFixture } from '@/data/use-fixture';
import { useSavedStays } from '@/data/saved';
import { STAYS, type Stay } from '@/data/stays';

/** One virtualized row: one or two stays. */
type GridRow = { key: string; stays: Stay[] };

/** What the undo bar is currently offering to put back. */
interface Undoable {
  stay: Stay;
  /** Bumped per unsave so a second one restarts the timer rather than sharing it. */
  seq: number;
}

const COLUMNS = 2;

export function Saved() {
  const { c, space } = useTheme();
  const router = useRouter();
  const t = useT();
  const { workspace } = useDomain();
  const toast = useToast();

  const { ids, toggle } = useSavedStays();
  const [undoable, setUndoable] = useState<Undoable | undefined>(undefined);

  // The read the screen waits on. Keyed on nothing that changes, so the
  // skeleton is a cold-start state and not something the grid flashes every
  // time a heart is tapped — the saved SET comes from the mutation store on
  // top, which updates without a refetch, exactly as the query cache will.
  const catalogue = useFixture<Stay[]>('guest.saved.catalogue', () => STAYS);

  const saved = useMemo(() => {
    if (!catalogue.data) return [];
    // Newest saved first, which is `collection_items.created_at` descending.
    // `ids` is append-ordered, so reversing it is that ordering.
    return [...ids]
      .reverse()
      .map((id) => catalogue.data?.find((s) => s.id === id))
      .filter((s): s is Stay => s !== undefined);
  }, [catalogue.data, ids]);

  const rows = useMemo<GridRow[]>(() => {
    const out: GridRow[] = [];
    for (let i = 0; i < saved.length; i += COLUMNS) {
      const pair = saved.slice(i, i + COLUMNS);
      out.push({ key: pair.map((s) => s.id).join('+'), stays: pair });
    }
    return out;
  }, [saved]);

  const offline = useOffline();

  const openStay = useCallback(
    (stay: Stay) => router.push({ pathname: '/listing/[id]', params: { id: stay.id } }),
    [router],
  );

  const unsave = useCallback(
    (stay: Stay) => {
      toggle(stay.id);
      setUndoable((prev) => ({ stay, seq: (prev?.seq ?? 0) + 1 }));
    },
    [toggle],
  );

  const undo = useCallback(() => {
    if (!undoable) return;
    toggle(undoable.stay.id);
    setUndoable(undefined);
    // The bar goes the instant it is pressed, so without this the undo has no
    // acknowledgement at all — the card reappearing three rows down is not one.
    // The shared toast is right here and the bar was not: this carries no
    // control, so it may announce and disappear.
    toast.show(t('saved.restored', { title: undoable.stay.title }), 'success');
  }, [t, toast, toggle, undoable]);

  const dismissUndo = useCallback(() => setUndoable(undefined), []);

  return (
    <View style={{ flex: 1 }}>
      <Screen.List<GridRow>
        greeting={t('saved.greeting')}
        title={t('saved.title')}
        action={
          <WorkspaceChip
            name={workspace.name}
            role={workspace.role}
            onPress={() => router.push('/switch')}
          />
        }
        header={
          <>
            {offline ? <OfflineNote /> : null}
            {saved.length > 0 ? (
              <Text size="sm" color="textMuted">
                {saved.length === 1
                  ? t('saved.countOne')
                  : t('saved.countMany', { count: saved.length })}
              </Text>
            ) : null}
          </>
        }
        data={rows}
        keyExtractor={(row) => row.key}
        // No `accessibilityRole` on the row. A pair of cards is not a list, and
        // labelling each row as one makes a screen reader announce three lists
        // on a page that holds one grid. The cards carry their own labels,
        // which is what a reader actually navigates by.
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            {item.stays.map((stay) => (
              <View key={stay.id} style={{ flex: 1 }}>
                <SavedCard stay={stay} onOpen={() => openStay(stay)} onUnsave={() => unsave(stay)} />
              </View>
            ))}
            {/* A trailing odd card keeps its column width instead of stretching
                to fill the row, so the grid stays a grid on the last line. */}
            {item.stays.length < COLUMNS ? <View style={{ flex: 1 }} /> : null}
          </View>
        )}
        loading={catalogue.status === 'loading'}
        loadingLabel={t('state.loadingList', { label: t('saved.listLabel') })}
        loadingRows={2}
        empty={emptySlot()}
      />

      {/* Session 11 lifted this into the kit; the seq key is what restarts the
          dwell when a second card is unsaved before the first one expires. */}
      <UndoBar
        key={undoable?.seq}
        state={
          undoable
            ? { text: t('saved.removed', { title: undoable.stay.title }), onUndo: undo }
            : null
        }
        onDismiss={dismissUndo}
        icon="heart"
        actionLabel={t('saved.undo')}
        actionA11yLabel={
          undoable ? t('saved.undoLabel', { title: undoable.stay.title }) : t('saved.undo')
        }
      />
    </View>
  );

  function emptySlot() {
    if (catalogue.status === 'error') {
      return (
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', { label: t('saved.errorLabel') })}
          detail={catalogue.error?.message}
          onRetry={catalogue.retry}
        />
      );
    }
    if (catalogue.status === 'loading') return null;
    return (
      <EmptyState
        icon="heart"
        title={t('saved.emptyTitle')}
        body={t('saved.emptyBody')}
        action={
          <Button variant="outline" size="md" onPress={() => router.push('/')}>
            {t('saved.emptyAction')}
          </Button>
        }
      />
    );
  }

  function OfflineNote() {
    return (
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={t('saved.offlineNote')}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space[2],
          padding: space[3],
          borderRadius: 10,
          backgroundColor: c.warning100,
        }}
      >
        <Icon name="wifiOff" size={16} color={c.warning600} />
        <Text size="xs" color="textBody" style={{ flex: 1, lineHeight: 18 }}>
          {t('saved.offlineNote')}
        </Text>
      </View>
    );
  }
}

/**
 * One tile. The heart is always filled here — everything on this screen is
 * saved by definition — so tapping it can only ever unsave, and the card's own
 * `onToggleSave` contract is honoured by ignoring the value it reports.
 */
function SavedCard({
  stay,
  onOpen,
  onUnsave,
}: {
  stay: Stay;
  onOpen: () => void;
  onUnsave: () => void;
}) {
  const { space } = useTheme();
  const t = useT();
  const unavailable = !stay.active;

  return (
    <View style={{ gap: space[2] }}>
      <ListingCard
        item={stay}
        onPress={onOpen}
        saved
        onToggleSave={onUnsave}
        unavailable={unavailable}
        unavailableLabel={unavailable ? t('saved.unavailable') : undefined}
        accessibilityLabel={
          unavailable
            ? t('saved.unavailableA11y', { title: stay.title })
            : `${stay.title}, ${stay.location}`
        }
      />
      {/* The badge says WHAT; this says what it means for the reader and what
          happens next. The canvas rule is that consequences are printed rather
          than discovered later. */}
      {unavailable ? (
        <Text size="xs" color="textMuted" style={{ lineHeight: 17 }}>
          {t('saved.unavailableNote')}
        </Text>
      ) : null}
    </View>
  );
}
