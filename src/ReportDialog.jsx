import { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { createReport } from './api.js';
import { useReferenceData } from './referenceData.js';

export function ReportDialog({ target, onClose, onReported }) {
  const { data: reference } = useReferenceData();
  const [category, setCategory] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createReport(target.type, target.id, category, details.trim() || null);
      onReported?.();
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <div className="modal-heading"><div><p className="eyebrow">TRUST AND SAFETY</p><h2 id="report-title">Report {target.label}</h2></div><button className="icon-button" aria-label="Close report" onClick={onClose}><X size={18} /></button></div>
        <p className="modal-copy">Platform operations review every report. The reported organization is not told who reported it.</p>
        <form onSubmit={submit}>
          <label className="field-label">Reason<select className="form-select" value={category} onChange={(event) => setCategory(event.target.value)} required><option value="" disabled>Choose a reason</option>{(reference?.reportCategories ?? []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="field-label">Details (optional)<textarea className="form-input report-details" value={details} onChange={(event) => setDetails(event.target.value)} maxLength="2000" placeholder="What happened? Do not include contact details or links." /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={submitting || !category}><Flag size={14} />{submitting ? 'Sending...' : 'Send report'}</button></div>
        </form>
      </section>
    </div>
  );
}
