import { useEffect, useState } from 'react';
import { useCombobox } from 'downshift';
import { MapPin, Search, Star, X } from 'lucide-react';
import { searchDestinations } from './api.js';

const searchDelayMs = 250;

// Accessible destination search (downshift); results are ranked server-side (exact, featured, popular, population).
export function DestinationPicker({ label, value, onChange, multiple = false, kinds = [], max = 1, placeholder = 'Search a place, district or region' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const kindsKey = kinds.join(',');
  const limit = multiple ? max : 1;
  const selectedIds = new Set(value.map((item) => item.id));

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

  const items = results.filter((destination) => !selectedIds.has(destination.id));
  const { isOpen, getLabelProps, getMenuProps, getInputProps, getItemProps, highlightedIndex } = useCombobox({
    items,
    inputValue: query,
    itemToString: (item) => item?.label ?? '',
    onInputValueChange: ({ inputValue, type }) => {
      if (type !== useCombobox.stateChangeTypes.ItemClick && type !== useCombobox.stateChangeTypes.InputKeyDownEnter) setQuery(inputValue ?? '');
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (!selectedItem) return;
      onChange(multiple ? [...value, selectedItem].slice(0, limit) : [selectedItem]);
      setQuery('');
    },
    selectedItem: null,
  });

  return (
    <fieldset className="invite-picker destination-picker">
      <legend {...getLabelProps()}>{label}{multiple ? ` (${value.length}/${limit})` : ''}</legend>
      {value.length > 0 && <div className="invite-chips">{value.map((destination) => <button type="button" key={destination.id} className="invite-chip" onClick={() => onChange(value.filter((item) => item.id !== destination.id))} aria-label={`Remove ${destination.label}`}><MapPin size={12} />{destination.label}<X size={12} /></button>)}</div>}
      <div className={value.length < limit ? '' : 'visually-hidden'}>
        <label className="search-field"><Search size={16} /><input {...getInputProps({ placeholder, disabled: value.length >= limit })} /></label>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <ul className={`invite-results destination-results ${isOpen && query.trim() ? '' : 'visually-hidden'}`} {...getMenuProps()}>
        {isOpen && query.trim() && (loading
          ? <li className="table-secondary">Searching destinations...</li>
          : items.length ? items.map((destination, index) => (
            <li key={destination.id} className={`invite-result destination-result ${highlightedIndex === index ? 'highlighted' : ''}`} {...getItemProps({ item: destination, index })}>
              {destination.featured ? <Star size={14} /> : <MapPin size={14} />}
              <span><strong>{destination.name}</strong><small>{destination.kindLabel}{destination.kind === 'country' ? '' : ` / ${destination.label.slice(destination.name.length + 2)}`}</small></span>
            </li>
          )) : <li className="table-secondary">No destinations match this search.</li>)}
      </ul>
    </fieldset>
  );
}
