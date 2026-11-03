import { Text as NativeText, View } from "react-native";
import { Glyph, type IconName } from "./icon";
import { roleText } from "./text";

/**
 * A room's housekeeping state, the staff vocabulary (`.st-pill`, `.rcell`): six states plus the two
 * the front desk adds on its tent board (`.rcell.occ`, `.rcell.arr`) and `vacant`, a cell with
 * nothing to say.
 */
export const roomStatuses = [
  "dirty",
  "cleaning",
  "clean",
  "ready",
  "blocked",
  "dnd",
  "occupied",
  "arriving",
  "vacant",
] as const;
export type RoomStatus = (typeof roomStatuses)[number];

/**
 * Each state's word, icon and ground with its measured label. The prototype's pairs: dirty on the
 * warning tint, cleaning on info, clean on accent, ready on success, blocked on danger, do not
 * disturb on the neutral fill; in house on the third surface, arriving on the plain surface.
 */
export const roomStatusLook = {
  dirty: {
    word: "Dirty",
    icon: "BroomMotion",
    root: "bg-warning-soft",
    label: "text-warning-soft-foreground",
    role: "warning-soft-foreground",
  },
  cleaning: {
    word: "Cleaning",
    icon: "CirclePlay",
    root: "bg-info-soft",
    label: "text-info-soft-foreground",
    role: "info-soft-foreground",
  },
  clean: {
    word: "Clean",
    icon: "CircleCheck",
    root: "bg-accent-soft",
    label: "text-accent-soft-foreground",
    role: "accent-soft-foreground",
  },
  ready: {
    word: "Ready",
    icon: "CheckDouble",
    root: "bg-success-soft",
    label: "text-success-soft-foreground",
    role: "success-soft-foreground",
  },
  blocked: {
    word: "Blocked",
    icon: "Ban",
    root: "bg-danger-soft",
    label: "text-danger-soft-foreground",
    role: "danger-soft-foreground",
  },
  dnd: {
    word: "Do not disturb",
    icon: "Moon",
    root: "bg-default",
    label: "text-default-foreground",
    role: "default-foreground",
  },
  occupied: {
    word: "In house",
    icon: "Person",
    root: "bg-surface-tertiary",
    label: "text-surface-tertiary-foreground",
    role: "surface-tertiary-foreground",
  },
  arriving: {
    word: "Arriving",
    icon: "ArrowRightToSquare",
    root: "bg-surface",
    label: "text-accent-text",
    role: "accent-text",
  },
  vacant: { word: "Vacant", icon: "CircleDashed", root: "bg-surface", label: "text-muted", role: "muted" },
} as const satisfies Record<RoomStatus, { word: string; icon: IconName; root: string; label: string; role: string }>;

/** Chrome: `caption` at its 1.5x cap, as the `.st-pill`'s 12 bold. */
const LABEL = { ...roleText("caption", false, { strong: true }), maxFontSizeMultiplier: 1.5 };

export type StatusPillProps = {
  status: RoomStatus;
  /**
   * The words, when they say more than the state's own word ("DND 11:00"). The state's word is
   * still read aloud first if the label leaves it out.
   */
  label?: string;
  /** Another icon for the state (the prototype's clock on a timed state). */
  icon?: IconName;
};

/**
 * `.st-pill`: a room's state as an icon AND a word on its tint, never the colour alone (D-ac). A
 * screen reader hears the state's word, then the label when it adds something.
 */
export function StatusPill({ status, label, icon }: StatusPillProps) {
  const look = roomStatusLook[status];
  const words = label ?? look.word;
  const spoken = words.toLowerCase().includes(look.word.toLowerCase()) ? words : `${look.word}, ${words}`;
  return (
    // Its own row, so the pill hugs its words in a column and still centres in a row.
    <View className="flex-row">
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={spoken}
        className={`flex-row items-center gap-1 rounded-lg px-2.5 py-1 ${look.root}`}
      >
        <Glyph name={icon ?? look.icon} size={12} role={look.role} />
        <NativeText
          className={`${LABEL.className} ${look.label}`}
          maxFontSizeMultiplier={LABEL.maxFontSizeMultiplier}
          style={LABEL.style}
        >
          {words}
        </NativeText>
      </View>
    </View>
  );
}
