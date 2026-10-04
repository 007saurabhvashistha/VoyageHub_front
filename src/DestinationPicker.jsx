import { useEffect, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { searchDestinations } from './api.js';
import { labelFor, useReferenceData } from './referenceData.js';

const searchDelayMs = 250;

export function DestinationPicker({ label, value, onChange, multiple = false, kinds = [], max = 1, placeholder = 'Search city, region or country' }) {
  const { data: reference } = useReferenceData();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const kindsKey = kinds.join(',');
  const limit = multiple ? max : 1;

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    const timeout = window.setTimeout(() => {
      searchDestinations(term, { kinds: kindsKey ? kindsKey.split(',') : [] })
        .then((result) => { if (active) { setResults(result.destinations); setError(''); } })
        .catch((requestError) => active && setError(requestError.message))
        .finally(() => active && setLoading(false));
    }, searchDelayMs);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [query, kindsKey]);

  const selectedIds = new Set(value.map((item) => item.id));
  function choose(destination) {
    if (selectedIds.has(destination.id)) return;
    onChange(multiple ? [...value, destination].slice(0, limit) : [destination]);
    setQuery('');
  }

  return (
    <fieldset className="invite-picker destination-picker">
      <legend>{label}{multiple ? ` (${value.length}/${limit})` : ''}</legend>
      {value.length > 0 && <div className="invite-chips">{value.map((destination) => <button type="button" key={destination.id} className="invite-chip" onClick={() => onChange(value.filter((item) => item.id !== destination.id))} aria-label={`Remove ${destination.label}`}><MapPin size={12} />{destination.label}<X size={12} /></button>)}</div>}
      {value.length < limit && <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} aria-label={label} /></label>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {query.trim() && <div className="invite-results" role="listbox">
        {loading ? <small className="table-secondary">Searching destinations...</small> : results.length ? results.map((destination) => (
          <button type="button" role="option" aria-selected={selectedIds.has(destination.id)} key={destination.id} className="invite-result destination-result" onClick={() => choose(destination)} disabled={selectedIds.has(destination.id)}>
            <MapPin size={14} /><span><strong>{destination.name}</strong><small>{labelFor(reference?.destinationKinds, destination.kind)}{destination.kind === 'country' ? '' : ` / ${destination.label.slice(destination.name.length + 2)}`}</small></span>
          </button>
        )) : <small className="table-secondary">No matching destination. Ask platform support to add it.</small>}
      </div>}
    </fieldset>
  );
}
