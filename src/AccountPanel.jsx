import { useState } from 'react';
import { Download, LogOut, RotateCcw, Trash2, UserX } from 'lucide-react';
import { cancelAccountDeletion, exportAccountData, logoutAccount, requestAccountDeletion } from './api.js';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });

function downloadJson(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

function ExportButton({ onError }) {
  const [exporting, setExporting] = useState(false);
  async function exportData() {
    setExporting(true);
    try {
      const data = await exportAccountData();
      downloadJson(data, `voyagehub-export-${data.exportedAt.slice(0, 10)}.json`);
    } catch (error) {
      onError(error.message);
    } finally {
      setExporting(false);
    }
  }
  return <button type="button" className="secondary-button" onClick={exportData} disabled={exporting}><Download size={15} />{exporting ? 'Preparing...' : 'Download my data'}</button>;
}

export function AccountPanel({ account, onDeleted }) {
  const [password, setPassword] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const isOwner = account.organization.accessRole === 'owner';

  async function deleteAccount(event) {
    event.preventDefault();
    setDeleting(true);
    setError('');
    try {
      const result = await requestAccountDeletion(password);
      onDeleted(result);
    } catch (requestError) {
      setError(requestError.message);
      setDeleting(false);
    }
  }

  return (
    <section className="surface-section full-section account-panel">
      <div className="section-heading"><div><p className="eyebrow">YOUR DATA</p><h2>Privacy and account</h2></div></div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="account-actions">
        <div><strong>Download your data</strong><small>A JSON file with your profile, sign-ins, messages, reports and accepted terms{isOwner || account.capabilities?.includes('profile.manage') ? ', plus your organization’s requests, offers and awards' : ''}.</small></div>
        <ExportButton onError={setError} />
      </div>
      <div className="account-actions danger-zone">
        <div><strong>Delete your account</strong><small>You are signed out everywhere. Your personal data is anonymized after the grace period; you can cancel by signing in before then. If you are the only member, your organization closes too: active offers are withdrawn and open requests cancelled straight away, and that cannot be undone.</small></div>
        {!confirming ? <button type="button" className="secondary-button reject-button" onClick={() => setConfirming(true)}><UserX size={15} />Delete account</button> : (
          <form className="account-delete-form" onSubmit={deleteAccount}>
            <label className="field-label">Confirm with your password<input className="form-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setConfirming(false); setPassword(''); }}>Keep account</button><button className="primary-button reject-button" disabled={deleting || !password}><Trash2 size={15} />{deleting ? 'Scheduling...' : 'Schedule deletion'}</button></div>
          </form>
        )}
      </div>
    </section>
  );
}

export function DeletionPendingPage({ account, onCancelled }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function cancel() {
    setWorking(true);
    setError('');
    try {
      await cancelAccountDeletion();
      onCancelled();
    } catch (requestError) {
      setError(requestError.message);
      setWorking(false);
    }
  }

  async function signOut() {
    await logoutAccount().catch(() => {});
    window.location.assign('/login');
  }

  return (
    <main className="auth-wait">
      <section className="legal-gate">
        <UserX size={26} />
        <h1>Account scheduled for deletion</h1>
        <p>Your personal data will be anonymized on <strong>{dateFormat.format(new Date(account.account.deletionScheduledFor))}</strong>.{account.account.organizationClosureScheduledFor ? ` ${account.organization.name} closes on the same date.` : ''}</p>
        <p>Cancel to keep using Lead Exchange. Offers withdrawn and requests cancelled when you asked for deletion stay that way.</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="modal-actions"><ExportButton onError={setError} /><button type="button" className="secondary-button" onClick={signOut}><LogOut size={15} />Sign out</button><button type="button" className="primary-button" onClick={cancel} disabled={working}><RotateCcw size={15} />{working ? 'Restoring...' : 'Cancel deletion'}</button></div>
      </section>
    </main>
  );
}
