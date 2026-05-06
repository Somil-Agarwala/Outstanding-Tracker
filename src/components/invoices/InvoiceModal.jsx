import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useMasterData } from '../../hooks/useMasterData'
import { fmtCurrency, calcDueDate, fmtDate, todayISO } from '../../lib/utils'

const EMPTY = {
  invoice_number:        '',
  invoice_date:          todayISO(),
  invoice_received_date: '',
  company_id:            '',
  stockist_id:           '',
  location_id:           '',
  invoice_amount:        '',
  cn_dn_amount:          '0',
  pdc_cheque_number:     '',
  pdc_date:              '',
  pdc_amount:            '',
  credit_days:           '30',
  payment_received:      '0',
  payment_date:          '',
  calling_remarks_1:     '',
  calling_remarks_2:     '',
}

export default function InvoiceModal({ invoice, onSave, onClose }) {
  const { companies, allStockists } = useMasterData()
  const [form,   setForm]   = useState(EMPTY)
  const [busy,   setBusy]   = useState(false)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    if (invoice) {
      setForm({
        invoice_number:        invoice.invoice_number        ?? '',
        invoice_date:          invoice.invoice_date          ?? todayISO(),
        invoice_received_date: invoice.invoice_received_date ?? '',
        company_id:            invoice.company_id            ?? '',
        stockist_id:           invoice.stockist_id           ?? '',
        location_id:           invoice.location_id           ?? '',
        invoice_amount:        String(invoice.invoice_amount    ?? ''),
        cn_dn_amount:          String(invoice.cn_dn_amount      ?? '0'),
        pdc_cheque_number:     invoice.pdc_cheque_number     ?? '',
        pdc_date:              invoice.pdc_date              ?? '',
        pdc_amount:            String(invoice.pdc_amount      ?? ''),
        credit_days:           String(invoice.credit_days     ?? '30'),
        payment_received:      String(invoice.payment_received ?? '0'),
        payment_date:          invoice.payment_date           ?? '',
        calling_remarks_1:     invoice.calling_remarks_1      ?? '',
        calling_remarks_2:     invoice.calling_remarks_2      ?? '',
      })
    }
  }, [invoice])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const filteredStockists = form.company_id
    ? allStockists.filter(s => s.company_id === form.company_id)
    : allStockists

  const selectedStockist = allStockists.find(s => s.id === form.stockist_id) ?? null

  useEffect(() => {
    if (!selectedStockist) return
    setForm(f => ({
      ...f,
      credit_days: String(selectedStockist.credit_days ?? 30),
      location_id: selectedStockist.location_id ?? '',
    }))
  }, [form.stockist_id]) // eslint-disable-line

  const invAmt  = Number(form.invoice_amount)   || 0
  const cnDn    = Number(form.cn_dn_amount)     || 0
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
    if (!form.location_id)           { setErrMsg('Stockist has no location — check Master Data'); return }

    setBusy(true)
    try {
      await onSave({
        invoice_number:        form.invoice_number.trim(),
        invoice_date:          form.invoice_date,
        invoice_received_date: form.invoice_received_date || null,
        company_id:            form.company_id,
        stockist_id:           form.stockist_id,
        location_id:           form.location_id,
        invoice_amount:        invAmt,
        cn_dn_amount:          cnDn,
        pdc_cheque_number:     form.pdc_cheque_number || null,
        pdc_date:              form.pdc_date          || null,
        pdc_amount:            Number(form.pdc_amount) || 0,
        credit_days:           Number(form.credit_days) || 30,
        payment_received:      paid,
        payment_date:          form.payment_date || null,
        calling_remarks_1:     form.calling_remarks_1 || null,
        calling_remarks_2:     form.calling_remarks_2 || null,
      }, invoice?.id ?? null)
      onClose()
    } catch (err) {
      setErrMsg(err.message ?? 'Failed to save invoice')
    } finally {
      setBusy(false)
    }
  }

  return (
    /*
      KEY FIX: position:fixed + inset-0 centres on the VIEWPORT,
      not the scrolled page. The inner div uses maxHeight:90vh with
      overflow-y:auto so the form scrolls inside the modal box.
    */
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(15,23,42,0.6)',
      }}
    >
      <div
        style={{
          background: '#fff', width: '100%', maxWidth: '680px',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          borderRadius: '16px', boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-sm font-bold text-slate-800">
            {invoice ? 'Edit Invoice' : 'Add Invoice'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={17} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Invoice Details ── */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Invoice Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Invoice Number *</label>
                <input className="input" value={form.invoice_number}
                  onChange={e => set('invoice_number', e.target.value)}
                  placeholder="INV-2024-001" />
              </div>
              <div>
                <label className="label">Invoice Date *</label>
                <input type="date" className="input" value={form.invoice_date}
                  onChange={e => set('invoice_date', e.target.value)} />
              </div>
              {/* NEW FIELD */}
              <div>
                <label className="label">Invoice Received Date</label>
                <input type="date" className="input" value={form.invoice_received_date}
                  onChange={e => set('invoice_received_date', e.target.value)} />
              </div>
              <div />
              <div>
                <label className="label">Company *</label>
                <select className="input" value={form.company_id}
                  onChange={e => {
                    set('company_id', e.target.value)
                    set('stockist_id', '')
                    set('location_id', '')
                  }}>
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

            {selectedStockist && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Auto-filled</p>
                  <p><span className="text-slate-400">Town:</span>
                    <span className="font-semibold ml-1">{selectedStockist.town}</span></p>
                  <p><span className="text-slate-400">PSR:</span>
                    <span className="font-semibold ml-1">{selectedStockist.psrs?.name ?? '—'}</span></p>
                  <p><span className="text-slate-400">Mobile:</span>
                    <span className="font-mono font-semibold ml-1">{selectedStockist.mobile ?? '—'}</span></p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-3 text-xs space-y-1.5">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Calculated</p>
                  <p><span className="text-indigo-400">Credit Days:</span>
                    <span className="font-semibold ml-1">{form.credit_days}d</span></p>
                  <p><span className="text-indigo-400">Due Date:</span>
                    <span className="font-semibold ml-1">{dueDate ? fmtDate(dueDate) : '—'}</span></p>
                  <p><span className="text-indigo-400">Net Outstanding:</span>
                    <span className="font-semibold ml-1">{fmtCurrency(netOut)}</span></p>
                </div>
              </div>
            )}
          </section>

          {/* ── Amounts ── */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Amounts</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Invoice Amount (₹) *</label>
                <input type="number" min="0" step="0.01" className="input"
                  value={form.invoice_amount}
                  onChange={e => set('invoice_amount', e.target.value)}
                  placeholder="0.00" />
              </div>
              <div>
                <label className="label">Credit Note / Debit Note (₹)</label>
                <input type="number" step="0.01" className="input"
                  value={form.cn_dn_amount}
                  onChange={e => set('cn_dn_amount', e.target.value)}
                  placeholder="Use – for credit note" />
              </div>
              <div>
                <label className="label">Net Outstanding (₹)</label>
                <input className="input bg-slate-50 text-slate-500 cursor-default"
                  readOnly value={fmtCurrency(netOut)} />
              </div>
            </div>
          </section>

          {/* ── PDC ── */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">PDC Details</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Cheque Number</label>
                <input className="input" value={form.pdc_cheque_number}
                  onChange={e => set('pdc_cheque_number', e.target.value)}
                  placeholder="CHQ 000001" />
              </div>
              <div>
                <label className="label">PDC Date</label>
                <input type="date" className="input" value={form.pdc_date}
                  onChange={e => set('pdc_date', e.target.value)} />
              </div>
              <div>
                <label className="label">PDC Amount (₹)</label>
                <input type="number" min="0" step="0.01" className="input"
                  value={form.pdc_amount}
                  onChange={e => set('pdc_amount', e.target.value)}
                  placeholder="0.00" />
              </div>
            </div>
          </section>

          {/* ── Payment ── */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Payment Received
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Amount Received (₹)</label>
                <input type="number" min="0" step="0.01" className="input"
                  value={form.payment_received}
                  onChange={e => set('payment_received', e.target.value)}
                  placeholder="0.00" />
              </div>
              <div>
                <label className="label">Received Date ★</label>
                <input type="date" className="input" value={form.payment_date}
                  onChange={e => set('payment_date', e.target.value)} />
              </div>
              <div>
                <label className="label">Balance (₹)</label>
                <input readOnly
                  className={`input cursor-default font-bold ${
                    balance > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                  }`}
                  value={fmtCurrency(balance)} />
              </div>
            </div>
          </section>

          {/* ── Remarks ── */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Calling Remarks
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Remarks 1</label>
                <input className="input" value={form.calling_remarks_1}
                  onChange={e => set('calling_remarks_1', e.target.value)}
                  placeholder="First follow-up notes…" />
              </div>
              <div>
                <label className="label">Remarks 2</label>
                <input className="input" value={form.calling_remarks_2}
                  onChange={e => set('calling_remarks_2', e.target.value)}
                  placeholder="Second follow-up notes…" />
              </div>
            </div>
          </section>

          {errMsg && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {errMsg}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
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
