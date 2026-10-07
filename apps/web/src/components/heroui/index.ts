"use client";

/**
 * The web app's one door to HeroUI 3 (`@heroui/react`).
 *
 * WHY A DOOR AND NOT A DIRECT IMPORT. `@heroui/react` has a single entry point
 * that also re-exports react-aria-components, which imports `client-only`, so a
 * Server Component that imports it fails the build ("'client-only' cannot be
 * imported from a Server Component module"). Measured, not assumed. This file
 * carries the `"use client"` boundary instead: every name below becomes a
 * client reference, so a Server Component can render `<Card>` around server
 * children without turning into a client component itself.
 *
 * WHY FLAT NAMES. A Server Component cannot dot into a client reference, so
 * `<Card.Header>` throws there at render time. Every part is exported under its
 * own name (`CardHeader`, `TabList`, `ModalDialog`) and every root under the
 * component's plain name (`Card` is `CardRoot`), which makes `Card.Header` a
 * type error everywhere rather than a runtime error in one place. Use the flat
 * names in client components too, so a file reads the same on either side of
 * the boundary.
 *
 * WHAT IS NOT HERE. The components `@injishi/ui` already wraps for the Injishi
 * vocabulary (Button, Badge, Input, Textarea, Checkbox, Switch, Slider,
 * Skeleton, Separator, Avatar, Tooltip, Label, Progress) come from that
 * package, so one variant name means one thing in every app (ADR-036). Pro
 * components arrive through `@injishi/ui/<name>` subpaths only (stepper,
 * empty-state, segment), never `@heroui-pro/react` directly: Pro is a
 * dependency of `packages/ui` alone.
 *
 * STYLING A NEXT LINK. Navigation stays on `next/link`, which a HeroUI Link
 * cannot replace without a router provider. To make a link wear a HeroUI part,
 * read the class from `@heroui/styles` (`cardVariants`, `chipVariants`,
 * `linkVariants`, `buttonVariants`), which is plain tailwind-variants and safe
 * to call in a Server Component.
 */

export {
  AlertRoot as Alert,
  AlertContent,
  AlertDescription,
  AlertIndicator,
  AlertTitle,
} from "@heroui/react";

export { BreadcrumbsRoot as Breadcrumbs, BreadcrumbsItem } from "@heroui/react";

export { ButtonGroupRoot as ButtonGroup, ButtonGroupSeparator } from "@heroui/react";

export {
  CardRoot as Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@heroui/react";

export { ChipRoot as Chip, ChipLabel } from "@heroui/react";

export { CloseButtonRoot as CloseButton } from "@heroui/react";

export { DescriptionRoot as Description } from "@heroui/react";

export {
  DisclosureRoot as Disclosure,
  DisclosureBody,
  DisclosureContent,
  DisclosureHeading,
  DisclosureIndicator,
  DisclosureTrigger,
  DisclosureGroupRoot as DisclosureGroup,
} from "@heroui/react";

export {
  DrawerRoot as Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerDialog,
  DrawerFooter,
  DrawerHandle,
  DrawerHeader,
  DrawerHeading,
  DrawerTrigger,
} from "@heroui/react";

export {
  DropdownRoot as Dropdown,
  DropdownItem,
  DropdownItemIndicator,
  DropdownMenu,
  DropdownPopover,
  DropdownSection,
  DropdownTrigger,
} from "@heroui/react";

export { EmptyStateRoot as EmptyState } from "@heroui/react";

export { ErrorMessageRoot as ErrorMessage } from "@heroui/react";

export { FieldErrorRoot as FieldError } from "@heroui/react";

export {
  FieldsetRoot as Fieldset,
  FieldGroup,
  FieldsetActions,
  FieldsetLegend,
} from "@heroui/react";

export { FormRoot as Form } from "@heroui/react";

export {
  InputGroupRoot as InputGroup,
  InputGroupInput,
  InputGroupPrefix,
  InputGroupSuffix,
  InputGroupTextArea,
} from "@heroui/react";

export {
  InputOTPRoot as InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  REGEXP_ONLY_DIGITS,
} from "@heroui/react";

export { KbdRoot as Kbd, KbdAbbr, KbdContent } from "@heroui/react";

export { LinkRoot as Link, LinkIcon } from "@heroui/react";

export {
  ListBoxRoot as ListBox,
  ListBoxItemRoot as ListBoxItem,
  ListBoxItemIndicator,
  ListBoxSectionRoot as ListBoxSection,
} from "@heroui/react";

export {
  MeterRoot as Meter,
  MeterFill,
  MeterOutput,
  MeterTrack,
} from "@heroui/react";

export {
  ModalRoot as Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseTrigger,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  ModalHeading,
  ModalIcon,
  ModalTrigger,
} from "@heroui/react";

export {
  NumberFieldRoot as NumberField,
  NumberFieldDecrementButton,
  NumberFieldGroup,
  NumberFieldIncrementButton,
  NumberFieldInput,
} from "@heroui/react";

export {
  PaginationRoot as Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationNextIcon,
  PaginationPrevious,
  PaginationPreviousIcon,
  PaginationSummary,
} from "@heroui/react";

export {
  PopoverRoot as Popover,
  PopoverArrow,
  PopoverContent,
  PopoverDialog,
  PopoverHeading,
  PopoverTrigger,
} from "@heroui/react";

export {
  ProgressBarRoot as ProgressBar,
  ProgressBarFill,
  ProgressBarOutput,
  ProgressBarTrack,
} from "@heroui/react";

export {
  ProgressCircleRoot as ProgressCircle,
  ProgressCircleFillCircle,
  ProgressCircleTrack,
  ProgressCircleTrackCircle,
} from "@heroui/react";

export {
  RadioGroupRoot as RadioGroup,
  RadioRoot as Radio,
  RadioContent,
  RadioControl,
  RadioIndicator,
} from "@heroui/react";

export { ScrollShadowRoot as ScrollShadow } from "@heroui/react";

export {
  SearchFieldRoot as SearchField,
  SearchFieldClearButton,
  SearchFieldGroup,
  SearchFieldInput,
  SearchFieldSearchIcon,
} from "@heroui/react";

export {
  SelectRoot as Select,
  SelectIndicator,
  SelectPopover,
  SelectTrigger,
  SelectValue,
} from "@heroui/react";

export { SpinnerRoot as Spinner } from "@heroui/react";

export { SurfaceRoot as Surface } from "@heroui/react";

export {
  TabsRoot as Tabs,
  Tab,
  TabIndicator,
  TabList,
  TabListContainer,
  TabPanel,
  TabSeparator,
} from "@heroui/react";

export {
  TableRoot as Table,
  TableBody,
  TableCell,
  TableColumn,
  TableContent,
  TableHeader,
  TableRow,
  TableScrollContainer,
} from "@heroui/react";

export {
  TagGroupRoot as TagGroup,
  TagGroupList,
  TagRoot as Tag,
  TagRemoveButton,
} from "@heroui/react";

export { TextFieldRoot as TextField } from "@heroui/react";

export { ToggleButtonRoot as ToggleButton } from "@heroui/react";

export {
  ToggleButtonGroupRoot as ToggleButtonGroup,
  ToggleButtonGroupSeparator,
} from "@heroui/react";

export { ToolbarRoot as Toolbar } from "@heroui/react";

export type { Key, Selection } from "@heroui/react";
