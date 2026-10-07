import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { listAuthSessions, revokeAuthSession, signOutEverywhere } from './api.js';

function dateTime(value) {
  return new Date(value).toLocaleString();
}

export function SessionManagementPanel() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    setError('');
    try {
      setSessions((await listAuthSessions()).sessions);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function revoke(session) {
    if (!window.confirm(`Sign out the session for ${session.organizationName}?`)) return;
    setBusy(session.id);
    setError('');
    try {
      await revokeAuthSession(session.id);
      setSessions((current) => current.filter((item) => item.id !== session.id));
      setNotice('Session signed out.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  async function signOutAll() {
    if (!window.confirm('Sign out every device using this account? You will need to sign in again.')) return;
    setBusy('all');
    setError('');
    try {
      await signOutEverywhere();
      navigate('/login', { replace: true, state: { notice: 'You have signed out of all sessions.' } });
    } catch (requestError) {
      setError(requestError.message);
      setBusy('');
    }
  }

  return <section className="surface-section full-section session-management-panel">
    <div className="section-heading request-list-heading">
      <div><p className="eyebrow">ACCOUNT SECURITY</p><h2>Active sessions <span className="heading-count">{sessions.length}</span></h2></div>
      <div className="session-actions">
        <button className="icon-button" aria-label="Refresh sessions" title="Refresh sessions" disabled={Boolean(busy)} onClick={refresh}><RefreshCw size={15} /></button>
        <button className="secondary-button reject-button" disabled={Boolean(busy) || loading || !sessions.length} onClick={signOutAll}><LogOut size={14} />Sign out everywhere</button>
      </div>
    </div>
    {error && <div className="auth-error" role="alert">{error}</div>}
    {notice && <p className="team-notice" role="status">{notice}</p>}
    {loading ? <div className="empty-state">Loading sessions...</div> : sessions.length ? <div className="role-table-wrap"><table className="role-table"><thead><tr><th>SESSION</th><th>ORGANIZATION</th><th>SIGNED IN</th><th>EXPIRES</th><th>STATUS</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>
      {sessions.map((session) => <tr key={session.id}>
        <td><strong>{session.current ? 'This device' : 'Signed-in session'}</strong></td>
        <td>{session.organizationName}<small>{session.businessType}</small></td>
        <td>{dateTime(session.createdAt)}</td>
        <td>{dateTime(session.expiresAt)}</td>
        <td><span className={`status-pill ${session.current ? 'open' : 'draft'}`}><i />{session.current ? 'Current' : 'Active'}</span></td>
        <td>{!session.current && <button className="icon-button" aria-label={`Sign out session for ${session.organizationName}`} title="Sign out session" disabled={Boolean(busy)} onClick={() => revoke(session)}><Trash2 size={15} /></button>}</td>
      </tr>)}
    </tbody></table></div> : <div className="empty-state">No active sessions found.</div>}
  </section>;
}