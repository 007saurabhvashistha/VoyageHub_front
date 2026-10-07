import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { DatabaseBackup, Eye, FileText, Hotel, MapPin, Plus, RefreshCw, Search, SlidersHorizontal, Star, Upload } from 'lucide-react';
import { createAdminDestination, decideHotelProperty, getAdminDestination, getDestinationLevels, getOperationsStatus, getPlatformSettings, importFeaturedDestinations, listAdminDestinations, listAdminLegalDocuments, listPendingHotelProperties, publishLegalDocument, saveDestinationLevels, updateAdminDestination, updatePlatformSetting } from './api.js';
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
    setInputs(Object.fromEntries(result.settings.map((setting) => [setting.key, setting.type === 'list' ? setting.value.join(', ') : setting.type === 'boolean' ? setting.value : String(setting.value)])));
  }

  useEffect(() => { getPlatformSettings().then(apply).catch((requestError) => setError(requestError.message)); }, []);

  const parsed = (setting) => setting.type === 'list'
    ? (inputs[setting.key] ?? '').split(',').map((item) => item.trim()).filter(Boolean)
    : setting.type === 'boolean' ? Boolean(inputs[setting.key])
    : Number(inputs[setting.key]);
  const unchanged = (setting) => JSON.stringify(parsed(setting)) === JSON.stringify(setting.value);

  async function save(event, setting) {
    event.preventDefault();
    setSaving(setting.key);
    setError('');
    setNotice('');
    try {
      apply(await updatePlatformSetting(setting.key, parsed(setting)));
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
            <label className="field-label" htmlFor={`setting-${setting.key}`}><SlidersHorizontal size={14} />{setting.label}{setting.unit ? ` (${setting.unit})` : ''}</label>
            {setting.type === 'list'
              ? <input id={`setting-${setting.key}`} className="form-input" value={inputs[setting.key] ?? ''} onChange={(event) => setInputs((current) => ({ ...current, [setting.key]: event.target.value }))} placeholder={setting.options ? setting.options.join(', ') : 'Comma separated'} />
              : setting.type === 'boolean'
                ? <div className="admin-feature-toggle"><input id={`setting-${setting.key}`} type="checkbox" role="switch" aria-label={setting.label} checked={Boolean(inputs[setting.key])} onChange={(event) => setInputs((current) => ({ ...current, [setting.key]: event.target.checked }))} /><span>{inputs[setting.key] ? 'Enabled' : 'Disabled'}</span></div>
                : <input id={`setting-${setting.key}`} className="form-input" type="number" min={setting.min} max={setting.max} step="1" value={inputs[setting.key] ?? ''} onChange={(event) => setInputs((current) => ({ ...current, [setting.key]: event.target.value }))} required />}
            <button className="primary-button" disabled={saving === setting.key || unchanged(setting)}>{saving === setting.key ? 'Saving...' : 'Save'}</button>
            <small>{setting.description}{setting.options ? ` Allowed: ${setting.options.join(', ')}.` : ''} Current {setting.type === 'list' ? setting.value.join(', ') || 'none' : setting.type === 'boolean' ? setting.value ? 'enabled' : 'disabled' : setting.value}{setting.updatedAt ? ` / updated ${new Date(setting.updatedAt).toLocaleString()}` : ` / default ${setting.type === 'list' ? setting.defaultValue.join(', ') || 'none' : setting.type === 'boolean' ? setting.defaultValue ? 'enabled' : 'disabled' : setting.defaultValue}`}</small>
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
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [parentsEditor, setParentsEditor] = useState(null);

  async function refresh(search = query) {
    try {
      setList(await listAdminDestinations({ q: search.trim(), featured: featuredOnly }));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => refresh(query), 250);
    return () => window.clearTimeout(timeout);
  }, [query, featuredOnly]);

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

  async function toggle(destination, field = 'active') {
    setBusy(destination.id);
    setError('');
    try {
      await updateAdminDestination(destination.id, { [field]: !destination[field] });
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  async function openParents(destination) {
    setError('');
    try {
      const detail = await getAdminDestination(destination.id);
      setParentsEditor({ destination, parents: detail.destination.secondaryParents });
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function saveParents() {
    setBusy(parentsEditor.destination.id);
    setError('');
    try {
      await updateAdminDestination(parentsEditor.destination.id, { secondary_parent_ids: parentsEditor.parents.map((parent) => parent.id) });
      setNotice(`Extra parents saved for ${parentsEditor.destination.name}.`);
      setParentsEditor(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  const parentKinds = reference?.destinationParentKinds?.[form.kind] ?? [];
  return (
    <>
      <SectionHeading eyebrow="MASTER DATA" title="Destinations" subtitle={`Countries, level 1 and level 2 areas and places used for leads, coverage and matching.${list.totals ? ` ${list.totals.active} active of ${list.totals.all}.` : ''} Bulk import: npm run destinations:import (countries from the Destination countries setting).`} />
      {error && <div className="auth-error" role="alert">{error}</div>}
      {notice && <p className="team-notice" role="status">{notice}</p>}
      <section className="surface-section admin-queue">
        <form className="destination-admin-form" onSubmit={create}>
          <label className="field-label">Type<select className="form-select" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value, parent: [] })}>{(reference?.destinationKinds ?? []).map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
          {form.kind === 'country'
            ? <label className="field-label">Country<select className="form-select" value={form.countryCode} onChange={(event) => setForm({ ...form, countryCode: event.target.value })} required><option value="" disabled>Select country</option>{(reference?.countries ?? []).map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
            : <>
              <label className="field-label">Name<input className="form-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength="2" maxLength="120" required /></label>
              <DestinationPicker label={`Parent (${parentKinds.map((kind) => labelFor(reference?.destinationKinds, kind).toLowerCase()).join(' or ')})`} value={form.parent} onChange={(parent) => setForm({ ...form, parent })} kinds={parentKinds} />
              <label className="field-label">Other names (comma separated)<input className="form-input" value={form.aliases} onChange={(event) => setForm({ ...form, aliases: event.target.value })} placeholder="Old names, short names, local spellings" /></label>
            </>}
          <button className="primary-button" disabled={busy === 'create' || (form.kind !== 'country' && !form.parent.length)}><Plus size={15} />Add destination</button>
        </form>
        <label className="search-field moderation-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search destinations, including inactive" aria-label="Search destinations" /></label>
        <label className="checkbox-field"><input type="checkbox" checked={featuredOnly} onChange={(event) => setFeaturedOnly(event.target.checked)} />Featured only</label>
        {parentsEditor && <div className="negotiation-notice">
          <p><strong>{parentsEditor.destination.label}</strong> also belongs to (for places that span several areas):</p>
          <DestinationPicker label="Extra parents" value={parentsEditor.parents} onChange={(parents) => setParentsEditor({ ...parentsEditor, parents })} multiple max={10} kinds={reference?.destinationParentKinds?.[parentsEditor.destination.kind] ?? []} />
          <div className="modal-actions"><button className="secondary-button" onClick={() => setParentsEditor(null)}>Cancel</button><button className="primary-button" disabled={busy === parentsEditor.destination.id} onClick={saveParents}>Save extra parents</button></div>
        </div>}
        {list.destinations.length ? list.destinations.map((destination) => (
          <article className="outbox-entry" key={destination.id}>
            <div className="outbox-entry-main"><strong>{destination.featured ? <Star size={13} /> : <MapPin size={13} />} {destination.label}</strong><span>{destination.kindLabel}{destination.aliases.length ? ` / also: ${destination.aliases.join(', ')}` : ''}</span></div>
            <div className="outbox-entry-state"><span className={`status-pill ${destination.active ? 'open' : 'expired'}`}><i />{destination.active ? 'Active' : 'Inactive'}</span></div>
            <button className="text-button" disabled={busy === destination.id} onClick={() => toggle(destination, 'featured')}>{destination.featured ? 'Unfeature' : 'Feature'}</button>
            {destination.kind !== 'country' && <button className="text-button" onClick={() => openParents(destination)}>Extra parents</button>}
            <button className="secondary-button" disabled={busy === destination.id} onClick={() => toggle(destination)}>{destination.active ? 'Deactivate' : 'Activate'}</button>
          </article>
        )) : <div className="empty-state"><MapPin size={22} /><strong>No destinations found</strong><span>Import GeoNames data or add destinations above.</span></div>}
      </section>
    </>
  );
}

export function AdminDestinationLevels() {
  const { data: reference } = useReferenceData();
  const [country, setCountry] = useState('');
  const [levels, setLevels] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!country) return;
    getDestinationLevels(country).then((result) => setLevels(result.levels)).catch((requestError) => setError(requestError.message));
  }, [country]);

  async function save(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const result = await saveDestinationLevels(country, levels.map((level) => ({ kind: level.kind, label: level.label, enabled: level.enabled })));
      setLevels(result.levels);
      setNotice('Level names saved.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <>
      <SectionHeading eyebrow="MASTER DATA" title="Destination level names" subtitle="What each level is called in a country (for example the local word for level 1 and level 2). Shown in every picker and label." />
      {error && <div className="auth-error" role="alert">{error}</div>}
      {notice && <p className="team-notice" role="status">{notice}</p>}
      <section className="surface-section admin-queue admin-settings-panel">
        <label className="field-label">Country<select className="form-select" value={country} onChange={(event) => setCountry(event.target.value)}><option value="" disabled>Select country</option>{(reference?.countries ?? []).map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
        {country && levels.length > 0 && <form className="request-form" onSubmit={save}>
          {levels.map((level, index) => (
            <div className="request-form-grid" key={level.kind}>
              <label className="field-label">{labelFor(reference?.destinationKinds, level.kind)} label<input className="form-input" value={level.label} minLength="2" maxLength="60" onChange={(event) => setLevels(levels.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} required /></label>
              <label className="checkbox-field"><input type="checkbox" checked={level.enabled} onChange={(event) => setLevels(levels.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item))} />Used in this country</label>
            </div>
          ))}
          <button className="primary-button">Save level names</button>
        </form>}
      </section>
    </>
  );
}

export function AdminFeaturedImport() {
  const { data: reference } = useReferenceData();
  const [file, setFile] = useState(null);
  const [country, setCountry] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      setResult(await importFeaturedDestinations(file, country));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionHeading eyebrow="MASTER DATA" title="Featured destinations import" subtitle="Upload a CSV with columns name, region, district, aliases (separate aliases with |) and optionally country_code. Rows that match exactly one destination are featured; nothing is guessed." />
      {error && <div className="auth-error" role="alert">{error}</div>}
      <section className="surface-section admin-queue admin-settings-panel">
        <form className="destination-admin-form" onSubmit={upload}>
          <label className="field-label">CSV file<input className="form-input" type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /></label>
          <label className="field-label">Default country (rows without country_code)<select className="form-select" value={country} onChange={(event) => setCountry(event.target.value)}><option value="">None</option>{(reference?.countries ?? []).map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
          <button className="primary-button" disabled={busy || !file}><Upload size={15} />{busy ? 'Importing...' : 'Import'}</button>
        </form>
        {result && <>
          <p className="team-notice" role="status">{result.totals.featured} of {result.totals.rows} rows featured; {result.totals.unresolved} need attention.</p>
          {result.report.filter((row) => row.status !== 'featured').map((row) => (
            <article className="outbox-entry" key={row.line}>
              <div className="outbox-entry-main"><strong>Line {row.line}: {row.name ?? '(no name)'}{row.region ? `, ${row.region}` : ''}{row.district ? `, ${row.district}` : ''}</strong><span>{row.message}{row.candidates?.length ? ` Candidates: ${row.candidates.map((candidate) => `${candidate.name} (${labelFor(reference?.destinationKinds, candidate.kind)})`).join('; ')}` : ''}</span></div>
              <div className="outbox-entry-state"><span className="status-pill draft"><i />{row.status.replace('_', ' ')}</span></div>
            </article>
          ))}
        </>}
      </section>
    </>
  );
}

export function AdminHotelPropertyQueue() {
  const [properties, setProperties] = useState([]);
  const [reasons, setReasons] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    try {
      setProperties((await listPendingHotelProperties()).properties);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function decide(property, decision) {
    setBusy(property.id);
    setError('');
    try {
      await decideHotelProperty(property.id, decision, reasons[property.id].trim());
      setProperties((current) => current.filter((item) => item.id !== property.id));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <SectionHeading eyebrow="TRUST AND SAFETY" title="Hotels awaiting review" subtitle="Hotels added or moved by an approved hotel account. Approved hotels start receiving leads for their area." action={<button className="secondary-button" onClick={refresh}><RefreshCw size={15} />Refresh</button>} />
      {error && <div className="auth-error" role="alert">{error}</div>}
      <section className="surface-section admin-queue">
        {properties.length ? properties.map((property) => {
          const reason = reasons[property.id]?.trim() ?? '';
          return <article className="verification-row" key={property.id}>
            <div className="verification-main">
              <div className="verification-title"><span className="role-option-icon"><Hotel size={17} /></span><div><h2>{property.name}</h2><span>{property.organizationName} / account {property.sellerStatus}</span></div></div>
              <div className="verification-facts"><span><MapPin size={14} />{property.destination?.label ?? '-'}</span>{property.roomCount && <span>{property.roomCount} rooms</span>}</div>
              <label className="field-label">Decision reason<textarea value={reasons[property.id] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [property.id]: event.target.value }))} minLength="5" maxLength="500" placeholder="Shared with the hotel account" /></label>
            </div>
            <div className="verification-actions"><button className="secondary-button reject-button" disabled={busy === property.id || reason.length < 5} onClick={() => decide(property, 'rejected')}>Reject</button><button className="primary-button" disabled={busy === property.id || reason.length < 5} onClick={() => decide(property, 'approved')}>Approve</button></div>
          </article>;
        }) : <div className="empty-state"><Hotel size={22} /><strong>No hotels waiting</strong><span>New and moved hotels appear here for review.</span></div>}
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
