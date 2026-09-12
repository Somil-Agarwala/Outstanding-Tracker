"use client";

import { useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

export function CompaniesTable() {
  const { companies, products, collections, sortedBags, dispatches } = useStore();
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return companies
      .filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      .map((c) => {
        const openBags = sortedBags.filter((b) => b.companyId === c.id && b.status === "ready");
        const companyDispatches = dispatches.filter((d) => d.companyId === c.id);
        return {
          ...c,
          skuCount: products.filter((p) => p.companyId === c.id).length,
          uncounted: collections.filter((col) => col.companyId === c.id && col.status === "uncounted").length,
          readyValue: openBags.reduce((sum, b) => sum + b.pieceCount * b.mrp, 0),
          outstanding: companyDispatches
            .filter((d) => d.status !== "settled" && d.status !== "rejected")
            .reduce((sum, d) => sum + (d.claimedValue - (d.receivedValue ?? 0)), 0),
        };
      });
  }, [companies, products, collections, sortedBags, dispatches, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search companies" className="pl-9" />
      </div>
      <div className="rounded-xl border border-line bg-surface">
        {rows.length === 0 ? (
          <EmptyState icon={Building2} title="No companies found" description="Try a different search term." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>SKUs</TableHead>
                <TableHead>Uncounted bags</TableHead>
                <TableHead>Ready to send</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-ink">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-accent">{c.code}</TableCell>
                  <TableCell className="text-ink-dim">{c.skuCount}</TableCell>
                  <TableCell className="text-ink">{c.uncounted}</TableCell>
                  <TableCell className="text-ink">{formatCurrency(c.readyValue)}</TableCell>
                  <TableCell className={c.outstanding > 0 ? "text-amber-300" : "text-ink-dim"}>
                    {formatCurrency(c.outstanding)}
                  </TableCell>
                  <TableCell><Badge tone={c.isActive ? "emerald" : "neutral"}>{c.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
