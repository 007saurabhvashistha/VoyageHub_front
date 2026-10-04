let csrfToken = '';

async function request(path, options = {}, csrfRequired = false, csrfPath = '/v1/auth/csrf') {
  if (csrfRequired && !csrfToken) {
    const session = await request(csrfPath);
    csrfToken = session.csrfToken;
  }

  const headers = {
    ...(typeof options.body === 'string' ? { 'content-type': 'application/json' } : {}),
    ...options.headers,
  };
  if (csrfRequired) headers['x-csrf-token'] = csrfToken;
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error?.message ?? 'The request could not be completed.');
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  if (body?.csrfToken) csrfToken = body.csrfToken;
  return body;
}

export function registerAccount(account) {
  return request('/v1/auth/register', { method: 'POST', body: JSON.stringify(account) });
}

export function loginAccount(credentials) {
  return request('/v1/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
}

export function requestEmailVerification(email) {
  return request('/v1/auth/verify-email/request', { method: 'POST', body: JSON.stringify({ email }) });
}

export function verifyEmailToken(token) {
  return request('/v1/auth/verify-email/confirm', { method: 'POST', body: JSON.stringify({ token }) });
}

export function requestPasswordReset(email) {
  return request('/v1/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) });
}

export function completePasswordReset(token, password) {
  return request('/v1/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ token, password }) });
}

export function verifyMfaChallenge(code) {
  return request('/v1/auth/mfa/challenge', { method: 'POST', body: JSON.stringify({ code }) }, true, '/v1/auth/mfa/challenge/csrf');
}

export function getMfaStatus() {
  return request('/v1/auth/mfa/status');
}

export function startMfaEnrollment() {
  return request('/v1/auth/mfa/enrollment/start', { method: 'POST', body: JSON.stringify({}) }, true);
}

export function confirmMfaEnrollment(code) {
  return request('/v1/auth/mfa/enrollment/confirm', { method: 'POST', body: JSON.stringify({ code }) }, true);
}

export function rotateMfaRecoveryCodes(code) {
  return request('/v1/auth/mfa/recovery-codes/rotate', { method: 'POST', body: JSON.stringify({ code }) }, true);
}

export function disableMfa(code) {
  return request('/v1/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ code }) }, true);
}

export function getCurrentSession() {
  return request('/v1/auth/me');
}

export async function logoutAccount() {
  await request('/v1/auth/logout', { method: 'POST' }, true);
  csrfToken = '';
}

export function listMarketplaceRequests() {
  return request('/v1/marketplace/requests');
}

export function createMarketplaceRequest(fields) {
  return request('/v1/marketplace/requests', { method: 'POST', body: JSON.stringify(fields) }, true);
}

export function getMarketplaceRequest(requestId) {
  return request(`/v1/marketplace/requests/${requestId}`);
}

export function publishMarketplaceRequest(requestId) {
  return request(`/v1/marketplace/requests/${requestId}/publish`, { method: 'POST', body: JSON.stringify({}) }, true);
}

export function listMarketplaceOffers() {
  return request('/v1/marketplace/offers');
}

export function listRequestOffers(requestId) {
  return request(`/v1/marketplace/requests/${requestId}/offers`);
}

export function submitDmcOffer(requestId, offer) {
  return request(`/v1/marketplace/requests/${requestId}/offers`, { method: 'POST', body: JSON.stringify(offer) }, true);
}

export function submitHotelOffer(requestId, offer) {
  return request(`/v1/marketplace/requests/${requestId}/offers`, { method: 'POST', body: JSON.stringify(offer) }, true);
}

export function awardMarketplaceOffer(requestId, selections, notSelectedReason = '') {
  return request(`/v1/marketplace/requests/${requestId}/award`, {
    method: 'POST',
    body: JSON.stringify({
      selections: selections.map((selection) => ({ offer_id: selection.offerId, offer_option_id: selection.optionId ?? null })),
      ...(notSelectedReason.trim() ? { not_selected_reason: notSelectedReason.trim() } : {}),
    }),
  }, true);
}

export function undoMarketplaceAward(requestId, reason = '') {
  return request(`/v1/marketplace/requests/${requestId}/award/undo`, { method: 'POST', body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}) }, true);
}

export function createOfferNegotiation(offerId, negotiation) {
  return request(`/v1/marketplace/offers/${offerId}/negotiations`, { method: 'POST', body: JSON.stringify(negotiation) }, true);
}

export function withdrawOfferNegotiation(negotiationId) {
  return request(`/v1/marketplace/negotiations/${negotiationId}/withdraw`, { method: 'POST', body: JSON.stringify({}) }, true);
}

export function acceptOfferNegotiation(negotiationId) {
  return request(`/v1/marketplace/negotiations/${negotiationId}/accept`, { method: 'POST', body: JSON.stringify({}) }, true);
}

export function declineOfferNegotiation(negotiationId, note) {
  return request(`/v1/marketplace/negotiations/${negotiationId}/decline`, { method: 'POST', body: JSON.stringify({ note }) }, true);
}

export function uploadOfferAttachment(offerId, file) {
  const body = new FormData();
  body.append('file', file);
  return request(`/v1/attachments/offers/${offerId}`, { method: 'POST', body }, true);
}

export function removeAttachment(attachmentId) {
  return request(`/v1/attachments/${attachmentId}`, { method: 'DELETE' }, true);
}

export function sendMessageAttachment(requestId, file, { body = '', sellerOrganizationId = '' } = {}) {
  const form = new FormData();
  if (sellerOrganizationId) form.append('seller_organization_id', sellerOrganizationId);
  if (body.trim()) form.append('body', body.trim());
  form.append('file', file);
  return request(`/v1/attachments/requests/${requestId}/messages`, { method: 'POST', body: form }, true);
}

export function createAttachmentDownloadUrl(attachmentId) {
  return request(`/v1/attachments/${attachmentId}/download-url`, { method: 'POST', body: JSON.stringify({}) }, true);
}

export function getSellerProfile() {
  return request('/v1/marketplace/seller-profile');
}

export function updateSellerProfile(profile) {
  return request('/v1/auth/profile', { method: 'PUT', body: JSON.stringify(profile) }, true);
}

export function listMarketplaceSuppliers({ search = '', country = '', limit = 25, offset = 0 } = {}) {
  const query = new URLSearchParams({ search, country, limit: String(limit), offset: String(offset) });
  return request(`/v1/marketplace/suppliers?${query}`);
}

export function getRequestMessages(requestId, { sellerOrganizationId = '', limit = 100, offset = 0 } = {}) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (sellerOrganizationId) query.set('seller_organization_id', sellerOrganizationId);
  return request(`/v1/marketplace/requests/${requestId}/messages?${query}`);
}

export function sendRequestMessage(requestId, body, sellerOrganizationId = '') {
  return request(`/v1/marketplace/requests/${requestId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body, ...(sellerOrganizationId ? { seller_organization_id: sellerOrganizationId } : {}) }),
  }, true);
}

export function listHotelInventory(from, to) {
  const query = new URLSearchParams({ from, to });
  return request(`/v1/marketplace/hotel/inventory?${query}`);
}

export function saveHotelInventory(inventory) {
  return request('/v1/marketplace/hotel/inventory', { method: 'PUT', body: JSON.stringify({ inventory }) }, true);
}

export function listNotifications() {
  return request('/v1/notifications');
}

export function markNotificationRead(notificationId) {
  return request(`/v1/notifications/${notificationId}/read`, { method: 'POST', body: JSON.stringify({}) }, true);
}

export function markAllNotificationsRead() {
  return request('/v1/notifications/read-all', { method: 'POST', body: JSON.stringify({}) }, true);
}

export function listPendingSellerProfiles() {
  return request('/v1/admin/seller-profiles/pending');
}

export function decideSellerVerification(organizationId, decision, reason) {
  return request(`/v1/admin/seller-profiles/${organizationId}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, reason }),
  }, true);
}

