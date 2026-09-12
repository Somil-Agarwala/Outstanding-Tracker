"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  collectionBags as seedCollections,
  companies as seedCompanies,
  countLines as seedCountLines,
  dispatches as seedDispatches,
  products as seedProducts,
  records as seedRecords,
  sortedBags as seedSortedBags,
} from "./mock-data";
import { buildMrpTiers, nextCollectionNumber, nextDispatchNumber, packTiersIntoBags } from "./bag-packing";
import { today } from "./utils";
import type { CollectionBag, Company, CountLine, DamageRecord, Dispatch, Product, SortedBag } from "@/types";

/**
 * One in-memory store shared by every page, so the pipeline genuinely
 * flows: counting a collection makes its pieces appear on the packing
 * screen, packing creates real bags, and dispatching moves those bags.
 *
 * This is deliberately the ONLY place that mutates data. When Supabase is
 * wired up, each function below becomes a query/mutation and the
 * components calling them do not need to change.
 *
 * State is per-session and resets on refresh, which is expected until the
 * database is connected.
 */
interface StoreValue {
  companies: Company[];
  products: Product[];
  collections: CollectionBag[];
  countLines: CountLine[];
  sortedBags: SortedBag[];
  dispatches: Dispatch[];
  records: DamageRecord[];

  addProduct: (product: Omit<Product, "id">) => Product;
  addCollections: (input: { companyId: string; distributorId: string; collectedDate: string; estimatedPieces?: number; notes?: string }, bagCount: number) => CollectionBag[];
  deleteCollections: (ids: string[]) => void;
  saveCount: (collectionId: string, lines: { productId: string; mrp: number; quantity: number }[]) => void;
  packPendingForCompany: (companyId: string) => { bagCount: number; pieceCount: number };
  packPendingLines: () => { bagCount: number; pieceCount: number };
  deleteSortedBags: (ids: string[]) => void;
  createDispatch: (bagIds: string[]) => Dispatch | null;
  recordSettlement: (dispatchId: string, receivedValue: number) => void;
  deleteDispatches: (ids: string[]) => void;
  addRecord: (record: Omit<DamageRecord, "id">) => void;
  deleteRecords: (ids: string[]) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [companies] = useState<Company[]>(seedCompanies);
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [collections, setCollections] = useState<CollectionBag[]>(seedCollections);
  const [countLines, setCountLines] = useState<CountLine[]>(seedCountLines);
  const [sortedBags, setSortedBags] = useState<SortedBag[]>(seedSortedBags);
  const [dispatches, setDispatches] = useState<Dispatch[]>(seedDispatches);
  const [records, setRecords] = useState<DamageRecord[]>(seedRecords);

  const addProduct = useCallback((product: Omit<Product, "id">) => {
    const created: Product = { ...product, id: `p-${Date.now()}` };
    setProducts((prev) => [...prev, created]);
    return created;
  }, []);

  const addCollections = useCallback(
    (input: { companyId: string; distributorId: string; collectedDate: string; estimatedPieces?: number; notes?: string }, bagCount: number) => {
      // One pickup usually means several bags from the same party, so the
      // whole batch is numbered in a single pass. Sequences run per
      // company, so Cadbury and Haldirams each keep their own clean run.
      const safeCount = Math.max(1, Math.floor(bagCount));
      const stamp = Date.now();
      const code = companies.find((c) => c.id === input.companyId)?.code ?? "GEN";
      const existingForCompany = collections.filter((c) => c.companyId === input.companyId).length;

      const created: CollectionBag[] = Array.from({ length: safeCount }, (_, index) => ({
        // Index is part of the id because Date.now() returns the same
        // value for every bag created inside one loop.
        id: `c-${stamp}-${index}`,
        bagNumber: nextCollectionNumber(code, existingForCompany + index, input.collectedDate),
        companyId: input.companyId,
        distributorId: input.distributorId,
        collectedDate: input.collectedDate,
        status: "uncounted",
        estimatedPieces: input.estimatedPieces,
        notes: input.notes,
      }));

      // Reversed so the highest number ends up at the top of the list,
      // matching the newest-first order of the rest of the page.
      setCollections((prev) => [...created.slice().reverse(), ...prev]);
      return created;
    },
    [collections, companies]
  );

