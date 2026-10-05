import { useEffect, useState } from 'react';
import { ArrowUpRight, BadgeCheck, Flag, BedDouble, Building2, CalendarDays, Check, ChevronRight, Clock3, Hotel, MapPin, MessageSquareText, Star, UsersRound, X } from 'lucide-react';
import { formatMinor, fromMinorUnits, toMinorUnits } from './money.js';
import { labelFor, useReferenceData } from './referenceData.js';
import { useCan } from './capabilities.js';
import { LeadBadges } from './LeadDestinations.jsx';
import { CoverageEditor } from './CoverageEditor.jsx';
import { HotelPropertiesManager } from './SellerSettings.jsx';
import { VerificationDocuments } from './SellerDocuments.jsx';

export function DmcOverview({ requests, offers, sellerProfile, loading, onOpenRequests, onOpenOffers, onRespond }) {
  const verified = sellerProfile?.verificationStatus === 'approved';
  return (
    <>
      <section className="metric-strip" aria-label="DMC workspace summary">
        <RoleMetric label="Matching requests" value={String(requests.length).padStart(2, '0')} note="Targeted to your coverage" icon={MapPin} />
        <RoleMetric label="Offers submitted" value={String(offers.length).padStart(2, '0')} note="Your active offers" icon={MessageSquareText} />
        <RoleMetric label="Verification" value={verified ? 'Approved' : 'Pending'} note="Required to submit offers" icon={Clock3} />
        <RoleMetric label="Eligible destinations" value={String(sellerProfile?.coverageDestinations?.length ?? 0).padStart(2, '0')} note="In your seller profile" icon={Star} />
      </section>
      <section className="surface-section role-overview-section">
        <div className="section-heading"><div><p className="eyebrow">DESTINATION INBOX</p><h2>Matching requests</h2></div><button className="text-button" onClick={onOpenRequests}>Open inbox <ChevronRight size={15} /></button></div>
        {loading ? <div className="empty-state">Loading matched requests...</div> : requests.length ? <SellerRequestList requests={requests.slice(0, 2)} onRespond={onRespond} role="dmc" sellerProfile={sellerProfile} /> : <div className="empty-state"><MapPin size={22} /><strong>No matched requests</strong><span>Requests will appear when verified coverage matches your profile.</span></div>}
      </section>
      <section className="market-note role-note"><div className="market-note-icon"><BadgeCheck size={19} /></div><div><strong>{verified ? 'Seller verification approved' : 'Seller verification pending'}</strong><span>{verified ? 'You can submit offers to requests sent to your organization.' : 'Offers stay disabled until an administrator verifies your business.'}</span></div><button className="text-button" onClick={onOpenOffers}>Review offers <ArrowUpRight size={15} /></button></section>
    </>
  );
}

export function DmcRequestWorkspace({ requests, sellerProfile, loading, onRespond, onMessage, onReport, onReconfirm, onRevise, onAnswerNegotiation }) {
  const verified = sellerProfile?.verificationStatus === 'approved';
  return (
    <section className="surface-section full-section role-inbox">
      <div className="section-heading request-list-heading"><div><p className="eyebrow">MATCHED TO YOUR COVERAGE</p><h2>Destination requests <span className="heading-count">{requests.length}</span></h2></div><span className={`status-pill ${verified ? 'open' : ''}`}><i />{verified ? 'Seller verified' : 'Verification pending'}</span></div>
      {loading ? <div className="empty-state">Loading matched requests...</div> : requests.length ? <SellerRequestList requests={requests} onRespond={onRespond} onMessage={onMessage} onReport={onReport} onReconfirm={onReconfirm} onRevise={onRevise} onAnswerNegotiation={onAnswerNegotiation} role="dmc" sellerProfile={sellerProfile} /> : <div className="empty-state"><MapPin size={22} /><strong>No matched requests</strong><span>Only requests targeted to your organization appear here.</span></div>}
      <p className="privacy-note"><BadgeCheck size={15} />Only your own offers and rank are visible. Client contact details are not shared.</p>
    </section>
  );
}

