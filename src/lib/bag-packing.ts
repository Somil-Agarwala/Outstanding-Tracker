import type { Company, CountLine, SortedBag } from "@/types";

/** Pieces per sorted bag. Change here and every projection follows. */
export const BAG_CAPACITY = 700;

export interface MrpTier {
  companyId: string;
  mrp: number;
  pieces: number;
  /** Bags this tier will produce: full bags plus one part-filled remainder. */
  fullBags: number;
  remainder: number;
  totalBags: number;
  value: number;
  sourceCollectionIds: string[];
}

/**
 * Groups unpacked count lines into COMPANY + MRP tiers.
 *
 * Company is the hard boundary: each company settles its own claim at its
 * own factory, so pieces never pool across companies no matter how well
 * the MRP matches. Within one company, pieces DO pool across parties,
 * because that is what fills a bag to capacity instead of leaving a
 * part-filled bag per party. Traceability survives via sourceCollectionIds.
 */
export function buildMrpTiers(lines: CountLine[]): MrpTier[] {
  const tiers = new Map<string, { companyId: string; mrp: number; pieces: number; collections: Set<string> }>();

  lines
    .filter((line) => !line.packed)
    .forEach((line) => {
      const key = `${line.companyId}::${line.mrp}`;
      const entry = tiers.get(key) ?? { companyId: line.companyId, mrp: line.mrp, pieces: 0, collections: new Set<string>() };
      entry.pieces += line.quantity;
      entry.collections.add(line.collectionId);
      tiers.set(key, entry);
    });

  return Array.from(tiers.values())
    .map((entry) => {
      const fullBags = Math.floor(entry.pieces / BAG_CAPACITY);
      const remainder = entry.pieces % BAG_CAPACITY;
      return {
        companyId: entry.companyId,
        mrp: entry.mrp,
        pieces: entry.pieces,
        fullBags,
        remainder,
        totalBags: fullBags + (remainder > 0 ? 1 : 0),
        value: entry.pieces * entry.mrp,
        sourceCollectionIds: Array.from(entry.collections),
      };
    })
    .sort((a, b) => a.companyId.localeCompare(b.companyId) || a.mrp - b.mrp);
}

function codeFor(companies: Company[], companyId: string): string {
  return companies.find((c) => c.id === companyId)?.code ?? "GEN";
}

/**
 * Turns tiers into concrete SortedBag rows. Bag numbers lead with the
 * company code and carry the MRP tier (CAD-M10-2026-0008), so someone
 * holding the physical bag can read both off the label without a lookup.
 * Sequence numbers run per company, not globally.
 */
export function packTiersIntoBags(
  tiers: MrpTier[],
  existingBags: SortedBag[],
  companies: Company[],
  dateStr: string
): SortedBag[] {
  const year = new Date(dateStr).getFullYear();
  const bags: SortedBag[] = [];

  // Per-company running sequence, seeded from what already exists.
  const sequences = new Map<string, number>();
  existingBags.forEach((bag) => {
    sequences.set(bag.companyId, (sequences.get(bag.companyId) ?? 0) + 1);
  });

  tiers.forEach((tier) => {
    const code = codeFor(companies, tier.companyId);
    let remaining = tier.pieces;
    while (remaining > 0) {
      const pieceCount = Math.min(BAG_CAPACITY, remaining);
      const seq = (sequences.get(tier.companyId) ?? 0) + 1;
      sequences.set(tier.companyId, seq);

      bags.push({
        id: `sb-${tier.companyId}-${year}-${seq}`,
        bagNumber: `${code}-M${tier.mrp}-${year}-${String(seq).padStart(4, "0")}`,
        companyId: tier.companyId,
        mrp: tier.mrp,
        pieceCount,
        isFull: pieceCount === BAG_CAPACITY,
        createdDate: dateStr,
        status: "ready",
        sourceCollectionIds: tier.sourceCollectionIds,
      });
      remaining -= pieceCount;
    }
  });

  return bags;
}

/** Per-company collection number, e.g. CAD-COL-2026-0042. */
export function nextCollectionNumber(companyCode: string, existingCountForCompany: number, dateStr: string): string {
  const year = new Date(dateStr).getFullYear();
  return `${companyCode}-COL-${year}-${String(existingCountForCompany + 1).padStart(4, "0")}`;
}

/** Per-company dispatch number, e.g. CAD-DSP-2026-0007. */
export function nextDispatchNumber(companyCode: string, existingCountForCompany: number, dateStr: string): string {
  const year = new Date(dateStr).getFullYear();
  return `${companyCode}-DSP-${year}-${String(existingCountForCompany + 1).padStart(4, "0")}`;
}

export function sortedBagValue(bag: SortedBag): number {
  return bag.pieceCount * bag.mrp;
}
