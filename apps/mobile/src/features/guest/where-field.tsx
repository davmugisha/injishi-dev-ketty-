// The dates sheet's "Where", when it sets Explore's search (`from=explore`): a place field that
// suggests districts, sectors and stays for two letters or more (AC-5), as Explore's search field did
// before this port. Picking one, or searching for the typed words, changes the search at once.

import type { ExploreMode } from "@injishi/contracts";
import { type ReactNode, useState } from "react";
import { Keyboard, View } from "react-native";
import { Field, IconButton, Input, ListGroup, ListItem, Spinner, Text } from "@/components/ui";
import { usePlaceSuggestions } from "./data";
import type { PlacePick } from "./explore-intent";
import { type ExploreIntent, intentParams, isNarrowed } from "./intent";
import type { ExploreData, PlaceSuggestion } from "./types";

const PLACE_ICON = { district: "MapPin", sector: "MapPin", property: "House" } as const;

const EVERYWHERE: PlacePick = { place: null, placeLabel: null, q: "" };

const PLACEHOLDER = "A town, sector or stay";

/**
 * The dates sheet's params from an Explore screen: it sets the search (`from=explore`), starts from
 * the search's own intent and, while nothing narrows it, shows what Explore is searching ("Rubavu,
 * Lake Kivu", "Anywhere in Rwanda") in the empty field.
 */
export function searchSheetParams(
  intent: ExploreIntent,
  data: Pick<ExploreData, "search">,
): Record<string, string | undefined> {
  return { from: "explore", ...intentParams(intent), where: isNarrowed(intent) ? undefined : data.search.title };
}

/**
 * The field, then either its suggestions or the rest of the sheet: while suggestions show, they stand
 * in for the calendar, so they sit right under the keyboard's words.
 */
export function WhereField({
  initial,
  searching,
  mode,
  onPick,
  children,
}: {
  /** What the search holds now: a picked place's label or typed words; "" for everywhere. */
  initial: string;
  /** What Explore searches with nothing narrowed, shown in the empty field. */
  searching?: string;
  mode: ExploreMode;
  /** The search changed: a place, words, or everywhere. */
  onPick: (pick: PlacePick) => void;
  /** The rest of the sheet. */
  children: ReactNode;
}) {
  const [typed, setTyped] = useState(initial);
  const [editing, setEditing] = useState(false);
  const words = typed.trim();
  const suggesting = editing && words.length >= 2;
  const places = usePlaceSuggestions(suggesting ? typed : "", mode);

  const settle = (shown: string, pick: PlacePick) => {
    setTyped(shown);
    setEditing(false);
    Keyboard.dismiss();
    onPick(pick);
  };
  const pick = (place: PlaceSuggestion) => settle(place.label, { place: place.ref, placeLabel: place.label, q: "" });
  const submit = () => settle(words, words ? { place: null, placeLabel: null, q: words } : EVERYWHERE);
  const clear = () => {
    setTyped("");
    setEditing(false);
    onPick(EVERYWHERE);
  };

  return (
    <View className="gap-4">
      <Field label="Where">
        <Input
          value={typed}
          onChangeText={(text) => {
            setTyped(text);
            setEditing(true);
          }}
          onSubmitEditing={submit}
          placeholder={searching ?? PLACEHOLDER}
          leading="MapPin"
          returnKeyType="search"
          autoCorrect={false}
          maxLength={80}
          trailing={
            typed ? (
              <IconButton icon="Xmark" label="Clear where" variant="plain" tone="muted" onPress={clear} />
            ) : undefined
          }
        />
      </Field>
      {suggesting ? (
        <View className="gap-2">
          {places.data === undefined && places.isFetching ? (
            <View className="items-center py-2">
              <Spinner size="sm" label="Finding places" />
            </View>
          ) : null}
          {places.data?.length === 0 ? (
            <Text role="caption" tone="muted" accessibilityLiveRegion="polite">
              No place or stay by that name yet. Search for the words anyway.
            </Text>
          ) : null}
          <ListGroup>
            {(places.data ?? []).map((place) => (
              <ListItem
                key={place.key}
                icon={PLACE_ICON[place.kind]}
                tone={place.kind === "property" ? "default" : "accent"}
                title={place.label}
                subtitle={place.sub}
                chevron={false}
                onPress={() => pick(place)}
              />
            ))}
            <ListItem
              icon="Magnifier"
              tone="default"
              title={`Search for “${words}”`}
              subtitle="Names, sectors and districts"
              chevron={false}
              onPress={submit}
            />
          </ListGroup>
        </View>
      ) : (
        children
      )}
    </View>
  );
}
