import { useEffect, useState } from 'react';
import { BadgeCheck, Building2, Globe2, Hotel, LogOut, Mail, RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { decideSellerVerification, getNotificationOutbox, getPlatformSettings, listPendingSellerProfiles, logoutAccount, retryNotificationOutbox, updateMaxOffersPerRequest } from './api.js';
import { MfaSecurityPanel } from './MfaSecurity.jsx';

function AdminWorkspace({ account }) {
  const [sellers, setSellers] = useState([]);
  const [reasons, setReasons] = useState({});
  const [evidenceReviewed, setEvidenceReviewed] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState('');
  const [outbox, setOutbox] = useState({ entries: [], summary: [] });
  const [outboxLoading, setOutboxLoading] = useState(true);
  const [retryingOutboxId, setRetryingOutboxId] = useState('');
  const [settings, setSettings] = useState(null);
  const [offerLimitInput, setOfferLimitInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState('');

  async function refreshSettings() {
    try {
      const result = await getPlatformSettings();
      setSettings(result.settings);
      setOfferLimitInput(String(result.settings.maxOffersPerRequest));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function saveOfferLimit(event) {
    event.preventDefault();
    setSavingSettings(true);
    setSettingsNotice('');
    setError('');
    try {
      await updateMaxOffersPerRequest(Number(offerLimitInput));
      await refreshSettings();
      setSettingsNotice('Offer limit saved. It applies to new offers immediately.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingSettings(false);
    }
  }

  async function refreshQueue() {
    setLoading(true);
    setError('');
    try {
      const result = await listPendingSellerProfiles();
      setSellers(result.sellers);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshOutbox() {
    setOutboxLoading(true);
    try {
      setOutbox(await getNotificationOutbox());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setOutboxLoading(false);
    }
  }

  useEffect(() => { refreshQueue(); refreshOutbox(); refreshSettings(); }, []);

  async function decide(seller, decision) {
    const reason = reasons[seller.organizationId]?.trim() ?? '';
    if (reason.length < 5 || !evidenceReviewed[seller.organizationId]) {
      setError('Confirm evidence review and add a decision reason before continuing.');
      return;
    }
    setProcessingId(seller.organizationId);
    setError('');
    try {
      await decideSellerVerification(seller.organizationId, decision, reason);
      setSellers((current) => current.filter((item) => item.organizationId !== seller.organizationId));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProcessingId('');
    }
  }

  async function requeue(entry) {
    setRetryingOutboxId(String(entry.id));
    setError('');
    try {
      await retryNotificationOutbox(entry.id);
      await refreshOutbox();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRetryingOutboxId('');
    }
  }

  async function signOut() {
    try {
      await logoutAccount();
      window.location.assign('/login');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <a className="auth-brand" href="/workspace/admin/verification"><span className="brand-mark"><Globe2 size={20} /></span><span><strong>LEAD EXCHANGE</strong><small>Platform operations</small></span></a>
        <div className="admin-user"><span><strong>{account.user.fullName}</strong><small>Platform administrator</small></span><button className="icon-button" aria-label="Sign out" onClick={signOut}><LogOut size={16} /></button></div>
      </header>
      <div className="admin-content">
        <div className="page-heading admin-heading"><div><p className="eyebrow">TRUST AND SAFETY</p><h1>Seller verification</h1><p className="page-subtitle">Review business claims before marketplace access is enabled.</p></div><span className="admin-queue-count"><ShieldCheck size={16} />{sellers.length} pending</span></div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <section className="surface-section admin-queue">
          {loading ? <div className="empty-state">Loading verification queue...</div> : sellers.length ? sellers.map((seller) => {
            const Icon = seller.businessType === 'hotelier' ? Hotel : Building2;
            return <article className="verification-row" key={seller.organizationId}>
              <div className="verification-main"><div className="verification-title"><span className="role-option-icon"><Icon size={17} /></span><div><h2>{seller.organizationName}</h2><span>{seller.businessType} / {seller.countryCode}</span></div><span className="status-pill draft"><i />Pending</span></div>
                <div className="verification-facts"><span><Globe2 size={14} />{seller.businessType === 'dmc' ? seller.coverageDestinations.join(', ') : seller.propertyCity}</span><span>Submitted {new Date(seller.submittedAt).toLocaleDateString()}</span></div>
                <label className="evidence-confirm"><input type="checkbox" checked={Boolean(evidenceReviewed[seller.organizationId])} onChange={(event) => setEvidenceReviewed((current) => ({ ...current, [seller.organizationId]: event.target.checked }))} />I reviewed the seller's verification evidence.</label>
                <label className="field-label">Decision reason<textarea value={reasons[seller.organizationId] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [seller.organizationId]: event.target.value }))} minLength="5" maxLength="500" placeholder="Record the review outcome" /></label>
              </div>
              <div className="verification-actions"><button className="secondary-button reject-button" disabled={processingId === seller.organizationId || !evidenceReviewed[seller.organizationId] || (reasons[seller.organizationId]?.trim().length ?? 0) < 5} onClick={() => decide(seller, 'rejected')}>Reject</button><button className="primary-button" disabled={processingId === seller.organizationId || !evidenceReviewed[seller.organizationId] || (reasons[seller.organizationId]?.trim().length ?? 0) < 5} onClick={() => decide(seller, 'approved')}><BadgeCheck size={15} />Approve</button></div>
            </article>;
          }) : <div className="empty-state"><ShieldCheck size={24} /><strong>Queue clear</strong><span>There are no seller profiles awaiting review.</span></div>}
        </section>
        <p className="admin-policy-note">Approval is audited and enables request matching and offer submission for that seller organization.</p>
        <div className="page-heading admin-heading outbox-heading"><div><p className="eyebrow">MARKETPLACE RULES</p><h2>Offer limit per request</h2><p className="page-subtitle">Maximum active offers a request accepts. Withdrawn offers free a slot.</p></div></div>
        <section className="surface-section admin-queue admin-settings-panel">
          {settings ? <form className="admin-setting-form" onSubmit={saveOfferLimit}>
            <label className="field-label" htmlFor="max-offers"><SlidersHorizontal size={14} />Active offers per request</label>
            <input id="max-offers" className="form-input" type="number" min={settings.maxOffersPerRequestBounds?.min ?? 1} max={settings.maxOffersPerRequestBounds?.max ?? 50} step="1" value={offerLimitInput} onChange={(event) => setOfferLimitInput(event.target.value)} required />
            <button className="primary-button" disabled={savingSettings || Number(offerLimitInput) === settings.maxOffersPerRequest}>{savingSettings ? 'Saving...' : 'Save limit'}</button>
            <small>Current: {settings.maxOffersPerRequest}{settings.updatedAt ? ` / updated ${new Date(settings.updatedAt).toLocaleString()}` : ' / platform default'}</small>
            {settingsNotice && <small role="status">{settingsNotice}</small>}
          </form> : <div className="empty-state">Loading marketplace rules...</div>}
        </section>
        <div className="page-heading admin-heading outbox-heading"><div><p className="eyebrow">DELIVERY OPERATIONS</p><h2>Notification outbox</h2><p className="page-subtitle">Durable delivery attempts and retry state.</p></div><button className="secondary-button" onClick={refreshOutbox} disabled={outboxLoading}><RefreshCw size={15} />Refresh</button></div>
        <div className="outbox-summary">{outbox.summary.map((item) => <span key={item.status}><strong>{item.count}</strong> {item.status.replace('_', ' ')}</span>)}</div>
        <section className="surface-section admin-queue notification-outbox-queue">
          {outboxLoading ? <div className="empty-state">Loading notification queue...</div> : outbox.entries.length ? outbox.entries.map((entry) => (
            <article className="outbox-entry" key={entry.id}>
              <div className="outbox-entry-main"><strong>{entry.title}</strong><span>{entry.organizationName} / {entry.eventType.replaceAll('_', ' ')}</span><small>Created {new Date(entry.createdAt).toLocaleString()}</small></div>
              <div className="outbox-entry-state"><span className={`status-pill ${entry.status === 'delivered' ? 'open' : 'draft'}`}><i />{entry.status.replace('_', ' ')}</span><small>{entry.attempts} attempts{entry.lastErrorCode ? ` / ${entry.lastErrorCode}` : ''}</small></div>
              {['blocked_config', 'dead_letter'].includes(entry.status) && <button className="secondary-button" disabled={retryingOutboxId === String(entry.id)} onClick={() => requeue(entry)}><RefreshCw size={14} />{retryingOutboxId === String(entry.id) ? 'Queueing...' : 'Queue retry'}</button>}
            </article>
          )) : <div className="empty-state"><Mail size={23} /><strong>No queued notifications</strong><span>New marketplace events appear here for delivery tracking.</span></div>}
        </section>
        <p className="admin-policy-note">External email remains blocked until a real provider is configured. Queueing a retry does not claim that a message was sent.</p>
        <div className="page-heading admin-heading outbox-heading"><div><p className="eyebrow">ACCOUNT SECURITY</p><h2>Administrator MFA</h2></div></div>
        <section className="surface-section admin-queue admin-mfa-panel"><MfaSecurityPanel account={account} /></section>
      </div>
    </main>
  );
}

export default AdminWorkspace;