import * as XLSX from "xlsx";
import {
  COLLECTION_STATUS_LABELS,
  REASON_LABELS,
  SORTED_BAG_STATUS_LABELS,
  STATUS_LABELS,
} from "./constants";
import { formatDate } from "./utils";
import type {
  CollectionBag,
  Company,
  CountLine,
  DamageRecord,
  Dispatch,
  Distributor,
  Product,
  SortedBag,
} from "@/types";

type Row = Record<string, string | number>;

function download(sheets: { name: string; rows: Row[] }[], filename: string) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    // An empty sheet throws in some Excel readers, so emit a placeholder row.
    const rows = sheet.rows.length > 0 ? sheet.rows : [{ Note: "No rows matched the selected filters" }];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheet.name);
  });
  XLSX.writeFile(workbook, filename);
}

interface BagExportParams {
  bags: SortedBag[];
  collections: CollectionBag[];
  countLines: CountLine[];
  distributors: Distributor[];
  products: Product[];
  companies: Company[];
  filterLabel?: string;
}

/**
 * The report carried to the factory. Sheet 1 is the manifest a person can
 * physically tick off bag by bag. Sheet 2 rolls up by MRP for the claim
 * total. Sheet 3 traces every bag back to the party it came from, which
 * is what settles disputes about whose stock was in which bag.
 */
