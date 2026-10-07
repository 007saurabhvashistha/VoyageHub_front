import { useEffect, useState } from 'react';
import { BedDouble, Bell, Check, MapPin, Plus, Trash2, Upload } from 'lucide-react';
import { createHotelProperty, createHotelPropertyPhotoUrl, deleteHotelPropertyPhoto, getAlertPreferences, listHotelProperties, saveAlertPreferences, updateHotelProperty, uploadHotelPropertyPhoto } from './api.js';
import { DestinationPicker } from './DestinationPicker.jsx';
import { labelFor, useReferenceData } from './referenceData.js';
import { useCan } from './capabilities.js';

const emptyForm = { name: '', location: [], starCategory: '', roomCount: '', roomTypes: '', mealPlans: [], facilities: [] };

// A hotel account lists each property it runs; leads match any approved, active property in the requested area.
export function HotelPropertiesManager() {
  const { data: reference } = useReferenceData();
  const canManage = useCan('profile.manage');
  const [properties, setProperties] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const result = await listHotelProperties();
      const propertiesWithUrls = await Promise.all(result.properties.map(async (property) => ({
        ...property,
        photos: await Promise.all((property.photos ?? []).map(async (photo) => {
          if (photo.scanStatus !== 'clean') return photo;
          try {
            return { ...photo, url: (await createHotelPropertyPhotoUrl(property.id, photo.id)).url };
          } catch {
            return photo;
          }
        })),
      })));
      setProperties(propertiesWithUrls);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
  }
  useEffect(() => { load(); }, []);

  function edit(property) {
    setEditingId(property.id);
    setForm({ name: property.name, location: property.destination ? [property.destination] : [], starCategory: property.starCategory ?? '', roomCount: property.roomCount ?? '', roomTypes: (property.roomTypes ?? []).join('\n'), mealPlans: property.mealPlans ?? [], facilities: property.facilities ?? [] });
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.location.length) return setError('Choose where the hotel is located.');
    setBusy(true);
    setError('');
    const body = { name: form.name.trim(), destination_id: form.location[0].id, star_category: form.starCategory ? Number(form.starCategory) : null, room_count: form.roomCount ? Number(form.roomCount) : null, room_types: form.roomTypes.split(/\r?\n/).map((value) => value.trim()).filter(Boolean), meal_plans: form.mealPlans, facilities: form.facilities };
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

  async function uploadPhoto(property, file) {
    if (!file) return;
    if (file.size > (reference?.limits.documentUpload.maxBytes ?? 0)) {
      setError(`${file.name} exceeds the configured upload limit.`);
      return;
    }
    setError('');
    try {
      await uploadHotelPropertyPhoto(property.id, file);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function removePhoto(property, photo) {
    try {
      await deleteHotelPropertyPhoto(property.id, photo.id);
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
          <td>{property.starCategory ? labelFor(reference?.hotelCategories, property.starCategory) : 'Category not set'}{property.roomCount ? ` / ${property.roomCount} rooms` : ''}{property.roomTypes?.length ? <small>{property.roomTypes.join(', ')}</small> : null}{property.mealPlans?.length ? <small>{property.mealPlans.map((meal) => labelFor(reference?.mealPlans, meal)).join(', ')}</small> : null}{property.facilities?.length ? <small>{property.facilities.map((facility) => labelFor(reference?.hotelFacilities, facility)).join(', ')}</small> : null}<div className="hotel-photo-strip">{property.photos?.map((photo) => photo.url ? <figure key={photo.id}><img src={photo.url} alt={photo.filename} /><button className="icon-button" aria-label={`Remove ${photo.filename}`} disabled={!canManage} onClick={() => removePhoto(property, photo)}><Trash2 size={13} /></button></figure> : <small key={photo.id}>{photo.filename} / {labelFor(reference?.documentScanStatuses, photo.scanStatus)}</small>)}</div></td>
          <td><span className={`status-pill ${property.verificationStatus === 'approved' && property.active ? 'open' : ''}`}><i />{property.active ? labelFor(reference?.hotelPropertyStatuses, property.verificationStatus) : 'Inactive'}</span><small>{labelFor(reference?.hotelOwnershipCheckStatuses, property.ownershipCheckStatus)}</small>{property.verificationReason && <small className="outcome-reason">{property.verificationReason}</small>}</td>
          <td><button className="text-button" disabled={!canManage} onClick={() => edit(property)}>Edit</button><button className="text-button" disabled={!canManage} onClick={() => toggleActive(property)}>{property.active ? 'Deactivate' : 'Activate'}</button><label className="icon-button" title="Upload hotel photo"><Upload size={14} /><input type="file" accept="image/jpeg,image/png" className="visually-hidden" disabled={!canManage || (property.photos?.length ?? 0) >= (reference?.limits.maxHotelPropertyPhotos ?? 0)} onChange={(event) => { uploadPhoto(property, event.target.files?.[0]); event.target.value = ''; }} /></label></td>
        </tr>)}
      </tbody></table></div>}
      {canManage && <form className="seller-profile-form hotel-property-form" onSubmit={submit}>
        <p className="field-label">{editingId ? 'Edit hotel' : 'Add a hotel'}</p>
        <div className="request-form-grid">
          <label className="field-label">Hotel name<input className="form-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength="2" maxLength="160" required /></label>
          <label className="field-label">Star category<select className="form-select" value={form.starCategory} onChange={(event) => setForm({ ...form, starCategory: event.target.value })}><option value="">Not set</option>{reference?.hotelCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
          <label className="field-label">Rooms<input className="form-input" type="number" min="1" max="5000" value={form.roomCount} onChange={(event) => setForm({ ...form, roomCount: event.target.value })} /></label>
          <label className="field-label">Room types<textarea className="form-input" value={form.roomTypes} onChange={(event) => setForm({ ...form, roomTypes: event.target.value })} placeholder="One room type per line" maxLength="3000" /></label>
        </div>
        <fieldset className="service-picker"><legend>Meal plans</legend>{reference?.mealPlans.map((meal) => <label key={meal.value}><input type="checkbox" checked={form.mealPlans.includes(meal.value)} onChange={(event) => setForm((current) => ({ ...current, mealPlans: event.target.checked ? [...current.mealPlans, meal.value] : current.mealPlans.filter((value) => value !== meal.value) }))} />{meal.label}</label>)}</fieldset>
        <fieldset className="service-picker"><legend>Facilities</legend>{reference?.hotelFacilities.map((facility) => <label key={facility.value}><input type="checkbox" checked={form.facilities.includes(facility.value)} onChange={(event) => setForm((current) => ({ ...current, facilities: event.target.checked ? [...current.facilities, facility.value] : current.facilities.filter((value) => value !== facility.value) }))} />{facility.label}</label>)}</fieldset>
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
