import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Globe2, LockKeyhole, UserRound } from 'lucide-react';
import { acceptInvitation, previewInvitation } from './api.js';
import { labelFor, useReferenceData } from './referenceData.js';
import { LegalConsent, requiredDocumentIds, useLegalDocuments } from './Legal.jsx';

function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { data: reference } = useReferenceData();
  const [invitation, setInvitation] = useState(null);
  const [status, setStatus] = useState(token ? 'loading' : 'invalid');
  const [error, setError] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const legal = useLegalDocuments();

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    previewInvitation(token)
      .then((result) => { if (active) { setInvitation(result.invitation); setStatus('ready'); } })
      .catch((requestError) => { if (active) { setError(requestError.message); setStatus('invalid'); } });
    return () => { active = false; };
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await acceptInvitation(token, fullName, password, legalAccepted ? requiredDocumentIds(legal.documents, invitation.role) : []);
      setStatus('accepted');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <Link className="auth-brand" to="/login"><span className="brand-mark"><Globe2 size={20} /></span><span><strong>LEAD EXCHANGE</strong><small>by VoyageHub</small></span></Link>
        <Link to="/login"><ArrowLeft size={14} />Back to sign in</Link>
      </header>
      <section className="auth-action-layout">
        <p className="eyebrow">TEAM INVITATION</p>
        {status === 'loading' && <h1>Checking invitation...</h1>}
        {status === 'invalid' && <><h1>Invitation unavailable</h1><p className="auth-action-description">{error || 'This invitation link is incomplete.'} Ask your organization for a new invitation.</p></>}
        {status === 'accepted' && <>
          <h1>You have joined {invitation.organizationName}</h1>
          <p className="auth-action-description">Sign in with {invitation.email} and choose the {labelFor(reference?.businessTypes, invitation.businessType)} account type.</p>
          <Link className="auth-submit auth-action-link" to="/login"><span>Continue to sign in</span><Check size={17} /></Link>
        </>}
        {status === 'ready' && <>
          <h1>Join {invitation.organizationName}</h1>
          <p className="auth-action-description">You were invited as {labelFor(reference?.memberRoles, invitation.role)} for {invitation.email}. The invitation expires {new Date(invitation.expiresAt).toLocaleString()}.</p>
          <form className="auth-form" onSubmit={submit}>
            <label className="auth-field"><span>Your full name</span><span className="auth-input"><UserRound size={16} /><input autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={120} required /></span></label>
            <label className="auth-field"><span>Choose a password</span><span className="auth-input"><LockKeyhole size={16} /><input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} required /></span></label>
            <LegalConsent documents={legal.documents} audience={invitation.role} checked={legalAccepted} onChange={setLegalAccepted} />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" disabled={submitting}>{submitting ? 'Joining...' : 'Accept invitation'}<Check size={17} /></button>
          </form>
        </>}
      </section>
      <footer className="auth-footer"><span>Lead Exchange by VoyageHub</span><span>Secure account access</span></footer>
    </main>
  );
}

export default AcceptInvitePage;
