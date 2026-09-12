"use client";

import { FormEvent, useState } from "react";
import { Plus, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REASON_LABELS, STATUS_LABELS } from "@/lib/constants";
import { distributors } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { formatCurrency, today } from "@/lib/utils";
import type { ReasonCategory, ResolutionStatus, SourceType } from "@/types";

const ADD_NEW_PRODUCT = "__add_new__";

export function NewEntryForm() {
  const { products, companies, addProduct, addRecord } = useStore();

  const [source, setSource] = useState<SourceType>("own_inventory");
  const [companyId, setCompanyId] = useState("");
  const [distributorId, setDistributorId] = useState("");
  const [productId, setProductId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [date, setDate] = useState(today());
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("units");
  const [reason, setReason] = useState<ReasonCategory | "">("");
  const [status, setStatus] = useState<ResolutionStatus>("pending_review");
  const [costValue, setCostValue] = useState("");
  const [costEdited, setCostEdited] = useState(false);
  const [responsibleParty, setResponsibleParty] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSku, setNewSku] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newUnit, setNewUnit] = useState("piece");
  const [newMrp, setNewMrp] = useState("");
  const [newCost, setNewCost] = useState("");

  // Product list is scoped to the chosen company so a SKU cannot be
  // filed against the wrong brand.
  const companyProducts = products.filter((p) => p.companyId === companyId);
  const selectedProduct = products.find((p) => p.id === productId);
  const estimate = selectedProduct && Number(quantity) > 0 ? Number(quantity) * selectedProduct.costPrice : null;

  // The cost field auto-fills from price x quantity, but stops the moment
  // the user types their own figure -- a manual override should never be
  // silently overwritten by the estimate.
  function syncEstimate(qty: string, product: typeof selectedProduct, edited: boolean) {
    if (edited) return;
    const q = Number(qty);
    if (!product || !Number.isFinite(q) || q <= 0) {
      setCostValue("");
      return;
    }
    setCostValue(String(Math.round(q * product.costPrice)));
  }

  function handleProductChange(value: string) {
    if (value === ADD_NEW_PRODUCT) {
      setShowAddProduct(true);
      return;
    }
    setProductId(value);
    const product = products.find((p) => p.id === value);
    if (product) setUnit(product.unit);
    syncEstimate(quantity, product, costEdited);
  }

  function handleAddProduct() {
    if (!newName.trim()) return;
    const created = addProduct({
      companyId,
      sku: newSku.trim() || `NEW-${Date.now().toString().slice(-5)}`,
      name: newName.trim(),
      category: newCategory.trim() || "Uncategorised",
      unit: newUnit,
      mrp: Number(newMrp) || 0,
      costPrice: Number(newCost) || 0,
      isActive: true,
    });
    setProductId(created.id);
    setUnit(created.unit);
    setCostEdited(false);
    syncEstimate(quantity, created, false);
    setShowAddProduct(false);
    setNewName("");
    setNewSku("");
    setNewCategory("");
    setNewUnit("piece");
    setNewMrp("");
    setNewCost("");
    setNotice(`${created.name} added to your product list.`);
    window.setTimeout(() => setNotice(null), 4000);
  }

  function resetForm() {
    setSource("own_inventory");
    setCompanyId("");
    setDistributorId("");
    setProductId("");
    setBatchNumber("");
    setDate(today());
    setQuantity("");
    setUnit("units");
    setReason("");
    setStatus("pending_review");
    setCostValue("");
    setCostEdited(false);
    setResponsibleParty("");
    setNotes("");
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId || !productId || !reason) return;
    addRecord({
      companyId,
      date,
      source,
      distributorId: source === "distributor" ? distributorId : undefined,
      productId,
      batchNumber,
      quantity: Number(quantity),
      unit,
      reason: reason as ReasonCategory,
      costValue: Number(costValue),
      status,
      responsibleParty,
      hasPhoto: false,
      notes: notes.trim() || undefined,
    });
    resetForm();
    setNotice("Record saved. It is now in All records.");
    window.setTimeout(() => setNotice(null), 4000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Notice message={notice} />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Source</CardTitle>
            <CardDescription>Where is this stock coming from?</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSource("own_inventory")}
              className={`rounded-lg border-2 p-4 text-left transition-colors ${
                source === "own_inventory" ? "border-accent bg-accent/10" : "border-line hover:border-line-strong"
              }`}
            >
              <p className="font-medium text-ink">Own inventory</p>
              <p className="mt-0.5 text-sm text-ink-dim">Stock held in your own warehouse</p>
            </button>
            <button
              type="button"
              onClick={() => setSource("distributor")}
              className={`rounded-lg border-2 p-4 text-left transition-colors ${
                source === "distributor" ? "border-accent bg-accent/10" : "border-line hover:border-line-strong"
              }`}
            >
              <p className="font-medium text-ink">Reported by a party</p>
              <p className="mt-0.5 text-sm text-ink-dim">Damage a party reported outside a collection bag</p>
            </button>
          </div>

          {source === "distributor" && (
            <div className="mt-4">
              <Label htmlFor="party">Party</Label>
              <Select id="party" required value={distributorId} onChange={(e) => setDistributorId(e.target.value)}>
                <option value="">Select a party</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Product and batch</CardTitle>
            <CardDescription>Identify the SKU and lot affected</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="entryCompany">Company</Label>
            <Select
              id="entryCompany"
              required
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setProductId("");
                setCostValue("");
                setCostEdited(false);
              }}
            >
              <option value="">Select a company</option>
              {companies.filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="product">Product</Label>
            <Select id="product" required disabled={!companyId} value={showAddProduct ? ADD_NEW_PRODUCT : productId} onChange={(e) => handleProductChange(e.target.value)}>
              <option value="">{companyId ? "Select a product" : "Choose a company first"}</option>
              {companyProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} (cost {p.costPrice}/{p.unit})
                </option>
              ))}
              <option value={ADD_NEW_PRODUCT}>+ Add a new product</option>
            </Select>
          </div>

          {showAddProduct && (
            <div className="space-y-3 rounded-lg border border-dashed border-line-strong p-4 sm:col-span-2">
              <p className="text-sm font-medium text-ink">New product</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="newName">Name</Label>
                  <Input id="newName" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Namkeen 40g" />
                </div>
                <div>
                  <Label htmlFor="newSku">SKU</Label>
                  <Input id="newSku" value={newSku} onChange={(e) => setNewSku(e.target.value)} placeholder="Auto if left blank" />
                </div>
                <div>
                  <Label htmlFor="newCategory">Category</Label>
                  <Input id="newCategory" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Namkeen" />
                </div>
                <div>
                  <Label htmlFor="newUnit">Unit</Label>
                  <Select id="newUnit" value={newUnit} onChange={(e) => setNewUnit(e.target.value)}>
                    <option value="piece">piece</option>
                    <option value="pack">pack</option>
                    <option value="bag">bag</option>
                    <option value="bottle">bottle</option>
                    <option value="sachet">sachet</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="newMrp">MRP (₹)</Label>
                  <Input id="newMrp" type="number" min={0} value={newMrp} onChange={(e) => setNewMrp(e.target.value)} placeholder="Printed price" />
                </div>
                <div>
                  <Label htmlFor="newCost">Cost price (₹)</Label>
                  <Input id="newCost" type="number" min={0} value={newCost} onChange={(e) => setNewCost(e.target.value)} placeholder="Your cost" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddProduct(false)}>Cancel</Button>
                <Button type="button" size="sm" onClick={handleAddProduct} disabled={!newName.trim()}>
                  <Plus className="h-4 w-4" /> Add product
                </Button>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="batch">Batch or lot number</Label>
            <Input id="batch" required value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="e.g. B26-0091" />
          </div>
          <div>
            <Label htmlFor="date">Date reported</Label>
            <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="quantity">Quantity</Label>
            <div className="flex gap-2">
              <Input
                id="quantity"
                type="number"
                min={1}
                required
                className="flex-1"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  syncEstimate(e.target.value, selectedProduct, costEdited);
                }}
                placeholder="0"
              />
              <Select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-32">
                <option value="units">units</option>
                <option value="pieces">pieces</option>
                <option value="packs">packs</option>
                <option value="cartons">cartons</option>
                <option value="kg">kg</option>
                <option value="litres">litres</option>
              </Select>
            </div>
            {estimate != null && (
              <p className="mt-1.5 text-xs text-accent">
                Estimated loss: {quantity} × {formatCurrency(selectedProduct!.costPrice)} = {formatCurrency(estimate)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Reason and resolution</CardTitle>
            <CardDescription>Categorise the loss and track where it stands</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Select id="reason" required value={reason} onChange={(e) => setReason(e.target.value as ReasonCategory)}>
              <option value="">Select a reason</option>
              {Object.entries(REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Resolution status</Label>
            <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as ResolutionStatus)}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="cost">Loss value (₹)</Label>
            <Input
              id="cost"
              type="number"
              min={0}
              required
              value={costValue}
              onChange={(e) => {
                setCostEdited(true);
                setCostValue(e.target.value);
              }}
              placeholder="0"
            />
            {!costEdited && estimate != null && <p className="mt-1 text-xs text-ink-faint">Auto-filled from cost price. Type here to override.</p>}
          </div>
          <div>
            <Label htmlFor="responsible">Responsible party</Label>
            <Input
              id="responsible"
              required
              value={responsibleParty}
              onChange={(e) => setResponsibleParty(e.target.value)}
              placeholder="e.g. Warehouse Team"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any extra context worth recording" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Photo evidence</CardTitle>
            <CardDescription>Attach photos of the damaged stock</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-line-strong px-6 py-10 text-center hover:border-accent/60 hover:bg-accent/5">
            <UploadCloud className="mb-2 h-8 w-8 text-ink-faint" />
            <p className="text-sm font-medium text-ink">Tap to upload or drag and drop</p>
            <p className="mt-1 text-xs text-ink-faint">Storage connects via Supabase later.</p>
            <input type="file" accept="image/*" multiple className="hidden" />
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={resetForm}>Reset</Button>
        <Button type="submit">Save record</Button>
      </div>
    </form>
  );
}
