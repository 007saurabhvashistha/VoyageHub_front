import { useEffect, useState } from 'react';
import { Copy, KeyRound, Plus, RotateCcw, Send, Trash2, Webhook } from 'lucide-react';
import { createWebhookEndpoint, deleteWebhookEndpoint, listWebhookDeliveries, listWebhookEndpoints, retryWebhookDelivery, rotateWebhookSecret, sendWebhookTest, updateWebhookEndpoint } from './api.js';
import { labelFor, useReferenceData } from './referenceData.js';

const deliveryStateClass = { delivered: 'open', pending: 'draft', processing: 'draft', retrying: 'draft', dead_letter: 'cancelled', cancelled: 'cancelled' };

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : '-';
}

export function IntegrationsPanel() {
  const { data: reference } = useReferenceData();
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [revealed, setRevealed] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deliveries, setDeliveries] = useState({ endpointId: null, items: [] });

  const eventOptions = (reference?.webhookEventTypes ?? []).filter((type) => state?.availableEventTypes.includes(type.value));

  async function refresh() {
    try {
      setState(await listWebhookEndpoints());
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function loadDeliveries(endpointId) {
    setDeliveries({ endpointId, items: (await listWebhookDeliveries(endpointId)).deliveries });
  }

  async function run(key, action, successMessage) {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await action();
      await refresh();
      if (deliveries.endpointId) await loadDeliveries(deliveries.endpointId).catch(() => {});
      if (successMessage) setNotice(successMessage);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  async function create(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const target = event.currentTarget;
    await run('create', async () => {
      const result = await createWebhookEndpoint({ url: form.get('url'), description: form.get('description'), event_types: form.getAll('event_types') });
      setRevealed({ endpointId: result.endpoint.id, url: result.endpoint.url, secret: result.secret });
      target.reset();
      setFormOpen(false);
    }, 'Endpoint added. Copy the signing secret now; it is shown only once.');
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(revealed.secret);
      setNotice('Signing secret copied.');
    } catch {
      setError('Copy failed. Select the secret and copy it manually.');
    }
  }

  const endpoints = state?.endpoints ?? [];
  const limits = state?.limits;
  const atLimit = limits && endpoints.length >= limits.maxEndpoints;

  return (
    <section className="surface-section full-section team-panel">
      <div className="section-heading request-list-heading"><div><p className="eyebrow">INTEGRATIONS</p><h2>Webhooks <span className="heading-count">{endpoints.length}</span></h2></div>
        {state?.signingConfigured && <button className="primary-button" disabled={atLimit} onClick={() => setFormOpen((open) => !open)} title={atLimit ? `At most ${limits.maxEndpoints} endpoints` : undefined}><Plus size={15} />Add endpoint</button>}
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {notice && <p className="team-notice" role="status">{notice}</p>}
      {state && !state.signingConfigured && <p className="privacy-note"><Webhook size={15} />Webhooks are not available yet: the platform operator has not configured the webhook signing key.</p>}

      {formOpen && (
        <form className="webhook-form" onSubmit={create}>
          <label className="field-label">Endpoint URL<input className="form-input" name="url" type="url" required maxLength="2048" placeholder="https://crm.example.com/webhooks/voyagehub" /></label>
          <label className="field-label">Description<input className="form-input" name="description" maxLength="200" placeholder="Aviat CRM production" /></label>
          <fieldset className="inclusion-picker"><legend>Events</legend>{eventOptions.map((type) => <label key={type.value}><input type="checkbox" name="event_types" value={type.value} />{type.label}</label>)}</fieldset>
          <div className="webhook-form-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-button" disabled={busy === 'create'}>{busy === 'create' ? 'Adding...' : 'Add endpoint'}</button></div>
        </form>
      )}

      {revealed && <div className="invite-link-box"><input className="form-input" readOnly value={revealed.secret} onFocus={(event) => event.target.select()} aria-label={`Signing secret for ${revealed.url}`} /><button type="button" className="secondary-button" onClick={copySecret}><Copy size={14} />Copy secret</button><button type="button" className="secondary-button" onClick={() => setRevealed(null)}>Done</button><small>Store this in your receiver's secret store. It will not be shown again; rotate it if it is lost or exposed.</small></div>}

      {!state ? <div className="empty-state">Loading webhooks...</div> : endpoints.length ? (
        <div className="role-table-wrap"><table className="role-table"><thead><tr><th>ENDPOINT</th><th>EVENTS</th><th>STATUS</th><th>LAST SUCCESS</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>
          {endpoints.map((endpoint) => (
            <tr key={endpoint.id}>
              <td><strong className="webhook-url">{endpoint.url}</strong><small>{endpoint.description ?? 'No description'}{endpoint.previousSecretExpiresAt ? ` / previous secret valid until ${formatTime(endpoint.previousSecretExpiresAt)}` : ''}</small></td>
              <td><small>{endpoint.eventTypes.map((type) => labelFor(reference?.webhookEventTypes, type)).join(', ')}</small></td>
              <td><span className={`status-pill ${endpoint.status === 'active' ? 'open' : 'cancelled'}`}><i />{endpoint.status === 'active' ? 'Active' : endpoint.disabledReason === 'failing' ? 'Disabled: failing' : 'Disabled'}</span>{endpoint.consecutiveFailures > 0 && <small>{endpoint.consecutiveFailures} failures in a row</small>}</td>
              <td>{formatTime(endpoint.lastSuccessAt)}</td>
              <td className="webhook-actions">
                <button className="secondary-button" disabled={Boolean(busy) || endpoint.status !== 'active' || !state.signingConfigured} onClick={() => run(endpoint.id, () => sendWebhookTest(endpoint.id), 'Test event queued. It is sent within a few seconds.')}><Send size={14} />Test</button>
                <button className="secondary-button" onClick={() => (deliveries.endpointId === endpoint.id ? setDeliveries({ endpointId: null, items: [] }) : loadDeliveries(endpoint.id).catch((requestError) => setError(requestError.message)))}>{deliveries.endpointId === endpoint.id ? 'Hide log' : 'Delivery log'}</button>
                <button className="secondary-button" disabled={Boolean(busy) || !state.signingConfigured} onClick={() => window.confirm(`Rotate the signing secret? The old secret keeps working for ${limits.secretRotationGraceHours} hours.`) && run(endpoint.id, async () => { const result = await rotateWebhookSecret(endpoint.id); setRevealed({ endpointId: endpoint.id, url: endpoint.url, secret: result.secret }); }, 'Secret rotated. Copy the new secret now.')}><KeyRound size={14} />Rotate secret</button>
                <button className="secondary-button" disabled={Boolean(busy)} onClick={() => run(endpoint.id, () => updateWebhookEndpoint(endpoint.id, { enabled: endpoint.status !== 'active' }), endpoint.status === 'active' ? 'Endpoint disabled.' : 'Endpoint enabled.')}>{endpoint.status === 'active' ? 'Disable' : 'Enable'}</button>
                <button className="icon-button" aria-label={`Delete ${endpoint.url}`} disabled={Boolean(busy)} onClick={() => window.confirm('Delete this endpoint and its delivery log?') && run(endpoint.id, () => deleteWebhookEndpoint(endpoint.id), 'Endpoint deleted.')}><Trash2 size={15} /></button>
              </td>
            </tr>
          ))}
        </tbody></table></div>
      ) : state.signingConfigured && <div className="empty-state"><Webhook size={22} /><strong>No webhook endpoints</strong><span>Send marketplace events to your CRM or other systems as signed HTTPS requests.</span></div>}

      {deliveries.endpointId && <>
        <h3 className="team-subheading">Delivery log (latest 100)</h3>
        {deliveries.items.length ? <div className="role-table-wrap"><table className="role-table"><thead><tr><th>EVENT</th><th>STATUS</th><th>ATTEMPTS</th><th>LAST RESULT</th><th>CREATED</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>
          {deliveries.items.map((item) => <tr key={item.id}>
            <td>{labelFor(reference?.webhookEventTypes, item.eventType)}<small>{item.messageId}</small></td>
            <td><span className={`status-pill ${deliveryStateClass[item.status]}`}><i />{labelFor(reference?.webhookDeliveryStatuses, item.status)}</span>{item.nextAttemptAt && <small>Next try {formatTime(item.nextAttemptAt)}</small>}</td>
            <td>{item.attempts}{item.manualRetries ? ` (+${item.manualRetries} manual)` : ''}</td>
            <td>{item.lastStatusCode ? `HTTP ${item.lastStatusCode}` : item.lastErrorCode ?? '-'}<small>{formatTime(item.lastAttemptAt)}</small></td>
            <td>{formatTime(item.createdAt)}</td>
            <td>{['dead_letter', 'cancelled'].includes(item.status) && <button className="secondary-button" disabled={Boolean(busy)} onClick={() => run(item.id, () => retryWebhookDelivery(item.id), 'Delivery queued again.')}><RotateCcw size={14} />Retry</button>}</td>
          </tr>)}
        </tbody></table></div> : <div className="empty-state">No deliveries yet.</div>}
      </>}

      <div className="privacy-note webhook-help"><Webhook size={15} /><span>Requests follow the Standard Webhooks format: verify the <code>webhook-signature</code> header (HMAC-SHA256 over <code>webhook-id.webhook-timestamp.body</code>) with your secret, reject old timestamps, and use <code>webhook-id</code> to ignore duplicates. Return any 2xx status within a few seconds. Failed deliveries are retried up to {limits?.maxAttempts ?? '-'} times with increasing delays; an endpoint is disabled after {limits?.disableAfterFailures ?? '-'} failures in a row. Payloads carry ids and summaries only, never guest details.</span></div>
    </section>
  );
}
