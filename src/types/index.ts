export type SourceType = "own_inventory" | "distributor";

export type ReasonCategory =
  | "damaged_in_transit"
  | "expired"
  | "quality_defect"
  | "water_damage"
  | "packaging_damage"
  | "returned_by_distributor"
  | "other";

export type ResolutionStatus =
  | "pending_review"
  | "under_investigation"
  | "written_off"
  | "returned_to_supplier"
  | "disposed"
  | "resolved";

export type UserRole = "admin" | "manager" | "data_entry" | "viewer";

/**
 * A principal / brand whose damaged goods you claim against. Each company
 * settles its own claims at its own factory, so a bag and a dispatch
 * always belong to exactly one company -- they are never mixed.
 */
export interface Company {
  id: string;
  name: string;
  /** Short code used to prefix bag numbers, e.g. CAD-M10-2026-0008. */
  code: string;
  claimContact?: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  /** Printed price. Sorted bags are packed by MRP tier, so this drives packing. */
  mrp: number;
  /** What the stock costs you. Drives the loss-value estimate on a record. */
  costPrice: number;
  isActive: boolean;
}

export interface Distributor {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  region: string;
  isActive: boolean;
}

/** A free-standing damage/expiry record, logged against your own inventory. */
export interface DamageRecord {
  id: string;
  companyId: string;
  date: string;
  source: SourceType;
  distributorId?: string;
  productId: string;
  batchNumber: string;
  quantity: number;
  unit: string;
  reason: ReasonCategory;
  costValue: number;
  status: ResolutionStatus;
  responsibleParty: string;
  hasPhoto: boolean;
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* The physical reimbursement pipeline                                 */
/*                                                                     */
/*   CollectionBag (sealed, uncounted)                                 */
/*        -> counted -> CountLine[] (SKU x quantity)                   */
/*        -> packed  -> SortedBag[] (700 pieces, one MRP tier each)     */
/*        -> sent    -> Dispatch (the factory run)                     */
/* ------------------------------------------------------------------ */

export type CollectionStatus = "uncounted" | "counted" | "packed";

/** What physically comes back from a party, before anyone opens it. */
export interface CollectionBag {
  id: string;
  bagNumber: string;
  /** Whose goods these are. One bag never mixes companies. */
  companyId: string;
  distributorId: string;
  collectedDate: string;
  status: CollectionStatus;
  countedDate?: string;
  /** Rough count written on the bag at pickup, before proper counting. */
  estimatedPieces?: number;
  notes?: string;
}

/** One counted SKU line inside a collection bag. */
export interface CountLine {
  id: string;
  collectionId: string;
  /** Copied from the parent bag so packing can group without a join. */
  companyId: string;
  productId: string;
  /** Snapshotted at count time so later MRP changes cannot rewrite history. */
  mrp: number;
  quantity: number;
  /** Set once these pieces have been packed into a SortedBag. */
  packed: boolean;
}

export type SortedBagStatus = "ready" | "dispatched";

/**
 * A packed bag destined for the factory. Holds exactly one MRP tier and
 * at most CAPACITY pieces -- pieces from different SKUs share a bag as
 * long as the printed price matches.
 */
export interface SortedBag {
  id: string;
  bagNumber: string;
  companyId: string;
  mrp: number;
  pieceCount: number;
  /** False when this is the trailing part-filled bag for its MRP tier. */
  isFull: boolean;
  createdDate: string;
  status: SortedBagStatus;
  dispatchId?: string;
  /** Collection bags whose pieces ended up in here, for traceability. */
  sourceCollectionIds: string[];
}

export type DispatchStatus = "sent" | "under_review" | "partially_settled" | "settled" | "rejected";

/** One physical run to the factory carrying many sorted bags. */
export interface Dispatch {
  id: string;
  dispatchNumber: string;
  /** A dispatch goes to one company's factory, so it is single-company. */
  companyId: string;
  sentDate: string;
  bagCount: number;
  pieceCount: number;
  claimedValue: number;
  receivedValue?: number;
  status: DispatchStatus;
  settledDate?: string;
  notes?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastActive: string;
}
