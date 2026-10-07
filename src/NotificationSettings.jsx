import { useEffect, useState } from 'react';
import { Bell, Check, Save } from 'lucide-react';
import { getNotificationPreferences, saveNotificationPreferences } from './api.js';

const defaults = { inAppEnabled: true, emailEnabled: true, emailFrequency: 'instant' };

export function NotificationSettings() {
  const [preferences, setPreferences] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getNotificationPreferences()
      .then((result) => setPreferences(result.preferences))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const result = await saveNotificationPreferences({
        in_app_enabled: preferences.inAppEnabled,
        email_enabled: preferences.emailEnabled,
        email_frequency: preferences.emailFrequency,
      });
      setPreferences(result.preferences);
      setSaved(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="surface-section full-section"><div className="empty-state">Loading notification preferences...</div></section>;

  return (
    <section className="surface-section full-section notification-settings">
      <div className="section-heading request-list-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h2><Bell size={19} />Notification preferences</h2></div></div>
      <form className="request-form" onSubmit={save}>
        <label className="evidence-confirm"><input type="checkbox" checked={preferences.inAppEnabled} onChange={(event) => setPreferences((current) => ({ ...current, inAppEnabled: event.target.checked }))} />In-app notifications</label>
        <label className="evidence-confirm"><input type="checkbox" checked={preferences.emailEnabled} onChange={(event) => setPreferences((current) => ({ ...current, emailEnabled: event.target.checked }))} />Email notifications</label>
        <label className="field-label">Email frequency<select className="form-select" value={preferences.emailFrequency} onChange={(event) => setPreferences((current) => ({ ...current, emailFrequency: event.target.value }))} disabled={!preferences.emailEnabled}><option value="instant">As events happen</option><option value="daily">Daily summary</option></select></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="modal-actions"><button className="primary-button" disabled={saving}><Save size={15} />{saving ? 'Saving...' : 'Save preferences'}</button>{saved && <span className="privacy-note"><Check size={15} />Saved</span>}</div>
      </form>
    </section>
  );
}