export function getVerificationDocuments() {
  return request('/v1/verification-documents');
}

export function uploadVerificationDocument(documentType, file) {
  const body = new FormData();
  body.append('document_type', documentType);
  body.append('file', file);
  return request('/v1/verification-documents', { method: 'POST', body }, true);
}

export function submitAgencyVerification() {
  return request('/v1/verification-documents/submit', { method: 'POST', body: JSON.stringify({}) }, true);
}

export function getAdminOrganizationDocuments(organizationId) {
  return request(`/v1/admin/organizations/${organizationId}/documents`);
}

export function listPendingAgencyVerifications() {
  return request('/v1/admin/agency-verifications/pending');
}

export function decideAgencyVerification(organizationId, decision, reason) {
  return request(`/v1/admin/agency-verifications/${organizationId}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, reason }),
  }, true);
}

export function createDocumentDownloadUrl(documentId) {
  return request(`/v1/admin/documents/${documentId}/download-url`, { method: 'POST', body: JSON.stringify({}) }, true);
}

export function getNotificationOutbox(status = '') {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/v1/admin/notification-outbox${query}`);
}

export function retryNotificationOutbox(outboxId) {
  return request(`/v1/admin/notification-outbox/${outboxId}/retry`, { method: 'POST', body: JSON.stringify({}) }, true);
}

export function getPlatformSettings() {
  return request('/v1/admin/settings');
}

export function getReferenceData() {
  return request('/v1/reference-data');
}

export function listTeamMembers() {
  return request('/v1/organization/members');
}

