import { useState } from 'react';
import { FileText, Printer, Upload, X } from 'lucide-react';
import { exportOfferToAviatCrm } from './api.js';
import { formatMinor } from './money.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function printItinerary(offer, option, markupPercentage, priceMinor) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.opener = null;
  const days = (offer.itinerary ?? []).map((day, index) => `<article><p class="day">DAY ${escapeHtml(day.day ?? index + 1)}</p><h2>${escapeHtml(day.title)}</h2>${day.destination ? `<p class="place">${escapeHtml(day.destination)}</p>` : ''}${day.description ? `<p>${escapeHtml(day.description)}</p>` : ''}</article>`).join('');
  const title = `${offer.destination} / Itinerary`;
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:15px/1.55 Georgia,serif;color:#202a2a;max-width:760px;margin:48px auto;padding:0 28px}header{border-bottom:2px solid #16796f;padding-bottom:18px;margin-bottom:28px}h1{font-size:30px;margin:0}h2{font-size:21px;margin:3px 0}header p,.place,.day{color:#16796f}.day{font:700 11px Arial,sans-serif;margin:0}article{padding:14px 0;border-bottom:1px solid #d8dfdc;break-inside:avoid}article p{margin:6px 0}.total{margin-top:28px;padding-top:14px;border-top:2px solid #16796f;display:flex;justify-content:space-between;font-size:19px}@media print{body{margin:0 auto;padding:0 8mm}}</style></head><body><header><p>${escapeHtml(offer.requestCode)} / ${escapeHtml(offer.dates ?? '')}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(option?.label ?? offer.optionLabel ?? 'Package')}</p></header>${days || '<p>Your itinerary details will be confirmed with your travel consultant.</p>'}<p class="total"><strong>Package total</strong><strong>${escapeHtml(formatMinor(priceMinor, offer.currency))}</strong></p><script>window.addEventListener('load',()=>window.print())</script></body></html>`);
  printWindow.document.close();
  return true;
}

export function OfferExportModal({ offer, onClose }) {
  const [optionId, setOptionId] = useState('');
  const [markup, setMarkup] = useState('0');
  const [apiBaseUrl, setApiBaseUrl] = useState(import.meta.env.VITE_AVIAT_CRM_API_BASE_URL ?? '');
  const [accessToken, setAccessToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [exported, setExported] = useState(null);
  const options = offer.options ?? [];
  const option = options.find((item) => item.id === optionId) ?? null;
  const costMinor = option?.estimatedTotalMinor ?? offer.estimatedTotalMinor ?? offer.totalMinor ?? offer.ratePerNightMinor;
  const markupPercentage = Number(markup);
  const priceMinor = Number.isSafeInteger(costMinor) && Number.isFinite(markupPercentage)
    ? Math.round(costMinor * (1 + markupPercentage / 100))
    : null;

  function print() {
    setError('');
    if (!Number.isSafeInteger(priceMinor)) {
      setError('This offer does not have a valid total price.');
      return;
    }
    if (!printItinerary(offer, option, markupPercentage, priceMinor)) setError('Allow pop-ups to print or save the itinerary as a PDF.');
  }

  async function pushToCrm(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await exportOfferToAviatCrm(offer.id, {
        api_base_url: apiBaseUrl.trim(),
        access_token: accessToken,
        offer_option_id: optionId || null,
        markup_percentage: markupPercentage,
      });
      setExported(result.crmItinerary);
      setAccessToken('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal request-modal" role="dialog" aria-modal="true" aria-labelledby="offer-export-title">
        <div className="modal-heading"><div><p className="eyebrow">CLIENT ITINERARY / {offer.requestCode}</p><h2 id="offer-export-title">{offer.destination} / Prepare offer</h2></div><button className="icon-button" aria-label="Close export" onClick={onClose}><X size={18} /></button></div>
        <form className="request-form" onSubmit={pushToCrm}>
          {options.length > 0 && <label className="field-label">Offer option<select className="form-select" value={optionId} onChange={(event) => setOptionId(event.target.value)}><option value="">{offer.optionLabel ?? 'Main offer'}</option>{options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
          <label className="field-label">Agency markup (%)<input className="form-input" type="number" min="0" step="any" value={markup} onChange={(event) => setMarkup(event.target.value)} required /></label>
          <dl className="request-preview-list"><div><dt>Supplier price</dt><dd>{Number.isSafeInteger(costMinor) ? formatMinor(costMinor, offer.currency) : 'Not available'}</dd></div><div><dt>Agency markup</dt><dd>{Number.isSafeInteger(priceMinor) ? formatMinor(priceMinor - costMinor, offer.currency) : 'Not available'} ({markupPercentage}%)</dd></div><div><dt>Client price</dt><dd>{Number.isSafeInteger(priceMinor) ? formatMinor(priceMinor, offer.currency) : 'Not available'}</dd></div></dl>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={print} disabled={!Number.isSafeInteger(priceMinor)}><Printer size={15} />Print / save PDF</button></div>
          <label className="field-label">Aviat CRM API base URL<input className="form-input" type="url" value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} placeholder="https://your-crm-host/api" autoComplete="url" required /></label>
          <label className="field-label">CRM access token<input className="form-input" type="password" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} autoComplete="new-password" required /></label>
          <small className="table-secondary">The token is used for this export only and is not saved. The itinerary is created as a draft in CRM.</small>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {exported && <p className="import-success" role="status"><FileText size={14} />Created CRM itinerary {exported.id}: {exported.title}</p>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Close</button><button className="primary-button" type="submit" disabled={busy || Boolean(exported) || !apiBaseUrl.trim() || !accessToken || !Number.isSafeInteger(priceMinor)}><Upload size={15} />{busy ? 'Sending...' : exported ? 'Exported' : 'Push to Aviat CRM'}</button></div>
        </form>
      </section>
    </div>
  );
}
