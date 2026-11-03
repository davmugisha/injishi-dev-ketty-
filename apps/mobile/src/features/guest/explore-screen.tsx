import type { ExploreMode, ExplorePlace, ExploreSort } from "@injishi/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { type ComponentRef, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import { Chip, EmptyView, Icon, IconButton, LoadingView, PressArea, Row, RowIcon, Text } from "@/components/ui";
import { roleText } from "@/components/ui/text";
import { AsOf, QueryError, QueryView } from "@/data/query-view";
import { ExploreCardBones, ExploreCardView } from "./explore-card";
import { EMPTY_INTENT, type ExploreIntent, intentFrom, intentParams, isNarrowed } from "./intent";
import { useExploreSearch, usePlaces } from "./queries";
import { countWords } from "./words";

const SORTS: { value: ExploreSort; label: string }[] = [
  { value: "top_rated", label: "Top rated" },
  { value: "price_asc", label: "Price, low to high" },
  { value: "price_desc", label: "Price, high to low" },
];

const MODES: { value: ExploreMode; label: string }[] = [
  { value: "stays", label: "Stays" },
  { value: "homes", label: "Homes" },
];

const PLACE_ICON = { district: "MapPin", sector: "MapPin", property: "House" } as const;

/** The field's words: the `body` role, growing with the phone's font size like every other text. */
const FIELD_TEXT = roleText("body");

/**
 * Explore (mobile spec 0005, feature 23, prototype `guest-04-explore`): search stays and homes across
 * Rwanda by place or name, sorted and paged on the server, for anyone, signed in or not. The search
 * lives in the route's params (the search intent), so back and sign in keep it. Dates, party, filters
 * and the map join in milestone 3.
 */
export function ExploreScreen() {
  const params = useLocalSearchParams();
  const intent = useMemo(() => intentFrom(params), [params]);
  const search = useExploreSearch(intent);
  const insets = useSafeAreaInsets();

  const setIntent = (next: ExploreIntent) => {
    const carried = intentParams(next);
    // Every key is named, so a cleared one leaves the route rather than lingering in it.
    router.setParams({
      mode: carried.mode,
      q: carried.q,
      place: carried.place,
      placeLabel: carried.placeLabel,
      sort: carried.sort,
    });
  };

  const results = useMemo(() => search.data?.pages.flatMap((p) => p.results), [search.data]);
  const total = search.data?.pages[0]?.total;
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await search.refetch();
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1" style={{ paddingTop: insets.top + 8 }}>
        <SearchField intent={intent} onChange={setIntent}>
          <QueryView
            query={search}
            data={results}
            offlineNote={null}
            loading={
              <LoadingView label="Loading stays" className="px-4 pt-2">
                <ExploreCardBones />
                <ExploreCardBones />
                <ExploreCardBones />
              </LoadingView>
            }
          >
            {(cards) => (
              <FlatList
                data={cards}
                keyExtractor={(c) => c.id}
                renderItem={({ item }) => <ExploreCardView card={item} />}
                contentContainerClassName="gap-6 px-4 pb-8"
                keyboardShouldPersistTaps="handled"
                onEndReachedThreshold={0.6}
                onEndReached={() => {
                  if (search.hasNextPage && !search.isFetchingNextPage && !search.isFetchNextPageError) {
                    void search.fetchNextPage();
                  }
                }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
                ListHeaderComponent={
                  <View className="gap-1">
                    <Choices intent={intent} onChange={setIntent} />
                    <View className="px-1 pt-1">
                      {total !== undefined ? (
                        <Text role="callout" tone="muted" accessibilityLiveRegion="polite">
                          <Text role="headline">{countWords(total, intent.mode)}</Text> · verified businesses only
                        </Text>
                      ) : null}
                      <AsOf query={search} />
                    </View>
                  </View>
                }
                ListEmptyComponent={
                  <NoResults
                    intent={intent}
                    onClear={() => setIntent({ ...EMPTY_INTENT, mode: intent.mode, sort: intent.sort })}
                    onRetry={() => void search.refetch()}
                  />
                }
                ListFooterComponent={
                  search.isFetchingNextPage ? (
                    <LoadingView label="Loading more stays">
                      <ExploreCardBones />
                    </LoadingView>
                  ) : search.isFetchNextPageError ? (
                    <QueryError error={search.error} onRetry={() => void search.fetchNextPage()} offlineNote={null} />
                  ) : undefined
                }
              />
            )}
          </QueryView>
        </SearchField>
      </View>
    </View>
  );
}

