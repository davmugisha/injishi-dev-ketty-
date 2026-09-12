/**
 * Icon: maps the Injishi design-system icon names used across screens to
 * Lucide glyphs (`lucide-react-native`), so component code can keep referring
 * to icons by the same semantic name the source design uses.
 *
 * Lucide, not Feather, since ADR-040 call 6. Web draws every icon from
 * `lucide-react`, and mobile drew from Feather: two icon sets in one product,
 * which nobody chose (`mobile-v1/parity.md` section 7). The package is pinned to
 * the same version as web's `lucide-react` (1.23.0), so a name draws the same
 * glyph on both platforms.
 *
 * How each name was carried over from the Feather map:
 *
 *   - Where Feather had no glyph and the name took a stand in, it now takes the
 *     real one, the same one `apps/web/src/components/app/icon.tsx` uses:
 *     `coins` (was `dollar-sign`), `bed` (was `home`), `sparkles` (was `zap`),
 *     `building` (was `grid`), `wallet` (was `credit-card`) and `receipt` (was
 *     `file-text`). `wallet` and `coins` stay two distinct glyphs, which the
 *     money tabs rely on.
 *   - Where mobile picked one Feather glyph among several on purpose, the pick
 *     stands: `filter` is sliders rather than a funnel, `share` is the three
 *     node glyph, `edit` is a pencil.
 *   - Everything else is the same glyph under Lucide's name for it.
 *
 * **Frozen after Session 0.** Every glyph the 37 prototype frames and the Guest
 * canvas need was added in one pass, so a later session never edits this file.
 * If a session finds a name missing, it says so in its report.
 *
 * `Map` and `Image` are imported under other names because both are also
 * globals, and shadowing them in this module would be a trap for the next edit.
 */
import {
  ArrowLeft,
  ArrowRight,
  Bed,
  Bell,
  Briefcase,
  Building,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleQuestionMark,
  CircleX,
  Clock,
  Coins,
  Compass,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  Droplet,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Globe,
  Grid3x3,
  Hash,
  Heart,
  House,
  Image as ImageGlyph,
  Inbox,
  Info,
  Key,
  Layers,
  List,
  Lock,
  LockOpen,
  LogOut,
  Mail,
  Map as MapGlyph,
  MapPin,
  MessageCircle,
  MessageSquare,
  Minus,
  Moon,
  Navigation,
  Paperclip,
  Pause,
  Pencil,
  Percent,
  Phone,
  Play,
  Plus,
  Receipt,
  RefreshCw,
  Repeat,
  RotateCcw,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  SlidersVertical,
  Smartphone,
  Sparkles,
  Star,
  Sun,
  Tag,
  ThumbsUp,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  Users,
  Wallet,
  Wifi,
  WifiOff,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '@/theme/theme';

// design name -> Lucide glyph
const MAP = {
  /* Shell and navigation */
  home: House,
  compass: Compass,
  calendar: Calendar,
  inbox: Inbox,
  mail: Mail,
  message: MessageSquare,
  messageCircle: MessageCircle,
  users: Users,
  user: User,
  search: Search,
  map: MapGlyph,
  mapPin: MapPin,
  navigation: Navigation,
  globe: Globe,
  grid: Grid3x3,
  layers: Layers,
  list: List,
  building: Building,
  settings: Settings,
  logOut: LogOut,

  /* Money and compliance */
  wallet: Wallet,
  creditCard: CreditCard,
  coins: Coins,
  dollarSign: DollarSign,
  receipt: Receipt,
  percent: Percent,
  shield: Shield,
  hash: Hash,
  tag: Tag,

  /* Documents and records */
  fileText: FileText,
  key: Key,
  lock: Lock,
  unlock: LockOpen,
  edit: Pencil,
  copy: Copy,
  download: Download,
  upload: Upload,
  share: Share2,
  externalLink: ExternalLink,
  trash: Trash2,
  briefcase: Briefcase,

  /* Work and maintenance */
  wrench: Wrench,
  tool: Wrench,
  sparkles: Sparkles,
  zap: Zap,
  bed: Bed,
  flag: Flag,
  droplet: Droplet,

  /* Media and capture */
  camera: Camera,
  image: ImageGlyph,
  phone: Phone,
  send: Send,
  paperclip: Paperclip,
  play: Play,
  pause: Pause,

  /* Feedback and state */
  star: Star,
  heart: Heart,
  check: Check,
  checkCircle: CircleCheck,
  x: X,
  xCircle: CircleX,
  alert: TriangleAlert,
  alertTriangle: TriangleAlert,
  alertCircle: CircleAlert,
  info: Info,
  helpCircle: CircleQuestionMark,
  eye: Eye,
  eyeOff: EyeOff,
  thumbsUp: ThumbsUp,
  bell: Bell,
  clock: Clock,
  wifi: Wifi,
  wifiOff: WifiOff,
  smartphone: Smartphone,
  sun: Sun,
  moon: Moon,
  filter: SlidersVertical,
  refreshCw: RefreshCw,
  rotateCcw: RotateCcw,
  repeat: Repeat,

  /* Direction */
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  plus: Plus,
  minus: Minus,
  moreHorizontal: Ellipsis,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof MAP;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, color, strokeWidth }: IconProps) {
  const { c } = useTheme();
  const Glyph = MAP[name];
  return <Glyph size={size} color={color ?? c.textBody} strokeWidth={strokeWidth} />;
}
