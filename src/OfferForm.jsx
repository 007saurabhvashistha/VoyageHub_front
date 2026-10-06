import { useEffect, useState } from 'react';
import { Download, Paperclip, Plus, Trash2, X } from 'lucide-react';
import { addDays, endOfDay, format, parseISO } from 'date-fns';
import { createAttachmentDownloadUrl, getMarketplaceOffer, removeAttachment } from './api.js';
import { formatMinor, toMinorUnits } from './money.js';
import { labelFor, useReferenceData } from './referenceData.js';

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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

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
          <form onSubmit={submit}>
            <label className="field-label" htmlFor="response-amount">{isHotel ? 'Rate per room, per night' : lines.length ? 'Package total (from line items)' : 'Total package price'}</label>
            <div className="response-fields">
              <select aria-label="Currency" value={activeCurrency} onChange={(event) => setCurrency(event.target.value)}>{reference.currencies.map((code) => <option key={code} value={code}>{code}</option>)}</select>
              {lines.length && !isHotel
                ? <output id="response-amount" className="form-input offer-total-output">{formatMinor(lineTotalMinor, activeCurrency)}</output>
                : <input id="response-amount" name="amount" type="number" min="0.01" step="any" placeholder="0.00" required />}
            </div>

            {!isHotel && <label className="field-label">Hotel category in this price<select className="form-select" name="hotel_category" defaultValue={target.hotelCategory ?? ''}><option value="">Not specified</option>{reference.hotelCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>}

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
              {options.length > 0 && <label className="field-label">Name of the main option<input className="form-input" name="option_label" maxLength="80" required placeholder={isHotel ? 'For example: Deluxe twin' : 'For example: 4 star'} /></label>}
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

            <fieldset className="inclusion-picker"><legend>Included</legend>{reference.offerInclusions.map((item) => <label key={item.value}><input type="checkbox" name="inclusions" value={item.value} />{item.label}</label>)}</fieldset>
            {!isHotel && <fieldset className="inclusion-picker"><legend>Not included</legend>{reference.offerInclusions.map((item) => <label key={item.value}><input type="checkbox" name="exclusions" value={item.value} />{item.label}</label>)}</fieldset>}

            <div className="request-form-grid">
              <label className="field-label">Offer valid until<input className="form-input" name="validity_until" type="date" required min={format(addDays(today, 1), 'yyyy-MM-dd')} max={format(addDays(today, reference.limits.offerValidity.maxDays), 'yyyy-MM-dd')} defaultValue={format(addDays(today, reference.limits.offerValidity.defaultDays), 'yyyy-MM-dd')} /></label>
              <label className="field-label">Free cancellation until<input className="form-input" name="free_cancellation_until" type="date" min={format(today, 'yyyy-MM-dd')} /></label>
              <label className="field-label">Deposit (%)<input className="form-input" name="deposit_percent" type="number" min="0" max="100" step="1" placeholder="Optional" /></label>
              <label className="field-label">Balance due (days before travel)<input className="form-input" name="balance_due_days" type="number" min="0" max="365" step="1" placeholder="Optional" /></label>
            </div>
            <label className="field-label">Cancellation policy<textarea className="form-input" name="cancellation_policy" maxLength="1000" placeholder="Charges by date, no-show rules" /></label>
            <label className="field-label">Payment notes<textarea className="form-input" name="payment_notes" maxLength="500" placeholder="Accepted payment methods, invoicing" /></label>
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

export function OfferDetails({ offer }) {
  const { data: reference } = useReferenceData();
  const typeLabel = (value) => reference?.offerLineItemTypes.find((type) => type.value === value)?.label ?? value;
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
      <details className="offer-details">
      <summary>Terms{offer.lineItems?.length ? ` and ${offer.lineItems.length} price lines` : ''}{offer.attachments?.length ? ` / ${offer.attachments.length} file(s)` : ''}</summary>
      {terms.length > 0 && <p>{terms.join(' / ')}</p>}
      {offer.cancellationPolicy && <p><strong>Cancellation:</strong> {offer.cancellationPolicy}</p>}
      {offer.paymentNotes && <p><strong>Payment:</strong> {offer.paymentNotes}</p>}
      {offer.lineItems?.length > 0 && <table className="line-item-table"><tbody>{offer.lineItems.map((item, index) => <tr key={index}><td>{typeLabel(item.type)}</td><td>{item.description}</td><td>{item.quantity} x {formatMinor(item.unitPriceMinor, offer.currency)}</td><td>{formatMinor(item.lineTotalMinor, offer.currency)}</td></tr>)}</tbody></table>}
      {offer.options?.length > 0 && <p>Line items and prices above are for the main option{offer.optionLabel ? ` (${offer.optionLabel})` : ''}. Alternative options share these terms.</p>}
      {offer.attachments?.length > 0 && <AttachmentList attachments={offer.attachments} />}
      {!terms.length && !offer.cancellationPolicy && !offer.paymentNotes && !offer.lineItems?.length && !offer.attachments?.length && <p>No additional terms were provided.</p>}
      </details>
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
