import { useEffect, useState } from 'react';
import { BedDouble, Bell, Check, MapPin, Plus } from 'lucide-react';
import { createHotelProperty, getAlertPreferences, listHotelProperties, saveAlertPreferences, updateHotelProperty } from './api.js';
import { DestinationPicker } from './DestinationPicker.jsx';
import { labelFor, useReferenceData } from './referenceData.js';
import { useCan } from './capabilities.js';

const emptyForm = { name: '', location: [], starCategory: '', roomCount: '' };

// A hotel account lists each property it runs; leads match any approved, active property in the requested area.
export function HotelPropertiesManager() {
  const { data: reference } = useReferenceData();
  const canManage = useCan('profile.manage');
  const [properties, setProperties] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => listHotelProperties().then((result) => setProperties(result.properties)).catch((requestError) => setError(requestError.message));
  useEffect(() => { load(); }, []);

  function edit(property) {
    setEditingId(property.id);
    setForm({ name: property.name, location: property.destination ? [property.destination] : [], starCategory: property.starCategory ?? '', roomCount: property.roomCount ?? '' });
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.location.length) return setError('Choose where the hotel is located.');
    setBusy(true);
    setError('');
    const body = { name: form.name.trim(), destination_id: form.location[0].id, star_category: form.starCategory ? Number(form.starCategory) : null, room_count: form.roomCount ? Number(form.roomCount) : null };
    try {
      if (editingId) await updateHotelProperty(editingId, body);
      else await createHotelProperty(body);
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  async function toggleActive(property) {
    try {
      await updateHotelProperty(property.id, { active: !property.active });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="hotel-properties">
      <div className="section-heading"><div><p className="eyebrow">MY HOTELS</p><h2>Properties <span className="heading-count">{properties.length}</span></h2></div></div>
      <p className="table-secondary">Leads reach you when any approved, active hotel sits in the area the agency chose. A new hotel, or a hotel that moves, is reviewed before it receives leads.</p>
      {properties.length > 0 && <div className="role-table-wrap"><table className="role-table"><thead><tr><th>HOTEL</th><th>LOCATION</th><th>DETAILS</th><th>STATUS</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>
        {properties.map((property) => <tr key={property.id}>
          <td><strong>{property.name}</strong></td>
          <td><MapPin size={13} /> {property.destination?.label ?? '-'}</td>
          <td>{property.starCategory ? labelFor(reference?.hotelCategories, property.starCategory) : 'Category not set'}{property.roomCount ? ` / ${property.roomCount} rooms` : ''}</td>
          <td><span className={`status-pill ${property.verificationStatus === 'approved' && property.active ? 'open' : ''}`}><i />{property.active ? labelFor(reference?.hotelPropertyStatuses, property.verificationStatus) : 'Inactive'}</span>{property.verificationReason && <small className="outcome-reason">{property.verificationReason}</small>}</td>
          <td><button className="text-button" disabled={!canManage} onClick={() => edit(property)}>Edit</button><button className="text-button" disabled={!canManage} onClick={() => toggleActive(property)}>{property.active ? 'Deactivate' : 'Activate'}</button></td>
        </tr>)}
      </tbody></table></div>}
      {canManage && <form className="seller-profile-form hotel-property-form" onSubmit={submit}>
        <p className="field-label">{editingId ? 'Edit hotel' : 'Add a hotel'}</p>
        <div className="request-form-grid">
          <label className="field-label">Hotel name<input className="form-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength="2" maxLength="160" required /></label>
          <label className="field-label">Star category<select className="form-select" value={form.starCategory} onChange={(event) => setForm({ ...form, starCategory: event.target.value })}><option value="">Not set</option>{reference?.hotelCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
          <label className="field-label">Rooms<input className="form-input" type="number" min="1" max="5000" value={form.roomCount} onChange={(event) => setForm({ ...form, roomCount: event.target.value })} /></label>
        </div>
        <DestinationPicker label="Location" value={form.location} onChange={(location) => setForm({ ...form, location })} kinds={reference?.hotelPropertyDestinationKinds ?? []} placeholder="Search the place or district of the hotel" />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="modal-actions">
          {editingId && <button type="button" className="secondary-button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</button>}
          <button className="primary-button" type="submit" disabled={busy}>{editingId ? <Check size={14} /> : <Plus size={14} />}{busy ? 'Saving...' : editingId ? 'Save hotel' : 'Add hotel'}</button>
        </div>
      </form>}
    </div>
  );
}

export function AlertPreferencesPanel({ role }) {
  const { data: reference } = useReferenceData();
  const canManage = useCan('profile.manage');
  const [preferences, setPreferences] = useState(null);
  const [properties, setProperties] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getAlertPreferences().then((result) => setPreferences(result.preferences)).catch((requestError) => setError(requestError.message));
    if (role === 'hotelier') listHotelProperties().then((result) => setProperties(result.properties)).catch(() => {});
  }, [role]);

  if (!preferences || !reference) return <section className="surface-section full-section"><div className="empty-state">{error || 'Loading alert preferences...'}</div></section>;
  const toggleList = (list, value) => (list ?? []).includes(value) ? (list ?? []).filter((item) => item !== value) : [...(list ?? []), value];

  async function save(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      const result = await saveAlertPreferences({ delivery: preferences.delivery, destination_kinds: preferences.destinationKinds, include_partial: preferences.includePartial, property_ids: preferences.propertyIds });
      setPreferences(result.preferences);
      setMessage('Alert preferences saved.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <section className="surface-section full-section role-profile">
      <div className="section-heading request-list-heading"><div><p className="eyebrow">LEAD ALERTS</p><h2>How we tell you about new leads</h2></div><Bell size={18} /></div>
      <p className="table-secondary">These settings only change alerts. Every lead in your area still appears in your request list.</p>
      <form className="seller-profile-form" onSubmit={save}>
        <fieldset className="service-picker"><legend>Delivery</legend>{reference.alertDeliveryModes.map((mode) => <label key={mode.value}><input type="radio" name="delivery" checked={preferences.delivery === mode.value} onChange={() => setPreferences({ ...preferences, delivery: mode.value })} />{mode.label}</label>)}</fieldset>
        <fieldset className="service-picker"><legend>Alert me for leads at these levels (none selected = all)</legend>{reference.destinationKinds.filter((kind) => kind.value !== 'country').map((kind) => <label key={kind.value}><input type="checkbox" checked={(preferences.destinationKinds ?? []).includes(kind.value)} onChange={() => setPreferences({ ...preferences, destinationKinds: toggleList(preferences.destinationKinds, kind.value) })} />{kind.label}</label>)}</fieldset>
        {role === 'dmc' && <label className="checkbox-field"><input type="checkbox" checked={preferences.includePartial} onChange={(event) => setPreferences({ ...preferences, includePartial: event.target.checked })} />Also alert me when I cover only part of the trip</label>}
        {role === 'hotelier' && properties.length > 1 && <fieldset className="service-picker"><legend>Alert me only for these hotels (none selected = all)</legend>{properties.map((property) => <label key={property.id}><input type="checkbox" checked={(preferences.propertyIds ?? []).includes(property.id)} onChange={() => setPreferences({ ...preferences, propertyIds: toggleList(preferences.propertyIds, property.id) })} /><BedDouble size={12} /> {property.name}</label>)}</fieldset>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <button className="primary-button" type="submit" disabled={!canManage} title={canManage ? undefined : 'Only owners and managers can change alert settings.'}>Save alert preferences</button>
      </form>
    </section>
  );
}
