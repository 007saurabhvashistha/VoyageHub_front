import { useEffect, useState } from 'react';
import { getReferenceData } from './api.js';

let pending = null;

export function loadReferenceData() {
  pending ??= getReferenceData().catch((error) => {
    pending = null;
    throw error;
  });
  return pending;
}

export function useReferenceData() {
  const [state, setState] = useState({ data: null, error: '' });
  useEffect(() => {
    let active = true;
    loadReferenceData()
      .then((data) => active && setState({ data, error: '' }))
      .catch((error) => active && setState({ data: null, error: error.message }));
    return () => { active = false; };
  }, []);
  return state;
}

export function labelFor(options, value) {
  return options?.find((option) => option.value === value)?.label ?? value;
}
