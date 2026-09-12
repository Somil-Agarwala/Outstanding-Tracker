"use client";

import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BAG_CAPACITY, type MrpTier } from "@/lib/bag-packing";
import { useStore } from "@/lib/store";
import { formatCurrency, formatNumber, pluralize } from "@/lib/utils";

/**
 * Shows exactly what will be generated before anything is created. The
 * preview is the point: someone about to create 40 bags should see the
 * split per MRP tier first, not discover it afterwards.
 */
export function PackingPanel({ tiers, onPack }: { tiers: MrpTier[]; onPack: () => void }) {
  const { companies } = useStore();
  if (tiers.length === 0) return null;

  const totalBags = tiers.reduce((sum, t) => sum + t.totalBags, 0);
  const totalPieces = tiers.reduce((sum, t) => sum + t.pieces, 0);
  const totalValue = tiers.reduce((sum, t) => sum + t.value, 0);

  return (
    <div className="mb-4 rounded-xl border border-accent/30 bg-accent/[0.06] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15">
            <Layers className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">
              {formatNumber(totalPieces)} counted pieces are waiting to be packed
            </p>
            <p className="mt-0.5 text-sm text-ink-dim">
              This will create {totalBags} {pluralize(totalBags, "bag")} at {BAG_CAPACITY} pieces each, grouped by company and MRP, worth {formatCurrency(totalValue)}.
            </p>
          </div>
        </div>
        <Button onClick={onPack}>Generate {totalBags} {pluralize(totalBags, "bag")}</Button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-ink-faint">
              <th className="py-2 pr-4 font-medium">Company</th>
              <th className="py-2 pr-4 font-medium">MRP tier</th>
              <th className="py-2 pr-4 font-medium">Pieces</th>
              <th className="py-2 pr-4 font-medium">Full bags</th>
              <th className="py-2 pr-4 font-medium">Part-filled</th>
              <th className="py-2 pr-4 font-medium">Bags</th>
              <th className="py-2 font-medium">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {tiers.map((tier) => (
              <tr key={`${tier.companyId}-${tier.mrp}`}>
                <td className="py-2 pr-4 text-ink-dim">{companies.find((c) => c.id === tier.companyId)?.name}</td>
                <td className="py-2 pr-4 font-medium text-ink">{formatCurrency(tier.mrp)}</td>
                <td className="py-2 pr-4 text-ink-dim">{formatNumber(tier.pieces)}</td>
                <td className="py-2 pr-4 text-ink-dim">{tier.fullBags}</td>
                <td className="py-2 pr-4 text-ink-dim">{tier.remainder > 0 ? `${formatNumber(tier.remainder)} pcs` : "—"}</td>
                <td className="py-2 pr-4 text-ink">{tier.totalBags}</td>
                <td className="py-2 text-ink">{formatCurrency(tier.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
