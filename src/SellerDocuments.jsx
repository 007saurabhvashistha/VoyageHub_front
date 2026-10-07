import { useEffect, useState } from 'react';
import { BadgeCheck, FileCheck2, FileWarning, Send, Upload } from 'lucide-react';
import { getVerificationDocuments, submitAgencyVerification, uploadVerificationDocument } from './api.js';
import { useCan } from './capabilities.js';
import { labelFor, useReferenceData } from './referenceData.js';

export function formatBytes(bytes) {
  const [value, unit] = bytes >= 1024 * 1024 ? [bytes / (1024 * 1024), 'megabyte'] : [bytes / 1024, 'kilobyte'];
  return new Intl.NumberFormat(undefined, { style: 'unit', unit, maximumFractionDigits: 1 }).format(value);
}

export function documentStateClass(document) {
  if (!document) return 'draft';
  if (document.expired) return 'cancelled';
  if (document.scanStatus === 'clean' && !document.removedAt) return 'open';
  return document.scanStatus === 'pending' ? 'draft' : 'cancelled';
}

// Agencies submit explicitly once their files are uploaded; sellers are queued by their profile instead.
export function VerificationDocuments({ onUploaded, submittable = false }) {
  const { data: reference } = useReferenceData();
  const canManage = useCan('profile.manage');
  const [state, setState] = useState(null);
  const [expiryDates, setExpiryDates] = useState({});
  const [error, setError] = useState('');
  const [uploadingType, setUploadingType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const limits = reference?.limits?.documentUpload;

  async function refresh() {
    try {
      const result = await getVerificationDocuments();
      setState(result);
      setExpiryDates((current) => Object.fromEntries(result.requirements.map((item) => [item.type, current[item.type] ?? item.document?.expiresAt ?? ''])));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function upload(type, input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (limits && file.size > limits.maxBytes) {
      setError(`Files must be ${formatBytes(limits.maxBytes)} or smaller.`);
      return;
    }
    setUploadingType(type);
    setError('');
    try {
      const result = await uploadVerificationDocument(type, file, expiryDates[type] ?? '');
      await refresh();
      onUploaded?.(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUploadingType('');
    }
  }

  async function submitForReview() {
    setSubmitting(true);
    setError('');
    try {
      await submitAgencyVerification();
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  const verification = state?.verification;
  const canSubmit = submittable && ['unsubmitted', 'rejected'].includes(verification?.status);

  return (
    <div className="seller-documents">
      <div className="section-heading"><div><p className="eyebrow">VERIFICATION DOCUMENTS</p><h3>Business proof</h3></div>{state && <span className={`status-pill ${state.complete ? 'open' : 'draft'}`}><i />{state.complete ? 'Ready for review' : `${state.missing.length} required missing`}</span>}</div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {submittable && verification && <div className="verification-summary">
        <span className={`status-pill ${verification.status === 'approved' ? 'open' : verification.status === 'rejected' ? 'cancelled' : 'draft'}`}><i />{labelFor(reference?.agencyVerificationStatuses, verification.status)}</span>
        {verification.reason && <span>Reviewer note: {verification.reason}</span>}
        {verification.status === 'pending' && verification.submittedAt && <span>Submitted {new Date(verification.submittedAt).toLocaleDateString()}</span>}
        {canSubmit && <button className="primary-button" disabled={!canManage || submitting || state.notUploaded.length > 0} title={state.notUploaded.length ? 'Upload every required document first.' : canManage ? undefined : 'Only owners and managers can submit for review.'} onClick={submitForReview}><Send size={14} />{submitting ? 'Submitting...' : 'Submit for review'}</button>}
        {verification.status === 'approved' && <span><BadgeCheck size={14} />Sellers see a verified badge on your requests.</span>}
      </div>}
      {state && !state.storageConfigured && <p className="privacy-note"><FileWarning size={15} />Document upload is not available yet: private file storage has not been configured for this platform.</p>}
      {!state ? <div className="empty-state">Loading documents...</div> : <ul className="document-list">
        {state.requirements.map((item) => {
          const document = item.document;
          return <li key={item.type} className="document-row">
            <div className="document-main">
              <strong>{item.label}{item.required ? '' : ' (optional)'}</strong>
              {document ? <span>{document.filename} / {formatBytes(document.sizeBytes)} / {new Date(document.uploadedAt).toLocaleDateString()}{document.expiresAt ? ` / ${document.expired ? 'Expired' : 'Expires'} ${new Date(`${document.expiresAt}T00:00:00`).toLocaleDateString()}` : ''}</span> : <span>Not uploaded</span>}
              <label className="document-expiry-field">Expiry date (optional)<input type="date" value={expiryDates[item.type] ?? ''} min={new Date().toISOString().slice(0, 10)} disabled={!canManage || !state.storageConfigured || Boolean(uploadingType)} onChange={(event) => setExpiryDates((current) => ({ ...current, [item.type]: event.target.value }))} /></label>
            </div>
            <span className={`status-pill ${documentStateClass(document)}`}><i />{document ? labelFor(reference?.documentScanStatuses, document.scanStatus) : 'Missing'}</span>
            <label className={`secondary-button document-upload ${!canManage || !state.storageConfigured || uploadingType ? 'disabled' : ''}`} title={canManage ? undefined : 'Only owners and managers can upload documents.'}>
              <Upload size={14} />{uploadingType === item.type ? 'Uploading...' : document ? 'Replace' : 'Upload'}
              <input type="file" className="visually-hidden" accept={limits?.allowedMimeTypes.join(',')} disabled={!canManage || !state.storageConfigured || Boolean(uploadingType)} onChange={(event) => upload(item.type, event.target)} />
            </label>
          </li>;
        })}
      </ul>}
      <p className="privacy-note"><FileCheck2 size={15} />Files are stored privately, scanned for malware, and only opened by platform reviewers.{limits ? ` Accepted: ${limits.allowedMimeTypes.map((mime) => mime.split('/')[1].toUpperCase()).join(', ')} up to ${formatBytes(limits.maxBytes)}.` : ''}</p>
    </div>
  );
}
