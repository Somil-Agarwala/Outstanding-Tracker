"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { formatCurrency, formatNumber } from "@/lib/utils";

export interface DraftLine {
  key: string;
  productId: string;
  quantity: number;
}

/**
 * The counting screen. Lines are added one SKU at a time because that is
 * how a bag is physically counted, and the running total updates as you
 * go so the person counting can sanity-check against the rough count
 * written on the bag at pickup.
 */
export function CountSheet({
  lines,
  onChange,
  onSave,
  onCancel,
  estimatedPieces,
  companyId,
}: {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  onSave: () => void;
  onCancel: () => void;
  estimatedPieces?: number;
  companyId: string;
}) {
  const { products, companies } = useStore();
  // Only this bag's company can appear. Counting a Haldirams SKU into a
  // Cadbury bag would produce a claim no factory will accept, so the
  // wrong SKU is simply not offered.
  const activeProducts = products.filter((p) => p.isActive && p.companyId === companyId);
  const company = companies.find((c) => c.id === companyId);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  const totalPieces = lines.reduce((sum, l) => sum + l.quantity, 0);
  const totalValue = lines.reduce((sum, l) => {
    const product = products.find((p) => p.id === l.productId);
    return sum + (product ? product.mrp * l.quantity : 0);
  }, 0);

  function addLine() {
    const qty = Number(quantity);
    if (!productId || !Number.isFinite(qty) || qty <= 0) return;

    // Counting the same SKU twice should add to the existing line rather
    // than create a duplicate row.
    const existing = lines.find((l) => l.productId === productId);
    if (existing) {
      onChange(lines.map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + qty } : l)));
    } else {
      onChange([...lines, { key: `dl-${Date.now()}`, productId, quantity: qty }]);
    }
    setProductId("");
    setQuantity("");
  }

  function removeLine(key: string) {
    onChange(lines.filter((l) => l.key !== key));
  }

  function updateQuantity(key: string, value: string) {
    const qty = Number(value);
    onChange(lines.map((l) => (l.key === key ? { ...l, quantity: Number.isFinite(qty) && qty > 0 ? qty : 0 } : l)));
  }

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold text-ink">Count sheet</h2>
        <p className="mt-0.5 text-sm text-ink-dim">
          Add each SKU as you count it. Only {company?.name ?? "this company"} products are listed, and the MRP comes from the product.
        </p>
      </div>

      <div className="border-b border-line px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="countProduct">Product</Label>
            <Select id="countProduct" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Select a SKU</option>
              {activeProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} (MRP {p.mrp})
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:w-32">
            <Label htmlFor="countQty">Pieces</Label>
            <Input
              id="countQty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLine();
                }
              }}
              placeholder="0"
            />
          </div>
          <Button onClick={addLine} disabled={!productId || quantity === ""} className="sm:w-auto">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {activeProducts.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-dim">
          No active products found for {company?.name ?? "this company"}. Add one in Products first.
        </p>
      ) : lines.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-dim">No lines counted yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {lines.map((line) => {
            const product = products.find((p) => p.id === line.productId);
            return (
              <li key={line.key} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{product?.name}</p>
                  <p className="text-xs text-ink-faint">
                    {product?.sku} · MRP {product?.mrp}
                  </p>
                </div>
                <Input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => updateQuantity(line.key, e.target.value)}
                  className="h-9 w-24"
                />
                <span className="hidden w-24 text-right text-sm text-ink-dim sm:block">
                  {formatCurrency((product?.mrp ?? 0) * line.quantity)}
                </span>
                <button
                  onClick={() => removeLine(line.key)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-elevated hover:text-red-300"
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p className="font-medium text-ink">
            {formatNumber(totalPieces)} pieces counted · {formatCurrency(totalValue)}
          </p>
          {estimatedPieces != null && (
            <p className="mt-0.5 text-xs text-ink-faint">
              Rough count at pickup was {formatNumber(estimatedPieces)}. Difference: {formatNumber(totalPieces - estimatedPieces)}.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSave} disabled={lines.length === 0 || totalPieces === 0}>
            Mark as counted
          </Button>
        </div>
      </div>
    </div>
  );
}
