import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import { FileText, Globe2 } from 'lucide-react';
import { getLegalDocument } from './api.js';
import { LegalLinks } from './Legal.jsx';
import { labelFor, useReferenceData } from './referenceData.js';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });

function GrievanceOfficer({ officer, entityName }) {
  if (!officer) return <p className="legal-contact-missing">The grievance officer contact has not been configured yet.</p>;
  return (
    <section className="legal-contact" aria-label="Grievance officer">
      <h2>Grievance officer</h2>
      <p>Under India's Digital Personal Data Protection Act 2023, you can contact our grievance officer about how {entityName ?? 'we'} handle your personal data.</p>
      <dl>
        <div><dt>Name</dt><dd>{officer.name}</dd></div>
        <div><dt>Email</dt><dd><a href={`mailto:${officer.email}`}>{officer.email}</a></dd></div>
        {officer.phone && <div><dt>Phone</dt><dd>{officer.phone}</dd></div>}
        {officer.address && <div><dt>Address</dt><dd>{officer.address}</dd></div>}
      </dl>
    </section>
  );
}

function CookieTable({ cookies }) {
  const hours = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  return (
    <section className="legal-contact" aria-label="Cookies in use">
      <h2>Cookies we set</h2>
      <table className="role-table"><thead><tr><th>NAME</th><th>PURPOSE</th><th>CATEGORY</th><th>LIFETIME</th></tr></thead><tbody>
        {cookies.map((cookie) => <tr key={cookie.name}><td><code>{cookie.name}</code></td><td>{cookie.purpose}</td><td>{cookie.category.replaceAll('_', ' ')}</td><td>{hours.format(cookie.lifetimeHours)} h</td></tr>)}
      </tbody></table>
    </section>
  );
}

export default function LegalPage() {
  const { type } = useParams();
  const { data: reference } = useReferenceData();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let active = true;
    setState({ loading: true });
    getLegalDocument(type)
      .then((result) => active && setState({ loading: false, ...result }))
      .catch((error) => active && setState({ loading: false, error: error.message }));
    return () => { active = false; };
  }, [type]);

  const typeLabel = labelFor(reference?.legalDocumentTypes, type);
  return (
    <main className="legal-page">
      <header className="auth-topbar">
        <Link className="auth-brand" to="/register"><span className="brand-mark"><Globe2 size={20} strokeWidth={1.8} /></span><span><strong>LEAD EXCHANGE</strong><small>by VoyageHub</small></span></Link>
        <LegalLinks />
      </header>
      <article className="legal-document">
        {state.loading ? <p>Loading {typeLabel}...</p> : state.error ? (
          <div className="empty-state"><FileText size={22} /><strong>{typeLabel}</strong><span>{state.error}</span></div>
        ) : (
          <>
            <p className="eyebrow">{typeLabel.toUpperCase()} / VERSION {state.document.version}</p>
            <h1>{state.document.title}</h1>
            <p className="legal-meta">Effective {dateFormat.format(new Date(state.document.publishedAt))}{state.entityName ? ` / ${state.entityName}` : ''}{state.document.changeSummary ? ` / ${state.document.changeSummary}` : ''}</p>
            <div className="legal-body"><Markdown>{state.document.body}</Markdown></div>
            {type === 'privacy' && <GrievanceOfficer officer={state.grievanceOfficer} entityName={state.entityName} />}
            {type === 'cookies' && reference?.cookies && <CookieTable cookies={reference.cookies} />}
          </>
        )}
      </article>
    </main>
  );
}
