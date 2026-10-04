import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { acceptLegalDocuments, listLegalDocuments } from './api.js';
import { labelFor, useReferenceData } from './referenceData.js';

const cookieNoticeKey = 'lead-exchange-cookie-notice';

function requiredDocuments(documents, audience) {
  return documents.filter((document) => document.acceptance === 'all_members' || (audience === 'owner' && document.acceptance === 'organization_owner'));
}

export function useLegalDocuments() {
  const [state, setState] = useState({ documents: [], loading: true, error: '' });
  useEffect(() => {
    let active = true;
    listLegalDocuments()
      .then((result) => active && setState({ documents: result.documents, loading: false, error: '' }))
      .catch((error) => active && setState({ documents: [], loading: false, error: error.message }));
    return () => { active = false; };
  }, []);
  return state;
}

export function LegalLinks() {
  const { data: reference } = useReferenceData();
  return <nav className="legal-links" aria-label="Legal">{(reference?.legalDocumentTypes ?? []).map((type) => <Link key={type.value} to={`/legal/${type.value}`} target="_blank" rel="noreferrer">{type.label}</Link>)}</nav>;
}

// Checkbox consent for the current documents a new member must accept.
export function LegalConsent({ documents, audience, checked, onChange }) {
  const { data: reference } = useReferenceData();
  const required = requiredDocuments(documents, audience);
  if (!required.length) return null;
  return (
    <label className="legal-consent">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} required />
      <span>I agree to the {required.map((document, index) => <span key={document.id}>{index > 0 && (index === required.length - 1 ? ' and ' : ', ')}<Link to={`/legal/${document.type}`} target="_blank" rel="noreferrer">{labelFor(reference?.legalDocumentTypes, document.type)}</Link></span>)}.</span>
    </label>
  );
}

export function requiredDocumentIds(documents, audience) {
  return requiredDocuments(documents, audience).map((document) => document.id);
}

// Only strictly necessary cookies are used, so this is an information notice rather than a consent choice.
export function CookieNotice() {
  const { data: reference } = useReferenceData();
  const fingerprint = (reference?.cookies ?? []).map((cookie) => cookie.name).join(',');
  const [dismissed, setDismissed] = useState(() => window.localStorage.getItem(cookieNoticeKey));
  if (!fingerprint || dismissed === fingerprint) return null;
  function dismiss() {
    window.localStorage.setItem(cookieNoticeKey, fingerprint);
    setDismissed(fingerprint);
  }
  return (
    <aside className="cookie-notice" role="region" aria-label="Cookie notice">
      <span>Lead Exchange uses only strictly necessary cookies to keep you signed in and protect your account. No advertising or analytics cookies. <Link to="/legal/cookies">Cookie policy</Link></span>
      <button type="button" className="secondary-button" onClick={dismiss}>OK</button>
    </aside>
  );
}

export function LegalAcceptanceGate({ documents, onAccepted }) {
  const { data: reference } = useReferenceData();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function accept(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await acceptLegalDocuments(documents.map((document) => document.id));
      onAccepted(result.pendingLegalDocuments);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-wait">
      <section className="legal-gate">
        <ShieldCheck size={26} />
        <h1>Review updated terms</h1>
        <p>Accept the current version of these documents to continue using Lead Exchange.</p>
        <ul>{documents.map((document) => <li key={document.id}><Link to={`/legal/${document.type}`} target="_blank" rel="noreferrer">{labelFor(reference?.legalDocumentTypes, document.type)}</Link> (version {document.version}{document.changeSummary ? `: ${document.changeSummary}` : ''})</li>)}</ul>
        <form onSubmit={accept}>
          <label className="legal-consent"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} required /><span>I have read and accept these documents.</span></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={!checked || saving}>{saving ? 'Saving...' : 'Accept and continue'}</button>
        </form>
      </section>
    </main>
  );
}
