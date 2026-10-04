import { useEffect, useState } from 'react';
import { Ban, Flag, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { listAdminOrganizations, listAdminReports, reinstateOrganization, resolveAdminReport, suspendOrganization } from './api.js';
import { labelFor, useReferenceData } from './referenceData.js';

export function AdminModeration() {
  const { data: reference } = useReferenceData();
  const [reports, setReports] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refreshReports() {
    try {
      setReports((await listAdminReports('open')).reports);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => { refreshReports(); }, []);
  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      listAdminOrganizations(search.trim())
        .then((result) => active && setOrganizations(result.organizations))
        .catch((requestError) => active && setError(requestError.message));
    }, 250);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [search]);

  async function run(key, action, message) {
    const note = notes[key]?.trim() ?? '';
    if (note.length < 5) {
      setError('Add a note or reason of at least 5 characters first.');
      return;
    }
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await action(note);
      setNotes((current) => ({ ...current, [key]: '' }));
      await refreshReports();
      setOrganizations((await listAdminOrganizations(search.trim())).organizations);
      setNotice(message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  const noteField = (key, placeholder) => <textarea className="form-input moderation-note" value={notes[key] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))} maxLength="500" placeholder={placeholder} />;

  return (
    <>
      <div className="page-heading admin-heading outbox-heading"><div><p className="eyebrow">TRUST AND SAFETY</p><h2>Reports</h2><p className="page-subtitle">Open reports from agencies and sellers. Reporters are notified of the outcome.</p></div><button className="secondary-button" onClick={refreshReports}><RefreshCw size={15} />Refresh</button></div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {notice && <p className="team-notice" role="status">{notice}</p>}
      <section className="surface-section admin-queue">
        {reports.length ? reports.map((report) => (
          <article className="verification-row" key={report.id}>
            <div className="verification-main">
              <div className="verification-title"><span className="role-option-icon"><Flag size={16} /></span><div><h2>{labelFor(reference?.reportCategories, report.category)}</h2><span>{labelFor(reference?.reportTargetTypes, report.targetType)} from {report.target.name} / reported by {report.reporterName}</span></div>{report.target.suspended && <span className="status-pill expired"><i />Suspended</span>}</div>
              {report.details && <p className="moderation-details">{report.details}</p>}
              <small className="table-secondary">Reported {new Date(report.createdAt).toLocaleString()} / item {report.targetId}</small>
              {noteField(report.id, 'Resolution note (shared as outcome only)')}
            </div>
            <div className="verification-actions">
              <button className="secondary-button" disabled={busy === report.id} onClick={() => run(report.id, (note) => resolveAdminReport(report.id, 'dismissed', note), 'Report dismissed.')}>Dismiss</button>
              <button className="primary-button" disabled={busy === report.id} onClick={() => run(report.id, (note) => resolveAdminReport(report.id, 'actioned', note), 'Report marked as actioned.')}>Mark actioned</button>
            </div>
          </article>
        )) : <div className="empty-state"><ShieldCheck size={24} /><strong>No open reports</strong><span>New reports appear here.</span></div>}
      </section>

      <div className="page-heading admin-heading outbox-heading"><div><p className="eyebrow">ACCOUNT ENFORCEMENT</p><h2>Organizations</h2><p className="page-subtitle">Suspending signs out every member, withdraws active offers and cancels open requests.</p></div></div>
      <section className="surface-section admin-queue">
        <label className="search-field moderation-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search organizations" aria-label="Search organizations" /></label>
        {organizations.map((organization) => {
          const key = `org-${organization.id}`;
          return (
            <article className="verification-row" key={organization.id}>
              <div className="verification-main">
                <div className="verification-title"><div><h2>{organization.name}</h2><span>{labelFor(reference?.businessTypes, organization.businessType)} / {organization.countryCode} / {organization.memberCount} members{organization.verificationStatus ? ` / ${organization.verificationStatus}` : ''}</span></div>{organization.openReports > 0 && <span className="status-pill draft"><i />{organization.openReports} open reports</span>}{organization.suspendedAt && <span className="status-pill expired"><i />Suspended</span>}</div>
                {organization.suspendedAt && <small className="table-secondary">Suspended {new Date(organization.suspendedAt).toLocaleString()}: {organization.suspensionReason}</small>}
                {noteField(key, organization.suspendedAt ? 'Reason for reinstating' : 'Reason for suspending')}
              </div>
              <div className="verification-actions">
                {organization.suspendedAt
                  ? <button className="primary-button" disabled={busy === key} onClick={() => run(key, (reason) => reinstateOrganization(organization.id, reason), `${organization.name} reinstated.`)}>Reinstate</button>
                  : <button className="secondary-button reject-button" disabled={busy === key} onClick={() => window.confirm(`Suspend ${organization.name}? All members are signed out immediately.`) && run(key, (reason) => suspendOrganization(organization.id, reason), `${organization.name} suspended.`)}><Ban size={14} />Suspend</button>}
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
