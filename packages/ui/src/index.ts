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
export { Input, type InputProps } from "./components/input";
export { Label } from "./components/label";
/* ADR-040 call 3: the two capabilities `apps/admin` held in its own
 * primitives, absorbed here before its copies are deleted. `NativeDialog` is a
 * separate export, not a mode of `Dialog`; `Toaster` takes its list as a prop. */
export { NativeDialog } from "./components/native-dialog";
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
