export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./components/accordion";
export { Avatar, AvatarImage, AvatarFallback } from "./components/avatar";
export { Badge, badgeVariants, type BadgeProps } from "./components/badge";
/* The one bar chart: a shared scale, the chart roles, the value as text. */
export { BarList, type BarListRow } from "./components/bar-list";
/* ADR-044 D-e 4: the one trail above a record, in every app. */
export { Breadcrumbs, type Crumb } from "./components/breadcrumbs";
export { Button, buttonVariants, type ButtonProps } from "./components/button";
/* ADR-058, 058-list-framework: the one list screen and its parts. Built on
 * TanStack Table (logic only) and dnd-kit (the board), reading the one list
 * spec from @injishi/contracts so the client and the route agree. */
export { BulkBar, type BulkAction, type BulkBarProps } from "./components/bulk-bar";
export { Calendar, HALF_BAND } from "./components/calendar";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/card";
export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  CarouselDots,
  useCarousel,
} from "./components/carousel";
export { Checkbox } from "./components/checkbox";
export { CardGrid, type CardGridProps } from "./components/card-grid";
export { ColumnChooser, type ColumnChooserProps } from "./components/column-chooser";
export { DataTable, type DataColumn, type DataTableProps } from "./components/data-table";
export { DataView, type DataViewProps } from "./components/data-view";
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/dialog";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./components/dropdown-menu";
export { FilterPanel, type FilterPanelProps, type RefOption } from "./components/filter-panel";
export { GroupSelect, type GroupSelectProps } from "./components/group-select";
export { Input, type InputProps } from "./components/input";
export { KanbanBoard, type KanbanBoardProps, type KanbanStage } from "./components/kanban-board";
export { Label } from "./components/label";
/* ADR-040 call 3: the two capabilities `apps/admin` held in its own
 * primitives, absorbed here before its copies are deleted. `NativeDialog` is a
 * separate export, not a mode of `Dialog`; `Toaster` takes its list as a prop. */
export { NativeDialog } from "./components/native-dialog";
export { Pager, type PagerProps } from "./components/pager";
export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from "./components/popover";
/* Promoted out of `apps/app` by ADR-036 call 10, taking this package from 21
 * components to 24. They were the only three that app owned with no twin here,
 * and leaving them behind would have left a `components/ui/` folder in it,
 * which is the exact place the next copy of `button.tsx` appears. */
export { Progress } from "./components/progress";
export {
  SavedViewsMenu,
  type NewSavedView,
  type SavedViewsMenuProps,
} from "./components/saved-views-menu";
export { ScrollArea, ScrollBar } from "./components/scroll-area";
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from "./components/select";
export { Separator } from "./components/separator";
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./components/sheet";
export { Skeleton } from "./components/skeleton";
export { StatusChips, type StatusChipsProps } from "./components/status-chips";
export { Slider } from "./components/slider";
export { Switch } from "./components/switch";
export { Tabs, TabsList, TabsTrigger, TabsContent, type TabsVariant } from "./components/tabs";
export { Textarea } from "./components/textarea";
export { Toaster, toastDwellMs, type Toast, type ToastTone } from "./components/toaster";
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./components/tooltip";
/* The list screen's state, kept in the URL (058-list-framework AC-LF2). */
export {
  readListState,
  savedViewConfigOf,
  stateOfSavedView,
  useListState,
  writeListState,
  type ListViewState,
  type ReadListState,
  type UseListState,
  type UseListStateOptions,
} from "./lib/use-list-state";

/* HeroUI Pro (a paid licence, `@heroui-pro/react`) is NOT exported from this
 * barrel, on purpose. Import each Pro adapter from its own subpath:
 *   import { KPI, KPIGroup } from "@injishi/ui/kpi";
 *   import { DataGrid } from "@injishi/ui/data-grid";
 *   (also empty-state, stepper, trend-chip, number-value, segment)
 * A barrel export would put Pro, and recharts behind KPI, into the module graph
 * of every page that imports anything from here, admin included, which uses no
 * Pro. Pro's own package keeps its heavy components subpath only for the same
 * reason. Every build that imports one needs Pro's code downloaded (kpi.tsx). */
