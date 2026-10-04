import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, ClipboardCheck, Download, FileWarning, Lock, Paperclip, ShieldCheck, Upload, X } from 'lucide-react';
import {
  confirmBooking,
  confirmBookingReference,
  answerBookingChange,
  correctGuestDetails,
  createVoucherDownloadUrl,
  getBooking,
  getGuestAccessLog,
  getGuestDetails,
  listBookings,
  restoreGuestDetails,
  revokeGuestDetails,
  uploadBookingVoucher,
  requestBookingChange,
  withdrawBookingChange,
} from './api.js';
import { useCan } from './capabilities.js';
import { labelFor, useReferenceData } from './referenceData.js';
import { documentStateClass, formatBytes } from './SellerDocuments.jsx';

const statusPill = { awarded: 'draft', confirmation_pending: 'awarded', booked: 'open', cancelled: 'cancelled' };

function travelText(booking) {
  return booking.travelStartDate ? `${booking.travelStartDate} - ${booking.travelEndDate}` : `${booking.travelMonth} / ${booking.nights} nights`;
}

function guestSummary(booking) {
  const parts = [`${booking.adults} adults`];
  if (booking.children) parts.push(`${booking.children} children`);
  if (booking.infants) parts.push(`${booking.infants} infants`);
  return parts.join(', ');
}

