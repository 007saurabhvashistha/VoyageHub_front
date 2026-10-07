import { useEffect, useState } from 'react';
import { Copy, KeyRound, Plus, RotateCcw, Send, Trash2, Webhook } from 'lucide-react';
import { createApiToken, createWebhookEndpoint, deleteWebhookEndpoint, listApiTokens, listWebhookDeliveries, listWebhookEndpoints, retryWebhookDelivery, revokeApiToken, rotateWebhookSecret, sendWebhookTest, updateWebhookEndpoint } from './api.js';
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
  const [apiTokenState, setApiTokenState] = useState(null);
  const [apiTokenName, setApiTokenName] = useState('');
  const [apiTokenFormOpen, setApiTokenFormOpen] = useState(false);
  const [revealedApiToken, setRevealedApiToken] = useState('');
  const [apiTokenBusy, setApiTokenBusy] = useState(false);

  const eventOptions = (reference?.webhookEventTypes ?? []).filter((type) => state?.availableEventTypes.includes(type.value));

  async function refresh() {
    try {
      setState(await listWebhookEndpoints());
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function refreshApiTokens() {
    try {
      setApiTokenState(await listApiTokens());
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => { refresh(); refreshApiTokens(); }, []);

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

  async function submitApiToken(event) {
    event.preventDefault();
    setApiTokenBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await createApiToken(apiTokenName);
      setRevealedApiToken(result.token);
      setApiTokenName('');
      setApiTokenFormOpen(false);
      await refreshApiTokens();
      setNotice('API token created. Copy it now; it is shown only once.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setApiTokenBusy(false);
    }
  }

  async function copyApiToken() {
    try {
      await navigator.clipboard.writeText(revealedApiToken);
      setNotice('API token copied.');
    } catch {
      setError('Copy failed. Select the token and copy it manually.');
    }
  }

  async function revokeToken(token) {
    if (!window.confirm(`Revoke the API token "${token.name}"? Connected clients will stop working immediately.`)) return;
    setApiTokenBusy(true);
    setError('');
    try {
      await revokeApiToken(token.id);
      await refreshApiTokens();
      setNotice('API token revoked.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setApiTokenBusy(false);
    }
  }

  const endpoints = state?.endpoints ?? [];
  const limits = state?.limits;
  const atLimit = limits && endpoints.length >= limits.maxEndpoints;

  return (
    <section className="surface-section full-section team-panel">
      <div className="section-heading request-list-heading"><div><p className="eyebrow">READ-ONLY INTEGRATION</p><h2>Public API tokens <span className="heading-count">{apiTokenState?.tokens.filter((token) => !token.revokedAt && new Date(token.expiresAt) > new Date()).length ?? 0}</span></h2></div>
        <button className="primary-button" disabled={apiTokenBusy || (apiTokenState && apiTokenState.tokens.filter((token) => !token.revokedAt && new Date(token.expiresAt) > new Date()).length >= apiTokenState.maxTokens)} onClick={() => setApiTokenFormOpen((open) => !open)}><Plus size={15} />Create token</button>
      </div>
      <p className="privacy-note">Tokens can read this organization’s marketplace requests, offers and awards. They cannot change data or access guest details. Tokens expire after {apiTokenState?.ttlDays ?? 'the configured'} days.</p>
      {apiTokenFormOpen && <form className="webhook-form api-token-form" onSubmit={submitApiToken}>
        <label className="field-label">Token name<input className="form-input" value={apiTokenName} onChange={(event) => setApiTokenName(event.target.value)} maxLength="80" required placeholder="Aviat CRM production" /></label>
        <button className="primary-button" disabled={apiTokenBusy}>{apiTokenBusy ? 'Creating...' : 'Create read-only token'}</button>
        <button type="button" className="secondary-button" onClick={() => setApiTokenFormOpen(false)}>Cancel</button>
      </form>}
      {revealedApiToken && <div className="invite-link-box"><input className="form-input" readOnly value={revealedApiToken} onFocus={(event) => event.target.select()} aria-label="New public API token" /><button type="button" className="secondary-button" onClick={copyApiToken}><Copy size={14} />Copy token</button><button type="button" className="secondary-button" onClick={() => setRevealedApiToken('')}>Done</button><small>Store it in your CRM’s secret manager. It will not be shown again.</small></div>}
      <div className="api-endpoint-list"><span>GET <code>/v1/public/marketplace/requests</code></span><span>GET <code>/v1/public/marketplace/offers</code></span><span>GET <code>/v1/public/marketplace/awards</code></span></div>
      {apiTokenState?.tokens.length ? <div className="role-table-wrap"><table className="role-table"><thead><tr><th>NAME</th><th>CREATED</th><th>LAST USED</th><th>EXPIRES</th><th>STATUS</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>
        {apiTokenState.tokens.map((token) => {
          const active = !token.revokedAt && new Date(token.expiresAt) > new Date();
          return <tr key={token.id}><td><strong>{token.name}</strong><small>{token.prefix}…</small></td><td>{formatTime(token.createdAt)}</td><td>{formatTime(token.lastUsedAt)}</td><td>{formatTime(token.expiresAt)}</td><td><span className={`status-pill ${active ? 'open' : 'cancelled'}`}><i />{active ? 'Active' : token.revokedAt ? 'Revoked' : 'Expired'}</span></td><td>{active && <button className="icon-button" aria-label={`Revoke ${token.name}`} disabled={apiTokenBusy} onClick={() => revokeToken(token)}><Trash2 size={15} /></button>}</td></tr>;
        })}
      </tbody></table></div> : apiTokenState && <div className="empty-state"><KeyRound size={21} /><strong>No API tokens</strong><span>Create a read-only token for a CRM or reporting client.</span></div>}

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
