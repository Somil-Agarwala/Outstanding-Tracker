import type {
  CollectionBag,
  Company,
  CountLine,
  DamageRecord,
  Dispatch,
  Distributor,
  Product,
  SortedBag,
  UserAccount,
} from "@/types";

// Dates are generated relative to "today" so sample data always looks
// current, however long after cloning this someone runs it.
function daysFromNow(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export const companies: Company[] = [
  { id: "co1", name: "Cadbury", code: "CAD", claimContact: "Regional Claims Desk", isActive: true },
  { id: "co2", name: "Haldirams", code: "HLD", claimContact: "Depot Claims Officer", isActive: true },
  { id: "co3", name: "Unicharm", code: "UNI", claimContact: "Area Sales Manager", isActive: true },
  { id: "co4", name: "Red Bull", code: "RBL", claimContact: "Trade Marketing", isActive: true },
  { id: "co5", name: "Lotte", code: "LOT", isActive: true },
];

export const products: Product[] = [
  { id: "p1", companyId: "co1", sku: "FG-BISC-003", name: "Glucose Biscuits 60g", category: "Biscuits", unit: "pack", mrp: 10, costPrice: 8, isActive: true },
  { id: "p2", companyId: "co2", sku: "FG-NMKN-004", name: "Aloo Bhujia 42g", category: "Namkeen", unit: "pack", mrp: 10, costPrice: 8, isActive: true },
  { id: "p3", companyId: "co1", sku: "FG-CHOC-011", name: "Milk Chocolate Bar 22g", category: "Confectionery", unit: "bar", mrp: 10, costPrice: 8, isActive: true },
  { id: "p4", companyId: "co3", sku: "FG-SOAP-005", name: "Herbal Bathing Soap 100g", category: "Personal Care", unit: "piece", mrp: 20, costPrice: 16, isActive: true },
  { id: "p5", companyId: "co2", sku: "FG-NMKN-012", name: "Mixture Namkeen 100g", category: "Namkeen", unit: "pack", mrp: 20, costPrice: 16, isActive: true },
  { id: "p6", companyId: "co5", sku: "FG-CAND-013", name: "Toffee Jar Pack", category: "Confectionery", unit: "piece", mrp: 5, costPrice: 4, isActive: true },
  { id: "p7", companyId: "co3", sku: "FG-DET-006", name: "Detergent Bar 250g", category: "Home Care", unit: "bar", mrp: 30, costPrice: 24, isActive: true },
  { id: "p8", companyId: "co3", sku: "FG-SHMP-008", name: "Shampoo Sachet 6ml", category: "Personal Care", unit: "sachet", mrp: 5, costPrice: 4, isActive: true },
  { id: "p9", companyId: "co2", sku: "FG-TEA-007", name: "CTC Tea 50g", category: "Beverages", unit: "pack", mrp: 30, costPrice: 24, isActive: true },
  { id: "p10", companyId: "co4", sku: "FG-OIL-001", name: "Sunflower Oil 1L Pouch", category: "Edible Oil", unit: "pouch", mrp: 145, costPrice: 132, isActive: false },
];

export const distributors: Distributor[] = [
  { id: "d1", name: "Ganga Traders", contactName: "Rakesh Singh", phone: "+91 98XXX XX101", region: "Lakhimpur City", isActive: true },
  { id: "d2", name: "Purvanchal Distributors", contactName: "Anita Verma", phone: "+91 98XXX XX102", region: "Lakhimpur Rural", isActive: true },
  { id: "d3", name: "Shiv Shakti Enterprises", contactName: "Manoj Tiwari", phone: "+91 98XXX XX103", region: "Sitapur", isActive: true },
  { id: "d4", name: "Awadh Wholesale Co.", contactName: "Deepak Yadav", phone: "+91 98XXX XX104", region: "Lucknow", isActive: true },
  { id: "d5", name: "Annapurna Agencies", contactName: "Suresh Pandey", phone: "+91 98XXX XX105", region: "Hardoi", isActive: false },
  { id: "d6", name: "Vindhya Sales Corp", contactName: "Ritu Sharma", phone: "+91 98XXX XX106", region: "Sitapur", isActive: true },
];

export const collectionBags: CollectionBag[] = [
  { id: "c1", bagNumber: "CAD-COL-2026-0001", companyId: "co1", distributorId: "d1", collectedDate: daysFromNow(-18), status: "packed", countedDate: daysFromNow(-15) },
  { id: "c2", bagNumber: "CAD-COL-2026-0002", companyId: "co1", distributorId: "d3", collectedDate: daysFromNow(-16), status: "packed", countedDate: daysFromNow(-14) },
  { id: "c3", bagNumber: "CAD-COL-2026-0003", companyId: "co1", distributorId: "d2", collectedDate: daysFromNow(-9), status: "counted", countedDate: daysFromNow(-6) },
  { id: "c4", bagNumber: "HLD-COL-2026-0001", companyId: "co2", distributorId: "d4", collectedDate: daysFromNow(-7), status: "counted", countedDate: daysFromNow(-5) },
  { id: "c5", bagNumber: "UNI-COL-2026-0001", companyId: "co3", distributorId: "d6", collectedDate: daysFromNow(-4), status: "uncounted", estimatedPieces: 600, notes: "Two sealed cartons, not opened yet." },
  { id: "c6", bagNumber: "HLD-COL-2026-0002", companyId: "co2", distributorId: "d1", collectedDate: daysFromNow(-2), status: "uncounted", estimatedPieces: 900 },
  { id: "c7", bagNumber: "CAD-COL-2026-0004", companyId: "co1", distributorId: "d3", collectedDate: daysFromNow(-1), status: "uncounted" },
];

export const countLines: CountLine[] = [
  // c1 and c2 (Cadbury) are already packed into the dispatched bags below.
  { id: "cl1", collectionId: "c1", companyId: "co1", productId: "p1", mrp: 10, quantity: 820, packed: true },
  { id: "cl2", collectionId: "c1", companyId: "co1", productId: "p3", mrp: 10, quantity: 540, packed: true },
  { id: "cl3", collectionId: "c2", companyId: "co1", productId: "p3", mrp: 10, quantity: 610, packed: true },
  { id: "cl4", collectionId: "c2", companyId: "co1", productId: "p1", mrp: 10, quantity: 430, packed: true },
  // c3 (Cadbury) and c4 (Haldirams) are counted but NOT packed -- these
  // feed the packing screen, and prove the company boundary holds because
  // both contain MRP 10 pieces that must not pool together.
  { id: "cl5", collectionId: "c3", companyId: "co1", productId: "p1", mrp: 10, quantity: 460, packed: false },
  { id: "cl6", collectionId: "c3", companyId: "co1", productId: "p3", mrp: 10, quantity: 380, packed: false },
  { id: "cl7", collectionId: "c4", companyId: "co2", productId: "p2", mrp: 10, quantity: 520, packed: false },
  { id: "cl8", collectionId: "c4", companyId: "co2", productId: "p5", mrp: 20, quantity: 290, packed: false },
  { id: "cl9", collectionId: "c4", companyId: "co2", productId: "p9", mrp: 30, quantity: 240, packed: false },
];

export const sortedBags: SortedBag[] = [
  { id: "sb1", bagNumber: "CAD-M10-2026-0001", companyId: "co1", mrp: 10, pieceCount: 700, isFull: true, createdDate: daysFromNow(-13), status: "dispatched", dispatchId: "dp1", sourceCollectionIds: ["c1", "c2"] },
  { id: "sb2", bagNumber: "CAD-M10-2026-0002", companyId: "co1", mrp: 10, pieceCount: 700, isFull: true, createdDate: daysFromNow(-13), status: "dispatched", dispatchId: "dp1", sourceCollectionIds: ["c1", "c2"] },
  { id: "sb3", bagNumber: "CAD-M10-2026-0003", companyId: "co1", mrp: 10, pieceCount: 700, isFull: true, createdDate: daysFromNow(-13), status: "dispatched", dispatchId: "dp1", sourceCollectionIds: ["c1", "c2"] },
  { id: "sb4", bagNumber: "CAD-M10-2026-0004", companyId: "co1", mrp: 10, pieceCount: 300, isFull: false, createdDate: daysFromNow(-13), status: "dispatched", dispatchId: "dp1", sourceCollectionIds: ["c1", "c2"] },
];

export const dispatches: Dispatch[] = [
  {
    id: "dp1",
    dispatchNumber: "CAD-DSP-2026-0001",
    companyId: "co1",
    sentDate: daysFromNow(-12),
    bagCount: 4,
    pieceCount: 2400,
    claimedValue: 24000,
    receivedValue: 21600,
    status: "partially_settled",
    settledDate: daysFromNow(-3),
  },
];

export const records: DamageRecord[] = [
  { companyId: "co4", id: "r1", date: daysFromNow(-2), source: "own_inventory", productId: "p10", batchNumber: "B26-1091", quantity: 40, unit: "pouches", reason: "damaged_in_transit", costValue: 5280, status: "pending_review", responsibleParty: "Warehouse Team", hasPhoto: true },
  { companyId: "co3", id: "r2", date: daysFromNow(-1), source: "own_inventory", productId: "p7", batchNumber: "B26-1102", quantity: 25, unit: "bars", reason: "water_damage", costValue: 600, status: "written_off", responsibleParty: "Warehouse Team", hasPhoto: true },
  { companyId: "co1", id: "r3", date: daysFromNow(-5), source: "distributor", distributorId: "d1", productId: "p1", batchNumber: "B26-0872", quantity: 120, unit: "packs", reason: "returned_by_distributor", costValue: 960, status: "under_investigation", responsibleParty: "Ganga Traders", hasPhoto: true },
  { companyId: "co2", id: "r4", date: daysFromNow(-7), source: "own_inventory", productId: "p9", batchNumber: "B26-0990", quantity: 60, unit: "packs", reason: "expired", costValue: 1440, status: "returned_to_supplier", responsibleParty: "Warehouse Team", hasPhoto: false },
  { companyId: "co3", id: "r5", date: daysFromNow(-10), source: "distributor", distributorId: "d3", productId: "p4", batchNumber: "B26-0654", quantity: 30, unit: "pieces", reason: "quality_defect", costValue: 480, status: "resolved", responsibleParty: "Shiv Shakti Enterprises", hasPhoto: false },
  { companyId: "co1", id: "r6", date: daysFromNow(-12), source: "own_inventory", productId: "p1", batchNumber: "B26-0602", quantity: 90, unit: "packs", reason: "expired", costValue: 720, status: "disposed", responsibleParty: "Warehouse Team", hasPhoto: true },
  { companyId: "co2", id: "r7", date: daysFromNow(-14), source: "distributor", distributorId: "d2", productId: "p2", batchNumber: "B26-0511", quantity: 200, unit: "packs", reason: "expired", costValue: 1600, status: "disposed", responsibleParty: "Purvanchal Distributors", hasPhoto: true },
  { companyId: "co2", id: "r8", date: daysFromNow(-20), source: "own_inventory", productId: "p5", batchNumber: "B26-0410", quantity: 80, unit: "packs", reason: "packaging_damage", costValue: 1280, status: "written_off", responsibleParty: "Delivery Partner", hasPhoto: true },
];

export const users: UserAccount[] = [
  { id: "u1", name: "Somil", email: "somil@freshtrack.app", role: "admin", isActive: true, lastActive: daysFromNow(0) },
  { id: "u2", name: "Priya Nair", email: "priya@freshtrack.app", role: "manager", isActive: true, lastActive: daysFromNow(-1) },
  { id: "u3", name: "Arjun Mehta", email: "arjun@freshtrack.app", role: "data_entry", isActive: true, lastActive: daysFromNow(-2) },
  { id: "u4", name: "Kavita Rao", email: "kavita@freshtrack.app", role: "data_entry", isActive: true, lastActive: daysFromNow(-6) },
  { id: "u5", name: "Vikram Joshi", email: "vikram@freshtrack.app", role: "viewer", isActive: false, lastActive: daysFromNow(-40) },
];