export function BookingsWorkspace() {
  const { data: reference } = useReferenceData();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  async function refresh() {
    setLoading(true);
    try {
      setBookings((await listBookings()).bookings);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <section className="surface-section full-section">
      <div className="section-heading request-list-heading"><div><p className="eyebrow">AWARDS AND BOOKINGS</p><h2>Bookings <span className="heading-count">{bookings.length}</span></h2></div></div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {loading ? <div className="empty-state">Loading bookings...</div> : bookings.length ? (
        <div className="table-scroll">
          <table className="request-table">
            <thead><tr><th>REQUEST</th><th>TRAVEL</th><th>{bookings[0].viewerRole === 'agency' ? 'SELLER' : 'AGENCY'}</th><th>GUEST DETAILS</th><th>STATUS</th><th><span className="visually-hidden">Open booking</span></th></tr></thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td><span className="table-primary">{booking.destination}</span><small className="table-secondary">{booking.requestCode}</small></td>
                  <td><span className="table-primary">{travelText(booking)}</span><small className="table-secondary">{guestSummary(booking)}</small></td>
                  <td><span className="table-primary">{booking.viewerRole === 'agency' ? booking.sellerName : booking.agencyName}</span></td>
                  <td><small className="table-secondary">{guestDetailsState(booking)}</small></td>
                  <td><span className={`status-pill ${statusPill[booking.status]}`}><i />{labelFor(reference?.bookingStatuses, booking.status)}</span></td>
                  <td><button className="icon-button row-open" aria-label={`Open booking ${booking.requestCode}`} onClick={() => setOpenId(booking.id)}><ArrowUpRight size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty-state"><ClipboardCheck size={22} /><strong>No bookings yet</strong><span>Awarded offers appear here for booking confirmation.</span></div>}
      {openId && <BookingDetailModal bookingId={openId} onClose={() => setOpenId(null)} onChanged={refresh} />}
    </section>
  );
}

function guestDetailsState(booking) {
  const guest = booking.guestDetails;
  if (!guest) return 'Not shared';
  if (guest.purgedAt) return 'Deleted under retention';
  if (guest.revokedAt) return 'Seller access revoked';
  if (!guest.sellerCanView) return 'Seller access ended';
  return `Shared with seller until ${guest.sellerAccessEndsOn}`;
}

function BookingDetailModal({ bookingId, onClose, onChanged }) {
  const { data: reference } = useReferenceData();
  const canConfirm = useCan('request.award');
  const canManage = useCan('booking.manage');
  const [booking, setBooking] = useState(null);
  const [guestDetails, setGuestDetails] = useState(null);
  const [accessLog, setAccessLog] = useState(null);
  const [mode, setMode] = useState('view');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBooking(bookingId).then((result) => setBooking(result.booking)).catch((requestError) => setError(requestError.message));
  }, [bookingId]);

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      const result = await action();
      if (result?.booking) {
        setBooking(result.booking);
        onChanged();
      } else if (result?.change) {
        const refreshed = await getBooking(bookingId);
        setBooking(refreshed.booking);
        onChanged();
      }
      return result;
    } catch (requestError) {
      setError(requestError.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  const isAgency = booking?.viewerRole === 'agency';
  const guest = booking?.guestDetails;
  const confirmed = ['confirmation_pending', 'booked'].includes(booking?.status);
  const canOpenGuests = canManage && guest && !guest.purgedAt && (isAgency || guest.sellerCanView);

  async function showGuests() {
    const result = await run(() => getGuestDetails(bookingId));
    if (result) setGuestDetails(result.guestDetails);
  }

  async function submitGuests(payload) {
    const result = await run(() => (mode === 'confirm' ? confirmBooking : correctGuestDetails)(bookingId, payload));
    if (result) {
      setMode('view');
      setGuestDetails(null);
      setAccessLog(null);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal comparison-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <div className="modal-heading"><div><p className="eyebrow">BOOKING {booking?.requestCode ?? ''}</p><h2 id="booking-title">{booking ? `${booking.destination} / ${isAgency ? booking.sellerName : booking.agencyName}` : 'Loading booking...'}</h2></div><button className="icon-button" aria-label="Close booking" onClick={onClose}><X size={18} /></button></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {booking && (mode === 'view' ? (
          <>
            <dl className="request-preview-list">
              <div><dt>Status</dt><dd><span className={`status-pill ${statusPill[booking.status]}`}><i />{labelFor(reference?.bookingStatuses, booking.status)}</span></dd></div>
              <div><dt>Travel</dt><dd>{travelText(booking)}</dd></div>
              <div><dt>Travellers</dt><dd>{guestSummary(booking)}{booking.roomingRequired ? ` / ${booking.roomCount} room(s), ${booking.offer.roomType}` : ''}</dd></div>
              {booking.offer.optionLabel && <div><dt>Awarded option</dt><dd>{booking.offer.optionLabel}{booking.offer.hotelCategory ? ` / ${labelFor(reference?.hotelCategories, booking.offer.hotelCategory)}` : ''}</dd></div>}
              <div><dt>Booking reference</dt><dd>{booking.sellerConfirmationNumber ? `${booking.sellerConfirmationNumber}${booking.sellerConfirmationNote ? ` (${booking.sellerConfirmationNote})` : ''}` : 'Not confirmed by the seller yet'}</dd></div>
              <div><dt>Guest details</dt><dd>{guestDetailsState(booking)}{guest && !guest.purgedAt ? ` / deleted on ${guest.deletionDueOn}` : ''}</dd></div>
              {guest?.revokedReason && <div><dt>Revocation reason</dt><dd>{guest.revokedReason}</dd></div>}
            </dl>

            {isAgency && booking.status === 'awarded' && (canConfirm
              ? <div className="modal-actions"><button className="primary-button" onClick={() => setMode('confirm')}><ClipboardCheck size={15} />Confirm booking and enter guests</button></div>
              : <p className="privacy-note">Only owners and managers can confirm a booking.</p>)}
            {!isAgency && booking.status === 'awarded' && <p className="privacy-note"><Lock size={15} />Guest details are shared once the agency confirms the booking.</p>}

            {canOpenGuests && (guestDetails
              ? <GuestList details={guestDetails} reference={reference} />
              : <div className="modal-actions"><button className="secondary-button" disabled={busy} onClick={showGuests}><Lock size={14} />Show guest details</button></div>)}
            {canOpenGuests && <p className="privacy-note"><ShieldCheck size={15} />Every time guest details are opened it is logged.{isAgency ? '' : ' Contact the travellers only through the agency.'}</p>}

            {isAgency && canManage && guest && !guest.purgedAt && confirmed && (
              <div className="modal-actions">
                <button className="secondary-button" disabled={busy} onClick={async () => {
                  const result = await run(() => getGuestDetails(bookingId));
                  if (result) { setGuestDetails(result.guestDetails); setMode('correct'); }
                }}>Correct guest details</button>
                {guest.revokedAt
                  ? <button className="secondary-button" disabled={busy} onClick={() => run(() => restoreGuestDetails(bookingId))}>Restore seller access</button>
                  : <RevokeButton busy={busy} onRevoke={(reason) => run(() => revokeGuestDetails(bookingId, reason))} />}
                <button className="text-button" disabled={busy} onClick={async () => {
                  const result = await run(() => getGuestAccessLog(bookingId));
                  if (result) setAccessLog(result.entries);
                }}>Access log</button>
              </div>
            )}
            {accessLog && <AccessLog entries={accessLog} reference={reference} />}

            <BookingChanges booking={booking} reference={reference} canManage={canManage} busy={busy} onRun={run} />

            {!isAgency && canManage && confirmed && <SellerConfirmation booking={booking} busy={busy} onSubmit={(number, note) => run(() => confirmBookingReference(bookingId, number, note))} />}
            <Vouchers booking={booking} canManage={canManage} onError={setError} onUploaded={async () => setBooking((await getBooking(bookingId)).booking)} />
          </>
        ) : (
          <GuestDetailsForm booking={booking} initial={mode === 'correct' ? guestDetails : null} busy={busy} submitLabel={mode === 'confirm' ? 'Confirm booking and share with seller' : 'Save corrected details'} onCancel={() => setMode('view')} onSubmit={submitGuests} />
        ))}
      </section>
    </div>
  );
}

function BookingChanges({ booking, reference, canManage, busy, onRun }) {
  const [changeType, setChangeType] = useState('amendment');
  const [message, setMessage] = useState('');
  const [startDate, setStartDate] = useState(booking.travelStartDate ?? '');
  const [endDate, setEndDate] = useState(booking.travelEndDate ?? '');
  const [nights, setNights] = useState(String(booking.nights));
  const [rooms, setRooms] = useState(String(booking.roomCount));
  const [responseNote, setResponseNote] = useState('');
  const [error, setError] = useState('');
  const hasPending = booking.changes?.some((change) => change.status === 'pending');
  const canRequest = canManage && ['confirmation_pending', 'booked'].includes(booking.status) && !hasPending;

  async function submit(event) {
    event.preventDefault();
    setError('');
    const proposedChanges = changeType === 'amendment' ? {
      ...(startDate && endDate ? { travel_start_date: startDate, travel_end_date: endDate, nights: Number(nights) } : {}),
      ...(rooms ? { room_count: Number(rooms) } : {}),
    } : {};
    const result = await onRun(() => requestBookingChange(booking.id, { change_type: changeType, message, proposed_changes: proposedChanges }));
    if (result) setMessage('');
  }

  async function answer(change, action) {
    setError('');
    const result = await onRun(() => answerBookingChange(booking.id, change.id, action, responseNote));
    if (result) setResponseNote('');
  }

  async function withdraw(change) {
    setError('');
    await onRun(() => withdrawBookingChange(booking.id, change.id));
  }

  return (
    <section className="booking-change-section">
      <div className="section-heading"><div><p className="eyebrow">AFTER BOOKING</p><h3>Changes and cancellations</h3></div></div>
      {booking.changes?.length > 0 && <ol className="booking-change-list">{[...booking.changes].reverse().map((change) => (
        <li key={change.id}>
          <div className="booking-change-heading"><strong>{labelFor(reference?.bookingChangeTypes, change.type)}</strong><span className={`status-pill ${change.status === 'accepted' ? 'open' : change.status === 'pending' ? 'draft' : 'cancelled'}`}><i />{labelFor(reference?.bookingChangeStatuses, change.status)}</span></div>
          <p>{change.message}</p>
          {change.type === 'amendment' && Object.entries(change.proposedChanges ?? {}).filter(([, value]) => value != null).map(([key, value]) => <small key={key}>{key.replaceAll('_', ' ')}: {value}</small>)}
          {change.responseNote && <small>Response: {change.responseNote}</small>}
          <time>{new Date(change.createdAt).toLocaleString()}</time>
          {change.status === 'pending' && change.isMine
            ? <button className="text-button" disabled={busy} onClick={() => withdraw(change)}>Withdraw request</button>
            : change.status === 'pending' && canManage && <div className="booking-change-response">
                <input className="form-input" value={responseNote} onChange={(event) => setResponseNote(event.target.value)} maxLength="1000" placeholder="Optional response note" aria-label="Response note" />
                <button className="primary-button" disabled={busy} onClick={() => answer(change, 'accept')}><Check size={14} />Accept</button>
                <button className="secondary-button" disabled={busy} onClick={() => answer(change, 'decline')}>Decline</button>
              </div>}
        </li>
      ))}</ol>}
      {canRequest && <form className="booking-change-form" onSubmit={submit}>
        <label className="field-label">Request type<select className="form-select" value={changeType} onChange={(event) => setChangeType(event.target.value)}>{reference?.bookingChangeTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        {changeType === 'amendment' && <div className="request-form-grid">
          <label className="field-label">New arrival<input className="form-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>
          <label className="field-label">New departure<input className="form-input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></label>
          <label className="field-label">Nights<input className="form-input" type="number" min="1" max={reference?.limits.bookingChanges.maxNights} value={nights} onChange={(event) => setNights(event.target.value)} required /></label>
          <label className="field-label">Rooms<input className="form-input" type="number" min="1" max={reference?.limits.bookingChanges.maxRooms} value={rooms} onChange={(event) => setRooms(event.target.value)} /></label>
        </div>}
        <label className="field-label">Message to the other party<textarea className="form-input" value={message} onChange={(event) => setMessage(event.target.value)} minLength="5" maxLength="1000" required placeholder={changeType === 'cancellation' ? 'Why does this booking need to be cancelled?' : 'Describe what needs to change'} /></label>
        <small className="table-secondary">The other party must accept before an amendment takes effect or a cancellation is completed.</small>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="modal-actions"><button className="primary-button" disabled={busy || (changeType === 'amendment' && (!startDate || !endDate))}><ArrowUpRight size={14} />Send request</button></div>
      </form>}
      {booking.status === 'cancelled' && <p className="privacy-note">This booking is cancelled. Its change history remains available to both parties.</p>}
    </section>
  );
}

function GuestList({ details, reference }) {
  return (
    <div className="guest-list">
      <table className="request-table">
        <thead><tr><th>GUEST</th><th>TYPE</th><th>NATIONALITY</th><th>ROOM</th></tr></thead>
        <tbody>{details.guests.map((item, index) => <tr key={index}><td><span className="table-primary">{item.fullName}</span>{item.lead && <small className="table-secondary">Lead guest</small>}</td><td>{labelFor(reference?.travellerTypes, item.travellerType)}{item.age != null ? `, ${item.age}` : ''}</td><td>{item.nationality ? (reference?.countries.find((country) => country.code === item.nationality)?.name ?? item.nationality) : '-'}</td><td>{item.roomNumber ?? '-'}</td></tr>)}</tbody>
      </table>
      <dl className="request-preview-list">
        <div><dt>Arrival</dt><dd>{[details.arrival.date, details.arrival.time, details.arrival.details].filter(Boolean).join(' / ')}</dd></div>
        <div><dt>Departure</dt><dd>{[details.departure.date, details.departure.time, details.departure.details].filter(Boolean).join(' / ')}</dd></div>
        {details.specialRequests && <div><dt>Special requests</dt><dd>{details.specialRequests}</dd></div>}
        <div><dt>Version</dt><dd>{details.version}</dd></div>
      </dl>
    </div>
  );
}

function RevokeButton({ busy, onRevoke }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!open) return <button className="secondary-button" disabled={busy} onClick={() => setOpen(true)}>Revoke seller access</button>;
  return (
    <span className="inline-form">
      <input className="form-input" value={reason} onChange={(event) => setReason(event.target.value)} maxLength="300" placeholder="Reason shared with the seller" aria-label="Revocation reason" />
      <button className="primary-button" disabled={busy || reason.trim().length < 5} onClick={async () => { await onRevoke(reason); setOpen(false); setReason(''); }}>Revoke</button>
      <button className="text-button" onClick={() => setOpen(false)}>Cancel</button>
    </span>
  );
}

function AccessLog({ entries, reference }) {
  return (
    <ul className="document-list">
      {entries.map((entry) => <li key={entry.id} className="document-row"><div className="document-main"><strong>{labelFor(reference?.guestAccessActions, entry.action)}</strong><span>{entry.organizationName ?? 'Platform'}{entry.userName ? ` / ${entry.userName}` : ''} / {new Date(entry.createdAt).toLocaleString()}</span></div></li>)}
    </ul>
  );
}

function SellerConfirmation({ booking, busy, onSubmit }) {
  const [number, setNumber] = useState(booking.sellerConfirmationNumber ?? '');
  const [note, setNote] = useState(booking.sellerConfirmationNote ?? '');
  return (
    <form className="request-form" onSubmit={(event) => { event.preventDefault(); onSubmit(number, note); }}>
      <div className="request-form-grid">
        <label className="field-label">Booking confirmation number<input className="form-input" value={number} onChange={(event) => setNumber(event.target.value)} minLength="3" maxLength="64" required /></label>
        <label className="field-label">Note for the agency (optional)<input className="form-input" value={note} onChange={(event) => setNote(event.target.value)} maxLength="500" /></label>
      </div>
      <div className="modal-actions"><button className="primary-button" disabled={busy || number.trim().length < 3}>{booking.status === 'booked' ? 'Update reference' : 'Confirm booking'}</button></div>
    </form>
  );
}

function Vouchers({ booking, canManage, onError, onUploaded }) {
  const { data: reference } = useReferenceData();
  const [uploading, setUploading] = useState(false);
  const isSeller = booking.viewerRole === 'seller';
  const limits = reference?.limits;
  const canUpload = isSeller && canManage && ['confirmation_pending', 'booked'].includes(booking.status) && !booking.guestDetails?.purgedAt;
  if (!booking.vouchers.length && !canUpload) return null;

  async function upload(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (limits && file.size > limits.documentUpload.maxBytes) {
      onError(`Files must be ${formatBytes(limits.documentUpload.maxBytes)} or smaller.`);
      return;
    }
    setUploading(true);
    try {
      await uploadBookingVoucher(booking.id, file);
      await onUploaded();
    } catch (requestError) {
      onError(requestError.message);
    } finally {
      setUploading(false);
    }
  }

  async function open(voucher) {
    try {
      const { url } = await createVoucherDownloadUrl(booking.id, voucher.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (requestError) {
      onError(requestError.message);
    }
  }

  return (
    <div className="seller-documents">
      <div className="section-heading"><div><p className="eyebrow">VOUCHERS</p><h3>Booking vouchers</h3></div></div>
      <ul className="document-list">
        {booking.vouchers.map((voucher) => <li key={voucher.id} className="document-row">
          <div className="document-main"><strong>{voucher.filename}</strong><span>{formatBytes(voucher.sizeBytes)} / {new Date(voucher.uploadedAt).toLocaleDateString()}</span></div>
          <span className={`status-pill ${documentStateClass(voucher)}`}><i />{voucher.removedAt ? 'Removed' : labelFor(reference?.documentScanStatuses, voucher.scanStatus)}</span>
          {canManage && voucher.scanStatus === 'clean' && !voucher.removedAt && <button className="secondary-button" onClick={() => open(voucher)}><Download size={14} />Open</button>}
        </li>)}
      </ul>
      {canUpload && limits && booking.vouchers.filter((voucher) => !voucher.removedAt).length < limits.maxVouchersPerBooking && (
        <label className={`secondary-button document-upload ${uploading ? 'disabled' : ''}`}>
          <Upload size={14} />{uploading ? 'Uploading...' : 'Upload voucher'}
          <input type="file" className="visually-hidden" accept={limits.documentUpload.allowedMimeTypes.join(',')} disabled={uploading} onChange={(event) => upload(event.target)} />
        </label>
      )}
      <p className="privacy-note"><FileWarning size={15} />Vouchers are stored privately and can be opened only after a malware scan.</p>
    </div>
  );
}

function initialGuests(booking, initial) {
  if (initial) {
    return initial.guests.map((item) => ({ full_name: item.fullName, traveller_type: item.travellerType, age: item.age ?? '', nationality: item.nationality ?? '', room_number: item.roomNumber ?? '' }));
  }
  const rows = [];
  for (const [type, count] of [['adult', booking.adults], ['child', booking.children], ['infant', booking.infants]]) {
    for (let index = 0; index < count; index += 1) rows.push({ full_name: '', traveller_type: type, age: '', nationality: '', room_number: booking.roomCount === 1 ? 1 : '' });
  }
  return rows;
}

function GuestDetailsForm({ booking, initial, busy, submitLabel, onCancel, onSubmit }) {
  const { data: reference } = useReferenceData();
  const [guests, setGuests] = useState(() => initialGuests(booking, initial));
  const [leadIndex, setLeadIndex] = useState(() => Math.max(0, initial ? initial.guests.findIndex((item) => item.lead) : 0));
  const [trip, setTrip] = useState({
    arrival_date: initial?.arrival.date ?? booking.travelStartDate ?? '',
    arrival_time: initial?.arrival.time ?? '',
    arrival_details: initial?.arrival.details ?? '',
    departure_date: initial?.departure.date ?? booking.travelEndDate ?? '',
    departure_time: initial?.departure.time ?? '',
    departure_details: initial?.departure.details ?? '',
    special_requests: initial?.specialRequests ?? '',
  });
  const fixedDates = Boolean(booking.travelStartDate);
  const typeInfo = (value) => reference?.travellerTypes.find((type) => type.value === value);
  const updateGuest = (index, field, value) => setGuests((current) => current.map((item, position) => position === index ? { ...item, [field]: value } : item));
  const updateTrip = (field) => (event) => setTrip((current) => ({ ...current, [field]: event.target.value }));
  const optionalNumber = (value) => value === '' || value == null ? null : Number(value);

  function submit(event) {
    event.preventDefault();
    onSubmit({
      guests: guests.map((item) => ({ full_name: item.full_name, traveller_type: item.traveller_type, age: optionalNumber(item.age), nationality: item.nationality || null, room_number: optionalNumber(item.room_number) })),
      lead_guest_index: leadIndex,
      ...trip,
      arrival_details: trip.arrival_details || null,
      departure_details: trip.departure_details || null,
      special_requests: trip.special_requests || null,
    });
  }

  if (!reference) return <div className="empty-state">Loading guest form...</div>;
  return (
    <form className="request-form" onSubmit={submit}>
      <p className="modal-copy">Enter only what {booking.sellerName} needs to run the trip. Phone numbers, email addresses and links are not accepted; the agency stays the travellers' contact point. Details are encrypted and shared only with this seller.</p>
      <div className="table-scroll">
        <table className="request-table">
          <thead><tr><th>LEAD</th><th>FULL NAME</th><th>TYPE</th><th>AGE</th><th>NATIONALITY</th><th>ROOM</th></tr></thead>
          <tbody>
            {guests.map((item, index) => {
              const type = typeInfo(item.traveller_type);
              return (
                <tr key={index}>
                  <td><input type="radio" name="lead-guest" checked={leadIndex === index} disabled={item.traveller_type !== 'adult'} onChange={() => setLeadIndex(index)} aria-label={`Lead guest ${index + 1}`} /></td>
                  <td><input className="form-input" value={item.full_name} onChange={(event) => updateGuest(index, 'full_name', event.target.value)} minLength="2" maxLength="120" required aria-label={`Guest ${index + 1} full name`} /></td>
                  <td>{type?.label ?? item.traveller_type}</td>
                  <td>{type?.minAge != null ? <input className="form-input" type="number" min={type.minAge} max={type.maxAge} value={item.age} onChange={(event) => updateGuest(index, 'age', event.target.value)} required aria-label={`Guest ${index + 1} age`} /> : '-'}</td>
                  <td><select className="form-select" value={item.nationality} onChange={(event) => updateGuest(index, 'nationality', event.target.value)} aria-label={`Guest ${index + 1} nationality`}><option value="">Not specified</option>{reference.countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></td>
                  <td><input className="form-input" type="number" min="1" max={booking.roomCount} value={item.room_number} onChange={(event) => updateGuest(index, 'room_number', event.target.value)} required={booking.roomingRequired} aria-label={`Guest ${index + 1} room number`} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="request-form-grid">
        <label className="field-label">Arrival date<input className="form-input" type="date" value={trip.arrival_date} onChange={updateTrip('arrival_date')} readOnly={fixedDates} required /></label>
        <label className="field-label">Arrival time<input className="form-input" type="time" value={trip.arrival_time} onChange={updateTrip('arrival_time')} /></label>
        <label className="field-label">Arrival details<input className="form-input" value={trip.arrival_details} onChange={updateTrip('arrival_details')} maxLength="200" placeholder="Flight or train number" /></label>
        <label className="field-label">Departure date<input className="form-input" type="date" value={trip.departure_date} onChange={updateTrip('departure_date')} readOnly={fixedDates} required /></label>
        <label className="field-label">Departure time<input className="form-input" type="time" value={trip.departure_time} onChange={updateTrip('departure_time')} /></label>
        <label className="field-label">Departure details<input className="form-input" value={trip.departure_details} onChange={updateTrip('departure_details')} maxLength="200" placeholder="Flight or train number" /></label>
      </div>
      <label className="field-label">Special requests (optional)<textarea className="form-input" value={trip.special_requests} onChange={updateTrip('special_requests')} maxLength="1000" /></label>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>Back</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving...' : submitLabel}</button></div>
    </form>
  );
}