/** Stays or homes, and the order, as chips under the search (AC-6). */
function Choices({ intent, onChange }: { intent: ExploreIntent; onChange: (next: ExploreIntent) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-2">
      {MODES.map((m) => (
        <Chip
          key={m.value}
          label={m.label}
          selected={intent.mode === m.value}
          onPress={() => onChange({ ...intent, mode: m.value })}
        />
      ))}
      <View className="mx-1 h-6 w-px bg-separator" />
      {SORTS.map((s) => (
        <Chip
          key={s.value}
          label={s.label}
          selected={intent.sort === s.value}
          onPress={() => onChange({ ...intent, sort: s.value })}
        />
      ))}
    </ScrollView>
  );
}

/** A search with no match says so and offers to clear it (AC-8); with none narrowed, nothing is live yet. */
function NoResults({ intent, onClear, onRetry }: { intent: ExploreIntent; onClear: () => void; onRetry: () => void }) {
  const noun = intent.mode === "homes" ? "homes" : "stays";
  return isNarrowed(intent) ? (
    <EmptyView
      icon="Magnifier"
      title={`No ${noun} match`}
      body={`Nothing listed matches “${intent.placeLabel ?? intent.q}”. Try another place or name.`}
      action={{ label: "Clear search", icon: "Xmark", onPress: onClear }}
    />
  ) : (
    <EmptyView
      icon="House"
      title={`No ${noun} yet`}
      body={`${intent.mode === "homes" ? "Homes" : "Stays"} show here the moment a business publishes them.`}
      action={{ label: "Check again", onPress: onRetry }}
    />
  );
}

/**
 * The place field (AC-5): two letters or more suggest districts, sectors and properties that have
 * something to find; picking one filters by it, and Search on the keyboard filters by the words.
 * While suggestions show, they stand in for the list.
 */
function SearchField({
  intent,
  onChange,
  children,
}: {
  intent: ExploreIntent;
  onChange: (next: ExploreIntent) => void;
  children: ReactNode;
}) {
  const shown = intent.placeLabel ?? intent.q;
  const [typed, setTyped] = useState(shown);
  const [focused, setFocused] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const places = usePlaces(intent.mode, focused ? typed : "");
  const placeholder = String(useCSSVariable("--color-field-placeholder"));
  const ink = String(useCSSVariable("--color-field-foreground"));

  // A new search from outside (back, a cleared search) shows its own words.
  useEffect(() => {
    if (!focused) setTyped(shown);
  }, [shown, focused]);

  const done = () => {
    setFocused(false);
    input.current?.blur();
    Keyboard.dismiss();
  };
  const pick = (place: ExplorePlace) => {
    setTyped(place.label);
    onChange({ ...intent, place: place.ref, placeLabel: place.label, q: "" });
    done();
  };
  const submit = () => {
    onChange({ ...intent, place: null, placeLabel: null, q: typed.trim() });
    done();
  };
  const clear = () => {
    setTyped("");
    onChange({ ...intent, place: null, placeLabel: null, q: "" });
  };

  const suggesting = focused && typed.trim().length >= 2;
  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-2 px-4 pb-3">
        <View className="min-h-12 flex-1 flex-row items-center gap-2 rounded-full border border-field-border bg-field pr-1 pl-4">
          <Icon name="Magnifier" size={20} tone="muted" />
          <TextInput
            ref={input}
            value={typed}
            onChangeText={setTyped}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={submit}
            placeholder="Where to? A town, sector or stay"
            placeholderTextColor={placeholder}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search by place or name"
            maxLength={80}
            maxFontSizeMultiplier={FIELD_TEXT.maxFontSizeMultiplier}
            className={`flex-1 py-3 ${FIELD_TEXT.className}`}
            style={[FIELD_TEXT.style, { color: ink }]}
          />
          {typed ? <IconButton icon="Xmark" label="Clear search" onPress={clear} /> : null}
        </View>
        {focused ? (
          <PressArea onPress={done} accessibilityLabel="Close search" className="items-center justify-center px-1">
            <Text role="headline" tone="accent">
              Cancel
            </Text>
          </PressArea>
        ) : null}
      </View>
      {suggesting ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="pb-8">
          {(places.data?.places ?? []).map((p) => (
            <Row
              key={`${p.kind}:${p.id}`}
              leading={<RowIcon name={PLACE_ICON[p.kind]} tone={p.kind === "property" ? "default" : "accent"} />}
              title={p.label}
              subtitle={p.sub}
              onPress={() => pick(p)}
            />
          ))}
          {places.data && places.data.places.length === 0 ? (
            <Text role="callout" tone="muted" className="px-4 py-3">
              No place or stay by that name yet. Search for the words anyway.
            </Text>
          ) : null}
          <Row
            leading={<RowIcon name="Magnifier" />}
            title={`Search for “${typed.trim()}”`}
            subtitle="Names, sectors and districts"
            onPress={submit}
          />
        </ScrollView>
      ) : (
        <View className="flex-1">{children}</View>
      )}
    </View>
  );
}
