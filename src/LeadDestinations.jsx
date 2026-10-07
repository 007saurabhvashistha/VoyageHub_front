import { useEffect, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BedDouble, GripVertical, Map as MapIcon, Route, UsersRound, X } from 'lucide-react';
import { DestinationPicker } from './DestinationPicker.jsx';
import { previewLeadAudience } from './api.js';
import { labelFor, useReferenceData } from './referenceData.js';

const previewDelayMs = 400;

function SortableStop({ stop, index, onNights, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stop.destination.id });
  return (
    <li ref={setNodeRef} className="stop-row" style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button type="button" className="icon-button drag-handle" aria-label={`Move ${stop.destination.name}`} {...attributes} {...listeners}><GripVertical size={15} /></button>
      <span className="stop-index">{index + 1}</span>
      <span className="stop-name"><strong>{stop.destination.name}</strong><small>{stop.destination.label}</small></span>
      <label className="stop-nights">Nights<input className="form-input" type="number" min="1" max="90" value={stop.nights} onChange={(event) => onNights(event.target.value)} aria-label={`Nights in ${stop.destination.name}`} /></label>
      <button type="button" className="icon-button" aria-label={`Remove ${stop.destination.name}`} onClick={onRemove}><X size={15} /></button>
    </li>
  );
}

// Ordered itinerary stops with optional nights, reordered by drag or keyboard.
export function StopsEditor({ stops, onChange, max }) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const from = stops.findIndex((stop) => stop.destination.id === active.id);
    const to = stops.findIndex((stop) => stop.destination.id === over.id);
    onChange(arrayMove(stops, from, to));
  }
  return (
    <div className="stops-editor">
      {stops.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stops.map((stop) => stop.destination.id)} strategy={verticalListSortingStrategy}>
            <ol className="stop-list">
              {stops.map((stop, index) => (
                <SortableStop key={stop.destination.id} stop={stop} index={index}
                  onNights={(nights) => onChange(stops.map((item, itemIndex) => itemIndex === index ? { ...item, nights } : item))}
                  onRemove={() => onChange(stops.filter((_, itemIndex) => itemIndex !== index))} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
      {stops.length < max && <DestinationPicker label={stops.length ? 'Add another stop' : 'Destination'} value={[]} onChange={([destination]) => destination && !stops.some((stop) => stop.destination.id === destination.id) && onChange([...stops, { destination, nights: '' }])} placeholder="Search a state, district or place" />}
    </div>
  );
}

// "About N sellers will be alerted" before publishing; counts only, never names.
export function AudiencePreview({ requirementType, destinationIds, hotelCategory, facts = {} }) {
  const [preview, setPreview] = useState(null);
  const key = JSON.stringify([requirementType, destinationIds, hotelCategory, facts]);
  useEffect(() => {
    if (!requirementType || !destinationIds.length) {
      setPreview(null);
      return undefined;
    }
    let active = true;
    const timeout = window.setTimeout(() => {
      previewLeadAudience({
        requirement_type: requirementType,
        destinations: destinationIds.map((id) => ({ destination_id: id })),
        hotel_category: hotelCategory || null,
        ...facts,
      })
        .then((result) => active && setPreview(result))
        .catch(() => active && setPreview(null));
    }, previewDelayMs);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [key]);
  if (!preview) return null;
  const sellerWord = preview.audience === 'hotelier' ? 'hotel' : 'DMC';
  return (
    <p className="audience-preview" role="status">
      <UsersRound size={14} />
      About {preview.sellers} verified {sellerWord}{preview.sellers === 1 ? '' : 's'} will see this lead
      {preview.audience === 'hotelier' ? ` (${preview.properties} matching hotel${preview.properties === 1 ? '' : 's'})` : preview.partialMatches ? ` (${preview.fullMatches} cover every stop, ${preview.partialMatches} cover part of it)` : ''}.
    </p>
  );
}

export function routeText(destinations = []) {
  return destinations.map((stop) => stop.nights ? `${stop.name} ${stop.nights}N` : stop.name).join(' → ');
}

// Lead type, route and how this seller matched; shown on seller cards and agency views.
export function LeadBadges({ request }) {
  const { data: reference } = useReferenceData();
  const route = routeText(request.destinations);
  const TypeIcon = request.requirementType === 'hotel_only' ? BedDouble : MapIcon;
  return (
    <div className="lead-badges">
      {request.requirementType && <span className={`lead-badge type-${request.requirementType}`}><TypeIcon size={12} />{labelFor(reference?.requirementTypes, request.requirementType)}</span>}
      {request.destinations?.length > 1 && <span className="lead-badge"><Route size={12} />{route}</span>}
      {request.childAges?.length > 0 && <span className="lead-badge">Child ages: {request.childAges.join(', ')}</span>}
      {request.matchType && request.matchType !== 'full' && <span className={`lead-badge match-${request.matchType}`}>{labelFor(reference?.matchTypes, request.matchType)}</span>}
      {request.matchingProperties?.length > 0 && <span className="lead-badge"><BedDouble size={12} />{request.matchingProperties.map((property) => property.name).join(', ')}</span>}
      {request.specialRequests && <p className="lead-special-requests"><strong>Special requests:</strong> {request.specialRequests}</p>}
    </div>
  );
}