export function listTeamInvitations() {
  return request('/v1/organization/invitations');
}

export function inviteTeamMember(email, role) {
  return request('/v1/organization/invitations', { method: 'POST', body: JSON.stringify({ email, role }) }, true);
}

export function revokeTeamInvitation(invitationId) {
  return request(`/v1/organization/invitations/${invitationId}`, { method: 'DELETE' }, true);
}

export function updateTeamMemberRole(userId, role) {
  return request(`/v1/organization/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }, true);
}

export function removeTeamMember(userId) {
  return request(`/v1/organization/members/${userId}`, { method: 'DELETE' }, true);
}

export function listTeamAuditEvents() {
  return request('/v1/organization/audit-events');
}

export function previewInvitation(token) {
  return request(`/v1/auth/invitations/preview?${new URLSearchParams({ token })}`);
}

export function acceptInvitation(token, fullName, password, acceptedLegalDocumentIds = []) {
  return request('/v1/auth/invitations/accept', { method: 'POST', body: JSON.stringify({ token, full_name: fullName, password, accepted_legal_document_ids: acceptedLegalDocumentIds }) });
}

export function createReport(targetType, targetId, category, details) {
  return request('/v1/marketplace/reports', { method: 'POST', body: JSON.stringify({ target_type: targetType, target_id: targetId, category, details }) }, true);
}

export function listAdminReports(status = 'open') {
  return request(`/v1/admin/reports?${new URLSearchParams({ status })}`);
}

export function resolveAdminReport(reportId, decision, note) {
  return request(`/v1/admin/reports/${reportId}/resolve`, { method: 'POST', body: JSON.stringify({ decision, note }) }, true);
}

export function listAdminOrganizations(search = '') {
  return request(`/v1/admin/organizations?${new URLSearchParams({ search })}`);
}

export function suspendOrganization(organizationId, reason) {
  return request(`/v1/admin/organizations/${organizationId}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }, true);
}

export function reinstateOrganization(organizationId, reason) {
  return request(`/v1/admin/organizations/${organizationId}/reinstate`, { method: 'POST', body: JSON.stringify({ reason }) }, true);
}

export function updatePlatformSetting(key, value) {
  return request(`/v1/admin/settings/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ value }) }, true);
}

export function searchDestinations(query, { kinds = [], country = '' } = {}) {
  const params = new URLSearchParams({ q: query });
  if (kinds.length) params.set('kinds', kinds.join(','));
  if (country) params.set('country', country);
  return request(`/v1/reference-data/destinations?${params}`);
}

export function listAdminDestinations({ q = '', country = '', kind = '' } = {}) {
  const params = new URLSearchParams({ q });
  if (country) params.set('country', country);
  if (kind) params.set('kind', kind);
  return request(`/v1/admin/destinations?${params}`);
}

export function createAdminDestination(destination) {
  return request('/v1/admin/destinations', { method: 'POST', body: JSON.stringify(destination) }, true);
}

export function updateAdminDestination(destinationId, changes) {
  return request(`/v1/admin/destinations/${destinationId}`, { method: 'PATCH', body: JSON.stringify(changes) }, true);
}

export function listLegalDocuments() {
  return request('/v1/legal/documents');
}

export function getLegalDocument(type) {
  return request(`/v1/legal/documents/${encodeURIComponent(type)}`);
}

export function acceptLegalDocuments(documentIds) {
  return request('/v1/legal/acceptances', { method: 'POST', body: JSON.stringify({ document_ids: documentIds }) }, true);
}

export function listAdminLegalDocuments() {
  return request('/v1/admin/legal/documents');
}

export function publishLegalDocument(document) {
  return request('/v1/admin/legal/documents', { method: 'POST', body: JSON.stringify(document) }, true);
}

export function exportAccountData() {
  return request('/v1/account/export');
}

export async function requestAccountDeletion(password) {
  const result = await request('/v1/account/deletion', { method: 'POST', body: JSON.stringify({ password }) }, true);
  csrfToken = '';
  return result;
}

export function cancelAccountDeletion() {
  return request('/v1/account/deletion/cancel', { method: 'POST', body: JSON.stringify({}) }, true);
}

export function closeMarketplaceRequest(requestId) {
  return request(`/v1/marketplace/requests/${requestId}/close`, { method: 'POST', body: JSON.stringify({}) }, true);
}

export function changeRequestTrip(requestId, trip) {
  return request(`/v1/marketplace/requests/${requestId}/trip`, { method: 'PATCH', body: JSON.stringify(trip) }, true);
}

export function reconfirmMarketplaceOffer(offerId, tripVersion) {
  return request(`/v1/marketplace/offers/${offerId}/reconfirm`, { method: 'POST', body: JSON.stringify({ trip_version: tripVersion }) }, true);
}

export function declineMarketplaceRequest(requestId, reason) {
  return request(`/v1/marketplace/requests/${requestId}/decline`, { method: 'POST', body: JSON.stringify({ reason }) }, true);
}

export function getMarketplaceOffer(offerId) {
  return request(`/v1/marketplace/offers/${offerId}`);
}

export function getOfferRevisions(offerId) {
  return request(`/v1/marketplace/offers/${offerId}/revisions`);
}

export function reviseMarketplaceOffer(offerId, revision) {
  return request(`/v1/marketplace/offers/${offerId}`, { method: 'PUT', body: JSON.stringify(revision) }, true);
}

export function withdrawMarketplaceOffer(offerId) {
  return request(`/v1/marketplace/offers/${offerId}/withdraw`, { method: 'POST', body: JSON.stringify({}) }, true);
}

export function getMarketplaceAward(awardId) {
  return request(`/v1/marketplace/awards/${awardId}`);
}

export function listBookings() {
  return request('/v1/bookings');
}

export function getBooking(awardId) {
  return request(`/v1/bookings/${awardId}`);
}

export function requestBookingChange(awardId, change) {
  return request(`/v1/bookings/${awardId}/changes`, { method: 'POST', body: JSON.stringify(change) }, true);
}

export function answerBookingChange(awardId, changeId, action, note = '') {
  return request(`/v1/bookings/${awardId}/changes/${changeId}/${action}`, { method: 'POST', body: JSON.stringify(note.trim() ? { note: note.trim() } : {}) }, true);
}

export function withdrawBookingChange(awardId, changeId) {
  return request(`/v1/bookings/${awardId}/changes/${changeId}/withdraw`, { method: 'POST', body: JSON.stringify({}) }, true);
}

export function confirmBooking(awardId, guestDetails) {
  return request(`/v1/bookings/${awardId}/confirm`, { method: 'POST', body: JSON.stringify(guestDetails) }, true);
}

export function getGuestDetails(awardId) {
  return request(`/v1/bookings/${awardId}/guest-details`);
}

export function correctGuestDetails(awardId, guestDetails) {
  return request(`/v1/bookings/${awardId}/guest-details`, { method: 'PUT', body: JSON.stringify(guestDetails) }, true);
}

export function revokeGuestDetails(awardId, reason) {
  return request(`/v1/bookings/${awardId}/guest-details/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }, true);
}