export function DmcOffers({ offers, loading }) {
  return (
    <section className="surface-section full-section role-inbox">
      <div className="section-heading request-list-heading"><div><p className="eyebrow">YOUR SUBMISSIONS</p><h2>My offers <span className="heading-count">{offers.length}</span></h2></div><span className="match-filter"><Clock3 size={14} />Your organization only</span></div>
      {loading ? <div className="empty-state">Loading your offers...</div> : offers.length ? <div className="role-table-wrap"><table className="role-table"><thead><tr><th>REQUEST</th><th>DESTINATION</th><th>YOUR PRICE</th><th>STATUS</th><th>RANK</th></tr></thead><tbody>
        {offers.map((offer) => <tr key={offer.id}><td><strong>{offer.requestCode}</strong><small>{new Date(offer.createdAt).toLocaleDateString()}</small></td><td>{offer.destination}</td><td><strong>{formatMinor(offer.totalMinor, offer.currency)}</strong><small>Valid through {new Date(offer.validityUntil).toLocaleDateString()}</small></td><td><span className={`status-pill ${offer.status === 'accepted' ? 'awarded' : 'open'}`}><i />{offer.status}</span>{offer.needsReconfirmation && <span className="status-pill draft"><i />Re-confirm needed</span>}{offer.outcomeReason && <small className="outcome-reason">Reason: {offer.outcomeReason}</small>}</td><td><span className="rank-value">{offer.rank} <small>of {offer.eligibleCount}</small></span></td></tr>)}
      </tbody></table></div> : <div className="empty-state"><MessageSquareText size={22} /><strong>No offers submitted</strong><span>Offers you submit to matched requests appear here.</span></div>}
      <p className="privacy-note"><UsersRound size={15} />Rank shows your position and eligible-offer count only. Competitor prices are never shown.</p>
    </section>
  );
}

export function HotelOverview({ requests, offers, sellerProfile, loading, onOpenRequests, onOpenAvailability, onRespond }) {
  const verified = sellerProfile?.verificationStatus === 'approved';
  return (
    <>
      <section className="metric-strip" aria-label="Hotel workspace summary">
        <RoleMetric label="Room requests" value={String(requests.length).padStart(2, '0')} note="Matched to your property" icon={BedDouble} />
        <RoleMetric label="Room quotes" value={String(offers.length).padStart(2, '0')} note="Submitted by your property" icon={MessageSquareText} />
        <RoleMetric label="Property city" value={sellerProfile?.propertyCity ?? '-'} note="From your seller profile" icon={MapPin} />
        <RoleMetric label="Verification" value={verified ? 'Approved' : 'Pending'} note="Required to quote rooms" icon={BadgeCheck} />
      </section>
      <section className="surface-section role-overview-section">
        <div className="section-heading"><div><p className="eyebrow">AGENCY ROOM REQUESTS</p><h2>Matched to your property</h2></div><button className="text-button" onClick={onOpenRequests}>All requests <ChevronRight size={15} /></button></div>
        {loading ? <div className="empty-state">Loading room requests...</div> : requests.length ? <HotelRequestList requests={requests.slice(0, 2)} onRespond={onRespond} sellerProfile={sellerProfile} /> : <div className="empty-state"><BedDouble size={22} /><strong>No matched room requests</strong><span>Requests for hotel services in {sellerProfile?.propertyCity ?? 'your city'} appear here.</span></div>}
      </section>
      <section className="market-note role-note"><div className="market-note-icon"><CalendarDays size={19} /></div><div><strong>{verified ? 'Hotel profile approved' : 'Hotel verification pending'}</strong><span>Room offers are enabled after operations reviews your property.</span></div><button className="text-button" onClick={onOpenAvailability}>Manage availability <ArrowUpRight size={15} /></button></section>
    </>
  );
}

