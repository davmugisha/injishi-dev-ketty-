import { type Href, router } from "expo-router";
import { View } from "react-native";
import { Avatar, IconTile, ListGroup, ListItem, LoadingBone, LoadingView, Radio, SheetScreen } from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { isMock } from "@/lib/data-mode";
import { protoImages } from "@/proto/images";
import { type AppKey, href } from "@/proto/screens";
import { setProtoRole, useProtoSession } from "@/proto/session";
import { useSurface } from "@/proto/surface";
import { useChoosePlace, useSwitcher } from "./data";
import type { Place } from "./types";
import { Eyebrow, Footnote, ListBones } from "./ui";

/** Where each app opens: its home (`My trips` opens the guest home before a stay). */
function homeOf(app: AppKey): Href {
  switch (app) {
    case "supervisor":
      return href("sup-floor");
    case "guest":
      return href("guest-home-before");
    case "housekeeper":
      return href("hk-today");
    case "technician":
      return href("tech-jobs");
    case "manager":
      return href("mgr-today");
    case "desk":
      return href("desk-today");
    case "resident":
      return href("res-home");
  }
}

/**
 * Switch place or role (prototype `shared-switcher`, X1): a sheet over the app with every place the
 * person works, lives or travels, grouped Work and Personal, the one in use ticked. Choosing another
 * place of the same app closes the sheet; another app opens that app's home without signing out.
 */
export function SwitcherScreen() {
  const surface = useSurface();
  const { role } = useProtoSession();
  // The app under the sheet: on sample data, the role being shown (none yet: nothing of an app is
  // underneath, and the sheet lists the supervisor's places, as the prototype draws it over the floor).
  const beneath: AppKey | null = isMock ? role : surface;
  const app: AppKey = beneath ?? "supervisor";
  const query = useSwitcher(app);
  const choose = useChoosePlace();

  const pick = (place: Place, currentId: string) => {
    // The place already in use, with its app underneath: nothing to change.
    if (place.id === currentId && place.app === beneath) {
      router.back();
      return;
    }
    choose.mutate(
      { from: app, placeId: place.id },
      {
        onSuccess: (chosen) => {
          if (!chosen) return;
          if (isMock) setProtoRole(chosen.app);
          if (chosen.app === beneath) router.back();
          else router.replace(homeOf(chosen.app));
        },
      },
    );
  };

  return (
    <SheetScreen title="Switch place" subtitle="One sign-in for every place you work, stay or live.">
      <QueryView
        query={query}
        data={query.data}
        loading={
          <LoadingView label="Loading your places">
            <LoadingBone className="h-3 w-16" />
            <ListBones rows={2} />
            <LoadingBone className="h-3 w-20" />
            <ListBones rows={1} />
          </LoadingView>
        }
      >
        {(view) => {
          const work = view.places.filter((p) => p.group === "work");
          const personal = view.places.filter((p) => p.group === "personal");
          return (
            <View className="gap-2">
              {work.length > 0 ? (
                <>
                  <Eyebrow>Work</Eyebrow>
                  <PlaceList places={work} currentId={view.currentId} onPick={(p) => pick(p, view.currentId)} />
                </>
              ) : null}
              {personal.length > 0 ? (
                <>
                  <Eyebrow className={work.length > 0 ? "mt-2" : undefined}>Personal</Eyebrow>
                  <PlaceList places={personal} currentId={view.currentId} onPick={(p) => pick(p, view.currentId)} />
                </>
              ) : null}
              <View className="mt-2">
                <Footnote>Invited somewhere new? It appears here once you accept.</Footnote>
              </View>
            </View>
          );
        }}
      </QueryView>
    </SheetScreen>
  );
}

function PlaceList({
  places,
  currentId,
  onPick,
}: {
  places: Place[];
  currentId: string;
  onPick: (place: Place) => void;
}) {
  return (
    <ListGroup>
      {places.map((place) => {
        const inUse = place.id === currentId;
        return (
          <ListItem
            key={place.id}
            leading={
              place.photo ? (
                <Avatar size="m" source={protoImages[place.photo]} />
              ) : (
                <IconTile icon={place.icon ?? "Suitcase"} />
              )
            }
            title={place.title}
            subtitle={place.detail}
            trailing={<Radio selected={inUse} />}
            chevron={false}
            onPress={() => onPick(place)}
            accessibilityLabel={`${place.title}, ${place.detail}${inUse ? ", in use" : ""}`}
          />
        );
      })}
    </ListGroup>
  );
}