export function restoreGuestDetails(awardId) {
  return request(`/v1/bookings/${awardId}/guest-details/restore`, { method: 'POST', body: JSON.stringify({}) }, true);
}

export function getGuestAccessLog(awardId) {
  return request(`/v1/bookings/${awardId}/guest-details/access-log`);
}

export function listWebhookEndpoints() {
  return request('/v1/webhooks/endpoints');
}

export function createWebhookEndpoint(endpoint) {
  return request('/v1/webhooks/endpoints', { method: 'POST', body: JSON.stringify(endpoint) }, true);
}

export function updateWebhookEndpoint(endpointId, changes) {
  return request(`/v1/webhooks/endpoints/${endpointId}`, { method: 'PATCH', body: JSON.stringify(changes) }, true);
}

export function deleteWebhookEndpoint(endpointId) {
  return request(`/v1/webhooks/endpoints/${endpointId}`, { method: 'DELETE' }, true);
}

export function rotateWebhookSecret(endpointId) {
  return request(`/v1/webhooks/endpoints/${endpointId}/rotate-secret`, { method: 'POST', body: JSON.stringify({}) }, true);
}

export function sendWebhookTest(endpointId) {
  return request(`/v1/webhooks/endpoints/${endpointId}/test`, { method: 'POST', body: JSON.stringify({}) }, true);
}

export function listWebhookDeliveries(endpointId) {
  return request(`/v1/webhooks/endpoints/${endpointId}/deliveries`);
}

export function retryWebhookDelivery(deliveryId) {
  return request(`/v1/webhooks/deliveries/${deliveryId}/retry`, { method: 'POST', body: JSON.stringify({}) }, true);
}

export function getOperationsStatus() {
  return request('/v1/admin/operations');
}

export function confirmBookingReference(awardId, confirmationNumber, note) {
  return request(`/v1/bookings/${awardId}/seller-confirmation`, { method: 'POST', body: JSON.stringify({ confirmation_number: confirmationNumber, note: note || null }) }, true);
}

export function uploadBookingVoucher(awardId, file) {
  const body = new FormData();
  body.append('file', file);
  return request(`/v1/bookings/${awardId}/vouchers`, { method: 'POST', body }, true);
}

export function createVoucherDownloadUrl(awardId, voucherId) {
  return request(`/v1/bookings/${awardId}/vouchers/${voucherId}/download-url`, { method: 'POST', body: JSON.stringify({}) }, true);
}