export function HotelRequestWorkspace({ requests, sellerProfile, loading, onRespond, onMessage, onReport, onReconfirm, onRevise, onAnswerNegotiation }) {
  const verified = sellerProfile?.verificationStatus === 'approved';
  return (
    <section className="surface-section full-section role-inbox">
      <div className="section-heading request-list-heading"><div><p className="eyebrow">ROOMS AND AVAILABILITY</p><h2>Booking requests <span className="heading-count">{requests.length}</span></h2></div><span className="match-filter"><MapPin size={14} />{sellerProfile?.propertyCity ?? 'Property city pending'}</span></div>
      {loading ? <div className="empty-state">Loading room requests...</div> : requests.length ? <HotelRequestList requests={requests} onRespond={onRespond} onMessage={onMessage} onReport={onReport} onReconfirm={onReconfirm} onRevise={onRevise} onAnswerNegotiation={onAnswerNegotiation} sellerProfile={sellerProfile} /> : <div className="empty-state"><BedDouble size={22} /><strong>No matched room requests</strong><span>Only requests for hotel services in your property city will appear here.</span></div>}
      <p className="privacy-note"><BadgeCheck size={15} />Guest names and direct contact details remain private to the travel agency. {verified ? 'Verified hotel can submit a room quote.' : 'Verification is required before quoting.'}</p>
    </section>
  );
}

export function HotelAvailability({ inventory, loading, onSave }) {
  const { data: reference } = useReferenceData();
  const canManageProfile = useCan('profile.manage');
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setRows(inventory.map((item) => ({
      date: item.date,
      roomType: item.roomType,
      availableRooms: String(item.availableRooms),
      nightlyRate: item.nightlyRateMinor == null ? '' : String(fromMinorUnits(item.nightlyRateMinor, item.currency)),
      currency: item.currency,
    })));
  }, [inventory]);

  function addRow() {
    setRows((current) => [...current, { date: new Date().toISOString().slice(0, 10), roomType: '', availableRooms: '1', nightlyRate: '', currency: current.at(-1)?.currency ?? reference?.defaults.currency ?? '' }]);
  }

  async function saveRows() {
    setSaving(true);
    const payload = rows.map((row) => ({
      date: row.date,
      room_type: row.roomType.trim(),
      available_rooms: Number(row.availableRooms),
      nightly_rate_minor: row.nightlyRate === '' ? null : toMinorUnits(row.nightlyRate, row.currency),
      currency: row.currency,
    }));
    await onSave(payload);
    setSaving(false);
  }

  function updateRow(index, field, value) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  return (
    <section className="surface-section full-section role-inbox">
      <div className="section-heading request-list-heading"><div><p className="eyebrow">ROOM INVENTORY</p><h2>Availability by date</h2></div><div className="inventory-actions"><button className="secondary-button" onClick={addRow}>Add date</button><button className="primary-button availability-save" disabled={saving || !rows.length || !canManageProfile} title={canManageProfile ? undefined : 'Only owners and managers can change inventory.'} onClick={saveRows}><Check size={15} />{saving ? 'Saving...' : 'Save inventory'}</button></div></div>
      {loading ? <div className="empty-state">Loading room inventory...</div> : rows.length ? <div className="availability-scroll"><table className="availability-table"><thead><tr><th>DATE</th><th>ROOM TYPE</th><th>ROOMS AVAILABLE</th><th>NIGHTLY RATE</th><th>CURRENCY</th><th><span className="visually-hidden">Remove row</span></th></tr></thead><tbody>
        {rows.map((row, index) => <tr key={`${row.date}-${row.roomType}-${index}`}><td><input aria-label={`Inventory date ${index + 1}`} type="date" value={row.date} onChange={(event) => updateRow(index, 'date', event.target.value)} required /></td><td><input aria-label={`Room type ${index + 1}`} className="inventory-room-type" value={row.roomType} onChange={(event) => updateRow(index, 'roomType', event.target.value)} placeholder="e.g. Deluxe Twin" maxLength="120" required /></td><td><input aria-label={`Available rooms ${index + 1}`} type="number" min="0" max="100" value={row.availableRooms} onChange={(event) => updateRow(index, 'availableRooms', event.target.value)} required /></td><td><input aria-label={`Nightly rate ${index + 1}`} type="number" min="0" step="0.01" value={row.nightlyRate} onChange={(event) => updateRow(index, 'nightlyRate', event.target.value)} placeholder="Optional" /></td><td><select aria-label={`Inventory currency ${index + 1}`} value={row.currency} onChange={(event) => updateRow(index, 'currency', event.target.value)}>{(reference?.currencies ?? [row.currency]).map((code) => <option key={code} value={code}>{code}</option>)}</select></td><td><button className="icon-button" aria-label={`Remove inventory row ${index + 1}`} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}><X size={16} /></button></td></tr>)}
      </tbody></table></div> : <div className="empty-state"><CalendarDays size={22} /><strong>No inventory dates set</strong><span>Add a date and room type to begin tracking availability.</span></div>}
      <p className="privacy-note"><CalendarDays size={15} />Inventory is private to your hotel organization. Set rooms available to zero to stop-sell a date.</p>
    </section>
  );
}

