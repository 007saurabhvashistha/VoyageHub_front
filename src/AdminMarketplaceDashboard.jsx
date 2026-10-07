import { useEffect, useState } from 'react';
import { Award, Clock3, RefreshCw, Send, ShoppingBag, TrendingUp } from 'lucide-react';
import { getAdminMarketplaceAnalytics } from './api.js';

function display(value, suffix = '') {
  return value == null ? '—' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

function AdminMetric({ icon: Icon, label, value, detail }) {
  return <div className="metric"><div className="metric-top"><span>{label}</span><Icon className="metric-icon teal" size={15} /></div><strong>{value}</strong><small>{detail}</small></div>;
}

export function AdminMarketplaceDashboard() {
  const [range, setRange] = useState({ from: '', to: '' });
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh(nextRange = range) {
    setBusy(true);
    setError('');
    try {
      setMetrics((await getAdminMarketplaceAnalytics(nextRange)).metrics);
      setRange(nextRange);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  useEffect(() => { refresh({ from: '', to: '' }); }, []);

  function submit(event) {
    event.preventDefault();
    refresh({ from: event.currentTarget.elements.from.value, to: event.currentTarget.elements.to.value });
  }

  return <section className="surface-section full-section admin-marketplace-dashboard">
    <div className="section-heading request-list-heading"><div><p className="eyebrow">MARKETPLACE HEALTH</p><h2>Marketplace dashboard</h2></div>
      <form className="report-range-form" onSubmit={submit}>
        <label>From<input type="date" name="from" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} /></label>
        <label>To<input type="date" name="to" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} /></label>
        <button className="secondary-button" disabled={busy}><RefreshCw size={14} />Apply</button>
      </form>
    </div>
    {error && <div className="auth-error" role="alert">{error}</div>}
    {loading ? <div className="empty-state">Loading marketplace metrics...</div> : <div className="report-metric-strip">
      <AdminMetric icon={Send} label="Published requests" value={display(metrics.publishedRequests)} detail={`${metrics.offersReceived} offers received`} />
      <AdminMetric icon={ShoppingBag} label="Offers per request" value={display(metrics.averageOffersPerRequest)} detail="Average across published requests" />
      <AdminMetric icon={Award} label="Award rate" value={display(metrics.awardRatePercent, '%')} detail={`${metrics.awardedRequests} requests awarded`} />
      <AdminMetric icon={Clock3} label="First response" value={display(metrics.responseTimeMinutes, ' min')} detail="Average from publish to first offer" />
      <AdminMetric icon={TrendingUp} label="Booking conversion" value={display(metrics.bookingConversionPercent, '%')} detail={`${metrics.bookedAwards} booked awards`} />
    </div>}
  </section>;
}