"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DISPATCH_STATUS_LABELS, DISPATCH_STATUS_TONE } from "@/lib/constants";
import { exportDispatch } from "@/lib/export";
import { distributors } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

export function DispatchDetailView({ dispatchId }: { dispatchId: string }) {
  const { dispatches, companies, sortedBags, collections, recordSettlement } = useStore();
  const [receivedInput, setReceivedInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const dispatch = dispatches.find((d) => d.id === dispatchId);

  if (!dispatch) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState
          icon={Send}
          title="Dispatch not found"
          description="It may have been deleted, or the link is out of date."
          action={<Link href="/dispatches"><Button variant="outline">Back to dispatches</Button></Link>}
        />
      </div>
    );
  }

  const bags = sortedBags.filter((b) => b.dispatchId === dispatch.id);
  const canSettle = dispatch.status === "sent" || dispatch.status === "under_review";
  const shortfall = dispatch.receivedValue != null ? dispatch.claimedValue - dispatch.receivedValue : null;

  function handleSettle() {
    const value = Number(receivedInput);
    if (!Number.isFinite(value) || value < 0) return;
    recordSettlement(dispatch!.id, value);
    setReceivedInput("");
    setNotice("Settlement recorded.");
    window.setTimeout(() => setNotice(null), 4000);
  }

  return (
    <div>
      <Link href="/dispatches" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-dim hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All dispatches
      </Link>

      <Notice message={notice} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold text-ink">{dispatch.dispatchNumber}</h1>
            <Badge tone={DISPATCH_STATUS_TONE[dispatch.status]}>{DISPATCH_STATUS_LABELS[dispatch.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-dim">
            {companies.find((c) => c.id === dispatch.companyId)?.name} factory
          </p>
        </div>
        <Button variant="outline" onClick={() => exportDispatch({ dispatch, bags, collections, distributors, companies })}>
          <Download className="h-4 w-4" /> Download report
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Bags sent" value={String(dispatch.bagCount)} />
        <StatCard label="Pieces" value={formatNumber(dispatch.pieceCount)} />
        <StatCard label="Claimed" value={formatCurrency(dispatch.claimedValue)} />
        <StatCard
          label="Received"
          value={dispatch.receivedValue != null ? formatCurrency(dispatch.receivedValue) : "Pending"}
          tone={shortfall != null && shortfall > 0 ? "amber" : "default"}
          hint={shortfall != null && shortfall > 0 ? `Short by ${formatCurrency(shortfall)}` : undefined}
        />
      </div>

      {canSettle && (
        <div className="mb-6 rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-ink">Record settlement</p>
          <p className="mt-1 text-sm text-ink-dim">
            Enter what the factory actually paid. A short payment is kept visible as partially settled rather than overwriting the original claim.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 sm:max-w-xs">
              <Label htmlFor="received">Received value (₹)</Label>
              <Input
                id="received"
                type="number"
                min={0}
                placeholder={String(dispatch.claimedValue)}
                value={receivedInput}
                onChange={(e) => setReceivedInput(e.target.value)}
              />
            </div>
            <Button onClick={handleSettle} disabled={receivedInput === ""}>Save settlement</Button>
          </div>
        </div>
      )}

      <h2 className="mb-3 text-base font-semibold text-ink">Bags in this dispatch</h2>

      {bags.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState icon={Send} title="No bags linked to this dispatch" />
        </div>
      ) : (
        <>
          <div className="hidden rounded-xl border border-line bg-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bag number</TableHead>
                  <TableHead>MRP</TableHead>
                  <TableHead>Pieces</TableHead>
                  <TableHead>Claim value</TableHead>
                  <TableHead>Parties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bags.map((bag) => {
                  const parties = Array.from(
                    new Set(
                      bag.sourceCollectionIds
                        .map((id) => collections.find((c) => c.id === id))
                        .map((c) => distributors.find((d) => d.id === c?.distributorId)?.name)
                        .filter((n): n is string => Boolean(n))
                    )
                  );
                  return (
                    <TableRow key={bag.id}>
                      <TableCell className="font-mono text-xs text-ink">{bag.bagNumber}</TableCell>
                      <TableCell className="text-ink-dim">{formatCurrency(bag.mrp)}</TableCell>
                      <TableCell className="text-ink">{formatNumber(bag.pieceCount)}</TableCell>
                      <TableCell className="text-ink">{formatCurrency(bag.pieceCount * bag.mrp)}</TableCell>
                      <TableCell className="text-ink-dim">{parties.join(", ") || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {bags.map((bag) => (
              <div key={bag.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-mono text-sm font-medium text-ink">{bag.bagNumber}</p>
                  <Badge tone="neutral">MRP {bag.mrp}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
                  <div>
                    <p className="text-xs text-ink-faint">Pieces</p>
                    <p className="text-sm font-medium text-ink">{formatNumber(bag.pieceCount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-faint">Value</p>
                    <p className="text-sm font-medium text-ink">{formatCurrency(bag.pieceCount * bag.mrp)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-ink-faint">Sent on {formatDate(dispatch.sentDate)}</p>
    </div>
  );
}
