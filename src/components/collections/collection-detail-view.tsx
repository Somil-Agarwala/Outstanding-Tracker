"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Inbox, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { distributors } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { CollectionStatusBadge } from "./collection-status-badge";
import { CountSheet, type DraftLine } from "./count-sheet";

export function CollectionDetailView({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const { collections, companies, countLines, products, saveCount, deleteCollections } = useStore();
  const [counting, setCounting] = useState(false);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const collection = collections.find((c) => c.id === collectionId);

  if (!collection) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState
          icon={Inbox}
          title="Collection bag not found"
          description="It may have been deleted, or the link is out of date."
          action={<Link href="/collections"><Button variant="outline">Back to collections</Button></Link>}
        />
      </div>
    );
  }

  const distributor = distributors.find((d) => d.id === collection.distributorId);
  const company = companies.find((c) => c.id === collection.companyId);
  const lines = countLines.filter((l) => l.collectionId === collection.id);
  const totalPieces = lines.reduce((sum, l) => sum + l.quantity, 0);
  const totalValue = lines.reduce((sum, l) => sum + l.quantity * l.mrp, 0);

  function startCounting() {
    setDraftLines(lines.map((l) => ({ key: l.id, productId: l.productId, quantity: l.quantity })));
    setCounting(true);
  }

  function handleSaveCount() {
    const payload = draftLines
      .filter((l) => l.quantity > 0)
      .map((l) => {
        const product = products.find((p) => p.id === l.productId);
        return { productId: l.productId, mrp: product?.mrp ?? 0, quantity: l.quantity };
      });
    saveCount(collection!.id, payload);
    setCounting(false);
    setNotice("Counted. These pieces are now waiting to be packed into sorted bags.");
    window.setTimeout(() => setNotice(null), 5000);
  }

  function handleDelete() {
    if (!window.confirm(`Delete ${collection!.bagNumber}? This cannot be undone.`)) return;
    deleteCollections([collection!.id]);
    router.push("/collections");
  }

  return (
    <div>
      <Link href="/collections" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-dim hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All collections
      </Link>

      <Notice message={notice} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold text-ink">{collection.bagNumber}</h1>
            <CollectionStatusBadge status={collection.status} />
          </div>
          <p className="mt-1 text-sm text-ink-dim">
            {company?.name} · {distributor?.name} · {distributor?.region}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!counting && collection.status !== "packed" && (
            <Button onClick={startCounting}>
              <ClipboardCheck className="h-4 w-4" />
              {collection.status === "uncounted" ? "Start counting" : "Edit count"}
            </Button>
          )}
          <Button variant="danger" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Counted pieces"
          value={collection.status === "uncounted" ? "Not counted" : formatNumber(totalPieces)}
          hint={collection.estimatedPieces != null ? `Rough count: ${formatNumber(collection.estimatedPieces)}` : undefined}
        />
        <StatCard label="Value at MRP" value={collection.status === "uncounted" ? "—" : formatCurrency(totalValue)} />
        <StatCard label="Collected" value={formatDate(collection.collectedDate)} />
        <StatCard label="Counted on" value={collection.countedDate ? formatDate(collection.countedDate) : "Pending"} />
      </div>

      {collection.notes && (
        <div className="mb-6 rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-medium text-ink-faint">Notes from pickup</p>
          <p className="mt-1 text-sm text-ink-dim">{collection.notes}</p>
        </div>
      )}

      {counting ? (
        <CountSheet
          lines={draftLines}
          onChange={setDraftLines}
          onSave={handleSaveCount}
          onCancel={() => setCounting(false)}
          estimatedPieces={collection.estimatedPieces}
          companyId={collection.companyId}
        />
      ) : lines.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={ClipboardCheck}
            title="This bag has not been counted yet"
            description="Open the count sheet when you are ready to count what is inside."
            action={<Button onClick={startCounting}>Start counting</Button>}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-base font-semibold text-ink">Counted contents</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>MRP</TableHead>
                <TableHead>Pieces</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Packed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => {
                const product = products.find((p) => p.id === line.productId);
                return (
                  <TableRow key={line.id}>
                    <TableCell className="font-mono text-xs text-ink-faint">{product?.sku}</TableCell>
                    <TableCell className="text-ink">{product?.name}</TableCell>
                    <TableCell className="text-ink-dim">{formatCurrency(line.mrp)}</TableCell>
                    <TableCell className="text-ink">{formatNumber(line.quantity)}</TableCell>
                    <TableCell className="text-ink">{formatCurrency(line.quantity * line.mrp)}</TableCell>
                    <TableCell className="text-ink-dim">{line.packed ? "Yes" : "Awaiting packing"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