export function exportSortedBags({ bags, collections, countLines, distributors, products, companies, filterLabel }: BagExportParams) {
  const manifest: Row[] = bags.map((bag) => {
    const parties = bag.sourceCollectionIds
      .map((id) => collections.find((c) => c.id === id))
      .map((c) => distributors.find((d) => d.id === c?.distributorId)?.name)
      .filter((name): name is string => Boolean(name));
    return {
      "Bag Number": bag.bagNumber,
      Company: companies.find((c) => c.id === bag.companyId)?.name ?? "",
      "MRP (INR)": bag.mrp,
      Pieces: bag.pieceCount,
      "Claim Value (INR)": bag.pieceCount * bag.mrp,
      "Full Bag": bag.isFull ? "Yes" : "Part-filled",
      Status: SORTED_BAG_STATUS_LABELS[bag.status],
      Created: formatDate(bag.createdDate),
      Parties: Array.from(new Set(parties)).join(", "),
    };
  });

  // Grouped by company then MRP, because each company is a separate claim.
  const byTier = new Map<string, { companyId: string; mrp: number; bags: number; pieces: number }>();
  bags.forEach((bag) => {
    const key = `${bag.companyId}::${bag.mrp}`;
    const entry = byTier.get(key) ?? { companyId: bag.companyId, mrp: bag.mrp, bags: 0, pieces: 0 };
    entry.bags += 1;
    entry.pieces += bag.pieceCount;
    byTier.set(key, entry);
  });

  const summary: Row[] = Array.from(byTier.values())
    .sort((a, b) => a.companyId.localeCompare(b.companyId) || a.mrp - b.mrp)
    .map((entry) => ({
      Company: companies.find((c) => c.id === entry.companyId)?.name ?? "",
      "MRP (INR)": entry.mrp,
      Bags: entry.bags,
      Pieces: entry.pieces,
      "Claim Value (INR)": entry.pieces * entry.mrp,
    }));

  summary.push({
    Company: "TOTAL",
    "MRP (INR)": "",
    Bags: bags.length,
    Pieces: bags.reduce((sum, b) => sum + b.pieceCount, 0),
    "Claim Value (INR)": bags.reduce((sum, b) => sum + b.pieceCount * b.mrp, 0),
  });

  const includedCollectionIds = new Set(bags.flatMap((b) => b.sourceCollectionIds));
  const traceability: Row[] = countLines
    .filter((line) => includedCollectionIds.has(line.collectionId))
    .map((line) => {
      const collection = collections.find((c) => c.id === line.collectionId);
      const distributor = distributors.find((d) => d.id === collection?.distributorId);
      const product = products.find((p) => p.id === line.productId);
      return {
        "Collection Bag": collection?.bagNumber ?? "",
        Company: companies.find((c) => c.id === line.companyId)?.name ?? "",
        Party: distributor?.name ?? "",
        Collected: collection ? formatDate(collection.collectedDate) : "",
        SKU: product?.sku ?? "",
        Product: product?.name ?? "",
        "MRP (INR)": line.mrp,
        Pieces: line.quantity,
        "Value (INR)": line.quantity * line.mrp,
      };
    });

  const suffix = filterLabel ? `-${filterLabel.replace(/\s+/g, "-").toLowerCase()}` : "";
  download(
    [
      { name: "Bag Manifest", rows: manifest },
      { name: "MRP Summary", rows: summary },
      { name: "Traceability", rows: traceability },
    ],
    `bag-report${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

/** The manifest for one completed factory run. */
export function exportDispatch({
  dispatch,
  bags,
  collections,
  distributors,
  companies,
}: {
  dispatch: Dispatch;
  bags: SortedBag[];
  collections: CollectionBag[];
  distributors: Distributor[];
  companies: Company[];
}) {
  const header: Row[] = [
    { Field: "Dispatch Number", Value: dispatch.dispatchNumber },
    { Field: "Company", Value: companies.find((c) => c.id === dispatch.companyId)?.name ?? "" },
    { Field: "Sent Date", Value: formatDate(dispatch.sentDate) },
    { Field: "Total Bags", Value: dispatch.bagCount },
    { Field: "Total Pieces", Value: dispatch.pieceCount },
    { Field: "Claimed Value (INR)", Value: dispatch.claimedValue },
    { Field: "Received Value (INR)", Value: dispatch.receivedValue ?? "Not settled yet" },
  ];

  const manifest: Row[] = bags.map((bag) => {
    const parties = bag.sourceCollectionIds
      .map((id) => collections.find((c) => c.id === id))
      .map((c) => distributors.find((d) => d.id === c?.distributorId)?.name)
      .filter((name): name is string => Boolean(name));
    return {
      "Bag Number": bag.bagNumber,
      "MRP (INR)": bag.mrp,
      Pieces: bag.pieceCount,
      "Claim Value (INR)": bag.pieceCount * bag.mrp,
      Parties: Array.from(new Set(parties)).join(", "),
    };
  });

  download(
    [
      { name: "Dispatch Summary", rows: header },
      { name: "Bag Manifest", rows: manifest },
    ],
    `${dispatch.dispatchNumber}-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

/** Collection bags as currently filtered on screen. */
export function exportCollections({
  collections,
  countLines,
  distributors,
  companies,
}: {
  collections: CollectionBag[];
  countLines: CountLine[];
  distributors: Distributor[];
  companies: Company[];
}) {
  const rows: Row[] = collections.map((collection) => {
    const lines = countLines.filter((l) => l.collectionId === collection.id);
    const distributor = distributors.find((d) => d.id === collection.distributorId);
    return {
      "Bag Number": collection.bagNumber,
      Company: companies.find((c) => c.id === collection.companyId)?.name ?? "",
      Party: distributor?.name ?? "",
      Region: distributor?.region ?? "",
      Status: COLLECTION_STATUS_LABELS[collection.status],
      Collected: formatDate(collection.collectedDate),
      Counted: collection.countedDate ? formatDate(collection.countedDate) : "",
      "Estimated Pieces": collection.estimatedPieces ?? "",
      "Counted Pieces": lines.reduce((sum, l) => sum + l.quantity, 0),
      "Counted Value (INR)": lines.reduce((sum, l) => sum + l.quantity * l.mrp, 0),
    };
  });

  download([{ name: "Collections", rows }], `collections-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Own-inventory damage records as currently filtered on screen. */
export function exportRecords({
  records,
  products,
  distributors,
  companies,
}: {
  records: DamageRecord[];
  products: Product[];
  distributors: Distributor[];
  companies: Company[];
}) {
  const rows: Row[] = records.map((r) => {
    const product = products.find((p) => p.id === r.productId);
    const distributor = distributors.find((d) => d.id === r.distributorId);
    return {
      Date: formatDate(r.date),
      Company: companies.find((c) => c.id === r.companyId)?.name ?? "",
      Source: r.source === "own_inventory" ? "Own Inventory" : distributor?.name ?? "Party",
      SKU: product?.sku ?? "",
      Product: product?.name ?? "",
      Batch: r.batchNumber,
      Quantity: r.quantity,
      Unit: r.unit,
      Reason: REASON_LABELS[r.reason],
      "Cost Value (INR)": r.costValue,
      Status: STATUS_LABELS[r.status],
      "Responsible Party": r.responsibleParty,
    };
  });

  download([{ name: "Damage Records", rows }], `damage-records-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
