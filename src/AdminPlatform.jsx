import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { DatabaseBackup, Eye, FileText, MapPin, Plus, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { createAdminDestination, getOperationsStatus, getPlatformSettings, listAdminDestinations, listAdminLegalDocuments, publishLegalDocument, updateAdminDestination, updatePlatformSetting } from './api.js';
import { DestinationPicker } from './DestinationPicker.jsx';
import { labelFor, useReferenceData } from './referenceData.js';

function SectionHeading({ eyebrow, title, subtitle, action }) {
  return <div className="page-heading admin-heading outbox-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="page-subtitle">{subtitle}</p></div>{action}</div>;
}

export function AdminSettings() {
  const [settings, setSettings] = useState([]);
  const [inputs, setInputs] = useState({});
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function apply(result) {
    setSettings(result.settings);
    setInputs(Object.fromEntries(result.settings.map((setting) => [setting.key, String(setting.value)])));
  }

  useEffect(() => { getPlatformSettings().then(apply).catch((requestError) => setError(requestError.message)); }, []);

  async function save(event, setting) {
    event.preventDefault();
    setSaving(setting.key);
    setError('');
    setNotice('');
    try {
      apply(await updatePlatformSetting(setting.key, Number(inputs[setting.key])));
      setNotice(`${setting.label} saved.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving('');
    }
  }

  return (
    <>
      <SectionHeading eyebrow="MARKETPLACE RULES" title="Platform settings" subtitle="Every change is audited. Defaults come from server configuration." />
      {error && <div className="auth-error" role="alert">{error}</div>}
      {notice && <p className="team-notice" role="status">{notice}</p>}
      <section className="surface-section admin-queue admin-settings-panel">
        {settings.length ? settings.map((setting) => (
          <form className="admin-setting-form" key={setting.key} onSubmit={(event) => save(event, setting)}>
            <label className="field-label" htmlFor={`setting-${setting.key}`}><SlidersHorizontal size={14} />{setting.label} ({setting.unit})</label>
            <input id={`setting-${setting.key}`} className="form-input" type="number" min={setting.min} max={setting.max} step="1" value={inputs[setting.key] ?? ''} onChange={(event) => setInputs((current) => ({ ...current, [setting.key]: event.target.value }))} required />
            <button className="primary-button" disabled={saving === setting.key || Number(inputs[setting.key]) === setting.value}>{saving === setting.key ? 'Saving...' : 'Save'}</button>
            <small>{setting.description} Current {setting.value}{setting.updatedAt ? ` / updated ${new Date(setting.updatedAt).toLocaleString()}` : ` / default ${setting.defaultValue}`}</small>
          </form>
        )) : <div className="empty-state">Loading platform settings...</div>}
      </section>
    </>
  );
}

export function AdminOperations() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  async function refresh() {
    setError('');
    try {
      setStatus(await getOperationsStatus());
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => { refresh(); }, []);

  const ageLabel = (hours) => hours >= 48 ? `${Math.round(hours / 24)} days` : `${hours} hours`;
  return (
    <>
      <SectionHeading eyebrow="OPERATIONS" title="Backups and restore drills" subtitle="Recorded by npm run db:backup and npm run db:restore-drill. See docs/runbooks in the backend repository." action={<button className="secondary-button" onClick={refresh}><RefreshCw size={15} />Refresh</button>} />
      {error && <div className="auth-error" role="alert">{error}</div>}
      <section className="surface-section admin-queue">
        {status ? <>
          {status.checks.map((check) => {
            const healthy = !check.overdue && !check.failingSinceSuccess;
            return <article className="outbox-entry" key={check.kind}>
              <div className="outbox-entry-main"><strong><DatabaseBackup size={13} /> {check.label}</strong><span>{check.lastSuccess ? `Last success ${new Date(check.lastSuccess.finishedAt).toLocaleString()}${check.lastSuccess.details?.backup ? ` / ${check.lastSuccess.details.backup}` : ''}${check.lastSuccess.details?.restoreSeconds ? ` / restore ${check.lastSuccess.details.restoreSeconds}s` : ''}` : 'Never succeeded'}{check.failingSinceSuccess ? ` / last run failed: ${check.lastFailure.details?.error ?? 'see the report'}` : ''}</span></div>
              <div className="outbox-entry-state"><span className={`status-pill ${healthy ? 'open' : 'cancelled'}`}><i />{healthy ? 'On schedule' : check.overdue ? `Overdue (every ${ageLabel(check.maxAgeHours)})` : 'Failing'}</span></div>
            </article>;
          })}
          <article className="outbox-entry">
            <div className="outbox-entry-main"><strong>Webhooks</strong><span>{status.webhooks.activeEndpoints} active endpoints / {status.webhooks.queuedDeliveries} queued / {status.webhooks.deadLetterDeliveries} failed deliveries / {status.webhooks.failingEndpoints} endpoints disabled for failures</span></div>
          </article>
        </> : <div className="empty-state">Loading operations status...</div>}
      </section>
    </>
  );
}

export function AdminDestinations() {
  const { data: reference } = useReferenceData();
  const [query, setQuery] = useState('');
  const [list, setList] = useState({ destinations: [], totals: null });
  const [form, setForm] = useState({ kind: 'city', name: '', countryCode: '', parent: [], aliases: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh(search = query) {
    try {
      setList(await listAdminDestinations({ q: search.trim() }));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => refresh(query), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  async function create(event) {
    event.preventDefault();
    setBusy('create');
    setError('');
    setNotice('');
    try {
      const parent = form.parent[0];
      const result = await createAdminDestination({
        kind: form.kind,
        name: form.kind === 'country' ? undefined : form.name,
        country_code: parent?.countryCode ?? form.countryCode,
        parent_id: form.kind === 'country' ? null : parent?.id ?? null,
        aliases: form.aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
      });
      setNotice(`${result.destination.label} added.`);
      setForm({ kind: form.kind, name: '', countryCode: form.countryCode, parent: form.parent, aliases: '' });
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  async function toggle(destination) {
    setBusy(destination.id);
    setError('');
    try {
      await updateAdminDestination(destination.id, { active: !destination.active });
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  const parentKinds = form.kind === 'region' ? ['country'] : ['country', 'region'];
  return (
    <>
      <SectionHeading eyebrow="MASTER DATA" title="Destinations" subtitle={`Countries, regions and cities used for requests, coverage and matching.${list.totals ? ` ${list.totals.active} active of ${list.totals.all}.` : ''} Bulk import: npm run destinations:import.`} />
      {error && <div className="auth-error" role="alert">{error}</div>}
      {notice && <p className="team-notice" role="status">{notice}</p>}
      <section className="surface-section admin-queue">
        <form className="destination-admin-form" onSubmit={create}>
          <label className="field-label">Type<select className="form-select" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value, parent: [] })}>{(reference?.destinationKinds ?? []).map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
          {form.kind === 'country'
            ? <label className="field-label">Country<select className="form-select" value={form.countryCode} onChange={(event) => setForm({ ...form, countryCode: event.target.value })} required><option value="" disabled>Select country</option>{(reference?.countries ?? []).map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
            : <>
              <label className="field-label">Name<input className="form-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength="2" maxLength="120" required /></label>
              <DestinationPicker label="Parent (country or region)" value={form.parent} onChange={(parent) => setForm({ ...form, parent })} kinds={parentKinds} />
              <label className="field-label">Other names (comma separated)<input className="form-input" value={form.aliases} onChange={(event) => setForm({ ...form, aliases: event.target.value })} placeholder="e.g. Bombay" /></label>
            </>}
          <button className="primary-button" disabled={busy === 'create' || (form.kind !== 'country' && !form.parent.length)}><Plus size={15} />Add destination</button>
        </form>
        <label className="search-field moderation-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search destinations, including inactive" aria-label="Search destinations" /></label>
        {list.destinations.length ? list.destinations.map((destination) => (
          <article className="outbox-entry" key={destination.id}>
            <div className="outbox-entry-main"><strong><MapPin size={13} /> {destination.label}</strong><span>{labelFor(reference?.destinationKinds, destination.kind)}{destination.aliases.length ? ` / also: ${destination.aliases.join(', ')}` : ''}</span></div>
            <div className="outbox-entry-state"><span className={`status-pill ${destination.active ? 'open' : 'expired'}`}><i />{destination.active ? 'Active' : 'Inactive'}</span></div>
            <button className="secondary-button" disabled={busy === destination.id} onClick={() => toggle(destination)}>{destination.active ? 'Deactivate' : 'Activate'}</button>
          </article>
        )) : <div className="empty-state"><MapPin size={22} /><strong>No destinations found</strong><span>Import GeoNames data or add destinations above.</span></div>}
      </section>
    </>
  );
}

export function AdminLegalDocuments() {
  const { data: reference } = useReferenceData();
  const [documents, setDocuments] = useState([]);
  const [draft, setDraft] = useState({ type: 'terms', title: '', body: '', changeSummary: '' });
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    try {
      setDocuments((await listAdminLegalDocuments()).documents);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function publish(event) {
    event.preventDefault();
    if (!window.confirm('Publish this version? Members must accept it before they can continue.')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await publishLegalDocument({ document_type: draft.type, title: draft.title, body: draft.body, change_summary: draft.changeSummary || null });
      setNotice(`${labelFor(reference?.legalDocumentTypes, result.document.type)} version ${result.document.version} published.`);
      setDraft({ type: draft.type, title: '', body: '', changeSummary: '' });
      setPreview(false);
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const missing = (reference?.legalDocumentTypes ?? []).filter((type) => !documents.some((document) => document.type === type.value));
  return (
    <>
      <SectionHeading eyebrow="COMPLIANCE" title="Legal documents" subtitle="Publishing creates a new version. Members are asked to accept required documents again." action={<button className="secondary-button" onClick={refresh}><RefreshCw size={15} />Refresh</button>} />
      {missing.length > 0 && <div className="auth-error" role="alert">Not published yet: {missing.map((type) => type.label).join(', ')}. New users can sign up without accepting them until they are published.</div>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      {notice && <p className="team-notice" role="status">{notice}</p>}
      <section className="surface-section admin-queue">
        <form className="legal-admin-form" onSubmit={publish}>
          <label className="field-label">Document<select className="form-select" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>{(reference?.legalDocumentTypes ?? []).map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
          <label className="field-label">Title<input className="form-input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} minLength="3" maxLength="200" required /></label>
          <label className="field-label">Body (Markdown, approved by your legal adviser)<textarea className="form-input legal-body-input" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} minLength="50" required /></label>
          <label className="field-label">What changed (optional)<input className="form-input" value={draft.changeSummary} onChange={(event) => setDraft({ ...draft, changeSummary: event.target.value })} maxLength="500" /></label>
          {preview && <div className="legal-body legal-preview"><Markdown>{draft.body}</Markdown></div>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setPreview(!preview)}><Eye size={15} />{preview ? 'Hide preview' : 'Preview'}</button><button className="primary-button" disabled={busy}><FileText size={15} />{busy ? 'Publishing...' : 'Publish new version'}</button></div>
        </form>
        {documents.map((document) => (
          <article className="outbox-entry" key={document.id}>
            <div className="outbox-entry-main"><strong>{labelFor(reference?.legalDocumentTypes, document.type)} v{document.version}: {document.title}</strong><span>Published {new Date(document.publishedAt).toLocaleString()}{document.publishedBy ? ` by ${document.publishedBy}` : ''}{document.changeSummary ? ` / ${document.changeSummary}` : ''}</span></div>
            <div className="outbox-entry-state"><small>{document.acceptanceCount} acceptances</small></div>
            <a className="secondary-button" href={`/legal/${document.type}`} target="_blank" rel="noreferrer">View current</a>
          </article>
        ))}
      </section>
    </>
  );
}
