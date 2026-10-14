import type { BoardId, FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "stock" area: Store home, Purchase orders, Goods receipt,
 * Stock ledger and Recipes and production (storekeeper Patrick Nshimiyimana, Isangano main store).
 * Collection names are "stock.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 */

export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** Intl.NumberFormat options for a KPI value (KPI.Value formats it with the app locale). */
export interface ValueFormat {
  style?: "decimal" | "currency" | "percent";
  currency?: string;
  notation?: "standard" | "compact";
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export interface LabeledValue {
  label: string;
  value: string;
}

// ── Store home ──────────────────────────────────────────────────────────────

export interface StoreKpi {
  id: string;
  label: string;
  value: number;
  format: ValueFormat;
  foot: string;
  board: BoardId;
  /** Section of the target screen the KPI opens, e.g. "requisitions". */
  anchor: string | null;
  /** Shows the warning icon before the label. */
  warn: boolean;
}

export interface ReorderAlert {
  id: string;
  name: string;
  icon: IconName;
  onHand: number;
  reorderAt: number;
  par: number;
  unit: string;
  /** Daily use, e.g. "9 kg a day". */
  use: string;
  /** What already covers the shortfall (open orders, last price). */
  cover: string;
  /** Already picked for the draft purchase order. */
  onDraftPo: boolean;
}

export interface Delivery {
  id: string;
  po: string;
  supplier: string;
  icon: IconName;
  detail: string;
  state: string;
  tone: Tone;
  /** The truck is here: the delivery can be received now. */
  canReceive: boolean;
}

export interface StoreValueRow {
  id: string;
  measure: "value" | "cogs";
  name: string;
  value: string;
  /** Bar length, 0–100. */
  share: number;
  note: string;
}

/** A requisition from an outlet or housekeeping, filled by issuing stock (an internal transfer at cost). */
export interface StoreRequisition {
  id: string;
  from: string;
  by: string;
  lines: string;
  value: number;
  need: string;
  state: string;
  tone: Tone;
  issuable: boolean;
  /** Why it is not issuable yet. */
  waitWhy: string | null;
}

/** A line of the last count (CNT-0412) with its variance. */
export interface CountVariance {
  id: string;
  item: string;
  system: number;
  counted: number;
  /** Unit shown after the quantities ("kg", "L"); null for plain counts. */
  unit: string | null;
  unitCost: number;
  reason: string;
  reasonTone: Tone;
  adjustment: string;
}

// ── Purchase orders ─────────────────────────────────────────────────────────

export interface PurchaseOrder {
  id: string;
  supplier: string;
  amount: number;
  currency: "RWF" | "USD";
  /** Rough RWF equivalent of a foreign-currency order. */
  rwfEquivalent: number | null;
  state: string;
  tone: Tone;
  /** Approval line under the status. */
  approval: string;
  /** Steps of the purchase flow already complete (Requisition, Quotes, Approval, Sent, Received, Invoice matched). */
  stage: number;
  facts: LabeledValue[];
  /** Has a receipt in progress (opens Goods receipt). */
  toReceipt: boolean;
  /** The draft being prepared: supplier, lines and total follow the chosen quote. */
  draft: boolean;
  origin: string | null;
  purpose: string | null;
}

export interface SupplierQuote {
  id: string;
  supplier: string;
  terms: string;
  tag: string;
  tagTone: Tone;
  /** Prefix of the supplier's item codes, e.g. "KFF-". */
  codePrefix: string;
  catalogMeta: string;
  catalog: { item: string; uom: string }[];
}

/** A line of the draft purchase order PO-26-0147, priced by each quote. */
export interface DraftPoLine {
  id: string;
  name: string;
  code: string;
  qty: number;
  qtyLabel: string;
  conversion: string;
  priceUnit: "kg" | "bag";
  /** Unit price per quote id; 0 = included, null = not offered. */
  prices: Record<string, number | null>;
}

export interface ApprovalRule {
  id: string;
  band: string;
  who: string;
  icon: IconName;
  /** Upper bound of the band (RWF); null = no limit. */
  upTo: number | null;
  /** Who approves an order in this band. */
  approver: string;
  /** Word used on the submit button ("Submit for owner approval"). */
  short: string;
  /** Approval line in the order list. */
  listLabel: string;
}

/** A requisition waiting to be bought (Purchase orders · Requisitions tab). */
export interface BuyRequisition {
  id: string;
  from: string;
  by: string;
  lines: string;
  state: string;
  tone: Tone;
  note: string;
  /** Approved and not in stock: can become a purchase order. */
  convertible: boolean;
}

// ── Goods receipt ───────────────────────────────────────────────────────────

export interface GoodsReceipt {
  id: string;
  po: string;
  supplier: string;
  supplierTin: string;
  quote: string;
  /** Price tolerance per line, in percent. */
  tolerance: number;
  facts: LabeledValue[];
  invoice: {
    number: string;
    ebm: string;
    date: string;
    total: number;
    file: { name: string; meta: string };
  };
  /** Posting outcome shown once the receipt is posted. */
  postedAt: string;
  movements: string;
  location: string;
}

export interface ReceiptLine {
  id: string;
  name: string;
  unit: "kg" | "bags";
  ordered: number;
  price: number;
  arrived: number;
  rejected: number;
  invoicedQty: number;
  invoicedPrice: number;
  reason: string;
  /** Shown instead of "Not delivered" when nothing arrived. */
  note: string | null;
}

export interface MatchResolution {
  id: string;
  title: string;
  desc: string;
  action: string;
  sent: string;
}

export interface ReasonOption {
  id: string;
  label: string;
}

// ── Stock ledger ────────────────────────────────────────────────────────────

export type MovementType = "receipt" | "transfer" | "adjustment" | "wastage" | "sale" | "production" | "return";

export interface StockLocation {
  id: string;
  name: string;
}

export interface StockMovement {
  id: string;
  time: string;
  type: MovementType;
  item: string;
  location: string;
  /** Locations the movement touches (ids of stock.locations). */
  locations: string[];
  qty: string;
  /** Value at cost in RWF (signed). */
  value: number;
  source: string;
  by: string;
  note: string;
  /** A compensating event that reverses an earlier movement. */
  reversal: boolean;
  /** Recipe quantity behind a sale consumption, e.g. "650 g". */
  recipeUnit: string | null;
}

/** A line of the open blind count CNT-0418 (dry store). */
export interface CountLine {
  id: string;
  item: string;
  system: number;
  counted: number;
  unitCost: number;
  reason: string | null;
}

export interface TransferStep {
  status: "default" | "current" | "success";
  title: string;
  detail: string;
}

export interface StockTransfer {
  id: string;
  route: string;
  state: string;
  tone: Tone;
  lines: { label: string; value: number }[];
  steps: TransferStep[];
  /** State after the storekeeper dispatches it; null when already dispatched. */
  onDispatch: { state: string; tone: Tone; steps: TransferStep[] } | null;
  tax: string;
}

// ── Recipes and production ──────────────────────────────────────────────────

export interface Recipe {
  id: string;
  name: string;
  icon: IconName;
  /** List line; null when computed from the costed ingredients. */
  meta: string | null;
  warn: boolean;
  version: string;
  context: string;
  facts: (LabeledValue & { mappedValue?: string })[];
  /** Fully costed recipe (ingredients, cost basis, economics). */
  costed: boolean;
  menuPrice: number | null;
  vatRate: number | null;
  /** Food cost target, percent of net price. */
  target: number | null;
  yieldNote: string | null;
  /** Sold on POS without a recipe; mapping resolves it. */
  unmapped: boolean;
  mappedMeta: string | null;
}

export interface RecipeIngredient {
  id: string;
  recipe: string;
  name: string;
  note: string;
  qty: number;
  unit: string;
  conversion: string;
  stockUnit: string;
  /** Recipe units in one stock unit (1,000 g in a kg). */
  perStockUnit: number;
  /** Cost per stock unit at weighted average cost. */
  costAvg: number;
  /** Cost per stock unit at the latest invoice price. */
  costLatest: number;
}

export interface ProductionBatch {
  id: string;
  product: string;
  plan: string;
  inputs: { label: string; cost: number }[];
  plannedYield: number;
  minYield: number;
  maxYield: number;
  lastBatch: string;
  movements: string;
}

export interface PosEvent {
  id: string;
  title: string;
  icon: IconName;
  detail: string;
  state: string;
  tone: Tone;
  /** Held because the item has no recipe. */
  needsRecipe: boolean;
  /** How it reads once the recipe is mapped. */
  resolved: { detail: string; state: string; tone: Tone } | null;
}

// ── Data ────────────────────────────────────────────────────────────────────

const storeKpis: StoreKpi[] = [
  {
    id: "stock-value",
    label: "Stock value at cost",
    value: 20000000,
    format: {
      style: "currency",
      currency: "RWF",
      notation: "compact",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    },
    foot: "All locations · weighted average cost",
    board: "StockLedger",
    anchor: null,
    warn: false,
  },
  {
    id: "reorder",
    label: "At or below reorder point",
    value: 5,
    format: {},
    foot: "1 already out: passion fruit",
    board: "PurchaseOrders",
    anchor: null,
    warn: true,
  },
  {
    id: "deliveries",
    label: "Deliveries due today",
    value: 3,
    format: {},
    foot: "Linen delivery moved to Tuesday",
    board: "GoodsReceipt",
    anchor: null,
    warn: false,
  },
  {
    id: "requisitions",
    label: "Requisitions waiting",
    value: 4,
    format: {},
    foot: "1 needs the general manager",
    board: "StoreHome",
    anchor: "requisitions",
    warn: false,
  },
  {
    id: "variance",
    label: "Last count variance",
    value: -143200,
    format: { style: "currency", currency: "RWF" },
    foot: "CNT-0412 · 2 lines without a reason",
    board: "StockLedger",
    anchor: null,
    warn: true,
  },
];

const reorderAlerts: ReorderAlert[] = [
  {
    id: "tilapia",
    name: "Tilapia, whole fresh",
    icon: "Cherry",
    onHand: 6.5,
    reorderAt: 15,
    par: 60,
    unit: "kg",
    use: "9 kg a day",
    cover: "PO-26-0142 brings 60 kg today; still below par for the EAC Health Forum week. Draft PO-26-0147 is ready.",
    onDraftPo: true,
  },
  {
    id: "gas",
    name: "Cooking gas, LPG 45 kg cylinder",
    icon: "Flame",
    onHand: 1,
    reorderAt: 2,
    par: 6,
    unit: "cylinders",
    use: "0.6 a day",
    cover: "PO-26-0145 brings 4 cylinders at 14:00. Covered.",
    onDraftPo: false,
  },
  {
    id: "towels",
    name: "Bath towels, 70 × 140 cm",
    icon: "TShirt",
    onHand: 38,
    reorderAt: 60,
    par: 120,
    unit: "pieces",
    use: "Laundry losses 14 last count",
    cover: "PO-26-0144 delayed by Kigali Linen House to Wednesday 14 Oct.",
    onDraftPo: false,
  },
  {
    id: "oil",
    name: "Cooking oil, 20 L jerrycan",
    icon: "Droplet",
    onHand: 1,
    reorderAt: 3,
    par: 8,
    unit: "jerrycans",
    use: "0.5 a day",
    cover: "No open order. Last bought from Mahoko Market Produce at RWF 52,000.",
    onDraftPo: true,
  },
  {
    id: "passion",
    name: "Passion fruit",
    icon: "Cherry",
    onHand: 0,
    reorderAt: 10,
    par: 30,
    unit: "kg",
    use: "4 kg a day",
    cover: "Out since yesterday 19:51 · passion juice is hidden on menus.",
    onDraftPo: false,
  },
];

const deliveries: Delivery[] = [
  {
    id: "PO-26-0142",
    po: "PO-26-0142",
    supplier: "Kivu Fresh Fish Co.",
    icon: "Box",
    detail: "Tilapia, sambaza, Nile perch, ice · truck at the gate 09:40 · supplier warned of a short delivery",
    state: "Arriving",
    tone: "accent",
    canReceive: true,
  },
  {
    id: "PO-26-0145",
    po: "PO-26-0145",
    supplier: "Rubavu Gas Supplies",
    icon: "Flame",
    detail: "4 LPG 45 kg cylinders · empties to return · due 14:00",
    state: "Due 14:00",
    tone: "default",
    canReceive: false,
  },
  {
    id: "PO-26-0146",
    po: "PO-26-0146",
    supplier: "Bralirwa",
    icon: "Box",
    detail: "Primus and Mutzig, 18 crates · Lake Bar store · due 16:00",
    state: "Due 16:00",
    tone: "default",
    canReceive: false,
  },
  {
    id: "PO-26-0144",
    po: "PO-26-0144",
    supplier: "Kigali Linen House",
    icon: "TShirt",
    detail: "120 bath towels, 40 bath sheets · was due today",
    state: "Delayed to 14 Oct",
    tone: "warning",
    canReceive: false,
  },
];

const storeValues: StoreValueRow[] = [
  {
    id: "value-main",
    measure: "value",
    name: "Isangano main store",
    value: "RWF 11.2M",
    share: 56,
    note: "Dry 4.1M · cold room 2.3M · linen 3.6M · beverages 1.2M",
  },
  {
    id: "value-lakebar",
    measure: "value",
    name: "Lake Bar store",
    value: "RWF 3.4M",
    share: 17,
    note: "Beverages and bar consumables",
  },
  {
    id: "value-lodge",
    measure: "value",
    name: "Ishyamba Forest Lodge store",
    value: "RWF 2.6M",
    share: 13,
    note: "Same legal entity · separate location",
  },
  {
    id: "value-terrace",
    measure: "value",
    name: "Isangano Terrace kitchen",
    value: "RWF 1.9M",
    share: 10,
    note: "Issued, not yet consumed",
  },
  {
    id: "value-floors",
    measure: "value",
    name: "Housekeeping floor stores",
    value: "RWF 0.9M",
    share: 4,
    note: "Amenities and cleaning supplies",
  },
  {
    id: "cogs-terrace",
    measure: "cogs",
    name: "Isangano Terrace",
    value: "RWF 13.6M · 33%",
    share: 33,
    note: "Sales RWF 41.2M · target 32% · tilapia price rose 8%",
  },
  {
    id: "cogs-lakebar",
    measure: "cogs",
    name: "Lake Bar",
    value: "RWF 6.1M · 33%",
    share: 33,
    note: "Sales RWF 18.4M · target 35%",
  },
  {
    id: "cogs-ishyamba",
    measure: "cogs",
    name: "Ishyamba restaurant",
    value: "RWF 3.6M · 37%",
    share: 37,
    note: "Sales RWF 9.8M · target 34% · wastage high",
  },
  {
    id: "cogs-roomservice",
    measure: "cogs",
    name: "Room service",
    value: "RWF 1.2M · 31%",
    share: 31,
    note: "Sales RWF 3.9M · posted through Terrace recipes",
  },
];

const storeRequisitions: StoreRequisition[] = [
  {
    id: "REQ-0931",
    from: "Isangano Terrace kitchen",
    by: "Joseph Habimana · 07:40",
    lines: "14 lines · tilapia 20 kg, plantain 2 bunches, oil 5 L, rice 25 kg…",
    value: 214600,
    need: "Today 10:00",
    state: "Approved",
    tone: "success",
    issuable: true,
    waitWhy: null,
  },
  {
    id: "REQ-0933",
    from: "Housekeeping linen room",
    by: "Beatrice Mukandori · 07:55",
    lines: "6 lines · bath towels 30 of the 38 in store, soap 120, toilet paper 96…",
    value: 268400,
    need: "Today 12:00",
    state: "Approved",
    tone: "success",
    issuable: true,
    waitWhy: null,
  },
  {
    id: "REQ-0930",
    from: "Ishyamba Forest Lodge store",
    by: "Lodge manager · 11 Oct",
    lines: "2 lines · LPG cylinders 2, cooking oil 2 jerrycans · transfer between properties of the same legal entity",
    value: 252000,
    need: "Tomorrow",
    state: "Approved",
    tone: "success",
    issuable: true,
    waitWhy: null,
  },
  {
    id: "REQ-0934",
    from: "Lake Bar",
    by: "Lake Bar supervisor · 08:05",
    lines: "2 lines · Primus 6 crates, Mutzig 4 crates",
    value: 286000,
    need: "Today 16:00",
    state: "Waiting for GM",
    tone: "warning",
    issuable: false,
    waitWhy: "Above the bar par level · Aline Uwase approves",
  },
];

const countVariances: CountVariance[] = [
  {
    id: "towels",
    item: "Bath towels, 70 × 140 cm",
    system: 52,
    counted: 38,
    unit: null,
    unitCost: 7000,
    reason: "Needs a reason",
    reasonTone: "warning",
    adjustment: "Not posted · needs GM approval over RWF 50,000",
  },
  {
    id: "primus",
    item: "Primus 500 ml",
    system: 312,
    counted: 288,
    unit: null,
    unitCost: 1100,
    reason: "Needs a reason",
    reasonTone: "warning",
    adjustment: "Not posted · recount requested",
  },
  {
    id: "oil",
    item: "Cooking oil, litres",
    system: 46,
    counted: 41,
    unit: "L",
    unitCost: 2500,
    reason: "Unrecorded kitchen issue",
    reasonTone: "default",
    adjustment: "Posted MV-26-21302 · 6 Oct",
  },
  {
    id: "rice",
    item: "Rice, kilograms",
    system: 112,
    counted: 104,
    unit: "kg",
    unitCost: 1200,
    reason: "Spillage · torn bag",
    reasonTone: "default",
    adjustment: "Posted MV-26-21303 · 6 Oct",
  },
  {
    id: "sugar",
    item: "Sugar, kilograms",
    system: 57,
    counted: 60,
    unit: "kg",
    unitCost: 1100,
    reason: "Unit error on receipt",
    reasonTone: "default",
    adjustment: "Posted MV-26-21304 · 6 Oct",
  },
];

const purchaseOrders: PurchaseOrder[] = [
  {
    id: "PO-26-0147",
    supplier: "Kivu Fresh Fish Co.",
    amount: 1093000,
    currency: "RWF",
    rwfEquivalent: null,
    state: "Draft",
    tone: "default",
    approval: "Above RWF 1M · owner",
    stage: 2,
    facts: [],
    toReceipt: false,
    draft: true,
    origin: "From REQ-0931 and 3 reorder alerts · prepared 08:20",
    purpose: "Weekly fish order for Isangano Terrace ahead of the EAC Health Forum block",
  },
  {
    id: "PO-26-0146",
    supplier: "Bralirwa",
    amount: 684000,
    currency: "RWF",
    rwfEquivalent: null,
    state: "Sent",
    tone: "info",
    approval: "Approved by Aline Uwase 10 Oct",
    stage: 3,
    facts: [
      { label: "Lines", value: "Primus 500 ml 12 crates, Mutzig 500 ml 6 crates" },
      { label: "Delivers to", value: "Lake Bar store · today 16:00" },
      { label: "Approval", value: "General manager band · approved 10 Oct 16:12" },
      { label: "Units", value: "1 crate = 20 bottles · stock held in bottles" },
    ],
    toReceipt: false,
    draft: false,
    origin: null,
    purpose: null,
  },
  {
    id: "PO-26-0145",
    supplier: "Rubavu Gas Supplies",
    amount: 296000,
    currency: "RWF",
    rwfEquivalent: null,
    state: "Sent",
    tone: "info",
    approval: "Approved by Aline Uwase 11 Oct",
    stage: 3,
    facts: [
      { label: "Lines", value: "LPG 45 kg cylinder × 4 at RWF 74,000" },
      { label: "Delivers to", value: "Isangano main store · today 14:00" },
      { label: "Empties", value: "4 empties go back with the driver" },
      { label: "Approval", value: "General manager band · approved 11 Oct 09:30" },
    ],
    toReceipt: false,
    draft: false,
    origin: null,
    purpose: null,
  },
  {
    id: "PO-26-0144",
    supplier: "Kigali Linen House",
    amount: 1260,
    currency: "USD",
    rwfEquivalent: 1795500,
    state: "Delayed",
    tone: "warning",
    approval: "Approved by Didier Mugenzi 9 Oct",
    stage: 3,
    facts: [
      { label: "Lines", value: "Bath towels 120, bath sheets 40" },
      { label: "Currency", value: "USD · converted at RWF 1,425 to the dollar, the rate set in finance on 9 Oct" },
      { label: "Approval", value: "Owner band · approved 9 Oct 18:05" },
      { label: "Delivery", value: "Supplier moved it to Wednesday 14 Oct" },
    ],
    toReceipt: false,
    draft: false,
    origin: null,
    purpose: null,
  },
  {
    id: "PO-26-0142",
    supplier: "Kivu Fresh Fish Co.",
    amount: 577000,
    currency: "RWF",
    rwfEquivalent: null,
    state: "Part received",
    tone: "accent",
    approval: "Approved by Aline Uwase 10 Oct",
    stage: 4,
    facts: [
      { label: "Lines", value: "Tilapia 60 kg, sambaza 10 kg, Nile perch 15 kg, ice 10 bags" },
      { label: "Received today", value: "Receipt GRN-26-0318 in progress · Nile perch back-ordered" },
      { label: "Supplier invoice", value: "KFF-INV-2210 · price differs from the PO" },
      { label: "Approval", value: "General manager band · approved 10 Oct 17:40" },
    ],
    toReceipt: true,
    draft: false,
    origin: null,
    purpose: null,
  },
  {
    id: "PO-26-0139",
    supplier: "Mahoko Market Produce",
    amount: 238500,
    currency: "RWF",
    rwfEquivalent: null,
    state: "Closed",
    tone: "success",
    approval: "Matched and approved for payment",
    stage: 6,
    facts: [
      { label: "Lines", value: "Plantain 10 bunches, avocado 200, tomatoes 30 kg, onions 25 kg" },
      { label: "Received", value: "GRN-26-0309 · 9 Oct · all accepted" },
      { label: "Match", value: "PO, receipt and invoice MMP-5521 agree" },
      { label: "Payable", value: "Approved by Grace Uwera · 10 Oct" },
    ],
    toReceipt: false,
    draft: false,
    origin: null,
    purpose: null,
  },
];

const supplierQuotes: SupplierQuote[] = [
  {
    id: "kff",
    supplier: "Kivu Fresh Fish Co.",
    terms: "Quote Q-2291 · valid to 15 Oct · delivery in 2 days · 15 days credit",
    tag: "Complete · lowest complete quote",
    tagTone: "success",
    codePrefix: "KFF-",
    catalogMeta: "TIN 107 654 321 · VAT registered · lead time 2 days",
    catalog: [
      { item: "Tilapia, whole fresh", uom: "kg → kg · RWF 5,200" },
      { item: "Sambaza, dried", uom: "bag 5 kg → kg · RWF 47,500" },
      { item: "Nile perch fillet", uom: "kg → kg · RWF 11,000" },
      { item: "Ice", uom: "bag 5 kg · RWF 500" },
    ],
  },
  {
    id: "gfc",
    supplier: "Gisenyi Fishers Cooperative",
    terms: "Quote GFC-118 · minimum 200 kg tilapia · no Nile perch · cash on delivery",
    tag: "Incomplete",
    tagTone: "warning",
    codePrefix: "GFC-",
    catalogMeta: "TIN 109 330 412 · cooperative · lead time 3 days",
    catalog: [
      { item: "Tilapia, whole fresh", uom: "kg → kg · min 200 kg" },
      { item: "Sambaza, dried", uom: "bag 5 kg → kg · RWF 45,000" },
      { item: "Ice", uom: "bag 5 kg · RWF 500" },
    ],
  },
  {
    id: "lka",
    supplier: "Lake Kivu Aquafarm Ltd",
    terms: "Quote LKA-77 · farmed tilapia · next-day delivery · 30 days credit",
    tag: "Complete · highest",
    tagTone: "default",
    codePrefix: "LKA-",
    catalogMeta: "TIN 110 562 008 · VAT registered · lead time 1 day",
    catalog: [
      { item: "Tilapia, farmed", uom: "kg → kg · RWF 5,600" },
      { item: "Sambaza, dried", uom: "bag 5 kg → kg · RWF 50,000" },
      { item: "Nile perch fillet", uom: "kg → kg · RWF 11,500" },
      { item: "Ice", uom: "Included with delivery" },
    ],
  },
];

const draftPoLines: DraftPoLine[] = [
  {
    id: "TIL-W",
    name: "Tilapia, whole fresh",
    code: "TIL-W",
    qty: 140,
    qtyLabel: "140 kg",
    conversion: "1 kg = 1 kg stock",
    priceUnit: "kg",
    prices: { kff: 5200, gfc: 5000, lka: 5600 },
  },
  {
    id: "SAM-D",
    name: "Sambaza, dried",
    code: "SAM-D",
    qty: 4,
    qtyLabel: "4 bags of 5 kg",
    conversion: "1 bag = 5 kg · 20 kg",
    priceUnit: "bag",
    prices: { kff: 47500, gfc: 45000, lka: 50000 },
  },
  {
    id: "NPF",
    name: "Nile perch fillet",
    code: "NPF",
    qty: 15,
    qtyLabel: "15 kg",
    conversion: "1 kg = 1 kg stock",
    priceUnit: "kg",
    prices: { kff: 11000, gfc: null, lka: 11500 },
  },
  {
    id: "ICE-5",
    name: "Ice",
    code: "ICE-5",
    qty: 20,
    qtyLabel: "20 bags of 5 kg",
    conversion: "Consumable · not stocked",
    priceUnit: "bag",
    prices: { kff: 500, gfc: 500, lka: 0 },
  },
];

const approvalRules: ApprovalRule[] = [
  {
    id: "storekeeper",
    band: "Up to RWF 250,000",
    who: "Storekeeper",
    icon: "Person",
    upTo: 250000,
    approver: "you",
    short: "your",
    listLabel: "Up to RWF 250,000 · storekeeper",
  },
  {
    id: "gm",
    band: "RWF 250,001 to 1,000,000",
    who: "General manager",
    icon: "Persons",
    upTo: 1000000,
    approver: "Aline Uwase, general manager",
    short: "GM",
    listLabel: "RWF 250,001 to 1M · GM",
  },
  {
    id: "owner",
    band: "Above RWF 1,000,000",
    who: "Owner",
    icon: "CrownDiamond",
    upTo: null,
    approver: "Didier Mugenzi, owner",
    short: "owner",
    listLabel: "Above RWF 1M · owner",
  },
];

const buyRequisitions: BuyRequisition[] = [
  {
    id: "REQ-0931",
    from: "Isangano Terrace kitchen",
    by: "Joseph Habimana · today 07:40",
    lines: "14 lines · 10 issued from stock, 4 fish lines added to PO-26-0147",
    state: "Approved",
    tone: "success",
    note: "Partly on PO-26-0147",
    convertible: false,
  },
  {
    id: "REQ-0935",
    from: "Housekeeping linen room",
    by: "Beatrice Mukandori · today 08:02",
    lines: "Guest soap 400, shampoo 300, toilet paper 240 · not enough in store",
    state: "Approved",
    tone: "success",
    note: "Estimated RWF 612,000 · general manager band",
    convertible: true,
  },
  {
    id: "REQ-0934",
    from: "Lake Bar",
    by: "Lake Bar supervisor · today 08:05",
    lines: "Primus 6 crates, Mutzig 4 crates",
    state: "Waiting for GM",
    tone: "warning",
    note: "Above the bar par level · Aline Uwase decides",
    convertible: false,
  },
  {
    id: "REQ-0929",
    from: "Ishyamba Forest Lodge store",
    by: "Lodge manager · 10 Oct",
    lines: "Charcoal 30 bags",
    state: "Rejected",
    tone: "default",
    note: "Rejected by Aline Uwase · buy locally in Nyamagabe",
    convertible: false,
  },
];

const receipts: GoodsReceipt[] = [
  {
    id: "GRN-26-0318",
    po: "PO-26-0142",
    supplier: "Kivu Fresh Fish Co.",
    supplierTin: "107 654 321",
    quote: "Q-2291",
    tolerance: 2,
    facts: [
      { label: "Delivery note", value: "DN-8841 · signed by the driver" },
      { label: "Arrived", value: "Today 09:42 · truck RAD 412 K" },
      { label: "Cold chain", value: "3.1 °C on arrival · limit 4 °C" },
      { label: "Receiving into", value: "Cold room · Isangano main store" },
      { label: "Received by", value: "Patrick Nshimiyimana · witness Joseph Habimana" },
    ],
    invoice: {
      number: "KFF-INV-2210",
      ebm: "SDC0107-NS-55127",
      date: "12 Oct 2026",
      total: 318400,
      file: { name: "KFF-INV-2210.pdf", meta: "214 KB · photo of the signed invoice · 09:58" },
    },
    postedAt: "10:05",
    movements: "MV-26-21880 to 21883",
    location: "the cold room",
  },
];

const receiptLines: ReceiptLine[] = [
  {
    id: "til",
    name: "Tilapia, whole fresh",
    unit: "kg",
    ordered: 60,
    price: 5200,
    arrived: 42,
    rejected: 3,
    invoicedQty: 39,
    invoicedPrice: 5600,
    reason: "Quality · soft flesh, strong smell",
    note: null,
  },
  {
    id: "sam",
    name: "Sambaza, dried",
    unit: "kg",
    ordered: 10,
    price: 9500,
    arrived: 10,
    rejected: 0,
    invoicedQty: 10,
    invoicedPrice: 9500,
    reason: "Quality",
    note: null,
  },
  {
    id: "npf",
    name: "Nile perch fillet",
    unit: "kg",
    ordered: 15,
    price: 11000,
    arrived: 0,
    rejected: 0,
    invoicedQty: 0,
    invoicedPrice: 0,
    reason: "Quality",
    note: "Back-ordered · supplier says Tuesday",
  },
  {
    id: "ice",
    name: "Ice, 5 kg bags",
    unit: "bags",
    ordered: 10,
    price: 500,
    arrived: 10,
    rejected: 0,
    invoicedQty: 10,
    invoicedPrice: 500,
    reason: "Melted",
    note: null,
  },
];

const rejectionReasons: ReasonOption[] = [
  { id: "quality-soft", label: "Quality · soft flesh, strong smell" },
  { id: "quality", label: "Quality" },
  { id: "melted", label: "Melted" },
  { id: "damaged", label: "Damaged in transit" },
  { id: "cold-chain", label: "Cold chain broken · above 4 °C" },
  { id: "not-ordered", label: "Not on the purchase order" },
];

const matchResolutions: MatchResolution[] = [
  {
    id: "credit",
    title: "Ask for a credit note",
    desc: "Kivu Fresh Fish Co. issues a fiscal credit note for the difference. The invoice is never edited.",
    action: "Send request to supplier",
    sent: "Credit note requested 10:12 · payable stays blocked until it arrives",
  },
  {
    id: "accept",
    title: "Accept the new price",
    desc: "Needs Aline Uwase, general manager, with a reason. Stock cost is adjusted by a new movement.",
    action: "Request GM approval",
    sent: "Sent to Aline Uwase 10:12 · waiting for her decision",
  },
  {
    id: "hold",
    title: "Hold and send to Finance",
    desc: "Grace Uwera, finance, decides with the supplier. Nothing is paid meanwhile.",
    action: "Send to Finance",
    sent: "With Grace Uwera since 10:12 · on hold",
  },
];

const locations: StockLocation[] = [
  { id: "main", name: "Isangano main store" },
  { id: "terrace", name: "Isangano Terrace kitchen" },
  { id: "lakebar", name: "Lake Bar store" },
  { id: "lodge", name: "Ishyamba Forest Lodge store" },
];

const movements: StockMovement[] = [
  {
    id: "MV-26-21880",
    time: "10:05",
    type: "receipt",
    item: "Tilapia, whole fresh",
    location: "Cold room · main store",
    locations: ["main"],
    qty: "+39 kg",
    value: 202800,
    source: "GRN-26-0318",
    by: "Patrick Nshimiyimana",
    note: "PO cost RWF 5,200 a kg",
    reversal: false,
    recipeUnit: null,
  },
  {
    id: "MV-26-21882",
    time: "10:05",
    type: "receipt",
    item: "Sambaza, dried",
    location: "Cold room · main store",
    locations: ["main"],
    qty: "+10 kg",
    value: 95000,
    source: "GRN-26-0318",
    by: "Patrick Nshimiyimana",
    note: "PO cost RWF 9,500 a kg",
    reversal: false,
    recipeUnit: null,
  },
  {
    id: "MV-26-21884",
    time: "10:20",
    type: "transfer",
    item: "Tilapia, whole fresh",
    location: "Cold room → Terrace kitchen",
    locations: ["main", "terrace"],
    qty: "20 kg",
    value: 104000,
    source: "TR-0092",
    by: "Patrick Nshimiyimana",
    note: "Internal · out and in posted together",
    reversal: false,
    recipeUnit: null,
  },
  {
    id: "MV-26-21890",
    time: "12:41",
    type: "sale",
    item: "Tilapia, whole fresh",
    location: "Terrace kitchen",
    locations: ["terrace"],
    qty: "−0.65 kg",
    value: -3445,
    source: "pos-evt-9c1e-0412-02",
    by: "System · from POS",
    note: "Order T6-0412 line 2 · Grilled tilapia with plantain × 1",
    reversal: false,
    recipeUnit: "650 g",
  },
  {
    id: "MV-26-21891",
    time: "12:41",
    type: "sale",
    item: "Plantain",
    location: "Terrace kitchen",
    locations: ["terrace"],
    qty: "−0.35 kg",
    value: -280,
    source: "pos-evt-9c1e-0412-02",
    by: "System · from POS",
    note: "Same event, second ingredient",
    reversal: false,
    recipeUnit: "350 g",
  },
  {
    id: "MV-26-21895",
    time: "14:10",
    type: "production",
    item: "Pili pili sauce",
    location: "Terrace kitchen",
    locations: ["terrace"],
    qty: "+3 L",
    value: 14100,
    source: "PB-0058",
    by: "Joseph Habimana",
    note: "Output of batch at input cost",
    reversal: false,
    recipeUnit: null,
  },
  {
    id: "MV-26-21896",
    time: "14:10",
    type: "production",
    item: "Fresh chillies",
    location: "Terrace kitchen",
    locations: ["terrace"],
    qty: "−0.8 kg",
    value: -2400,
    source: "PB-0058",
    by: "Joseph Habimana",
    note: "Input to batch",
    reversal: false,
    recipeUnit: null,
  },
  {
    id: "MV-26-21902",
    time: "15:30",
    type: "wastage",
    item: "Avocado",
    location: "Terrace kitchen",
    locations: ["terrace"],
    qty: "−6 pcs",
    value: -1500,
    source: "WS-0331",
    by: "Joseph Habimana",
    note: "Overripe · photo attached",
    reversal: false,
    recipeUnit: null,
  },
  {
    id: "MV-26-21903",
    time: "16:02",
    type: "return",
    item: "Mutzig 500 ml",
    location: "Lake Bar store → Bralirwa",
    locations: ["lakebar"],
    qty: "−20 btl",
    value: -22000,
    source: "RTN-0012",
    by: "Patrick Nshimiyimana",
    note: "Broken crate returned to the supplier",
    reversal: false,
    recipeUnit: null,
  },
  {
    id: "MV-26-21904",
    time: "16:15",
    type: "adjustment",
    item: "Cooking oil",
    location: "Dry store · main store",
    locations: ["main"],
    qty: "−2 L",
    value: -5000,
    source: "CNT-0412 recount",
    by: "Approved by Aline Uwase",
    note: "Reason: unrecorded kitchen issue",
    reversal: false,
    recipeUnit: null,
  },
  {
    id: "MV-26-21911",
    time: "19:53",
    type: "sale",
    item: "Mutzig 500 ml",
    location: "Lake Bar store",
    locations: ["lakebar"],
    qty: "+1 btl",
    value: 1100,
    source: "Reverses MV-26-21907",
    by: "System · void VD-01",
    note: "Compensating event for void on T2-0409 · not served",
    reversal: true,
    recipeUnit: null,
  },
];

const countLines: CountLine[] = [
  { id: "rice", item: "Rice, kg", system: 98, counted: 98, unitCost: 1200, reason: null },
  { id: "oil", item: "Cooking oil, L", system: 39, counted: 37, unitCost: 2500, reason: "Unrecorded kitchen issue" },
  { id: "sugar", item: "Sugar, kg", system: 60, counted: 60, unitCost: 1100, reason: null },
  { id: "maize", item: "Maize flour, kg", system: 45, counted: 41, unitCost: 900, reason: null },
  { id: "beans", item: "Beans, kg", system: 70, counted: 72, unitCost: 1300, reason: "Unit error on receipt" },
  { id: "salt", item: "Salt, kg", system: 18, counted: 18, unitCost: 400, reason: null },
  { id: "paste", item: "Tomato paste, tins", system: 96, counted: 90, unitCost: 650, reason: "Damaged · bulged tins" },
];

const varianceReasons: ReasonOption[] = [
  { id: "spillage", label: "Spillage" },
  { id: "kitchen-issue", label: "Unrecorded kitchen issue" },
  { id: "unit-error", label: "Unit error on receipt" },
  { id: "bulged", label: "Damaged · bulged tins" },
  { id: "theft", label: "Theft suspected" },
  { id: "recount", label: "Recount needed" },
];

const transfers: StockTransfer[] = [
  {
    id: "TR-0092",
    route: "Cold room, main store → Isangano Terrace kitchen · for REQ-0931",
    state: "Received",
    tone: "success",
    lines: [
      { label: "Tilapia, whole fresh · 20 kg", value: 104000 },
      { label: "Plantain · 19 kg (2 bunches)", value: 15200 },
      { label: "Cooking oil · 5 L", value: 12500 },
      { label: "Rice · 25 kg", value: 30000 },
    ],
    steps: [
      { status: "success", title: "Dispatched", detail: "10:20 · Patrick Nshimiyimana" },
      { status: "success", title: "Received in full", detail: "10:34 · Joseph Habimana counted and signed" },
    ],
    onDispatch: null,
    tax: "Same legal entity and property · no fiscal document",
  },
  {
    id: "TR-0093",
    route: "Isangano main store → Ishyamba Forest Lodge store · for REQ-0930",
    state: "Ready to dispatch",
    tone: "default",
    lines: [
      { label: "LPG 45 kg cylinder · 2", value: 148000 },
      { label: "Cooking oil · 2 jerrycans (40 L)", value: 104000 },
    ],
    steps: [
      { status: "current", title: "Picked and packed", detail: "Waiting for the lodge vehicle" },
      { status: "default", title: "Receive at Ishyamba", detail: "The lodge counts and signs" },
    ],
    onDispatch: {
      state: "In transit",
      tone: "info",
      steps: [
        { status: "success", title: "Dispatched", detail: "10:41 · Patrick Nshimiyimana · vehicle RAB 233 C" },
        {
          status: "current",
          title: "Waiting for the lodge to count and receive",
          detail: "Stock shows in transit until then",
        },
      ],
    },
    tax: "Another property of Amahoro Hospitality Ltd · still internal · no VAT invoice",
  },
];

const recipes: Recipe[] = [
  {
    id: "tilapia",
    name: "Grilled tilapia with plantain",
    icon: "Cherry",
    meta: null,
    warn: false,
    version: "Recipe v3 · effective 1 Oct 2026 · approved by Joseph Habimana",
    context: "Isangano Terrace dinner menu v14 · POS code GT-01 · Grill station",
    facts: [],
    costed: true,
    menuPrice: 14000,
    vatRate: 0.18,
    target: 32,
    yieldNote: "Yield 1 portion · about 450 g plated",
    unmapped: false,
    mappedMeta: null,
  },
  {
    id: "brochette",
    name: "Beef brochettes with chips",
    icon: "Flame",
    meta: "Menu RWF 12,000 · food cost 29%",
    warn: false,
    version: "Recipe v2 · effective 1 Sep 2026",
    context: "Grill station · Terrace dinner menu",
    facts: [
      { label: "Beef sirloin", value: "250 g" },
      { label: "Potatoes", value: "300 g · chips" },
      { label: "Cooking oil", value: "60 ml" },
      { label: "Cost per portion", value: "RWF 2,950" },
    ],
    costed: false,
    menuPrice: 12000,
    vatRate: 0.18,
    target: 32,
    yieldNote: null,
    unmapped: false,
    mappedMeta: null,
  },
  {
    id: "isombe",
    name: "Isombe with rice",
    icon: "Cherry",
    meta: "Menu RWF 9,000 · food cost 22%",
    warn: false,
    version: "Recipe v1 · effective 1 Jun 2026",
    context: "Hot line · Terrace lunch and dinner",
    facts: [
      { label: "Cassava leaves", value: "300 g" },
      { label: "Rice", value: "150 g" },
      { label: "Palm oil", value: "30 ml" },
      { label: "Cost per portion", value: "RWF 1,680" },
    ],
    costed: false,
    menuPrice: 9000,
    vatRate: 0.18,
    target: 32,
    yieldNote: null,
    unmapped: false,
    mappedMeta: null,
  },
  {
    id: "pili",
    name: "Pili pili sauce",
    icon: "Droplet",
    meta: "Sub-recipe · batch of 3 L",
    warn: false,
    version: "Sub-recipe v4 · effective 15 Aug 2026",
    context: "Produced in batches · held as stock in litres",
    facts: [
      { label: "Batch size", value: "3 L" },
      { label: "Shelf life", value: "7 days refrigerated" },
      { label: "Last batch", value: "PB-0058 · RWF 4,700 a litre" },
      { label: "Used in", value: "Grilled tilapia, brochettes, sambaza fry" },
    ],
    costed: false,
    menuPrice: null,
    vatRate: null,
    target: null,
    yieldNote: null,
    unmapped: false,
    mappedMeta: null,
  },
  {
    id: "juice",
    name: "Passion juice",
    icon: "Cup",
    meta: "Batch of 1 L · passion fruit out of stock",
    warn: true,
    version: "Sub-recipe v2 · effective 1 Jul 2026",
    context: "Lake Bar and Terrace",
    facts: [
      { label: "Passion fruit", value: "1.2 kg a litre" },
      { label: "Sugar", value: "120 g a litre" },
      { label: "Stock now", value: "Passion fruit 0 kg · item hidden on menus" },
      { label: "Reorder", value: "On draft PO for Mahoko Market Produce" },
    ],
    costed: false,
    menuPrice: null,
    vatRate: null,
    target: null,
    yieldNote: null,
    unmapped: false,
    mappedMeta: null,
  },
  {
    id: "special",
    name: "Chef's special",
    icon: "CircleQuestion",
    meta: "Sold on POS · no recipe mapped",
    warn: true,
    version: "No recipe yet",
    context: "Sold 2 times today on Till 2",
    facts: [
      { label: "Last sale", value: "T6-0415 · 13:05 · 2 portions" },
      {
        label: "Stock effect",
        value: "Nothing deducted · held in the exception queue",
        mappedValue: "Posted after mapping · 2 events replayed",
      },
      { label: "Who maps it", value: "Kitchen lead or storekeeper" },
      { label: "Why it matters", value: "Unmapped sales hide real food cost" },
    ],
    costed: false,
    menuPrice: null,
    vatRate: null,
    target: null,
    yieldNote: null,
    unmapped: true,
    mappedMeta: "Mapped to Kivu sambaza fry",
  },
];

const recipeIngredients: RecipeIngredient[] = [
  {
    id: "tilapia-tilapia",
    recipe: "tilapia",
    name: "Tilapia, whole fresh",
    note: "Whole fish, cleaned and scored",
    qty: 650,
    unit: "g",
    conversion: "kg · 1 kg = 1,000 g",
    stockUnit: "kg",
    perStockUnit: 1000,
    costAvg: 5300,
    costLatest: 5600,
  },
  {
    id: "tilapia-plantain",
    recipe: "tilapia",
    name: "Plantain",
    note: "Bought by the bunch, stocked by weight",
    qty: 350,
    unit: "g",
    conversion: "kg · 1 bunch ≈ 9.5 kg",
    stockUnit: "kg",
    perStockUnit: 1000,
    costAvg: 800,
    costLatest: 800,
  },
  {
    id: "tilapia-oil",
    recipe: "tilapia",
    name: "Cooking oil",
    note: "",
    qty: 40,
    unit: "ml",
    conversion: "L · 1 L = 1,000 ml",
    stockUnit: "L",
    perStockUnit: 1000,
    costAvg: 2500,
    costLatest: 2500,
  },
  {
    id: "tilapia-pili",
    recipe: "tilapia",
    name: "Pili pili sauce",
    note: "Sub-recipe · made in batches",
    qty: 30,
    unit: "ml",
    conversion: "L · from production",
    stockUnit: "L",
    perStockUnit: 1000,
    costAvg: 4700,
    costLatest: 4700,
  },
  {
    id: "tilapia-lemon",
    recipe: "tilapia",
    name: "Lemon",
    note: "",
    qty: 0.5,
    unit: "piece",
    conversion: "piece",
    stockUnit: "piece",
    perStockUnit: 1,
    costAvg: 100,
    costLatest: 100,
  },
  {
    id: "tilapia-spice",
    recipe: "tilapia",
    name: "Salt and spice mix",
    note: "",
    qty: 10,
    unit: "g",
    conversion: "kg · 1 kg = 1,000 g",
    stockUnit: "kg",
    perStockUnit: 1000,
    costAvg: 1500,
    costLatest: 1500,
  },
  {
    id: "tilapia-charcoal",
    recipe: "tilapia",
    name: "Charcoal",
    note: "Grill fuel",
    qty: 300,
    unit: "g",
    conversion: "kg · 1 bag = 30 kg",
    stockUnit: "kg",
    perStockUnit: 1000,
    costAvg: 400,
    costLatest: 400,
  },
];

const batches: ProductionBatch[] = [
  {
    id: "PB-0059",
    product: "Pili pili sauce",
    plan: "Planned 3 L for tonight · Joseph Habimana · Terrace kitchen",
    inputs: [
      { label: "Fresh chillies · 0.8 kg", cost: 2400 },
      { label: "Tomatoes · 2 kg", cost: 2400 },
      { label: "Cooking oil · 1.5 L", cost: 3750 },
      { label: "Garlic · 0.3 kg", cost: 1200 },
      { label: "Onions · 1 kg", cost: 1000 },
      { label: "Lemon · 10 pieces", cost: 1000 },
      { label: "Salt and spice mix · 0.2 kg", cost: 300 },
    ],
    plannedYield: 3,
    minYield: 2.5,
    maxYield: 3.5,
    lastBatch: "Last batch PB-0058: 3 L at RWF 4,700 a litre",
    movements: "MV-26-21920 to 21927",
  },
];

const posEvents: PosEvent[] = [
  {
    id: "evt-0412-02",
    title: "pos-evt-9c1e-0412-02",
    icon: "CircleCheck",
    detail: "T6-0412 line 2 · Grilled tilapia × 1 · confirmed 12:41 · 7 ingredients deducted (MV-26-21890 onwards)",
    state: "Posted",
    tone: "success",
    needsRecipe: false,
    resolved: null,
  },
  {
    id: "evt-0412-02-retry-2",
    title: "pos-evt-9c1e-0412-02 · retry 2",
    icon: "CopyCheck",
    detail: "Arrived again at 12:41:40 after a POS timeout · same ID, so nothing was deducted",
    state: "Duplicate ignored",
    tone: "default",
    needsRecipe: false,
    resolved: null,
  },
  {
    id: "evt-0409-03",
    title: "pos-evt-77b0-0409-03",
    icon: "ArrowUturnCcwLeft",
    detail: "Void of Mutzig 500 ml on T2-0409, not served · compensating +1 bottle reverses MV-26-21907",
    state: "Correction posted",
    tone: "info",
    needsRecipe: false,
    resolved: null,
  },
  {
    id: "evt-0418-05",
    title: "pos-evt-a71f-0418-05",
    icon: "Hourglass",
    detail: "T6-0418 · Grilled tilapia × 1 · sent 19:49 · posts when the kitchen bumps the ticket",
    state: "Waiting",
    tone: "warning",
    needsRecipe: false,
    resolved: null,
  },
  {
    id: "evt-0415-01",
    title: "pos-evt-5d2c-0415-01",
    icon: "CircleExclamation",
    detail: "Chef's special × 2 · no recipe mapped · held, nothing deducted",
    state: "Exception",
    tone: "danger",
    needsRecipe: true,
    resolved: {
      detail: "Chef's special × 2 · mapped to Kivu sambaza fry and replayed once",
      state: "Posted after mapping",
      tone: "success",
    },
  },
];

export const fixtures = {
  "stock.homeKpis": storeKpis,
  "stock.reorderAlerts": reorderAlerts,
  "stock.deliveries": deliveries,
  "stock.storeValues": storeValues,
  "stock.storeRequisitions": storeRequisitions,
  "stock.countVariances": countVariances,
  "stock.purchaseOrders": purchaseOrders,
  "stock.supplierQuotes": supplierQuotes,
  "stock.draftPoLines": draftPoLines,
  "stock.approvalRules": approvalRules,
  "stock.buyRequisitions": buyRequisitions,
  "stock.receipts": receipts,
  "stock.receiptLines": receiptLines,
  "stock.rejectionReasons": rejectionReasons,
  "stock.matchResolutions": matchResolutions,
  "stock.locations": locations,
  "stock.movements": movements,
  "stock.countLines": countLines,
  "stock.varianceReasons": varianceReasons,
  "stock.transfers": transfers,
  "stock.recipes": recipes,
  "stock.recipeIngredients": recipeIngredients,
  "stock.batches": batches,
  "stock.posEvents": posEvents,
} satisfies FixtureSet;
