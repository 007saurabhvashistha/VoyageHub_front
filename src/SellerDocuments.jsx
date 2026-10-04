import { useEffect, useState } from 'react';
import { FileCheck2, FileWarning, Upload } from 'lucide-react';
import { getSellerDocuments, uploadSellerDocument } from './api.js';
import { useCan } from './capabilities.js';
import { labelFor, useReferenceData } from './referenceData.js';

export function formatBytes(bytes) {
  const [value, unit] = bytes >= 1024 * 1024 ? [bytes / (1024 * 1024), 'megabyte'] : [bytes / 1024, 'kilobyte'];
  return new Intl.NumberFormat(undefined, { style: 'unit', unit, maximumFractionDigits: 1 }).format(value);
}

export function documentStateClass(document) {
  if (!document) return 'draft';
  if (document.scanStatus === 'clean' && !document.removedAt) return 'open';
  return document.scanStatus === 'pending' ? 'draft' : 'cancelled';
}

export function SellerDocuments({ onUploaded }) {
  const { data: reference } = useReferenceData();
  const canManage = useCan('profile.manage');
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [uploadingType, setUploadingType] = useState('');
  const limits = reference?.limits?.documentUpload;

  async function refresh() {
    try {
      setState(await getSellerDocuments());
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
      const result = await uploadSellerDocument(type, file);
      await refresh();
      onUploaded?.(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUploadingType('');
    }
  }

  return (
    <div className="seller-documents">
      <div className="section-heading"><div><p className="eyebrow">VERIFICATION DOCUMENTS</p><h3>Business proof</h3></div>{state && <span className={`status-pill ${state.complete ? 'open' : 'draft'}`}><i />{state.complete ? 'Ready for review' : `${state.missing.length} required missing`}</span>}</div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {state && !state.storageConfigured && <p className="privacy-note"><FileWarning size={15} />Document upload is not available yet: private file storage has not been configured for this platform.</p>}
      {!state ? <div className="empty-state">Loading documents...</div> : <ul className="document-list">
        {state.requirements.map((item) => {
          const document = item.document;
          return <li key={item.type} className="document-row">
            <div className="document-main">
              <strong>{item.label}{item.required ? '' : ' (optional)'}</strong>
              {document ? <span>{document.filename} / {formatBytes(document.sizeBytes)} / {new Date(document.uploadedAt).toLocaleDateString()}</span> : <span>Not uploaded</span>}
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