export function RoleProfile({ role, profile, organization, onSave, onDocumentsChanged }) {
  const isDmc = role === 'dmc';
  const canManageProfile = useCan('profile.manage');
  const { data: reference } = useReferenceData();
  const [coverage, setCoverage] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCoverage((profile?.coverage ?? []).map((destination) => ({ destination, mode: destination.mode ?? 'include' })));
  }, [profile]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    await onSave({ coverage: coverage.map((rule) => ({ destination_id: rule.destination.id, mode: rule.mode })) });
    setSaving(false);
  }

  return (
    <section className="surface-section full-section role-profile">
      <div className="section-heading request-list-heading"><div><p className="eyebrow">SELLER PROFILE</p><h2>{organization}</h2></div><span className={`status-pill ${profile?.verificationStatus === 'approved' ? 'open' : ''}`}><i />{profile?.verificationStatus ?? 'Loading'}</span></div>
      <div className="profile-detail-grid"><div><span>Destination coverage</span><strong>{isDmc ? profile?.coverageDestinations?.join(', ') || 'No destinations listed' : profile?.propertyCity || 'No property city listed'}</strong></div><div><span>Business type</span><strong>{isDmc ? 'Destination management company' : 'Hotelier'}</strong></div><div><span>Business verification</span><strong>{profile?.verificationStatus === 'approved' ? 'Approved' : 'Pending manual review'}</strong></div><div><span>Verification note</span><strong>{profile?.verificationReason || 'No review note available'}</strong></div></div>
      {isDmc ? <form className="seller-profile-form" onSubmit={submit}>
        <CoverageEditor rules={coverage} onChange={setCoverage} max={reference?.limits?.maxCoverageDestinations ?? 1} />
        <button className="primary-button" type="submit" disabled={saving || !profile || !canManageProfile || !coverage.some((rule) => rule.mode === 'include')} title={canManageProfile ? undefined : 'Only owners and managers can change the company profile.'}>{saving ? 'Saving...' : 'Save coverage'}</button>
      </form> : <HotelPropertiesManager />}
      {isDmc && <p className="privacy-note"><BadgeCheck size={15} />Changing your coverage withdraws active offers and requires a new manual verification review.</p>}
      <VerificationDocuments onUploaded={onDocumentsChanged} />
    </section>
  );
}

function RoleMetric({ label, value, note, icon: Icon }) {
  return <div className="metric"><div className="metric-top"><span>{label}</span><Icon size={17} className="metric-icon teal" strokeWidth={1.8} /></div><strong>{value}</strong><small>{note}</small></div>;
}

function sellerActionState(request, canSubmitOffer, canWriteOffers, readyLabel) {
  if (request.status === 'awarded') return { label: 'Awarded', disabled: true };
  if (request.status === 'closed') return { label: 'Under agency review', disabled: true };
  if (request.needsReconfirmation) return { label: 'Re-confirm needed', disabled: true, title: 'Open the request inbox to re-confirm or revise your offer.' };
  if (request.hasActiveOffer) return { label: 'Offer submitted', disabled: true };
  if (request.offerLimitReached) return { label: 'Offer limit reached', disabled: true, title: `This request already has ${request.offerLimit} offers.` };
  if (!canSubmitOffer) return { label: 'Verification pending', disabled: true, title: 'Complete seller verification before bidding.' };
  if (!canWriteOffers) return { label: 'View only', disabled: true, title: 'Your team role cannot submit offers.' };
  return { label: readyLabel, disabled: false };
}