  const deleteCollections = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setCollections((prev) => prev.filter((c) => !idSet.has(c.id)));
    setCountLines((prev) => prev.filter((l) => !idSet.has(l.collectionId)));
  }, []);

  const saveCount = useCallback(
    (collectionId: string, lines: { productId: string; mrp: number; quantity: number }[]) => {
      // The bag's company is copied onto every line, so packing can group
      // by company without joining back through the collection each time.
      const companyId = collections.find((c) => c.id === collectionId)?.companyId ?? "";
      setCountLines((prev) => {
        const withoutOld = prev.filter((l) => l.collectionId !== collectionId);
        const created: CountLine[] = lines.map((line, index) => ({
          id: `cl-${Date.now()}-${index}`,
          collectionId,
          companyId,
          productId: line.productId,
          mrp: line.mrp,
          quantity: line.quantity,
          packed: false,
        }));
        return [...withoutOld, ...created];
      });
      setCollections((prev) =>
        prev.map((c) => (c.id === collectionId ? { ...c, status: "counted", countedDate: today() } : c))
      );
    },
    [collections]
  );

  // Shared by "pack everything" and "pack one company". Passing a filter
  // keeps the two paths identical apart from which lines they consider,
  // so they cannot drift apart.
  const packLines = useCallback(
    (matches: (line: CountLine) => boolean) => {
      const eligible = countLines.filter((l) => !l.packed && matches(l));
      if (eligible.length === 0) return { bagCount: 0, pieceCount: 0 };

      const tiers = buildMrpTiers(eligible);
      const created = packTiersIntoBags(tiers, sortedBags, companies, today());
      const eligibleIds = new Set(eligible.map((l) => l.id));
      const touchedCollectionIds = new Set(eligible.map((l) => l.collectionId));

      setSortedBags((prev) => [...prev, ...created]);
      setCountLines((prev) => prev.map((l) => (eligibleIds.has(l.id) ? { ...l, packed: true } : l)));
      // A collection only becomes "packed" once none of its lines remain
      // unpacked -- packing one company must not mark a bag finished.
      setCollections((prev) =>
        prev.map((c) => {
          if (!touchedCollectionIds.has(c.id)) return c;
          const stillPending = countLines.some((l) => l.collectionId === c.id && !l.packed && !eligibleIds.has(l.id));
          return stillPending ? c : { ...c, status: "packed" };
        })
      );

      return {
        bagCount: created.length,
        pieceCount: created.reduce((sum, b) => sum + b.pieceCount, 0),
      };
    },
    [countLines, sortedBags, companies]
  );

  const packPendingLines = useCallback(() => packLines(() => true), [packLines]);

  const packPendingForCompany = useCallback(
    (companyId: string) => packLines((line) => line.companyId === companyId),
    [packLines]
  );


  const deleteSortedBags = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setSortedBags((prev) => prev.filter((b) => !idSet.has(b.id)));
  }, []);

  const createDispatch = useCallback(
    (bagIds: string[]) => {
      const idSet = new Set(bagIds);
      const selected = sortedBags.filter((b) => idSet.has(b.id) && b.status === "ready");
      if (selected.length === 0) return null;

      // A dispatch goes to one company's factory, so refuse to build a
      // mixed one rather than silently creating an unclaimable batch.
      const companyId = selected[0].companyId;
      if (selected.some((b) => b.companyId !== companyId)) return null;

      const code = companies.find((c) => c.id === companyId)?.code ?? "GEN";
      const existingForCompany = dispatches.filter((d) => d.companyId === companyId).length;

      const dispatch: Dispatch = {
        id: `dp-${Date.now()}`,
        dispatchNumber: nextDispatchNumber(code, existingForCompany, today()),
        companyId,
        sentDate: today(),
        bagCount: selected.length,
        pieceCount: selected.reduce((sum, b) => sum + b.pieceCount, 0),
        claimedValue: selected.reduce((sum, b) => sum + b.pieceCount * b.mrp, 0),
        status: "sent",
      };

      setDispatches((prev) => [dispatch, ...prev]);
      setSortedBags((prev) =>
        prev.map((b) => (idSet.has(b.id) && b.status === "ready" ? { ...b, status: "dispatched", dispatchId: dispatch.id } : b))
      );
      return dispatch;
    },
    [dispatches, sortedBags, companies]
  );

  const recordSettlement = useCallback((dispatchId: string, receivedValue: number) => {
    setDispatches((prev) =>
      prev.map((d) =>
        d.id === dispatchId
          ? {
              ...d,
              receivedValue,
              // A short payment stays visible as "partially settled" rather
              // than silently overwriting what was originally claimed.
              status: receivedValue < d.claimedValue ? "partially_settled" : "settled",
              settledDate: today(),
            }
          : d
      )
    );
  }, []);

  const deleteDispatches = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setDispatches((prev) => prev.filter((d) => !idSet.has(d.id)));
  }, []);

  const addRecord = useCallback((record: Omit<DamageRecord, "id">) => {
    setRecords((prev) => [{ ...record, id: `r-${Date.now()}` }, ...prev]);
  }, []);

  const deleteRecords = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setRecords((prev) => prev.filter((r) => !idSet.has(r.id)));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      companies,
      products,
      collections,
      countLines,
      sortedBags,
      dispatches,
      records,
      addProduct,
      addCollections,
      deleteCollections,
      saveCount,
      packPendingLines,
      packPendingForCompany,
      deleteSortedBags,
      createDispatch,
      recordSettlement,
      deleteDispatches,
      addRecord,
      deleteRecords,
    }),
    [
      companies,
      products,
      collections,
      countLines,
      sortedBags,
      dispatches,
      records,
      addProduct,
      addCollections,
      deleteCollections,
      saveCount,
      packPendingLines,
      packPendingForCompany,
      deleteSortedBags,
      createDispatch,
      recordSettlement,
      deleteDispatches,
      addRecord,
      deleteRecords,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
