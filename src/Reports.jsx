import { useEffect, useState } from 'react';
import { Award, Clock3, RefreshCw, Star, TrendingDown, Trophy } from 'lucide-react';
import { getAgencyReport, getSellerPerformance } from './api.js';
import { formatMinor } from './money.js';

function metricValue(value, suffix = '') {
  return value == null ? '—' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

function Metric({ label, value, detail, icon: Icon }) {
  return <div className="metric">
    <div className="metric-top"><span>{label}</span><Icon className="metric-icon teal" size={15} /></div>
    <strong>{value}</strong>
    <small>{detail}</small>
  </div>;
}

export function ReportsWorkspace({ role }) {
  const [range, setRange] = useState({ from: '', to: '' });
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isAgency = role === 'agency';

  async function refresh(nextRange = range) {
    setBusy(true);
    setError('');
    try {
      const result = isAgency ? await getAgencyReport(nextRange) : await getSellerPerformance(nextRange);
      setMetrics(result.metrics);
      setRange(nextRange);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  useEffect(() => { refresh({ from: '', to: '' }); }, [role]);

  function submit(event) {
    event.preventDefault();
    refresh({ from: event.currentTarget.elements.from.value, to: event.currentTarget.elements.to.value });
  }

  return <section className="surface-section full-section reports-panel">
    <div className="section-heading request-list-heading"><div><p className="eyebrow">{isAgency ? 'AGENCY REPORTS' : 'SELLER PERFORMANCE'}</p><h2>{isAgency ? 'Marketplace results' : 'Offer outcomes'}</h2></div>
      <form className="report-range-form" onSubmit={submit}>
        <label>From<input type="date" name="from" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} /></label>
        <label>To<input type="date" name="to" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} /></label>
        <button className="secondary-button" disabled={busy}><RefreshCw size={14} />Apply</button>
      </form>
    </div>
    {error && <div className="auth-error" role="alert">{error}</div>}
    {loading ? <div className="empty-state">Loading report...</div> : <>
      {isAgency ? <>
        <div className="report-metric-strip">
          <Metric label="Published requests" value={metricValue(metrics.requestsCount)} detail="In the selected period" icon={Award} />
          <Metric label="Offers received" value={metricValue(metrics.offersReceived)} detail={`${metrics.respondedRequests} requests received a response`} icon={Trophy} />
          <Metric label="Award rate" value={metricValue(metrics.awardRatePercent, '%')} detail="Requests with an active award" icon={Trophy} />
          <Metric label="First response" value={metricValue(metrics.responseTimeMinutes, ' min')} detail="Average from publish to first offer" icon={Clock3} />
        </div>
        <div className="report-supporting-data"><div className="section-heading"><div><p className="eyebrow">BUDGET SAVINGS</p><h3>Below-budget awards</h3></div></div>
          {metrics.savingsByCurrency.length ? <div className="report-breakdown">{metrics.savingsByCurrency.map((item) => <div key={item.currency}><span>{item.currency} / {item.requestCount} requests</span><strong>{formatMinor(Number(item.totalMinor), item.currency)}</strong></div>)}</div> : <div className="empty-state">No comparable awards below the request budget in this period.</div>}
        </div>
      </> : <>
        <div className="report-metric-strip">
          <Metric label="Decided offers" value={metricValue(metrics.decidedOffers)} detail="Accepted or not selected" icon={Award} />
          <Metric label="Win rate" value={metricValue(metrics.winRatePercent, '%')} detail={`${metrics.wins} awarded offers`} icon={Trophy} />
          <Metric label="Response time" value={metricValue(metrics.responseTimeMinutes, ' min')} detail="Average from publish to offer" icon={Clock3} />
          <Metric label="Average rating" value={metricValue(metrics.averageRating)} detail={`${metrics.ratingCount} verified reviews`} icon={Star} />
        </div>
        <div className="report-supporting-data"><div className="section-heading"><div><p className="eyebrow">LOST OFFERS</p><h3>Reasons for not being selected</h3></div></div>
          {metrics.lostReasons.length ? <div className="report-breakdown">{metrics.lostReasons.map((item) => <div key={item.reason}><span><TrendingDown size={14} />{item.reason}</span><strong>{item.count}</strong></div>)}</div> : <div className="empty-state">No lost-offer reasons in this period.</div>}
        </div>
      </>}
    </>}
  </section>;
}