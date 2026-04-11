import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useMasterData } from '../../hooks/useMasterData'
import { fmtCurrency, calcDueDate, fmtDate, todayISO } from '../../lib/utils'

const EMPTY = {
  invoice_number:    '',
  invoice_date:      todayISO(),
  company_id:        '',
  stockist_id:       '',
  location_id:       '',
  invoice_amount:    '',
  cn_dn_amount:      '0',
  pdc_cheque_number: '',
  pdc_date:          '',
  pdc_amount:        '',
  credit_days:       '30',
  payment_received:  '0',
  payment_date:      '',
  calling_remarks_1: '',
  calling_remarks_2: '',
}

export default function InvoiceModal({ invoice, onSave, onClose }) {
  const { companies, allStockists } = useMasterData()
  const [form,   setForm]   = useState(EMPTY)
  const [busy,   setBusy]   = useState(false)
  const [errMsg, setErrMsg] = useState('')

  // populate form when editing
  useEffect(() => {
    if (invoice) {
      setForm({
        invoice_number:    invoice.invoice_number    ?? '',
        invoice_date:      invoice.invoice_date      ?? todayISO(),
        company_id:        invoice.company_id        ?? '',
        stockist_id:       invoice.stockist_id       ?? '',
        location_id:       invoice.location_id       ?? '',
        invoice_amount:    String(invoice.invoice_amount    ?? ''),
        cn_dn_amount:      String(invoice.cn_dn_amount      ?? '0'),
        pdc_cheque_number: invoice.pdc_cheque_number ?? '',
        pdc_date:          invoice.pdc_date          ?? '',
        pdc_amount:        String(invoice.pdc_amount  ?? ''),
        credit_days:       String(invoice.credit_days ?? '30'),
        payment_received:  String(invoice.payment_received ?? '0'),
        payment_date:      invoice.payment_date       ?? '',
        calling_remarks_1: invoice.calling_remarks_1  ?? '',
        calling_remarks_2: invoice.calling_remarks_2  ?? '',
      })
    }
  }, [invoice])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // stockists filtered by selected company
  const filteredStockists = form.company_id
    ? allStockists.filter(s => s.company_id === form.company_id)
    : allStockists

  // selected stockist record
  const selectedStockist = allStockists.find(s => s.id === form.stockist_id) ?? null

  // auto-fill credit_days + location when stockist changes
  useEffect(() => {
    if (!selectedStockist) return
    setForm(f => ({
      ...f,
      credit_days: String(selectedStockist.credit_days ?? 30),
      location_id: selectedStockist.location_id ?? '',
    }))
  }, [form.stockist_id]) // eslint-disable-line

  // calculated display values
  const invAmt  = Number(form.invoice_amount)  || 0
  const cnDn    = Number(form.cn_dn_amount)    || 0
  const netOut  = invAmt + cnDn
  const paid    = Number(form.payment_received) || 0
  const balance = netOut - paid
  const dueDate = calcDueDate(form.invoice_date, form.credit_days)

  async function handleSave(e) {
    e.preventDefault()
    setErrMsg('')
    if (!form.invoice_number.trim()) { setErrMsg('Invoice number is required'); return }
    if (!form.invoice_date)          { setErrMsg('Invoice date is required');   return }
    if (!form.company_id)            { setErrMsg('Please select a company');    return }
    if (!form.stockist_id)           { setErrMsg('Please select a stockist');   return }
    if (!form.location_id)           { setErrMsg('Stockist has no location set — check Master Data'); return }

    setBusy(true)
    try {
      await onSave({
        invoice_number:    form.invoice_number.trim(),
        invoice_date:      form.invoice_date,
        company_id:        form.company_id,
        stockist_id:       form.stockist_id,
        location_id:       form.location_id,
        invoice_amount:    invAmt,
        cn_dn_amount:      cnDn,
        pdc_cheque_number: form.pdc_cheque_number || null,
        pdc_date:          form.pdc_date          || null,
        pdc_amount:        Number(form.pdc_amount) || 0,
        credit_days:       Number(form.credit_days) || 30,
        payment_received:  paid,
        payment_date:      form.payment_date || null,
        calling_remarks_1: form.calling_remarks_1 || null,
        calling_remarks_2: form.calling_remarks_2 || null,
      }, invoice?.id ?? null)
      onClose()
    } catch (err) {
      setErrMsg(err.message ?? 'Failed to save invoice')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold">{invoice ? 'Edit Invoice' : 'Add Invoice'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Invoice Details ── */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Invoice Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Invoice Number *</label>
                <input className="input" value={form.invoice_number}
                  onChange={e => set('invoice_number', e.target.value)} placeholder="INV-2024-001" />
              </div>
              <div>
                <label className="label">Invoice Date *</label>
                <input type="date" className="input" value={form.invoice_date}
                  onChange={e => set('invoice_date', e.target.value)} />
              </div>
              <div>
                <label className="label">Company *</label>
                <select className="input" value={form.company_id}
                  onChange={e => { set('company_id', e.target.value); set('stockist_id', ''); set('location_id', '') }}>
                  <option value="">Select company…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Stockist *</label>
                <select className="input" value={form.stockist_id}
                  onChange={e => set('stockist_id', e.target.value)}>
                  <option value="">Select stockist…</option>
                  {filteredStockists.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {/* auto-filled info */}
            {selectedStockist && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5">
                  <p className="text-gray-400 font-semibold uppercase tracking-wide text-[10px] mb-1">Auto-filled</p>
                  <p><span className="text-gray-400">Town:</span> <span className="font-medium ml-1">{selectedStockist.town}</span></p>
                  <p><span className="text-gray-400">PSR:</span>  <span className="font-medium ml-1">{selectedStockist.psrs?.name ?? '—'}</span></p>
                  <p><span className="text-gray-400">Mobile:</span><span className="font-mono font-medium ml-1">{selectedStockist.mobile ?? '—'}</span></p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-3 text-xs space-y-1.5">
                  <p className="text-indigo-400 font-semibold uppercase tracking-wide text-[10px] mb-1">Calculated</p>
                  <p><span className="text-indigo-400">Credit Days:</span> <span className="font-medium ml-1">{form.credit_days}d</span></p>
                  <p><span className="text-indigo-400">Due Date:</span>    <span className="font-medium ml-1">{dueDate ? fmtDate(dueDate) : '—'}</span></p>
                  <p><span className="text-indigo-400">Net Outstanding:</span><span className="font-medium ml-1">{fmtCurrency(netOut)}</span></p>
                </div>
              </div>
            )}
          </section>

          {/* ── Amounts ── */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Amounts</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Invoice Amount (₹) *</label>
                <input type="number" min="0" step="0.01" className="input"
                  value={form.invoice_amount} onChange={e => set('invoice_amount', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="label">Credit Note / Debit Note (₹)</label>
                <input type="number" step="0.01" className="input"
                  value={form.cn_dn_amount} onChange={e => set('cn_dn_amount', e.target.value)}
                  placeholder="Use – for credit note" />
              </div>
              <div>
                <label className="label">Net Outstanding (₹)</label>
                <input className="input bg-gray-50 text-gray-500 cursor-default" readOnly value={fmtCurrency(netOut)} />
              </div>
            </div>
          </section>

          {/* ── PDC ── */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">PDC Details</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Cheque Number</label>
                <input className="input" value={form.pdc_cheque_number}
                  onChange={e => set('pdc_cheque_number', e.target.value)} placeholder="CHQ 000001" />
              </div>
              <div>
                <label className="label">PDC Date</label>
                <input type="date" className="input" value={form.pdc_date}
                  onChange={e => set('pdc_date', e.target.value)} />
              </div>
              <div>
                <label className="label">PDC Amount (₹)</label>
                <input type="number" min="0" step="0.01" className="input"
                  value={form.pdc_amount} onChange={e => set('pdc_amount', e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </section>

          {/* ── Payment Received ── */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Payment Received</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Amount Received (₹)</label>
                <input type="number" min="0" step="0.01" className="input"
                  value={form.payment_received} onChange={e => set('payment_received', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="label">Payment Date</label>
                <input type="date" className="input" value={form.payment_date}
                  onChange={e => set('payment_date', e.target.value)} />
              </div>
              <div>
                <label className="label">Balance (₹)</label>
                <input readOnly className={`input cursor-default font-semibold ${balance > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
                  value={fmtCurrency(balance)} />
              </div>
            </div>
          </section>

          {/* ── Calling Remarks ── */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Calling Remarks</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Remarks 1</label>
                <input className="input" value={form.calling_remarks_1}
                  onChange={e => set('calling_remarks_1', e.target.value)} placeholder="First follow-up notes…" />
              </div>
              <div>
                <label className="label">Remarks 2</label>
                <input className="input" value={form.calling_remarks_2}
                  onChange={e => set('calling_remarks_2', e.target.value)} placeholder="Second follow-up notes…" />
              </div>
            </div>
          </section>

          {errMsg && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {errMsg}
            </p>
          )}
        </form>

        {/* footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={busy} className="btn-primary">
            {busy && <Loader2 size={13} className="animate-spin" />}
            {invoice ? 'Update Invoice' : 'Save Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}
