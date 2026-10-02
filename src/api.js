let csrfToken = '';

async function request(path, options = {}, csrfRequired = false, csrfPath = '/v1/auth/csrf') {
  if (csrfRequired && !csrfToken) {
    const session = await request(csrfPath);
    csrfToken = session.csrfToken;
  }

  const headers = {
    ...(options.body ? { 'content-type': 'application/json' } : {}),
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

export function awardMarketplaceOffer(requestId, offerId, notSelectedReason = '') {
  return request(`/v1/marketplace/requests/${requestId}/award`, {
    method: 'POST',
    body: JSON.stringify({ offer_id: offerId, ...(notSelectedReason.trim() ? { not_selected_reason: notSelectedReason.trim() } : {}) }),
  }, true);
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

export function updateMaxOffersPerRequest(value) {
  return request('/v1/admin/settings/max-offers-per-request', { method: 'PUT', body: JSON.stringify({ value }) }, true);
}

export function closeMarketplaceRequest(requestId) {
  return request(`/v1/marketplace/requests/${requestId}/close`, { method: 'POST', body: JSON.stringify({}) }, true);
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