function TripChangeNotice({ request }) {
  if (!request.tripChange) return null;
  const { previous, changedAt, note } = request.tripChange;
  return <p className="trip-change-note"><CalendarDays size={13} />Trip details changed {new Date(changedAt).toLocaleDateString()}. Previously {previous.dates} / {previous.travelers}{previous.roomCount ? ` / ${previous.roomCount} rooms` : ''}.{note ? ` Agency note: ${note}` : ''}</p>;
}

// Revising the offer answers either kind; accepting applies the counter price as-is.
function NegotiationNotice({ request, onAnswer, onRevise, canWriteOffers }) {
  const { data: reference } = useReferenceData();
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const negotiation = request.openNegotiation;
  if (!negotiation || !onAnswer) return null;
  const counter = negotiation.kind === 'counter_offer';
  const price = counter ? `${formatMinor(negotiation.counterPriceMinor, negotiation.currency)}${negotiation.offerKind === 'hotel_room' ? ' / room / night' : ''}` : null;
  const title = canWriteOffers ? undefined : 'Your team role cannot change offers.';

  async function answer(accept) {
    setBusy(true);
    setError('');
    const failure = await onAnswer(negotiation, accept, note.trim());
    setBusy(false);
    if (failure) setError(failure);
  }

  return (
    <div className="negotiation-notice">
      <p><strong>{labelFor(reference?.negotiationKinds, negotiation.kind)}</strong>{negotiation.optionLabel ? ` for ${negotiation.optionLabel}` : ''}{price ? `: ${price}` : ''}{negotiation.message ? `. Agency note: ${negotiation.message}` : ''}</p>
      {declining ? <>
        <textarea className="form-input" aria-label="Reason for declining" value={note} onChange={(event) => setNote(event.target.value)} maxLength="1000" placeholder="Tell the agency why" />
        <div className="modal-actions"><button className="secondary-button" disabled={busy} onClick={() => setDeclining(false)}>Back</button><button className="primary-button" disabled={busy || note.trim().length < 5} onClick={() => answer(false)}>Send decline</button></div>
      </> : <div className="modal-actions">
        {counter && <button className="primary-button" disabled={busy || !canWriteOffers} title={title} onClick={() => answer(true)}><Check size={14} />Accept counter price</button>}
        <button className="secondary-button" disabled={!canWriteOffers} title={title} onClick={() => onRevise(request)}>Revise offer</button>
        <button className="text-button" disabled={!canWriteOffers} title={title} onClick={() => setDeclining(true)}>Decline</button>
      </div>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  );
}

function ReconfirmActions({ request, onReconfirm, onRevise, canWriteOffers }) {
  const [busy, setBusy] = useState(false);
  const title = canWriteOffers ? undefined : 'Your team role cannot change offers.';
  async function reconfirm() {
    setBusy(true);
    await onReconfirm(request);
    setBusy(false);
  }
  return <>
    <button className="secondary-button" disabled={busy || !canWriteOffers} title={title} onClick={reconfirm}><Check size={14} />{busy ? 'Confirming...' : 'Re-confirm price'}</button>
    <button className="primary-button" disabled={!canWriteOffers} title={title} onClick={() => onRevise(request)}>Revise offer<ArrowUpRight size={14} /></button>
  </>;
}

function SellerRequestAction({ request, action, onRespond, onReconfirm, onRevise, canWriteOffers }) {
  if (request.needsReconfirmation && request.status === 'open' && onReconfirm && onRevise) return <ReconfirmActions request={request} onReconfirm={onReconfirm} onRevise={onRevise} canWriteOffers={canWriteOffers} />;
  return <button className="secondary-button" disabled={action.disabled} title={action.title} onClick={() => onRespond(request)}>{action.label}<ArrowUpRight size={14} /></button>;
}

function SellerRequestList({ requests, onRespond, onMessage, onReport, onReconfirm, onRevise, onAnswerNegotiation, role, sellerProfile }) {
  const { data: reference } = useReferenceData();
  const canWriteOffers = useCan('offer.write');
  const canSubmitOffer = role !== 'dmc' || sellerProfile?.verificationStatus === 'approved';
  return <div className="seller-request-list">{requests.map((request) => { const action = sellerActionState(request, canSubmitOffer, canWriteOffers, 'Prepare offer'); return <article className="seller-request-row" key={request.id}>
    <div className="seller-request-main"><div className="seller-request-title"><h3>{request.destination}</h3><span className="request-id">{request.requestCode}</span>{request.agencyVerified && <span className="verified-mark" title="Verified agency"><BadgeCheck size={14} /></span>}</div><span className="request-agency"><Building2 size={13} />{request.agencyName}{request.agencyVerified && <BadgeCheck size={13} />}</span><div className="request-detail-line"><span><CalendarDays size={14} />{request.dates}</span><span><UsersRound size={14} />{request.travelers}</span></div><p>{request.services?.map((service) => labelFor(reference?.services, service)).join(', ')}</p><LeadBadges request={request} /><TripChangeNotice request={request} /><NegotiationNotice request={request} onAnswer={onAnswerNegotiation} onRevise={onRevise} canWriteOffers={canWriteOffers} /></div>
    <div className="seller-request-side"><span className="request-deadline"><Clock3 size={13} />Respond by {request.deadline}</span><div className="seller-request-actions">{onReport && <button className="text-button report-link" onClick={() => onReport(request)}><Flag size={13} />Report</button>}{onMessage && <button className="secondary-button" onClick={() => onMessage(request)}><MessageSquareText size={14} />Message</button>}<SellerRequestAction request={request} action={action} onRespond={onRespond} onReconfirm={onReconfirm} onRevise={onRevise} canWriteOffers={canWriteOffers} /></div></div>
  </article>; })}</div>;
}


function HotelRequestList({ requests, onRespond, onMessage, onReport, onReconfirm, onRevise, onAnswerNegotiation, sellerProfile }) {
  const { data: reference } = useReferenceData();
  const canWriteOffers = useCan('offer.write');
  const canSubmitOffer = sellerProfile?.verificationStatus === 'approved';
  return <div className="seller-request-list">{requests.map((request) => { const action = sellerActionState(request, canSubmitOffer, canWriteOffers, 'Quote rooms'); return <article className="seller-request-row" key={request.id}>
    <div className="seller-request-main"><div className="seller-request-title"><h3>{request.destination}</h3><span className="request-id">{request.requestCode}</span>{request.agencyVerified && <span className="verified-mark" title="Verified agency"><BadgeCheck size={14} /></span>}</div><span className="request-agency"><Building2 size={13} />{request.agencyName}{request.agencyVerified && <BadgeCheck size={13} />}</span><div className="request-detail-line"><span><CalendarDays size={14} />{request.dates}</span><span><BedDouble size={14} />{request.roomCount ?? 1} rooms / {request.nights} nights</span></div><p>{request.mealPlan ? labelFor(reference?.mealPlans, request.mealPlan) : 'Meal plan flexible'} / {request.hotelCategory ? labelFor(reference?.hotelCategories, request.hotelCategory) : 'Any category'}</p><LeadBadges request={request} /><TripChangeNotice request={request} /><NegotiationNotice request={request} onAnswer={onAnswerNegotiation} onRevise={onRevise} canWriteOffers={canWriteOffers} /></div>
    <div className="seller-request-side"><span className="request-deadline"><Clock3 size={13} />Respond by {request.deadline}</span><div className="seller-request-actions">{onReport && <button className="text-button report-link" onClick={() => onReport(request)}><Flag size={13} />Report</button>}{onMessage && <button className="secondary-button" onClick={() => onMessage(request)}><MessageSquareText size={14} />Message</button>}<SellerRequestAction request={request} action={action} onRespond={onRespond} onReconfirm={onReconfirm} onRevise={onRevise} canWriteOffers={canWriteOffers} /></div></div>
  </article>; })}</div>;
}