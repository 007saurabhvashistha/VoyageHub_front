import { useEffect, useState } from 'react';
import { Download, FileText, Paperclip, Plus, Printer, Trash2, X } from 'lucide-react';
import { addDays, endOfDay, format, parseISO } from 'date-fns';
import { createAttachmentDownloadUrl, deleteDmcOfferLibraryItem, getMarketplaceOffer, listDmcOfferLibrary, listHotelOfferPhotos, removeAttachment, saveDmcOfferLibraryItem } from './api.js';
import { formatMinor, toMinorUnits } from './money.js';
import { labelFor, useReferenceData } from './referenceData.js';
import { OfferExportModal } from './OfferExportModal.jsx';

const emptyLine = (type) => ({ itemType: type, description: '', quantity: '1', unitPrice: '' });
const emptyOption = () => ({ label: '', hotelCategory: '', roomType: '', mealPlan: '', price: '', notes: '' });
const optionalNumber = (value) => (value === '' || value == null ? null : Number(value));

export function OfferFormModal({ role, target, roomTypes = [], onClose, onSubmit }) {
  const isHotel = role === 'hotelier';
  const { data: reference } = useReferenceData();
  const [currency, setCurrency] = useState('');
  const [lines, setLines] = useState([]);
  const [options, setOptions] = useState([]);
  const [files, setFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [libraryItems, setLibraryItems] = useState([]);
  const [loadedItem, setLoadedItem] = useState(null);
  const [libraryName, setLibraryName] = useState('');
  const [libraryError, setLibraryError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const today = new Date();
  const activeCurrency = currency || reference?.defaults.currency || '';
  const lineTotalMinor = lines.reduce((sum, line) => sum + (line.unitPrice === '' ? 0 : toMinorUnits(line.unitPrice, activeCurrency) * Number(line.quantity || 0)), 0);
  const fileSlots = (reference?.limits.maxOfferAttachments ?? 0) - existingFiles.length - files.length;

  useEffect(() => {
    if (!target.reviseOfferId) return undefined;
    let active = true;
    getMarketplaceOffer(target.reviseOfferId)
      .then((result) => active && setExistingFiles(result.offer.attachments ?? []))
      .catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [target.reviseOfferId]);

  useEffect(() => {
    if (isHotel) return undefined;
    let active = true;
    listDmcOfferLibrary()
      .then((result) => active && setLibraryItems(result.items))
      .catch((requestError) => active && setLibraryError(requestError.message));
    return () => { active = false; };
  }, [isHotel]);

  useEffect(() => {
    const payload = loadedItem?.payload;
    setLines(payload?.lines ?? []);
    setOptions(payload?.options ?? []);
    setItinerary(payload?.itinerary ?? []);
    setCurrency(payload?.currency ?? '');
  }, [loadedItem]);

  async function removeExisting(attachment) {
    try {
      await removeAttachment(attachment.id);
      setExistingFiles((current) => current.filter((item) => item.id !== attachment.id));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function addFiles(input) {
    const picked = [...input.files].slice(0, Math.max(fileSlots, 0));
    input.value = '';
    const tooLarge = picked.find((file) => file.size > reference.limits.documentUpload.maxBytes);
    if (tooLarge) {
      setError(`${tooLarge.name} is larger than ${reference.limits.documentUpload.maxBytes / (1024 * 1024)} MB.`);
      return;
    }
    setFiles((current) => [...current, ...picked]);
  }

  function updateLine(index, field, value) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line));
  }

  function updateOption(index, field, value) {
    setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? { ...option, [field]: value } : option));
  }

  function updateItineraryDay(index, field, value) {
    setItinerary((current) => current.map((day, dayIndex) => dayIndex === index ? { ...day, [field]: value } : day));
  }

  async function saveLibraryItem(form, type) {
    setLibraryError('');
    if (!libraryName.trim()) {
      setLibraryError('Name this saved offer first.');
      return;
    }
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());
    delete values.inclusions;
    delete values.exclusions;
    try {
      const result = await saveDmcOfferLibraryItem({
        library_type: type,
        name: libraryName.trim(),
        payload: { values, inclusions: formData.getAll('inclusions'), exclusions: formData.getAll('exclusions'), currency: activeCurrency, lines, options, itinerary },
      });
      setLibraryItems((current) => [result.item, ...current]);
      setLoadedItem(result.item);
      setLibraryName('');
      setLibraryError(`${type === 'template' ? 'Template' : 'Draft'} saved.`);
    } catch (requestError) {
      setLibraryError(requestError.message);
    }
  }

  async function removeLibraryItem(item) {
    try {
      await deleteDmcOfferLibraryItem(item.id);
      setLibraryItems((current) => current.filter((saved) => saved.id !== item.id));
      if (loadedItem?.id === item.id) setLoadedItem(null);
    } catch (requestError) {
      setLibraryError(requestError.message);
    }
  }

  function printCurrentItinerary(event) {
    const form = new FormData(event.currentTarget.form);
    const amount = form.get('amount');
    printOfferItinerary({
      destination: target.destination,
      requestCode: target.requestCode,
      itinerary,
      mainOption: {
        label: form.get('option_label') || 'Main package',
        hotelCategory: optionalNumber(form.get('hotel_category')),
        totalMinor: lines.length ? lineTotalMinor : amount ? toMinorUnits(amount, activeCurrency) : null,
      },
      options,
      currency: activeCurrency,
      categories: reference.hotelCategories,
    });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const terms = {
      currency: activeCurrency,
      inclusions: form.getAll('inclusions'),
      exclusions: form.getAll('exclusions'),
      validity_until: endOfDay(parseISO(form.get('validity_until'))).toISOString(),
      cancellation_policy: form.get('cancellation_policy') || null,
      free_cancellation_until: form.get('free_cancellation_until') || null,
      deposit_percent: optionalNumber(form.get('deposit_percent')),
      balance_due_days_before_travel: optionalNumber(form.get('balance_due_days')),
      payment_notes: form.get('payment_notes') || null,
      option_label: options.length ? form.get('option_label').trim() : null,
      options: options.map((option) => ({
        label: option.label.trim(),
        notes: option.notes.trim() || null,
        ...(isHotel
          ? { room_type: option.roomType.trim(), meal_plan: option.mealPlan || null, rate_per_night_minor: toMinorUnits(option.price, activeCurrency) }
          : { hotel_category: optionalNumber(option.hotelCategory), total_minor: toMinorUnits(option.price, activeCurrency) }),
      })),
    };
    const payload = isHotel
      ? {
          ...terms,
          rate_per_night_minor: toMinorUnits(form.get('amount'), activeCurrency),
          room_type: form.get('room_type'),
          meal_plan: form.get('meal_plan'),
          room_count: optionalNumber(form.get('room_count')),
          taxes_included: form.get('taxes_included') === 'on',
          availability_confirmed: form.get('availability_confirmed') === 'on',
          ...(form.get('hotel_property_id') ? { hotel_property_id: form.get('hotel_property_id') } : {}),
        }
      : {
          ...terms,
          hotel_category: optionalNumber(form.get('hotel_category')),
          total_minor: lines.length ? lineTotalMinor : toMinorUnits(form.get('amount'), activeCurrency),
          line_items: lines.map((line) => ({ item_type: line.itemType, description: line.description.trim(), quantity: Number(line.quantity), unit_price_minor: toMinorUnits(line.unitPrice, activeCurrency) })),
          itinerary: itinerary.map((day) => ({ day: Number(day.day), destination: day.destination?.trim() || null, title: day.title.trim(), description: day.description?.trim() || null })),
        };
    if (!isHotel && payload.total_minor <= 0) {
      setError('Enter a package total or add priced line items.');
      return;
    }
    setSubmitting(true);
    const failure = await onSubmit(payload, files);
    setSubmitting(false);
    if (failure) setError(failure);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal offer-form-modal" role="dialog" aria-modal="true" aria-labelledby="response-modal-title">
        <div className="modal-heading">
          <div><p className="eyebrow">{isHotel ? 'HOTEL RESPONSE' : 'DMC OFFER'}</p><h2 id="response-modal-title">{target.reviseOfferId ? 'Revise offer for the updated trip' : isHotel ? 'Respond to room request' : 'Prepare an offer'}</h2></div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="modal-copy"><strong>{target.destination}</strong> / {target.requestCode} / {target.travelers} / {target.nights} nights. This offer is visible only to the requesting agency.</p>
        {!reference ? <div className="empty-state">Loading offer options...</div> : (
          <form key={loadedItem?.id ?? 'new-offer'} onSubmit={submit}>
            {!isHotel && <fieldset className="line-item-editor">
              <legend>Saved offer drafts and templates</legend>
              <div className="response-fields"><select className="form-select" aria-label="Load a saved offer" value={loadedItem?.id ?? ''} onChange={(event) => setLoadedItem(libraryItems.find((item) => item.id === event.target.value) ?? null)}><option value="">Start a new offer</option>{libraryItems.map((item) => <option key={item.id} value={item.id}>{item.type === 'template' ? 'Template' : 'Draft'} / {item.name}</option>)}</select>{loadedItem && <button type="button" className="icon-button" aria-label={`Delete ${loadedItem.name}`} onClick={() => removeLibraryItem(loadedItem)}><Trash2 size={15} /></button>}</div>
              <div className="response-fields"><input className="form-input" aria-label="Saved offer name" value={libraryName} onChange={(event) => setLibraryName(event.target.value)} placeholder="Name this draft or template" maxLength="80" /><button type="button" className="secondary-button" onClick={(event) => saveLibraryItem(event.currentTarget.form, 'draft')}>Save draft</button><button type="button" className="secondary-button" onClick={(event) => saveLibraryItem(event.currentTarget.form, 'template')}>Save template</button></div>
              {libraryError && <small className="table-secondary" role="status">{libraryError}</small>}
            </fieldset>}
            <label className="field-label" htmlFor="response-amount">{isHotel ? 'Rate per room, per night' : lines.length ? 'Package total (from line items)' : 'Total package price'}</label>
            <div className="response-fields">
              <select aria-label="Currency" value={activeCurrency} onChange={(event) => setCurrency(event.target.value)}>{reference.currencies.map((code) => <option key={code} value={code}>{code}</option>)}</select>
              {lines.length && !isHotel
                ? <output id="response-amount" className="form-input offer-total-output">{formatMinor(lineTotalMinor, activeCurrency)}</output>
                : <input id="response-amount" name="amount" type="number" min="0.01" step="any" placeholder="0.00" defaultValue={loadedItem?.payload.values?.amount ?? ''} required />}
            </div>

            {!isHotel && <label className="field-label">Hotel category in this price<select className="form-select" name="hotel_category" defaultValue={loadedItem?.payload.values?.hotel_category ?? target.hotelCategory ?? ''}><option value="">Not specified</option>{reference.hotelCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>}

            {!isHotel && <fieldset className="line-item-editor">
              <legend>Day-by-day plan ({itinerary.length}/90)</legend>
              {itinerary.map((day, index) => <div className="itinerary-editor-row" key={index}>
                <input aria-label={`Day ${index + 1} number`} type="number" min="1" max="90" value={day.day} onChange={(event) => updateItineraryDay(index, 'day', event.target.value)} required />
                <input aria-label={`Day ${index + 1} destination`} value={day.destination ?? ''} onChange={(event) => updateItineraryDay(index, 'destination', event.target.value)} placeholder="Destination" maxLength="120" />
                <input aria-label={`Day ${index + 1} title`} value={day.title} onChange={(event) => updateItineraryDay(index, 'title', event.target.value)} placeholder="Plan title" maxLength="120" required />
                <input aria-label={`Day ${index + 1} details`} value={day.description ?? ''} onChange={(event) => updateItineraryDay(index, 'description', event.target.value)} placeholder="Activities and arrangements" maxLength="1000" />
                <button type="button" className="icon-button" aria-label={`Remove day ${index + 1}`} onClick={() => setItinerary((current) => current.filter((_, dayIndex) => dayIndex !== index))}><Trash2 size={14} /></button>
              </div>)}
              <div className="modal-actions"><button type="button" className="secondary-button" disabled={itinerary.length >= 90} onClick={() => setItinerary((current) => [...current, { day: current.length + 1, destination: '', title: '', description: '' }])}><Plus size={14} />Add day</button>{itinerary.length > 0 && <button type="button" className="secondary-button" onClick={printCurrentItinerary}><Printer size={14} />Print / save PDF</button>}</div>
            </fieldset>}

            {!isHotel && (
              <fieldset className="line-item-editor">
                <legend>Price breakdown ({lines.length}/{reference.limits.maxOfferLineItems})</legend>
                {lines.map((line, index) => (
                  <div className="line-item-row" key={index}>
                    <select aria-label={`Line ${index + 1} type`} value={line.itemType} onChange={(event) => updateLine(index, 'itemType', event.target.value)}>{reference.offerLineItemTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
                    <input aria-label={`Line ${index + 1} description`} value={line.description} onChange={(event) => updateLine(index, 'description', event.target.value)} placeholder="Description" minLength={2} maxLength={200} required />
                    <input aria-label={`Line ${index + 1} quantity`} type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} required />
                    <input aria-label={`Line ${index + 1} unit price`} type="number" min="0" step="any" value={line.unitPrice} onChange={(event) => updateLine(index, 'unitPrice', event.target.value)} placeholder="Unit price" required />
                    <span className="line-item-total">{line.unitPrice === '' ? '-' : formatMinor(toMinorUnits(line.unitPrice, activeCurrency) * Number(line.quantity || 0), activeCurrency)}</span>
                    <button type="button" className="icon-button" aria-label={`Remove line ${index + 1}`} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}><Trash2 size={14} /></button>
                  </div>
                ))}
                <button type="button" className="secondary-button" disabled={lines.length >= reference.limits.maxOfferLineItems} onClick={() => setLines((current) => [...current, emptyLine(reference.offerLineItemTypes[0].value)])}><Plus size={14} />Add line item</button>
              </fieldset>
            )}

            {isHotel && (
              <div className="request-form-grid">
                {!target.reviseOfferId && target.matchingProperties?.length > 0 && <label className="field-label">Hotel for this offer<select className="form-select" name="hotel_property_id" defaultValue={target.matchingProperties[0].id} required>{target.matchingProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>}
                <label className="field-label">Room type<input className="form-input" name="room_type" list="room-type-options" maxLength="120" required placeholder={roomTypes.length ? 'Choose or type a room type' : 'Type the room type'} /><datalist id="room-type-options">{roomTypes.map((roomType) => <option key={roomType} value={roomType} />)}</datalist></label>
                <label className="field-label">Rooms<input className="form-input" name="room_count" type="number" min="1" max="50" defaultValue={target.roomCount ?? 1} required /></label>
                <label className="field-label">Meal plan<select className="form-select" name="meal_plan" defaultValue={target.mealPlan ?? reference.mealPlans[0]?.value}>{reference.mealPlans.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}</select></label>
                <label className="checkbox-field"><input type="checkbox" name="taxes_included" />Rate includes taxes</label>
                <label className="checkbox-field"><input type="checkbox" name="availability_confirmed" />I confirm rooms are available for these dates</label>
              </div>
            )}

            <fieldset className="line-item-editor">
              <legend>Alternative options ({options.length}/{reference.limits.maxOfferOptions})</legend>
              <small className="table-secondary">Offer the same trip at other prices, for example a 3 star and a 5 star version. All options share the terms below.</small>
              {options.length > 0 && <label className="field-label">Name of the main option<input className="form-input" name="option_label" maxLength="80" defaultValue={loadedItem?.payload.values?.option_label ?? ''} required placeholder={isHotel ? 'For example: Deluxe twin' : 'For example: 4 star'} /></label>}
              {options.map((option, index) => (
                <div className={`offer-option-row${isHotel ? ' hotel-option' : ''}`} key={index}>
                  <input aria-label={`Option ${index + 1} name`} value={option.label} onChange={(event) => updateOption(index, 'label', event.target.value)} placeholder="Option name" maxLength={80} required />
                  {isHotel
                    ? <>
                        <input aria-label={`Option ${index + 1} room type`} value={option.roomType} onChange={(event) => updateOption(index, 'roomType', event.target.value)} list="room-type-options" placeholder="Room type" maxLength={120} required />
                        <select aria-label={`Option ${index + 1} meal plan`} value={option.mealPlan} onChange={(event) => updateOption(index, 'mealPlan', event.target.value)}><option value="">Meal plan</option>{reference.mealPlans.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}</select>
                      </>
                    : <select aria-label={`Option ${index + 1} hotel category`} value={option.hotelCategory} onChange={(event) => updateOption(index, 'hotelCategory', event.target.value)}><option value="">Hotel category</option>{reference.hotelCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select>}
                  <input aria-label={`Option ${index + 1} price`} type="number" min="0.01" step="any" value={option.price} onChange={(event) => updateOption(index, 'price', event.target.value)} placeholder={isHotel ? 'Rate / room / night' : 'Total price'} required />
                  <input aria-label={`Option ${index + 1} notes`} value={option.notes} onChange={(event) => updateOption(index, 'notes', event.target.value)} placeholder="What changes (optional)" maxLength={500} />
                  <button type="button" className="icon-button" aria-label={`Remove option ${index + 1}`} onClick={() => setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index))}><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" className="secondary-button" disabled={options.length >= reference.limits.maxOfferOptions} onClick={() => setOptions((current) => [...current, emptyOption()])}><Plus size={14} />Add option</button>
            </fieldset>

            <fieldset className="inclusion-picker"><legend>Included</legend>{reference.offerInclusions.map((item) => <label key={item.value}><input type="checkbox" name="inclusions" value={item.value} defaultChecked={loadedItem?.payload.inclusions?.includes(item.value)} />{item.label}</label>)}</fieldset>
            {!isHotel && <fieldset className="inclusion-picker"><legend>Not included</legend>{reference.offerInclusions.map((item) => <label key={item.value}><input type="checkbox" name="exclusions" value={item.value} defaultChecked={loadedItem?.payload.exclusions?.includes(item.value)} />{item.label}</label>)}</fieldset>}

            <div className="request-form-grid">
              <label className="field-label">Offer valid until<input className="form-input" name="validity_until" type="date" required min={format(addDays(today, 1), 'yyyy-MM-dd')} max={format(addDays(today, reference.limits.offerValidity.maxDays), 'yyyy-MM-dd')} defaultValue={loadedItem?.payload.values?.validity_until ?? format(addDays(today, reference.limits.offerValidity.defaultDays), 'yyyy-MM-dd')} /></label>
              <label className="field-label">Free cancellation until<input className="form-input" name="free_cancellation_until" type="date" min={format(today, 'yyyy-MM-dd')} defaultValue={loadedItem?.payload.values?.free_cancellation_until ?? ''} /></label>
              <label className="field-label">Deposit (%)<input className="form-input" name="deposit_percent" type="number" min="0" max="100" step="1" placeholder="Optional" defaultValue={loadedItem?.payload.values?.deposit_percent ?? ''} /></label>
              <label className="field-label">Balance due (days before travel)<input className="form-input" name="balance_due_days" type="number" min="0" max="365" step="1" placeholder="Optional" defaultValue={loadedItem?.payload.values?.balance_due_days ?? ''} /></label>
            </div>
            <label className="field-label">Cancellation policy<textarea className="form-input" name="cancellation_policy" maxLength="1000" defaultValue={loadedItem?.payload.values?.cancellation_policy ?? ''} placeholder="Charges by date, no-show rules" /></label>
            <label className="field-label">Payment notes<textarea className="form-input" name="payment_notes" maxLength="500" defaultValue={loadedItem?.payload.values?.payment_notes ?? ''} placeholder="Accepted payment methods, invoicing" /></label>
            <fieldset className="line-item-editor">
              <legend>Files ({existingFiles.length + files.length}/{reference.limits.maxOfferAttachments})</legend>
              <small className="table-secondary">Itinerary PDF or photos. The agency can open them after a malware scan.</small>
              {existingFiles.length > 0 && <AttachmentList attachments={existingFiles} onRemove={removeExisting} />}
              {files.length > 0 && <ul className="attachment-list">{files.map((file, index) => <li key={`${file.name}-${index}`}><span><Paperclip size={13} />{file.name}</span><small>Uploads when you submit</small><button type="button" className="icon-button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}><Trash2 size={14} /></button></li>)}</ul>}
              {fileSlots > 0 && <label className="secondary-button document-upload"><Plus size={14} />Add files<input type="file" multiple className="visually-hidden" accept={reference.limits.documentUpload.allowedMimeTypes.join(',')} onChange={(event) => addFiles(event.target)} /></label>}
            </fieldset>
            <small className="table-secondary">Do not include contact details or links; offers with them are rejected.</small>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Submitting...' : isHotel ? 'Submit room quote' : 'Submit offer'}</button></div>
          </form>
        )}
      </section>
    </div>
  );
}

function printOfferItinerary({ destination, requestCode, itinerary = [], mainOption, options = [], currency, categories = [] }) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.opener = null;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const dayRows = itinerary.map((day) => `<article><p class="day">DAY ${escapeHtml(day.day)}</p><h2>${escapeHtml(day.title)}</h2>${day.destination ? `<p class="destination">${escapeHtml(day.destination)}</p>` : ''}${day.description ? `<p>${escapeHtml(day.description)}</p>` : ''}</article>`).join('');
  const optionRows = [...(mainOption ? [mainOption] : []), ...options].map((option) => {
    const category = categories.find((item) => item.value === Number(option.hotelCategory ?? option.hotel_category))?.label ?? '';
    const totalMinor = option.totalMinor ?? option.total_minor ?? option.ratePerNightMinor ?? (option.price == null ? null : toMinorUnits(option.price, currency));
    return `<li><strong>${escapeHtml(option.label)}</strong>${category ? ` / ${escapeHtml(category)}` : ''}${totalMinor == null ? '' : ` <span>${escapeHtml(formatMinor(totalMinor, currency))}</span>`}</li>`;
  }).join('');
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(requestCode)} itinerary</title><style>body{font:15px/1.55 Georgia,serif;color:#202a2a;max-width:760px;margin:48px auto;padding:0 28px}header{border-bottom:2px solid #16796f;padding-bottom:18px;margin-bottom:28px}h1{font-size:30px;margin:0}h2{font-size:21px;margin:3px 0}header p,.destination,.day{color:#16796f}article{padding:14px 0;border-bottom:1px solid #d8dfdc;break-inside:avoid}.day{font:700 11px Arial,sans-serif;letter-spacing:1px;margin:0}article p{margin:6px 0}ul{padding-left:18px}li{padding:5px 0}li span{font-weight:700;margin-left:8px}@media print{body{margin:0 auto;padding:0 8mm}}</style></head><body><header><p>${escapeHtml(requestCode)}</p><h1>${escapeHtml(destination)} / Itinerary</h1></header>${dayRows}${optionRows ? `<section><h2>Hotel options</h2><ul>${optionRows}</ul></section>` : ''}<script>window.addEventListener('load',()=>window.print())</script></body></html>`);
  printWindow.document.close();
  return true;
}

export function OfferDetails({ offer }) {
  const { data: reference } = useReferenceData();
  const [hotelPhotos, setHotelPhotos] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);
  const typeLabel = (value) => reference?.offerLineItemTypes.find((type) => type.value === value)?.label ?? value;
  useEffect(() => {
    if (offer.kind !== 'hotel_room' || !offer.hotelPropertyId) return undefined;
    let active = true;
    listHotelOfferPhotos(offer.hotelPropertyId).then((result) => active && setHotelPhotos(result.photos)).catch(() => active && setHotelPhotos([]));
    return () => { active = false; };
  }, [offer.id, offer.hotelPropertyId, offer.kind]);
  const terms = [
    offer.depositPercent != null && `Deposit ${offer.depositPercent}%`,
    offer.balanceDueDaysBeforeTravel != null && `Balance ${offer.balanceDueDaysBeforeTravel} days before travel`,
    offer.freeCancellationUntil && `Free cancellation until ${new Date(offer.freeCancellationUntil).toLocaleDateString()}`,
    offer.kind === 'hotel_room' && offer.taxesIncluded != null && (offer.taxesIncluded ? 'Taxes included' : 'Taxes extra'),
    offer.kind === 'hotel_room' && offer.availabilityConfirmed && 'Availability confirmed',
  ].filter(Boolean);
  return (
    <>
      {(offer.comparisonLabels?.length > 0 || offer.comparisonTotalMinor != null || offer.responseTimeMinutes != null) && <div className="comparison-meta">
        {offer.comparisonLabels?.map((label) => <span className="status-pill open" key={label}><i />{labelFor(reference?.comparisonLabels, label)}</span>)}
        {offer.comparisonTotalMinor != null
          ? <strong>{formatMinor(offer.comparisonTotalMinor, offer.comparisonCurrency)} comparison total</strong>
          : <small>Comparison currency conversion unavailable</small>}
        {offer.comparisonPerTravellerMinor != null && <small>{formatMinor(offer.comparisonPerTravellerMinor, offer.comparisonCurrency)} per traveller</small>}
        {offer.exchangeRate?.baseCurrency !== offer.exchangeRate?.quoteCurrency && offer.exchangeRate && <small>
          {offer.exchangeRate.stale ? 'Cached rate' : 'Rate'}: {offer.exchangeRate.rate} {offer.exchangeRate.quoteCurrency} per {offer.exchangeRate.baseCurrency}, as of {offer.exchangeRate.rateDate}; fetched {new Date(offer.exchangeRate.fetchedAt).toLocaleString()} ({offer.exchangeRate.provider})
        </small>}
        {offer.responseTimeMinutes != null && <small>Responded in {formatResponseTime(offer.responseTimeMinutes)}</small>}
      </div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setExportOpen(true)}><FileText size={14} />Prepare client itinerary</button></div>
      <details className="offer-details">
      <summary>Terms{offer.lineItems?.length ? ` and ${offer.lineItems.length} price lines` : ''}{offer.attachments?.length ? ` / ${offer.attachments.length} file(s)` : ''}</summary>
      {terms.length > 0 && <p>{terms.join(' / ')}</p>}
      {offer.cancellationPolicy && <p><strong>Cancellation:</strong> {offer.cancellationPolicy}</p>}
      {offer.paymentNotes && <p><strong>Payment:</strong> {offer.paymentNotes}</p>}
        {hotelPhotos.length > 0 && <div className="hotel-photo-strip offer-hotel-photos">{hotelPhotos.map((photo) => <figure key={photo.id}><img src={photo.url} alt={photo.filename} /></figure>)}</div>}
      {offer.lineItems?.length > 0 && <table className="line-item-table"><tbody>{offer.lineItems.map((item, index) => <tr key={index}><td>{typeLabel(item.type)}</td><td>{item.description}</td><td>{item.quantity} x {formatMinor(item.unitPriceMinor, offer.currency)}</td><td>{formatMinor(item.lineTotalMinor, offer.currency)}</td></tr>)}</tbody></table>}
      {offer.itinerary?.length > 0 && <section className="offer-itinerary"><div className="section-heading"><h3>Day-by-day plan</h3><button type="button" className="text-button" onClick={() => printOfferItinerary({ destination: offer.destination, requestCode: offer.requestCode, itinerary: offer.itinerary, mainOption: { label: offer.optionLabel ?? 'Main package', hotelCategory: offer.hotelCategory, totalMinor: offer.totalMinor }, options: offer.options, currency: offer.currency, categories: reference?.hotelCategories })}><Printer size={14} />Print / save PDF</button></div>{offer.itinerary.map((day) => <article key={day.day}><strong>Day {day.day}: {day.title}</strong>{day.destination && <span>{day.destination}</span>}{day.description && <p>{day.description}</p>}</article>)}</section>}
      {offer.options?.length > 0 && <p>Line items and prices above are for the main option{offer.optionLabel ? ` (${offer.optionLabel})` : ''}. Alternative options share these terms.</p>}
      {offer.attachments?.length > 0 && <AttachmentList attachments={offer.attachments} />}
      {!terms.length && !offer.cancellationPolicy && !offer.paymentNotes && !offer.lineItems?.length && !offer.attachments?.length && <p>No additional terms were provided.</p>}
      </details>
      {exportOpen && <OfferExportModal offer={offer} onClose={() => setExportOpen(false)} />}
    </>
  );
}

function formatResponseTime(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function AttachmentList({ attachments, onRemove }) {
  const { data: reference } = useReferenceData();
  const [error, setError] = useState('');

  async function open(attachment) {
    setError('');
    try {
      const { url } = await createAttachmentDownloadUrl(attachment.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <>
      <ul className="attachment-list">{attachments.map((attachment) => <li key={attachment.id}>
        <span><Paperclip size={13} />{attachment.filename}</span>
        {attachment.scanStatus === 'clean'
          ? <button type="button" className="text-button" onClick={() => open(attachment)}><Download size={13} />Open</button>
          : <small>{labelFor(reference?.documentScanStatuses, attachment.scanStatus)}</small>}
        {onRemove && <button type="button" className="icon-button" aria-label={`Remove ${attachment.filename}`} onClick={() => onRemove(attachment)}><Trash2 size={14} /></button>}
      </li>)}</ul>
      {error && <p className="auth-error" role="alert">{error}</p>}
    </>
  );
}
