// The Injishi UI kit for the phone (mobile spec 0002, and the prototype port's PLAN.md, Kit).
// Screens import from here.

// Type, icons, sizes and press
export { Icon, type IconName, type IconProps } from "./icon";
export { type IconSize, iconSizes, metrics } from "./metrics";
export { PressArea, type PressAreaProps } from "./press-area";
export {
  type RoleTextOptions,
  Text,
  type TextProps,
  type TextRole,
  type TextTone,
  textRoles,
  textTones,
} from "./text";
export { type Tone, tones } from "./tone";
export { FixedLight, Inverse, OnPhoto } from "./ground";
export { UiSurface, type UiSurfaceKind } from "./ui-surface";

// Chrome and layout
export { BottomInset, Dock, type DockProps, Screen, type ScreenProps, useBottomInset } from "./screen";
export { goBack, NavBar, type NavBarProps, ScreenHeader, type ScreenHeaderProps } from "./screen-header";
export { Section, type SectionProps } from "./section";
export { Card, type CardProps, type CardTone, cardTones } from "./card";
export { IconTile, type IconTileProps, ListGroup, type ListGroupProps, ListItem, type ListItemProps } from "./list";
export { KeyValue, type KeyValueProps, type KeyValueRow } from "./key-value";
export { Tile, TileGrid, type TileGridProps, type TileProps } from "./tile";
export { Banner, type BannerProps, type BannerTone, bannerTones, OfflineBar, type OfflineBarProps } from "./banner";
export { type ShowToastOptions, Toast, type ToastProps, useToast } from "./toast";
export { Divider, type DividerProps } from "./divider";
export { Row, RowAvatar, RowIcon, type RowProps, RowThumb } from "./row";

// Buttons
export { Button, type ButtonProps, type ButtonVariant, buttonVariants } from "./button";
export { IconButton, type IconButtonProps, type IconButtonVariant } from "./icon-button";

// Chips and status
export { Chip, type ChipProps, type ChipTone, type ChipVariant, chipTones } from "./chip";
export { FilterChips, type FilterChipsProps, type FilterOption } from "./filter-chips";
export { CountBadge, type CountBadgeProps, LiveDot, type LiveDotProps } from "./badge";
export { type RoomStatus, roomStatuses, roomStatusLook, StatusPill, type StatusPillProps } from "./status-pill";
export { TestMoneyBanner, type TestMoneyBannerProps, TestMoneyTag } from "./test-money";

// Forms
export { Field, type FieldProps, Input, type InputProps, TextArea } from "./field";
export { SearchBar, type SearchBarProps } from "./search-bar";
export { Segmented, type SegmentedOption, type SegmentedProps } from "./segmented";
export { Toggle, type ToggleProps } from "./toggle";
export {
  Checkbox,
  type CheckboxProps,
  Choice,
  type ChoiceProps,
  OptionTile,
  type OptionTileProps,
  Radio,
  type RadioProps,
} from "./selection";
export { Stepper, type StepperProps } from "./stepper";
export { OtpInput, type OtpInputProps } from "./otp-input";
export { Keypad, type KeypadProps, PinDots, type PinDotsProps } from "./keypad";

// Media
export { Photo, PhotoHero, type PhotoHeroProps, type PhotoProps, PhotoScrim, type PhotoScrimPreset } from "./photo";
export { Avatar, type AvatarProps, type AvatarSize } from "./avatar";
export { PagerDots, type PagerDotsProps } from "./pager-dots";
export { type MapPin, PlaceMap, type PlaceMapProps } from "./place-map";

// Progress and numbers
export {
  ProgressBar,
  type ProgressBarProps,
  type ProgressTone,
  Spinner,
  type SpinnerProps,
  StepBar,
  type StepBarProps,
} from "./progress";
export { Timeline, type TimelineProps, type TimelineState, type TimelineStep } from "./timeline";
export { Ring, type RingProps } from "./ring";
export { Kpi, type KpiProps, Sparkline, type SparklineProps } from "./kpi";

// Chat and overlays
export { Bubble, type BubbleProps, Composer, type ComposerProps } from "./chat";
export { SheetScreen, type SheetScreenProps } from "./sheet-screen";
export { Dialog, type DialogProps } from "./dialog";

// Staff and codes
export { QrCode, type QrCodeProps, qrModules } from "./qr-code";
export { RoomCell, type RoomCellProps, RoomGrid, type RoomGridProps } from "./room-grid";
export { ScanFrame, type ScanFrameProps } from "./scan-frame";

// States
export { EmptyView, type EmptyViewProps } from "./empty-view";
export { ErrorView, type ErrorViewProps } from "./error-view";
export { LoadingBone, type LoadingBoneProps, LoadingView, type LoadingViewProps } from "./loading-view";
