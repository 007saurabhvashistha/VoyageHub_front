import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDownUp,
  ArrowUpRight,
  BarChart3,
  BadgeCheck,
  Bell,
  CalendarDays,
  Check,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  Copy,
  Building2,
  Clock3,
  FileText,
  FileUp,
  Flag,
  Globe2,
  LayoutDashboard,
  Hotel,
  LogOut,
  MapPin,
  MessageSquareText,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Star,
  UsersRound,
  UserCog,
  Webhook,
  X,
} from 'lucide-react';
import { addDays, addHours, differenceInCalendarDays, format, parseISO } from 'date-fns';
import AuthPage from './AuthPage.jsx';
import AuthActionPage from './AuthActionPage.jsx';
import AcceptInvitePage from './AcceptInvitePage.jsx';
import { TeamPanel } from './TeamPanel.jsx';
import { AttachmentList, OfferDetails, OfferFormModal } from './OfferForm.jsx';
import { ReportDialog } from './ReportDialog.jsx';
import { CapabilitiesContext, useCan } from './capabilities.js';
import { formatMinor, toMinorUnits } from './money.js';
import { labelFor, useReferenceData } from './referenceData.js';
import { MfaChallengePage, MfaSecurityPanel, MfaSetupPage } from './MfaSecurity.jsx';
import { CookieNotice, LegalAcceptanceGate, LegalLinks } from './Legal.jsx';
import { AccountPanel, DeletionPendingPage } from './AccountPanel.jsx';
import { DestinationPicker } from './DestinationPicker.jsx';
import { AudiencePreview, LeadBadges, StopsEditor, routeText } from './LeadDestinations.jsx';
import { AlertPreferencesPanel } from './SellerSettings.jsx';
import { BookingsWorkspace } from './Bookings.jsx';
import { NotificationSettings } from './NotificationSettings.jsx';
import { IntegrationsPanel } from './Integrations.jsx';
import { ReportsWorkspace } from './Reports.jsx';
import { SessionManagementPanel } from './Sessions.jsx';
import { VerificationDocuments } from './SellerDocuments.jsx';
import {
  acceptOfferNegotiation,
  awardMarketplaceOffer,
  cancelMarketplaceRequest,
  changeRequestTrip,
  createMarketplaceRequest,
  createOfferNegotiation,
  declineOfferNegotiation,
  extendMarketplaceRequestDeadline,
  getCurrentSession,
  getRequestMessages,
  listOrganizations,
  listHotelInventory,
  getSellerProfile,
  listMarketplaceOffers,
  listMarketplaceRequests,
  listMarketplaceSuppliers,
  listPreferredSuppliers,
  listNotifications,
  listRequestOffers,
  markAllNotificationsRead,
  markNotificationRead,
  logoutAccount,
  publishMarketplaceRequest,
  reconfirmMarketplaceOffer,
  repostRequest,
  reviseMarketplaceOffer,
  submitDmcOffer,
  submitHotelOffer,
  setPreferredSupplier,
  switchOrganization,
  searchDestinations,
  updateSellerProfile,
  updateSellerSettings,
  saveHotelInventory,
  sendRequestMessage,
  sendMessageAttachment,
  setMarketplaceOfferShortlisted,
  undoMarketplaceAward,
  uploadOfferAttachment,
  withdrawOfferNegotiation,
} from './api.js';
import {
  DmcOffers,
  DmcOverview,
  DmcRequestWorkspace,
  HotelAvailability,
  HotelOverview,
  HotelRequestWorkspace,
  RoleProfile,
} from './RoleWorkspaces.jsx';

// Markdown rendering is only needed on these screens, so they load on demand.
const AdminWorkspace = lazy(() => import('./AdminWorkspace.jsx'));
const LegalPage = lazy(() => import('./LegalPage.jsx'));
const loadingScreen = <main className="auth-wait">Loading...</main>;

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={loadingScreen}>
      <Routes>
        <Route path="/" element={<Navigate to="/register" replace />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/verify-email" element={<AuthActionPage mode="verify" />} />
        <Route path="/forgot-password" element={<AuthActionPage mode="forgot" />} />
        <Route path="/reset-password" element={<AuthActionPage mode="reset" />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/mfa-challenge" element={<MfaChallengePage />} />
        <Route path="/mfa-setup" element={<MfaSetupPage />} />
        <Route path="/workspace/:role/*" element={<WorkspaceRoute />} />
        <Route path="/legal/:type" element={<LegalPage />} />
        <Route path="*" element={<Navigate to="/register" replace />} />
      </Routes>
      </Suspense>
      <CookieNotice />
    </BrowserRouter>
  );
}

function WorkspaceRoute() {
  const { role } = useParams();
  const [gate, setGate] = useState({ status: 'checking' });
  const allowedRole = ['agency', 'dmc', 'hotelier', 'admin'].includes(role);

  useEffect(() => {
    let active = true;
    setGate({ status: 'checking' });
    getCurrentSession()
      .then((account) => active && setGate({ status: 'authenticated', account }))
      .catch((error) => active && setGate({ status: error.status === 401 ? 'signed_out' : 'unavailable', message: error.message }));
    return () => { active = false; };
  }, [role]);

  if (!allowedRole) return <Navigate to="/register" replace />;
  if (gate.status === 'checking') return <main className="auth-wait">Checking your account...</main>;
  if (gate.status === 'signed_out') return <Navigate to="/login" replace />;
  if (gate.status === 'unavailable') {
    return <main className="auth-wait"><section><h1>Account service unavailable</h1><p>{gate.message}</p><Link to="/login">Return to sign in</Link></section></main>;
  }
  if (gate.account.account?.deletionRequestedAt) {
    return <DeletionPendingPage account={gate.account} onCancelled={() => setGate({ status: 'authenticated', account: { ...gate.account, account: { ...gate.account.account, deletionRequestedAt: null, deletionScheduledFor: null, organizationClosureScheduledFor: null } } })} />;
  }
  if (gate.account.pendingLegalDocuments?.length) {
    return <LegalAcceptanceGate documents={gate.account.pendingLegalDocuments} onAccepted={(pending) => setGate({ status: 'authenticated', account: { ...gate.account, pendingLegalDocuments: pending } })} />;
  }
  if (gate.account.user.isPlatformAdmin && role !== 'admin') return <Navigate to="/workspace/admin/verification" replace />;
  if (role === 'admin') {
    if (!gate.account.user.isPlatformAdmin) return <Navigate to="/login" replace />;
    return gate.account.user.mfaEnabled ? <AdminWorkspace account={gate.account} /> : <Navigate to="/mfa-setup" replace />;
  }
  if (gate.account.organization.businessType !== role) return <Navigate to={`/workspace/${gate.account.organization.businessType}/overview`} replace />;

  return <Workspace role={role} account={gate.account} />;
}

const workspaceDetails = {
  agency: { roleLabel: 'Travel agency', title: 'Travel advisor', action: 'New request' },
  dmc: { roleLabel: 'Destination management company', title: 'DMC partner', action: 'Matching requests' },
  hotelier: { roleLabel: 'Hotelier', title: 'Property manager', action: 'Availability' },
};

function OrganizationSwitcher({ account }) {
  const [organizations, setOrganizations] = useState([account.organization]);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listOrganizations()
      .then((result) => active && setOrganizations(result.organizations))
      .catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [account.organization.id]);

  async function changeOrganization(event) {
    const organizationId = event.target.value;
    if (!organizationId || organizationId === account.organization.id) return;
    setSwitching(true);
    setError('');
    try {
      const result = await switchOrganization(organizationId);
      window.location.assign(`/workspace/${result.organization.businessType}/overview`);
    } catch (requestError) {
      setError(requestError.message);
      setSwitching(false);
    }
  }

  return <>
    <div className="workspace-switcher">
      <span className="workspace-avatar">{account.organization.name[0]?.toUpperCase()}</span>
      <span className="workspace-copy"><strong>{account.organization.name}</strong><small>{workspaceDetails[account.organization.businessType]?.roleLabel}</small></span>
      <ChevronDown size={15} />
      {organizations.length > 1 && <select className="workspace-switcher-select" aria-label="Switch organization" value={account.organization.id} disabled={switching} onChange={changeOrganization}>
        <option value={account.organization.id}>{account.organization.name} / current</option>
        {organizations.filter((organization) => organization.id !== account.organization.id).map((organization) => <option key={organization.id} value={organization.id}>{organization.name} / {workspaceDetails[organization.businessType]?.roleLabel}</option>)}
      </select>}
    </div>
    {error && <p className="workspace-switcher-error" role="alert">{error}</p>}
  </>;
}

function Workspace({ role, account }) {
  const navigate = useNavigate();
  const details = {
    ...workspaceDetails[role],
    organization: account.organization.name,
    name: account.user.fullName,
    initials: account.user.fullName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
  };
  const workspaceNavigation = {
    agency: [
      { label: 'Overview', icon: LayoutDashboard },
      { label: 'Requests', icon: FileText },
      { label: 'Offers', icon: MessageSquareText },
      { label: 'Bookings', icon: ClipboardCheck },
      { label: 'Reports', icon: BarChart3 },
      { label: 'Suppliers', icon: UsersRound },
      { label: 'Verification', icon: BadgeCheck },
      { label: 'Team', icon: UserCog },
      { label: 'Integrations', icon: Webhook, capability: 'integration.manage' },
      { label: 'Security', icon: ShieldCheck },
      { label: 'Notifications', icon: Bell },
    ],
    dmc: [
      { label: 'Overview', icon: LayoutDashboard },
      { label: 'Matching requests', icon: FileText },
      { label: 'My offers', icon: MessageSquareText },
      { label: 'Bookings', icon: ClipboardCheck },
      { label: 'Performance', icon: BarChart3 },
      { label: 'Company profile', icon: Building2 },
      { label: 'Lead alerts', icon: Bell },
      { label: 'Team', icon: UserCog },
      { label: 'Integrations', icon: Webhook, capability: 'integration.manage' },
      { label: 'Security', icon: ShieldCheck },
      { label: 'Notifications', icon: Bell },
    ],
    hotelier: [
      { label: 'Overview', icon: LayoutDashboard },
      { label: 'Booking requests', icon: FileText },
      { label: 'Bookings', icon: ClipboardCheck },
      { label: 'Performance', icon: BarChart3 },
      { label: 'Properties', icon: Hotel },
      { label: 'Lead alerts', icon: Bell },
      { label: 'Availability', icon: CalendarDays },
      { label: 'Team', icon: UserCog },
      { label: 'Integrations', icon: Webhook, capability: 'integration.manage' },
      { label: 'Security', icon: ShieldCheck },
      { label: 'Notifications', icon: Bell },
    ],
  };
  const navigation = workspaceNavigation[role].filter((item) => !item.capability || account.capabilities?.includes(item.capability));
  const canWriteRequests = account.capabilities?.includes('request.write');
  const { data: reference } = useReferenceData();
  const todayLabel = new Intl.DateTimeFormat('en', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()).toUpperCase();
  const [activePage, setActivePage] = useState('Overview');
  const [requests, setRequests] = useState([]);
  const [offers, setOffers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [sellerProfile, setSellerProfile] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [marketplaceError, setMarketplaceError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [draftToPublish, setDraftToPublish] = useState(null);
  const [toast, setToast] = useState('');
  const [apiState, setApiState] = useState('checking');
  const [responseTarget, setResponseTarget] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [tripChangeTarget, setTripChangeTarget] = useState(null);
  const [deadlineTarget, setDeadlineTarget] = useState(null);
  const [messageThread, setMessageThread] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  async function signOut() {
    try {
      await logoutAccount();
      navigate('/login', { replace: true });
    } catch (error) {
      setToast(error.message);
    }
  }

  async function toggleNotifications() {
    const shouldOpen = !notificationsOpen;
    setNotificationsOpen(shouldOpen);
    if (!shouldOpen) return;
    setNotificationsLoading(true);
    try {
      const result = await listNotifications();
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch (error) {
      setMarketplaceError(error.message);
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function readNotification(notification) {
    try {
      await markNotificationRead(notification.id);
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (error) {
      setMarketplaceError(error.message);
    }
  }

  async function readAllNotifications() {
    try {
      await markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
    } catch (error) {
      setMarketplaceError(error.message);
    }
  }

  useEffect(() => {
    let active = true;
    fetch('/api/v1/health/live')
      .then((response) => {
        if (!response.ok) throw new Error('API unavailable');
        return response.json();
      })
      .then(() => active && setApiState('connected'))
      .catch(() => active && setApiState('offline'));
    return () => { active = false; };
  }, []);

  async function syncMarketplace() {
    setDataLoading(true);
    setMarketplaceError('');
    try {
      const requestResult = await listMarketplaceRequests();
      const offerResult = ['agency', 'dmc', 'hotelier'].includes(role) ? await listMarketplaceOffers() : { offers: [] };
      const profileResult = role === 'dmc' || role === 'hotelier' ? await getSellerProfile() : null;
      const inventoryResult = role === 'hotelier' ? await listHotelInventory(new Date().toISOString().slice(0, 10), new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)) : { inventory: [] };
      const notificationResult = await listNotifications();
      setRequests(requestResult.requests);
      setOffers(offerResult.offers);
      setSellerProfile(profileResult);
      setInventory(inventoryResult.inventory);
      setUnreadCount(notificationResult.unreadCount);
    } catch (error) {
      setMarketplaceError(error.message);
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    syncMarketplace();
  }, [role]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredRequests = requests.filter((request) => {
    const matchesQuery = `${request.requestCode} ${request.destination} ${request.country}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  async function saveRequestDraft(fields) {
    try {
      const result = await createMarketplaceRequest(fields);
      setDraftToPublish(result.request);
      setActivePage('Requests');
      await syncMarketplace();
    } catch (error) {
      setMarketplaceError(error.message);
    }
  }

  async function cloneRequest(source) {
    try {
      const result = await repostRequest(source.id);
      setDraftToPublish(result.request);
      setCreateOpen(true);
      await syncMarketplace();
      setToast(`Draft copied from ${source.requestCode}. Review it before publishing.`);
    } catch (error) {
      setMarketplaceError(error.message);
    }
  }

  async function publishDraft() {
    if (!draftToPublish) return;
    try {
      const result = await publishMarketplaceRequest(draftToPublish.id);
      setDraftToPublish(null);
      setCreateOpen(false);
      await syncMarketplace();
      setToast(`Published to ${result.targetedSellerCount} verified sellers.`);
    } catch (error) {
      setMarketplaceError(error.message);
    }
  }

  async function saveSellerOffer(payload, files = []) {
    if (!responseTarget) return null;
    const tripPayload = { ...payload, trip_version: responseTarget.tripVersion };
    let saved;
    try {
      saved = responseTarget.reviseOfferId
        ? await reviseMarketplaceOffer(responseTarget.reviseOfferId, tripPayload)
        : await (role === 'dmc' ? submitDmcOffer : submitHotelOffer)(responseTarget.id, tripPayload);
    } catch (error) {
      return error.message;
    }
    const failedFiles = [];
    for (const file of files) {
      try {
        await uploadOfferAttachment(saved.offer.id, file);
      } catch (error) {
        failedFiles.push(`${file.name}: ${error.message}`);
      }
    }
    setResponseTarget(null);
    await syncMarketplace();
    if (failedFiles.length) setMarketplaceError(`The offer was saved, but some files were not attached. ${failedFiles.join(' ')}`);
    setToast(responseTarget.reviseOfferId ? 'Revised offer sent to the agency.' : role === 'hotelier' ? 'Room quote submitted to the requesting agency.' : 'Offer submitted to the requesting agency.');
    return null;
  }

  async function reconfirmOffer(request) {
    try {
      await reconfirmMarketplaceOffer(request.myOfferId, request.tripVersion);
      await syncMarketplace();
      setToast('Offer re-confirmed for the updated trip.');
    } catch (error) {
      setMarketplaceError(error.message);
    }
  }

  async function saveTripChange(trip) {
    try {
      const result = await changeRequestTrip(tripChangeTarget.id, { ...trip, trip_version: tripChangeTarget.tripVersion });
      setTripChangeTarget(null);
      await syncMarketplace();
      if (comparison?.request.id === result.request.id) {
        const refreshed = await listRequestOffers(result.request.id);
        setComparison({ request: { ...comparison.request, ...result.request }, offers: refreshed.offers });
      }
      setToast(result.offersAwaitingReconfirmation
        ? `Trip updated. ${result.offersAwaitingReconfirmation} seller offer(s) must be re-confirmed before you can award them.`
        : 'Trip updated and matched sellers notified.');
      return null;
    } catch (error) {
      return error.message;
    }
  }

  async function saveDeadlineExtension(change) {
    if (!deadlineTarget) return 'Request not found.';
    try {
      await extendMarketplaceRequestDeadline(deadlineTarget.id, change);
      setDeadlineTarget(null);
      await syncMarketplace();
      setToast('Response deadline extended. Matched sellers were notified.');
      return null;
    } catch (error) {
      return error.message;
    }
  }

  async function cancelRequest(request) {
    if (!window.confirm(`Cancel ${request.requestCode}? Sellers will be notified and active offers withdrawn.`)) return;
    try {
      await cancelMarketplaceRequest(request.id);
      if (comparison?.request.id === request.id) setComparison(null);
      await syncMarketplace();
      setToast(`${request.requestCode} cancelled.`);
    } catch (error) {
      setMarketplaceError(error.message);
    }
  }

  async function refreshComparison(requestId) {
    const refreshed = await listRequestOffers(requestId);
    setComparison((current) => current?.request.id === requestId ? { ...current, offers: refreshed.offers } : current);
  }

  async function sendNegotiation(offer, payload) {
    try {
      await createOfferNegotiation(offer.id, payload);
      await refreshComparison(offer.requestId);
      setToast(payload.kind === 'counter_offer' ? `Counter-offer sent to ${offer.sellerName}.` : `Revision request sent to ${offer.sellerName}.`);
      return null;
    } catch (error) {
      return error.message;
    }
  }

  async function setOfferShortlisted(offer, shortlisted) {
    try {
      await setMarketplaceOfferShortlisted(offer.id, shortlisted);
      await refreshComparison(offer.requestId);
      setToast(shortlisted ? `${offer.sellerName} added to shortlist.` : `${offer.sellerName} removed from shortlist.`);
    } catch (error) {
      setMarketplaceError(error.message);
    }
  }

  async function withdrawNegotiation(offer) {
    try {
      await withdrawOfferNegotiation(offer.openNegotiation.id);
      await refreshComparison(offer.requestId);
      setToast('Request withdrawn. The seller can no longer answer it.');
    } catch (error) {
      setMarketplaceError(error.message);
    }
  }

  async function answerNegotiation(negotiation, accept, note) {
    try {
      if (accept) await acceptOfferNegotiation(negotiation.id);
      else await declineOfferNegotiation(negotiation.id, note);
      await syncMarketplace();
      setToast(accept ? 'Counter price accepted. The agency has been notified.' : 'Decline sent to the agency.');
      return null;
    } catch (error) {
      return error.message;
    }
  }

  async function saveInventory(rows) {
    try {
      const result = await saveHotelInventory(rows);
      await syncMarketplace();
      setToast(`Saved ${result.savedCount} room inventory rows.`);
    } catch (error) {
      setMarketplaceError(error.message);
    }
  }

  async function saveSellerProfile(profile) {
    try {
      const result = await updateSellerProfile(profile);
      await syncMarketplace();
      setToast(result.changed ? 'Profile updated. A new verification review is required before bidding.' : 'No profile changes to save.');
      return true;
    } catch (error) {
      setMarketplaceError(error.message);
      return false;
    }
  }

  async function saveSellerSettings(settings) {
    try {
      const result = await updateSellerSettings(settings);
      await syncMarketplace();
      setToast(result.acceptingRequests ? 'Matching preferences saved. Your organization can receive new requests.' : 'Matching preferences saved. New requests are paused.');
      return true;
    } catch (error) {
      setMarketplaceError(error.message);
      return false;
    }
  }

  async function openComparison(request) {
    if (!request) {
      setToast('No agency request is attached to this offer.');
      return;
    }
    if (request.status === 'draft') {
      setDraftToPublish(request);
      setCreateOpen(true);
      return;
    }
    try {
      const result = await listRequestOffers(request.id);
      setComparison({ request, offers: result.offers });
    } catch (error) {
      setMarketplaceError(error.message);
    }
  }

  return (
    <CapabilitiesContext.Provider value={account.capabilities ?? []}>
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#overview" onClick={() => setActivePage('Overview')} aria-label="Lead Exchange home">
          <span className="brand-mark"><Globe2 size={20} strokeWidth={1.8} /></span>
          <span className="brand-copy"><strong>LEAD EXCHANGE</strong><small>by VoyageHub</small></span>
        </a>

        <OrganizationSwitcher account={account} />

        <p className="nav-caption">WORKSPACE</p>
        <nav className="primary-nav">
          {navigation.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activePage === label ? 'active' : ''}`} onClick={() => setActivePage(label)} title={label} aria-label={label}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {label === 'Offers' && <span className="nav-count">{offers.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="region-note"><Globe2 size={15} /><span>Global workspace</span><span className="region-code">Defaults {reference ? `${reference.defaults.country} / ${reference.defaults.currency}` : '...'}</span></div>
          <div className="profile-row">
            <span className="profile-avatar">{details.initials}</span>
            <span className="profile-copy"><strong>{details.name}</strong><small>{details.title}</small></span>
            <button className="icon-button profile-menu" aria-label="Sign out" onClick={signOut}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>{details.organization}</span><ChevronRight size={14} /><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <span className={`api-indicator ${apiState}`}><i />{apiState === 'connected' ? 'API connected' : apiState === 'offline' ? 'API offline' : 'Checking API'}</span>
            <span className="preview-label"><span />Connected workspace</span>
            <button className="icon-button notification-button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={notificationsOpen} onClick={toggleNotifications}><Bell size={18} />{unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}</button>
          </div>
        </header>

        <div className="page-wrap">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{todayLabel}</p>
              <h1>{activePage === 'Overview' ? `Good morning, ${details.name.split(' ')[0]}` : activePage}</h1>
              <p className="page-subtitle">{activePage === 'Overview' ? overviewSubtitle(role) : pageSubtitle(activePage, role)}</p>
            </div>
            {!['Security', 'Team', 'Integrations'].includes(activePage) && (role !== 'agency' || canWriteRequests) && <button className="primary-button" onClick={() => role === 'agency' ? setCreateOpen(true) : setActivePage(details.action)}>
              {role === 'agency' ? <Plus size={17} /> : <ArrowUpRight size={16} />}{details.action}
            </button>}
          </div>

          {marketplaceError && <div className="auth-error marketplace-error" role="alert">{marketplaceError}</div>}
          {role === 'agency' && activePage === 'Overview' && <Overview requests={requests} offers={offers} loading={dataLoading} onOpenRequests={() => setActivePage('Requests')} onOpenOffers={() => setActivePage('Offers')} onOpenRequest={openComparison} />}
          {role === 'agency' && activePage === 'Requests' && (
            <RequestWorkspace
              requests={filteredRequests}
              loading={dataLoading}
              query={query}
              setQuery={setQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              onCreate={() => setCreateOpen(true)}
              onCloneRequest={canWriteRequests ? cloneRequest : null}
              onExtendDeadline={canWriteRequests ? setDeadlineTarget : null}
              onCancelRequest={canWriteRequests ? cancelRequest : null}
              onOpenRequest={openComparison}
            />
          )}
          {role === 'agency' && activePage === 'Offers' && <OfferWorkspace offers={offers} onCompare={(offer) => openComparison(requests.find((item) => item.id === offer.requestId))} />}
          {role === 'agency' && activePage === 'Reports' && <ReportsWorkspace role={role} />}
          {role === 'agency' && activePage === 'Suppliers' && <SupplierWorkspace />}
          {role === 'agency' && activePage === 'Verification' && <section className="surface-section full-section"><div className="section-heading request-list-heading"><div><p className="eyebrow">AGENCY VERIFICATION</p><h2>{details.organization}</h2></div></div><p className="modal-copy">Verified agencies show a badge on every request, so sellers know the buyer is a real business.</p><VerificationDocuments submittable /></section>}
          {activePage === 'Security' && <MfaSecurityPanel account={account} />}
          {activePage === 'Security' && <SessionManagementPanel />}
          {activePage === 'Security' && <AccountPanel account={account} onDeleted={(result) => navigate('/login', { replace: true, state: { notice: `Account deletion scheduled for ${new Date(result.scheduledFor).toLocaleDateString()}. Sign in before then to cancel.` } })} />}
          {activePage === 'Team' && <TeamPanel account={account} />}
          {activePage === 'Integrations' && <IntegrationsPanel />}
          {activePage === 'Bookings' && <BookingsWorkspace />}
          {activePage === 'Notifications' && <NotificationSettings />}
          {role === 'dmc' && activePage === 'Overview' && <DmcOverview requests={requests} offers={offers} sellerProfile={sellerProfile} loading={dataLoading} onOpenRequests={() => setActivePage('Matching requests')} onOpenOffers={() => setActivePage('My offers')} onRespond={setResponseTarget} />}
          {role === 'dmc' && activePage === 'Matching requests' && <DmcRequestWorkspace requests={requests} sellerProfile={sellerProfile} loading={dataLoading} onRespond={setResponseTarget} onReconfirm={reconfirmOffer} onAnswerNegotiation={answerNegotiation} onRevise={(request) => setResponseTarget({ ...request, reviseOfferId: request.myOfferId })} onReport={(request) => setReportTarget({ type: 'request', id: request.id, label: `request ${request.requestCode}` })} onMessage={(request) => setMessageThread({ requestId: request.id, requestCode: request.requestCode, peerName: request.agencyName })} />}
          {role === 'dmc' && activePage === 'My offers' && <DmcOffers offers={offers} loading={dataLoading} />}
          {role === 'dmc' && activePage === 'Performance' && <ReportsWorkspace role={role} />}
          {role === 'dmc' && activePage === 'Company profile' && <RoleProfile role="dmc" profile={sellerProfile} organization={details.organization} onSave={saveSellerProfile} onSaveSettings={saveSellerSettings} onDocumentsChanged={syncMarketplace} />}
          {role === 'hotelier' && activePage === 'Overview' && <HotelOverview requests={requests} offers={offers} sellerProfile={sellerProfile} loading={dataLoading} onOpenRequests={() => setActivePage('Booking requests')} onOpenAvailability={() => setActivePage('Availability')} onRespond={setResponseTarget} />}
          {role === 'hotelier' && activePage === 'Booking requests' && <HotelRequestWorkspace requests={requests} sellerProfile={sellerProfile} loading={dataLoading} onRespond={setResponseTarget} onReconfirm={reconfirmOffer} onAnswerNegotiation={answerNegotiation} onRevise={(request) => setResponseTarget({ ...request, reviseOfferId: request.myOfferId })} onReport={(request) => setReportTarget({ type: 'request', id: request.id, label: `request ${request.requestCode}` })} onMessage={(request) => setMessageThread({ requestId: request.id, requestCode: request.requestCode, peerName: request.agencyName })} />}
          {role === 'hotelier' && activePage === 'Properties' && <RoleProfile role="hotelier" profile={sellerProfile} organization={details.organization} onSave={saveSellerProfile} onSaveSettings={saveSellerSettings} onDocumentsChanged={syncMarketplace} />}
          {role === 'hotelier' && activePage === 'Performance' && <ReportsWorkspace role={role} />}
          {role !== 'agency' && activePage === 'Lead alerts' && <AlertPreferencesPanel role={role} />}
          {role === 'hotelier' && activePage === 'Availability' && <HotelAvailability inventory={inventory} loading={dataLoading} onSave={saveInventory} />}

          <footer className="page-footer"><span>Lead Exchange</span><LegalLinks /></footer>
        </div>
      </main>

      {createOpen && <CreateRequestModal draft={draftToPublish} onClose={() => { setCreateOpen(false); setDraftToPublish(null); }} onCreate={saveRequestDraft} onPublish={publishDraft} />}

      {responseTarget && <OfferFormModal role={role} target={responseTarget} roomTypes={[...new Set(inventory.map((item) => item.roomType))]} onClose={() => setResponseTarget(null)} onSubmit={saveSellerOffer} />}
      {comparison && <OfferComparison request={comparison.request} offers={comparison.offers} onShortlist={setOfferShortlisted} onNegotiate={sendNegotiation} onWithdrawNegotiation={withdrawNegotiation} onChangeTrip={() => setTripChangeTarget(comparison.request)} onRepost={async () => {
        try {
          const other = reference?.requirementTypes.find((type) => type.value !== comparison.request.requirementType)?.value;
          const result = await repostRequest(comparison.request.id, { requirementType: other, cancelOriginal: true });
          setComparison(null);
          await syncMarketplace();
          setToast(`Lead cancelled and copied to draft ${result.request.requestCode}. Review and publish it.`);
        } catch (error) {
          setMarketplaceError(error.message);
        }
      }} onReport={(offer) => setReportTarget({ type: 'offer', id: offer.id, label: `offer from ${offer.sellerName}` })} onMessage={(offer) => setMessageThread({ requestId: comparison.request.id, requestCode: comparison.request.requestCode, sellerOrganizationId: offer.sellerOrganizationId, peerName: offer.sellerName })} onAward={async (selections, notSelectedReason) => {
        try {
          await awardMarketplaceOffer(comparison.request.id, selections, notSelectedReason);
          setComparison(null);
          await syncMarketplace();
          setToast(`${selections.length > 1 ? `Awarded to ${selections.length} sellers.` : 'Offer awarded.'} You can undo it for ${reference?.limits.awardUndoWindowMinutes} minutes from the request. Confirm the booking under Bookings to share guest details.`);
        } catch (error) {
          setMarketplaceError(error.message);
        }
      }} onUndoAward={async (reason) => {
        try {
          const result = await undoMarketplaceAward(comparison.request.id, reason);
          setComparison(null);
          await syncMarketplace();
          setToast(`Award undone. ${result.restoredOffers} offer(s) are active again and the request is ${result.status}.`);
        } catch (error) {
          setMarketplaceError(error.message);
        }
      }} onClose={() => setComparison(null)} />}
      {tripChangeTarget && <TripChangeModal request={tripChangeTarget} onClose={() => setTripChangeTarget(null)} onSave={saveTripChange} />}
      {deadlineTarget && <DeadlineExtensionModal request={deadlineTarget} onClose={() => setDeadlineTarget(null)} onSave={saveDeadlineExtension} />}
      {messageThread && <MessageThreadModal {...messageThread} onReport={(message) => setReportTarget({ type: 'message', id: message.id, label: `message from ${message.senderName}` })} onClose={() => setMessageThread(null)} />}
      {reportTarget && <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} onReported={() => setToast('Report sent to platform operations.')} />}
      {notificationsOpen && <NotificationPopover notifications={notifications} unreadCount={unreadCount} loading={notificationsLoading} onClose={() => setNotificationsOpen(false)} onRead={readNotification} onReadAll={readAllNotifications} />}

      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
    </CapabilitiesContext.Provider>
  );
}

function overviewSubtitle(role) {
  if (role === 'dmc') return 'Destination opportunities selected for your team.';
  if (role === 'hotelier') return 'Your property requests and room inventory.';
  return 'Your marketplace at a glance.';
}

function SupplierInvitePicker({ selected, onChange, maxInvited }) {
  const [search, setSearch] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timeout = window.setTimeout(() => {
      listMarketplaceSuppliers({ search: search.trim(), limit: 10, favoritesOnly })
        .then((result) => { if (active) { setResults(result.suppliers); setError(''); } })
        .catch((requestError) => active && setError(requestError.message))
        .finally(() => active && setLoading(false));
    }, 250);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [search, favoritesOnly]);

  const selectedIds = new Set(selected.map((supplier) => supplier.organizationId));
  function toggle(supplier) {
    if (selectedIds.has(supplier.organizationId)) onChange(selected.filter((item) => item.organizationId !== supplier.organizationId));
    else if (selected.length < maxInvited) onChange([...selected, { organizationId: supplier.organizationId, name: supplier.name, type: supplier.type }]);
  }

  return (
    <fieldset className="invite-picker">
      <legend>Invite verified suppliers ({selected.length}/{maxInvited})</legend>
      {selected.length > 0 && <div className="invite-chips">{selected.map((supplier) => <button type="button" key={supplier.organizationId} className="invite-chip" onClick={() => toggle(supplier)} aria-label={`Remove ${supplier.name}`}>{supplier.name}<X size={12} /></button>)}</div>}
      <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company or destination" aria-label="Search suppliers to invite" /></label>
      <label className="preferred-filter"><input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} />Preferred suppliers only</label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="invite-results">
        {loading ? <small className="table-secondary">Searching verified suppliers...</small> : results.length ? results.map((supplier) => (
          <label key={supplier.organizationId} className="invite-result">
            <input type="checkbox" checked={selectedIds.has(supplier.organizationId)} disabled={!selectedIds.has(supplier.organizationId) && selected.length >= maxInvited} onChange={() => toggle(supplier)} />
            <span><strong>{supplier.name}{supplier.isFavorite && <em className="preferred-label">Preferred</em>}</strong><small>{supplier.type === 'hotelier' ? `Hotel / ${supplier.propertyCity ?? supplier.countryCode}` : `DMC / ${supplier.coverageDestinations.join(', ')}`}</small></span>
          </label>
        )) : <small className="table-secondary">No verified suppliers match this search.</small>}
      </div>
    </fieldset>
  );
}

function CreateRequestModal({ draft, onClose, onCreate, onPublish }) {
  const { data: reference, error: referenceError } = useReferenceData();
  const [dateMode, setDateMode] = useState('exact');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [visibility, setVisibility] = useState('open');
  const [invitedSuppliers, setInvitedSuppliers] = useState([]);
  const [destination, setDestination] = useState([]);
  const [requirementType, setRequirementType] = useState('');
  const [stops, setStops] = useState([]);
  const [hotelCategory, setHotelCategory] = useState('');
  const [importedValues, setImportedValues] = useState(null);
  const requestFormRef = useRef(null);
  const [, setPreviewRevision] = useState(0);
  const isHotelOnly = reference?.requirementTypes.find((type) => type.value === requirementType)?.audience === 'hotelier';
  const allowedServices = (reference?.services ?? []).filter((service) => service.allowedFor.includes(requirementType));
  const chosenDestinationIds = isHotelOnly ? destination.map((item) => item.id) : stops.map((stop) => stop.destination.id);
  const now = new Date();
  const deadlineLimits = reference?.limits.requestDeadline;
  const deadlineInputFormat = "yyyy-MM-dd'T'HH:mm";
  const previewForm = requestFormRef.current ? new FormData(requestFormRef.current) : null;
  const previewBudgetMin = previewForm?.get('budgetMin');
  const previewBudgetMax = previewForm?.get('budgetMax');
  let previewBudgetMinMinor = null;
  let previewBudgetMaxMinor = null;
  if (previewBudgetMin && previewBudgetMax) {
    try {
      previewBudgetMinMinor = toMinorUnits(previewBudgetMin, previewForm.get('budgetCurrency'));
      previewBudgetMaxMinor = toMinorUnits(previewBudgetMax, previewForm.get('budgetCurrency'));
    } catch {
      previewBudgetMinMinor = null;
      previewBudgetMaxMinor = null;
    }
  }
  const audienceFacts = {
    group_type: previewForm?.get('groupType') || importedValues?.group_type || importedValues?.groupType || reference?.groupTypes[0]?.value,
    adults: Number(previewForm?.get('adults') ?? importedValues?.adults ?? 2),
    children: Number(previewForm?.get('children') ?? importedValues?.children ?? 0),
    infants: Number(previewForm?.get('infants') ?? importedValues?.infants ?? 0),
    budget_min_minor: previewBudgetMinMinor,
    budget_max_minor: previewBudgetMaxMinor,
    budget_currency: previewBudgetMinMinor == null ? null : previewForm.get('budgetCurrency'),
    travel_start_date: previewForm?.get('travelStartDate') || null,
    travel_end_date: previewForm?.get('travelEndDate') || null,
    room_count: previewForm?.get('roomCount') ? Number(previewForm.get('roomCount')) : null,
  };

  useEffect(() => {
    if (importedValues) setPreviewRevision((revision) => revision + 1);
  }, [importedValues?.importKey]);

  async function importCrmRequest(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFormError('');
    try {
      const parsed = JSON.parse(await file.text());
      const source = parsed?.request ?? parsed;
      if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('The CRM export must contain a request object.');
      const nextRequirement = source.requirement_type ?? source.requirementType;
      if (!reference.requirementTypes.some((item) => item.value === nextRequirement)) throw new Error('Choose a supported request type in the CRM export.');
      const rawDestinations = source.destinations ?? (source.destination ? [source.destination] : []);
      if (!Array.isArray(rawDestinations) || rawDestinations.length === 0) throw new Error('The CRM export must include at least one destination.');
      const requirement = reference.requirementTypes.find((item) => item.value === nextRequirement);
      const isHotelRequest = requirement.audience === 'hotelier';
      const kinds = isHotelRequest
        ? reference.limits.hotelLeadAllowedDestinationKinds ?? [] : [];
      const resolved = await Promise.all(rawDestinations.map(async (item) => {
        const name = typeof item === 'string' ? item : item?.name ?? item?.destination;
        if (typeof name !== 'string' || !name.trim()) throw new Error('Every CRM destination needs a name.');
        const result = await searchDestinations(name.trim(), { kinds });
        const destinationMatch = result.destinations.find((candidate) => candidate.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
        if (!destinationMatch) throw new Error(`Match "${name}" to a destination in the master list before importing.`);
        return { destination: destinationMatch, nights: typeof item === 'object' ? item.nights ?? null : null };
      }));
      const importedServices = Array.isArray(source.services) ? source.services : typeof source.services === 'string' ? [source.services] : [];
      const allowedServiceValues = new Set(reference.services.filter((item) => item.allowedFor.includes(nextRequirement)).map((item) => item.value));
      if (importedServices.some((service) => !allowedServiceValues.has(service))) throw new Error('The CRM export includes a service that is not valid for this request type.');
      const groupType = source.group_type ?? source.groupType;
      if (!reference.groupTypes.some((item) => item.value === groupType)) throw new Error('The CRM export must include a supported group type.');
      const nextDateMode = source.travel_month || source.travelMonth ? 'month' : 'exact';
      const nextNights = source.nights ?? (source.travel_start_date && source.travel_end_date ? differenceInCalendarDays(parseISO(source.travel_end_date), parseISO(source.travel_start_date)) : null);
      if (!Number.isInteger(Number(nextNights)) || Number(nextNights) < 1) throw new Error('The CRM export must include travel dates or a travel month and nights.');
      if (requirement.maxDestinations != null && resolved.length > requirement.maxDestinations) throw new Error(`${requirement.label} can include at most ${requirement.maxDestinations} destination(s).`);

      setRequirementType(nextRequirement);
      setDateMode(nextDateMode);
      setHotelCategory(source.hotel_category == null ? '' : String(source.hotel_category));
      setImportedValues({ ...source, group_type: groupType, services: importedServices, nights: Number(nextNights), importKey: Date.now() });
      if (isHotelRequest) {
        setDestination(resolved.map((item) => item.destination));
        setStops([]);
      } else {
        setStops(resolved.map((item) => ({ destination: item.destination, nights: item.nights == null ? '' : String(item.nights) })));
        setDestination([]);
      }
      setVisibility('open');
      setInvitedSuppliers([]);
      setFormError('CRM request imported. Review all details before saving.');
    } catch (error) {
      setFormError(error instanceof SyntaxError ? 'Choose a valid CRM JSON export.' : error.message);
    }
  }

  async function submitDraft(event) {
    event.preventDefault();
    setFormError('');
    const form = new FormData(event.currentTarget);
    const services = isHotelOnly ? allowedServices.map((service) => service.value) : form.getAll('services');
    if (!requirementType) {
      setFormError('Choose whether you need a hotel only or a full itinerary.');
      return;
    }
    if (!chosenDestinationIds.length) {
      setFormError('Choose a destination from the list.');
      return;
    }
    if (services.length === 0) {
      setFormError('Select at least one requested service.');
      return;
    }
    if (visibility !== 'open' && invitedSuppliers.length === 0) {
      setFormError('Invite at least one verified supplier, or choose open visibility.');
      return;
    }
    const startDate = form.get('travelStartDate');
    const endDate = form.get('travelEndDate');
    const nights = dateMode === 'exact'
      ? differenceInCalendarDays(parseISO(endDate), parseISO(startDate))
      : Number(form.get('nights'));
    const budgetMin = form.get('budgetMin');
    const budgetMax = form.get('budgetMax');
    const budgetCurrency = form.get('budgetCurrency');
    const childrenCount = Number(form.get('children') ?? 0);
    const childAges = String(form.get('childAges') ?? '').split(/[\s,;]+/).filter(Boolean).map(Number);
    const childRange = reference.travellerTypes.find((traveller) => traveller.value === 'child');
    if (childrenCount > 0 && (childAges.length !== childrenCount || childAges.some((age) => !Number.isInteger(age) || age < childRange.minAge || age > childRange.maxAge))) {
      setFormError(`Enter one age between ${childRange.minAge} and ${childRange.maxAge} for each child.`);
      return;
    }
    if ((budgetMin && !budgetMax) || (!budgetMin && budgetMax)) {
      setFormError('Enter both budget limits or leave the budget blank.');
      return;
    }

    const fields = {
      requirement_type: requirementType,
      destinations: isHotelOnly
        ? destination.map((item) => ({ destination_id: item.id }))
        : stops.map((stop) => ({ destination_id: stop.destination.id, nights: stop.nights ? Number(stop.nights) : null })),
      travel_start_date: dateMode === 'exact' ? startDate : null,
      travel_end_date: dateMode === 'exact' ? endDate : null,
      travel_month: dateMode === 'month' ? form.get('travelMonth') : null,
      nights,
      adults: Number(form.get('adults')),
      children: Number(form.get('children')),
      infants: Number(form.get('infants')),
      child_ages: childAges,
      special_requests: String(form.get('specialRequests') ?? '').trim() || null,
      group_type: form.get('groupType'),
      hotel_category: hotelCategory ? Number(hotelCategory) : null,
      room_count: form.get('roomCount') ? Number(form.get('roomCount')) : null,
      meal_plan: form.get('mealPlan') || null,
      services,
      budget_min_minor: budgetMin && budgetMax ? toMinorUnits(budgetMin, budgetCurrency) : null,
      budget_max_minor: budgetMin && budgetMax ? toMinorUnits(budgetMax, budgetCurrency) : null,
      budget_currency: budgetMin && budgetMax ? budgetCurrency : null,
      response_deadline: new Date(form.get('responseDeadline')).toISOString(),
      visibility,
      invited_seller_ids: visibility === 'open' ? [] : invitedSuppliers.map((supplier) => supplier.organizationId),
    };
    if (nights < 1) {
      setFormError('Travel end must be after travel start.');
      return;
    }
    setSaving(true);
    await onCreate(fields);
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal request-modal" role="dialog" aria-modal="true" aria-labelledby="request-modal-title">
        <div className="modal-heading"><div><p className="eyebrow">AGENCY WORKSPACE</p><h2 id="request-modal-title">{draft ? 'Review seller-visible request' : 'Create a trip request'}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
        {draft ? (
          <>
            <p className="modal-copy">This allowlisted snapshot is what matched sellers will receive. No traveler names, contacts, or internal notes are included.</p>
            <dl className="request-preview-list"><div><dt>Lead type</dt><dd>{labelFor(reference?.requirementTypes, draft.requirementType)}</dd></div><div><dt>Destination</dt><dd>{draft.destinations?.length ? routeText(draft.destinations) : draft.destination}, {draft.destinationCountry}</dd></div><div><dt>Travel</dt><dd>{draft.dates} / {draft.nights} nights</dd></div><div><dt>Travelers</dt><dd>{draft.travelers}</dd></div>{draft.childAges?.length > 0 && <div><dt>Child ages</dt><dd>{draft.childAges.join(', ')}</dd></div>}{draft.specialRequests && <div><dt>Special requests</dt><dd>{draft.specialRequests}</dd></div>}<div><dt>Services</dt><dd>{draft.services.map((service) => labelFor(reference?.services, service)).join(', ')}</dd></div><div><dt>Response deadline</dt><dd>{new Date(draft.responseDeadline).toLocaleString()}</dd></div><div><dt>Visibility</dt><dd>{labelFor(reference?.requestVisibilities, draft.visibility)}</dd></div>{draft.invitedSellers?.length > 0 && <div><dt>Invited suppliers</dt><dd>{draft.invitedSellers.map((seller) => seller.name).join(', ')}</dd></div>}</dl>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Keep draft</button><button type="button" className="primary-button" onClick={onPublish}>Publish request</button></div>
          </>
        ) : !reference ? <div className="empty-state">{referenceError || 'Loading request options...'}</div> : (
          <>
          <label className="secondary-button document-upload"><FileUp size={15} />Import CRM JSON<input type="file" className="visually-hidden" accept="application/json,.json" onChange={importCrmRequest} /></label>
          <form ref={requestFormRef} key={importedValues?.importKey ?? 'blank-request'} className="request-form" onChange={() => setPreviewRevision((revision) => revision + 1)} onSubmit={submitDraft}>
            <fieldset className="requirement-picker"><legend>What do you need?</legend>
              {reference.requirementTypes.map((type) => (
                <label key={type.value} className={`requirement-option ${requirementType === type.value ? 'selected' : ''}`}>
                  <input type="radio" name="requirementType" value={type.value} checked={requirementType === type.value} onChange={() => { setRequirementType(type.value); setDestination([]); setStops([]); }} />
                  <strong>{type.label}</strong><small>{type.description}</small>
                </label>
              ))}
              <small className="table-secondary">The lead type cannot be changed after publishing.</small>
            </fieldset>
            {requirementType && (isHotelOnly
              ? <DestinationPicker label="Destination" value={destination} onChange={setDestination} kinds={reference.limits.hotelLeadAllowedDestinationKinds ?? []} placeholder="Search a state, district or place" />
              : <StopsEditor stops={stops} onChange={setStops} max={reference.limits.maxRequestDestinations ?? 1} />)}
            <AudiencePreview requirementType={requirementType} destinationIds={chosenDestinationIds} hotelCategory={hotelCategory} facts={audienceFacts} />
            <div className="request-form-grid"><label className="field-label">Date mode<select className="form-select" value={dateMode} onChange={(event) => setDateMode(event.target.value)}><option value="exact">Exact dates</option><option value="month">Month and nights</option></select></label>{dateMode === 'exact' ? <><label className="field-label">Arrival<input className="form-input" name="travelStartDate" type="date" min={format(now, 'yyyy-MM-dd')} defaultValue={importedValues?.travel_start_date ?? importedValues?.travelStartDate ?? ''} required /></label><label className="field-label">Departure<input className="form-input" name="travelEndDate" type="date" min={format(now, 'yyyy-MM-dd')} defaultValue={importedValues?.travel_end_date ?? importedValues?.travelEndDate ?? ''} required /></label></> : <><label className="field-label">Travel month<input className="form-input" name="travelMonth" type="month" min={format(now, 'yyyy-MM')} defaultValue={importedValues?.travel_month ?? importedValues?.travelMonth ?? ''} required /></label><label className="field-label">Nights<input className="form-input" name="nights" type="number" min="1" max="90" defaultValue={importedValues?.nights ?? ''} required /></label></>}
              <label className="field-label">Adults<input className="form-input" name="adults" type="number" min="1" max="100" defaultValue={importedValues?.adults ?? 2} required /></label><label className="field-label">Children<input className="form-input" name="children" type="number" min="0" max="80" defaultValue={importedValues?.children ?? 0} /></label><label className="field-label">Infants<input className="form-input" name="infants" type="number" min="0" max="40" defaultValue={importedValues?.infants ?? 0} /></label><label className="field-label">Group type<select className="form-select" name="groupType" defaultValue={importedValues?.group_type ?? importedValues?.groupType ?? reference.groupTypes[0]?.value}>{reference.groupTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label className="field-label">Hotel category<select className="form-select" name="hotelCategory" value={hotelCategory} onChange={(event) => setHotelCategory(event.target.value)}><option value="">Any</option>{reference.hotelCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label className="field-label">Rooms<input className="form-input" name="roomCount" type="number" min="1" max="50" defaultValue={importedValues?.room_count ?? importedValues?.roomCount ?? 1} /></label><label className="field-label">Meal plan<select className="form-select" name="mealPlan" defaultValue={importedValues?.meal_plan ?? importedValues?.mealPlan ?? ''}><option value="">Any</option>{reference.mealPlans.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}</select></label></div>
            <div className="request-form-grid"><label className="field-label">Child ages<input className="form-input" name="childAges" inputMode="numeric" defaultValue={Array.isArray(importedValues?.child_ages) ? importedValues.child_ages.join(', ') : importedValues?.childAges ?? ''} placeholder="Comma-separated" /></label></div>
            <label className="field-label">Special requests<textarea className="form-input" name="specialRequests" maxLength="2000" defaultValue={importedValues?.special_requests ?? importedValues?.specialRequests ?? ''} /></label>
            {requirementType && <fieldset className="service-picker"><legend>Services requested</legend>{allowedServices.map((service) => <label key={service.value}><input type="checkbox" name="services" value={service.value} defaultChecked={isHotelOnly || importedValues?.services?.includes(service.value)} {...(isHotelOnly ? { checked: true, disabled: true, readOnly: true } : {})} />{service.label}</label>)}</fieldset>}
            <p className="field-label budget-title">Optional budget range</p><div className="request-form-grid budget-grid"><select className="form-select" name="budgetCurrency" aria-label="Budget currency" defaultValue={importedValues?.budget_currency ?? importedValues?.budgetCurrency ?? reference.defaults.currency}>{reference.currencies.map((code) => <option key={code} value={code}>{code}</option>)}</select><input className="form-input" name="budgetMin" type="number" min="0" step="any" placeholder="Minimum" defaultValue={importedValues?.budget_min ?? importedValues?.budgetMin ?? ''} /><input className="form-input" name="budgetMax" type="number" min="0" step="any" placeholder="Maximum" defaultValue={importedValues?.budget_max ?? importedValues?.budgetMax ?? ''} /></div>
            <label className="field-label">Response deadline<input className="form-input" name="responseDeadline" type="datetime-local" required min={format(addHours(now, deadlineLimits.minHours), deadlineInputFormat)} max={format(addDays(now, deadlineLimits.maxDays), deadlineInputFormat)} defaultValue={format(addHours(now, deadlineLimits.defaultHours), deadlineInputFormat)} /></label>
            <label className="field-label">Who can see this request<select className="form-select" value={visibility} onChange={(event) => setVisibility(event.target.value)}>{reference.requestVisibilities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            {visibility !== 'open' && <SupplierInvitePicker selected={invitedSuppliers} onChange={setInvitedSuppliers} maxInvited={reference.limits.maxInvitedSuppliers} />}
            {formError && <p className={formError.startsWith('CRM request imported') ? 'import-success' : 'auth-error'} role={formError.startsWith('CRM request imported') ? 'status' : 'alert'}>{formError}</p>}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save draft and preview'}</button></div>
          </form>
          </>
        )}
      </section>
    </div>
  );
}

function OfferComparison({ request, offers, onAward, onUndoAward, onShortlist, onNegotiate, onWithdrawNegotiation, onChangeTrip, onRepost, onMessage, onReport, onClose }) {
  const { data: reference } = useReferenceData();
  const [awardSelections, setAwardSelections] = useState([]);
  const [negotiationTarget, setNegotiationTarget] = useState(null);
  const [notSelectedReason, setNotSelectedReason] = useState('');
  const [awarding, setAwarding] = useState(false);
  const canAwardRole = useCan('request.award');
  const canAward = ['open', 'closed'].includes(request.status) && canAwardRole;
  const canChangeTrip = useCan('request.write') && request.status === 'open';
  const canMessage = useCan('message.write');
  const canWriteRequest = useCan('request.write');
  const canNegotiate = useCan('request.write') && ['open', 'closed'].includes(request.status);
  const awaitingCount = offers.filter((offer) => offer.needsReconfirmation).length;
  const awardTarget = awardSelections.length > 0;
  const canUndo = canAwardRole && request.status === 'awarded' && request.awardUndoUntil && new Date(request.awardUndoUntil) > new Date();

  async function confirmAward() {
    setAwarding(true);
    await onAward(awardSelections.map(({ offer, option }) => ({ offerId: offer.id, optionId: option?.id ?? null })), notSelectedReason);
    setAwarding(false);
  }

  async function undoAward() {
    setAwarding(true);
    await onUndoAward(notSelectedReason);
    setAwarding(false);
  }

  const awardable = (offer) => canAward && ['submitted', 'shortlisted'].includes(offer.status);
  const startAward = (offer, option) => setAwardSelections([{ offer, option }]);
  const selectedOfferIds = new Set(awardSelections.map(({ offer }) => offer.id));
  const splitCandidates = offers.filter((offer) => awardable(offer) && !offer.needsReconfirmation && !selectedOfferIds.has(offer.id));
  const canSplit = reference && awardSelections.length < reference.limits.maxAwardsPerRequest && splitCandidates.length > 0;

  function addSplitSelection(value) {
    const [offerId, optionId] = value.split(':');
    const offer = offers.find((item) => item.id === offerId);
    if (offer) setAwardSelections((current) => [...current, { offer, option: offer.options?.find((item) => item.id === optionId) ?? null }]);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal comparison-modal" role="dialog" aria-modal="true" aria-labelledby="comparison-title">
        <div className="modal-heading"><div><p className="eyebrow">AGENCY COMPARISON</p><h2 id="comparison-title">{request.destination} offers</h2></div><button className="icon-button" aria-label="Close comparison" onClick={onClose}><X size={18} /></button></div>
        <div className="trip-summary"><span><CalendarDays size={14} />{request.dates} / {request.nights} nights</span><span><UsersRound size={14} />{request.travelers}{request.roomCount ? ` / ${request.roomCount} rooms` : ''}</span>{request.tripChangedAt && <span className="status-pill draft"><i />Changed {new Date(request.tripChangedAt).toLocaleDateString()}</span>}{canChangeTrip && !awardTarget && <button className="secondary-button" onClick={onChangeTrip}>Change trip details</button>}{canWriteRequest && ['draft', 'open'].includes(request.status) && onRepost && !awardTarget && <button className="text-button" onClick={onRepost} title="The lead type cannot change after publishing. This cancels the lead and copies it into a new draft of the other type.">Repost as {labelFor(reference?.requirementTypes, reference?.requirementTypes.find((type) => type.value !== request.requirementType)?.value)}</button>}</div>
        <LeadBadges request={request} />
        {awaitingCount > 0 && !awardTarget && <p className="trip-change-note">{awaitingCount} offer(s) were priced for earlier trip details. They can be awarded once the seller re-confirms or revises them.</p>}
        {canUndo && <div className="negotiation-notice">
          <p>Awarded {new Date(request.awardedAt).toLocaleTimeString()}. You can undo this decision until {new Date(request.awardUndoUntil).toLocaleTimeString()}, as long as no booking has been confirmed. Every offer becomes active again and sellers are told.</p>
          <input className="form-input" aria-label="Reason for undoing the award" value={notSelectedReason} onChange={(event) => setNotSelectedReason(event.target.value)} maxLength="300" placeholder="Optional reason shared with the sellers" />
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={undoAward} disabled={awarding}>{awarding ? 'Undoing...' : 'Undo award'}</button></div>
        </div>}
        {awardTarget ? (
          <div className="award-confirm">
            <p className="modal-copy">Award {awardSelections.length > 1 ? 'parts of this trip to:' : 'this offer:'}</p>
            <ul className="attachment-list">{awardSelections.map(({ offer, option }, index) => <li key={offer.id}>
              <span><strong>{offer.sellerName}</strong>{(option?.label ?? offer.optionLabel) ? ` (${option?.label ?? offer.optionLabel})` : ''}</span>
              <span>{formatOfferPrice(option ? { ...offer, ...option } : offer)}</span>
              {index > 0 && <button type="button" className="icon-button" aria-label={`Remove ${offer.sellerName}`} onClick={() => setAwardSelections((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button>}
            </li>)}</ul>
            {canSplit && <label className="field-label">Split the trip: also award part of it to<select className="form-select" value="" onChange={(event) => addSplitSelection(event.target.value)}><option value="">Choose another seller's offer</option>{splitCandidates.flatMap((offer) => [
              <option key={offer.id} value={`${offer.id}:`}>{offer.sellerName}{offer.optionLabel ? ` - ${offer.optionLabel}` : ''} / {formatOfferPrice(offer)}</option>,
              ...(offer.options ?? []).map((option) => <option key={option.id} value={`${offer.id}:${option.id}`}>{offer.sellerName} - {option.label} / {formatOfferPrice({ ...offer, ...option })}</option>),
            ])}</select></label>}
            <p className="modal-copy">Every other active offer will be marked not selected. You can undo this for {reference?.limits.awardUndoWindowMinutes} minutes, until a booking is confirmed.</p>
            <label className="field-label" htmlFor="not-selected-reason">Optional reason shared with sellers who were not selected</label>
            <textarea id="not-selected-reason" className="form-input" value={notSelectedReason} onChange={(event) => setNotSelectedReason(event.target.value)} maxLength="300" placeholder="For example: client chose a higher hotel category" />
            <small className="table-secondary">Do not include contact details or links. {300 - notSelectedReason.length} characters left.</small>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setAwardSelections([])} disabled={awarding}>Back</button><button type="button" className="primary-button" onClick={confirmAward} disabled={awarding}>{awarding ? 'Awarding...' : awardSelections.length > 1 ? `Confirm award to ${awardSelections.length} sellers` : 'Confirm award'}</button></div>
          </div>
        ) : negotiationTarget ? (
          <NegotiationForm offer={negotiationTarget} onCancel={() => setNegotiationTarget(null)} onSubmit={async (payload) => {
            const failure = await onNegotiate(negotiationTarget, payload);
            if (!failure) setNegotiationTarget(null);
            return failure;
          }} />
        ) : offers.length ? <div className="comparison-list">{offers.map((offer) => <article className="comparison-offer" key={offer.id}><div><strong>{offer.sellerName}</strong>{offer.matchType && offer.matchType !== 'full' && <span className={`lead-badge match-${offer.matchType}`}>{labelFor(reference?.matchTypes, offer.matchType)}</span>}<small>{offer.kind === 'hotel_room' ? `${offer.hotelPropertyName ? `${offer.hotelPropertyName} / ` : ''}${offer.roomType} / ${offer.roomCount ?? 1} room(s)` : 'Land package'} · valid through {new Date(offer.validityUntil).toLocaleDateString()}</small><span>{offer.inclusions.map((item) => labelFor(reference?.offerInclusions, item)).join(', ')}</span><OfferDetails offer={offer} /><OfferOptionList offer={offer} reference={reference} canAward={awardable(offer)} onAward={(option) => startAward(offer, option)} />{offer.openNegotiation && <span className="status-pill draft"><i />{labelFor(reference?.negotiationKinds, offer.openNegotiation.kind)} sent{offer.openNegotiation.counterPriceMinor != null ? `: ${formatMinor(offer.openNegotiation.counterPriceMinor, offer.currency)}` : ''}{offer.openNegotiation.optionLabel ? ` (${offer.openNegotiation.optionLabel})` : ''}, waiting for the seller</span>}</div><div className="comparison-price-block">{offer.optionLabel && <small>{offer.optionLabel}</small>}<strong className="comparison-price">{formatOfferPrice(offer)}</strong>{offer.kind === 'hotel_room' && offer.estimatedTotalMinor != null && <small>Est. stay {formatMinor(offer.estimatedTotalMinor, offer.currency)}</small>}{offer.perTravellerMinor != null && <small>{formatMinor(offer.perTravellerMinor, offer.currency)} per traveller ({offer.travellers})</small>}</div><div className="comparison-actions">{offer.needsReconfirmation && <span className="status-pill draft" title="The seller has not yet confirmed this price for the updated trip."><i />Awaiting re-confirmation</span>}{canWriteRequest && ['open', 'closed'].includes(request.status) && ['submitted', 'shortlisted'].includes(offer.status) && <button className="secondary-button" onClick={() => onShortlist(offer, offer.status !== 'shortlisted')}>{offer.status === 'shortlisted' ? 'Remove shortlist' : 'Shortlist'}</button>}{canMessage && <button className="secondary-button" onClick={() => onMessage(offer)}><MessageSquareText size={14} />Message</button>}{canNegotiate && ['submitted', 'shortlisted'].includes(offer.status) && (offer.openNegotiation
          ? <button className="secondary-button" onClick={() => onWithdrawNegotiation(offer)}>Withdraw request</button>
          : <button className="secondary-button" onClick={() => setNegotiationTarget(offer)}>Negotiate</button>)}{awardable(offer) && <button className="primary-button" disabled={offer.needsReconfirmation} onClick={() => startAward(offer, null)}>{offer.options?.length ? 'Award main option' : 'Award offer'}</button>}<button className="text-button report-link" onClick={() => onReport(offer)}><Flag size={13} />Report</button></div></article>)}</div> : <div className="empty-state"><MessageSquareText size={22} /><strong>No verified offers yet</strong><span>Offers from verified sellers will appear here.</span></div>}
        <p className="privacy-note">Awarding does not confirm a booking or release guest details.</p>
      </section>
    </div>
  );
}

function DeadlineExtensionModal({ request, onClose, onSave }) {
  const { data: reference } = useReferenceData();
  const [responseDeadline, setResponseDeadline] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const now = new Date();
  const deadlineLimits = reference?.limits.requestDeadline;
  const inputFormat = "yyyy-MM-dd'T'HH:mm";
  const currentDeadline = new Date(request.responseDeadline);
  const minDeadline = deadlineLimits ? new Date(Math.max(currentDeadline.getTime(), addHours(now, deadlineLimits.minHours).getTime())) : currentDeadline;
  const maxDeadline = deadlineLimits ? addDays(now, deadlineLimits.maxDays) : addDays(now, 30);

  useEffect(() => {
    if (!deadlineLimits || responseDeadline) return;
    const suggested = new Date(Math.min(Math.max(currentDeadline.getTime() + deadlineLimits.minHours * 60 * 60 * 1000, minDeadline.getTime()), maxDeadline.getTime()));
    setResponseDeadline(format(suggested, inputFormat));
  }, [deadlineLimits, request.id]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    const nextDeadline = new Date(responseDeadline);
    if (Number.isNaN(nextDeadline.getTime()) || nextDeadline <= currentDeadline) {
      setError('Choose a deadline later than the current deadline.');
      return;
    }
    setSaving(true);
    const failure = await onSave({ response_deadline: nextDeadline.toISOString(), note: note.trim() || null });
    setSaving(false);
    if (failure) setError(failure);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal request-modal" role="dialog" aria-modal="true" aria-labelledby="deadline-modal-title">
        <div className="modal-heading"><div><p className="eyebrow">AGENCY WORKSPACE / {request.requestCode}</p><h2 id="deadline-modal-title">Extend response deadline</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
        {!deadlineLimits ? <div className="empty-state">Loading deadline limits...</div> : <form className="request-form" onSubmit={submit}>
          <label className="field-label">New response deadline<input className="form-input" type="datetime-local" value={responseDeadline} min={format(minDeadline, inputFormat)} max={format(maxDeadline, inputFormat)} onChange={(event) => setResponseDeadline(event.target.value)} required /></label>
          <label className="field-label">Note for matched sellers<textarea className="form-input" value={note} onChange={(event) => setNote(event.target.value)} maxLength="500" placeholder="Optional update" /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Extend deadline'}</button></div>
        </form>}
      </section>
    </div>
  );
}

function TripChangeModal({ request, onClose, onSave }) {
  const { data: reference } = useReferenceData();
  const [dateMode, setDateMode] = useState(request.travelMonth ? 'month' : 'exact');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const now = new Date();
  const deadlineLimits = reference?.limits.requestDeadline;
  const deadlineInputFormat = "yyyy-MM-dd'T'HH:mm";
  const currentDeadline = new Date(request.responseDeadline);
  const earliestDeadline = deadlineLimits ? new Date(Math.max(currentDeadline.getTime(), addHours(now, deadlineLimits.minHours).getTime())) : currentDeadline;
  const needsExtension = deadlineLimits && currentDeadline < addHours(now, deadlineLimits.minHours);
  const isHotelOnly = reference?.requirementTypes.find((type) => type.value === request.requirementType)?.audience === 'hotelier';
  const initialStops = (request.destinations ?? []).map((stop) => ({ destination: { id: stop.destinationId, name: stop.name, kind: stop.kind, label: stop.name }, nights: stop.nights ?? '' }));
  const [stops, setStops] = useState(initialStops);
  const stopsKey = (list) => list.map((stop) => `${stop.destination.id}:${stop.nights || ''}`).join('|');
  const destinationsChanged = stopsKey(stops) !== stopsKey(initialStops);

  async function submit(event) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const startDate = form.get('travelStartDate');
    const endDate = form.get('travelEndDate');
    const nights = dateMode === 'exact' ? differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) : Number(form.get('nights'));
    const childrenCount = Number(form.get('children') ?? 0);
    const childAges = String(form.get('childAges') ?? '').split(/[\s,;]+/).filter(Boolean).map(Number);
    const childRange = reference?.travellerTypes.find((traveller) => traveller.value === 'child');
    if (childrenCount > 0 && (childAges.length !== childrenCount || childAges.some((age) => !Number.isInteger(age) || age < childRange.minAge || age > childRange.maxAge))) {
      setError(`Enter one age between ${childRange.minAge} and ${childRange.maxAge} for each child.`);
      return;
    }
    if (nights < 1) {
      setError('Travel end must be after travel start.');
      return;
    }
    if (!stops.length) {
      setError('Keep at least one destination.');
      return;
    }
    const deadline = form.get('responseDeadline');
    setSaving(true);
    const failure = await onSave({
      ...(destinationsChanged ? { destinations: stops.map((stop) => ({ destination_id: stop.destination.id, nights: stop.nights ? Number(stop.nights) : null })) } : {}),
      travel_start_date: dateMode === 'exact' ? startDate : null,
      travel_end_date: dateMode === 'exact' ? endDate : null,
      travel_month: dateMode === 'month' ? form.get('travelMonth') : null,
      nights,
      adults: Number(form.get('adults')),
      children: Number(form.get('children')),
      infants: Number(form.get('infants')),
      child_ages: childAges,
      special_requests: String(form.get('specialRequests') ?? '').trim() || null,
      room_count: form.get('roomCount') ? Number(form.get('roomCount')) : null,
      response_deadline: deadline ? new Date(deadline).toISOString() : null,
      note: form.get('note') || null,
    });
    setSaving(false);
    if (failure) setError(failure);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal request-modal" role="dialog" aria-modal="true" aria-labelledby="trip-change-title">
        <div className="modal-heading"><div><p className="eyebrow">REQUEST {request.requestCode}</p><h2 id="trip-change-title">Change trip details</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
        <p className="modal-copy">Matched sellers are notified. Offers already received must be re-confirmed or revised by the seller before you can award them.</p>
        {!reference ? <div className="empty-state">Loading request options...</div> : (
          <form className="request-form" onSubmit={submit}>
            {isHotelOnly
              ? <DestinationPicker label="Destination" value={stops.map((stop) => stop.destination)} onChange={(chosen) => setStops(chosen.map((destination) => ({ destination, nights: '' })))} kinds={reference.limits.hotelLeadAllowedDestinationKinds ?? []} />
              : <StopsEditor stops={stops} onChange={setStops} max={reference.limits.maxRequestDestinations ?? 1} />}
            {destinationsChanged && <p className="table-secondary">Changing the destination re-routes the lead: sellers outside the new area lose access unless they already sent an offer, and sellers in the new area are alerted. The lead type stays {labelFor(reference.requirementTypes, request.requirementType)}.</p>}
            <div className="request-form-grid"><label className="field-label">Date mode<select className="form-select" value={dateMode} onChange={(event) => setDateMode(event.target.value)}><option value="exact">Exact dates</option><option value="month">Month and nights</option></select></label>{dateMode === 'exact' ? <><label className="field-label">Arrival<input className="form-input" name="travelStartDate" type="date" min={format(now, 'yyyy-MM-dd')} defaultValue={request.travelStartDate ?? ''} required /></label><label className="field-label">Departure<input className="form-input" name="travelEndDate" type="date" min={format(now, 'yyyy-MM-dd')} defaultValue={request.travelEndDate ?? ''} required /></label></> : <><label className="field-label">Travel month<input className="form-input" name="travelMonth" type="month" min={format(now, 'yyyy-MM')} defaultValue={request.travelMonth ?? ''} required /></label><label className="field-label">Nights<input className="form-input" name="nights" type="number" min="1" max="90" defaultValue={request.nights} required /></label></>}
              <label className="field-label">Adults<input className="form-input" name="adults" type="number" min="1" max="100" defaultValue={request.adults} required /></label><label className="field-label">Children<input className="form-input" name="children" type="number" min="0" max="80" defaultValue={request.children} /></label><label className="field-label">Infants<input className="form-input" name="infants" type="number" min="0" max="40" defaultValue={request.infants} /></label><label className="field-label">Rooms<input className="form-input" name="roomCount" type="number" min="1" max="50" defaultValue={request.roomCount ?? ''} /></label></div>
            <div className="request-form-grid"><label className="field-label">Child ages<input className="form-input" name="childAges" inputMode="numeric" defaultValue={request.childAges?.join(', ') ?? ''} placeholder="Comma-separated" /></label></div>
            <label className="field-label">Special requests<textarea className="form-input" name="specialRequests" maxLength="2000" defaultValue={request.specialRequests ?? ''} /></label>
            <label className="field-label">{needsExtension ? 'New response deadline (required: sellers need time to re-confirm)' : 'Extend response deadline (optional)'}<input className="form-input" name="responseDeadline" type="datetime-local" required={needsExtension} min={format(earliestDeadline, deadlineInputFormat)} max={format(addDays(now, deadlineLimits.maxDays), deadlineInputFormat)} /></label>
            <label className="field-label">Note to sellers (optional)<textarea className="form-input" name="note" maxLength="500" placeholder="For example: client added one adult and moved arrival by a day" /></label>
            <small className="table-secondary">Do not include traveller names, contact details or links.</small>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save and notify sellers'}</button></div>
          </form>
        )}
      </section>
    </div>
  );
}

function MessageThreadModal({ requestId, requestCode, sellerOrganizationId = '', peerName, onReport, onClose }) {
  const { data: reference } = useReferenceData();
  const [file, setFile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getRequestMessages(requestId, { sellerOrganizationId })
      .then((result) => active && setMessages(result.messages))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [requestId, sellerOrganizationId]);

  async function submit(event) {
    event.preventDefault();
    if ((!message.trim() && !file) || sending) return;
    setSending(true);
    setError('');
    try {
      const result = file
        ? await sendMessageAttachment(requestId, file, { body: message, sellerOrganizationId })
        : await sendRequestMessage(requestId, message, sellerOrganizationId);
      setMessages((current) => [...current, result.message]);
      setMessage('');
      setFile(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal message-modal" role="dialog" aria-modal="true" aria-labelledby="message-thread-title">
        <div className="modal-heading"><div><p className="eyebrow">REQUEST {requestCode}</p><h2 id="message-thread-title">Conversation with {peerName}</h2></div><button className="icon-button" aria-label="Close conversation" onClick={onClose}><X size={18} /></button></div>
        <div className="message-thread" aria-live="polite">
          {loading ? <div className="empty-state">Loading conversation...</div> : messages.length ? messages.map((item) => <article className={`message-bubble ${item.isMine ? 'mine' : ''}`} key={item.id}><strong>{item.isMine ? 'You' : item.senderName}</strong><p>{item.body}</p>{item.attachments?.length > 0 && <AttachmentList attachments={item.attachments} />}<time>{new Date(item.createdAt).toLocaleString()}</time>{!item.isMine && onReport && <button className="text-button report-link" onClick={() => onReport(item)}><Flag size={12} />Report</button>}</article>) : <div className="empty-state"><MessageSquareText size={22} /><strong>No messages yet</strong><span>Ask a question about this request or offer.</span></div>}
        </div>
        <form className="message-compose" onSubmit={submit}>
          <label className="visually-hidden" htmlFor="marketplace-message">Message</label>
          <textarea id="marketplace-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength="4000" placeholder={file ? 'Optional note with the file' : 'Write a message about this request'} required={!file} />
          <div>
            <small>Keep traveler contact details and external links out of marketplace messages.</small>
            {file
              ? <span className="attachment-chip"><Paperclip size={13} />{file.name}<button type="button" className="icon-button" aria-label="Remove file" onClick={() => setFile(null)}><X size={13} /></button></span>
              : reference && <label className="secondary-button document-upload"><Paperclip size={14} />Attach file<input type="file" className="visually-hidden" accept={reference.limits.documentUpload.allowedMimeTypes.join(',')} onChange={(event) => { setFile(event.target.files[0] ?? null); event.target.value = ''; }} /></label>}
            <button className="primary-button" disabled={sending || (!message.trim() && !file)}>{sending ? 'Sending...' : 'Send message'}</button>
          </div>
        </form>
        {error && <p className="auth-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}

function formatOfferPrice(offer) {
  return offer.kind === 'hotel_room'
    ? `${formatMinor(offer.ratePerNightMinor, offer.currency)} / room / night`
    : formatMinor(offer.totalMinor, offer.currency);
}

function NegotiationForm({ offer, onSubmit, onCancel }) {
  const { data: reference } = useReferenceData();
  const [kind, setKind] = useState('revision_request');
  const [optionId, setOptionId] = useState('');
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const counter = kind === 'counter_offer';
  const option = offer.options?.find((item) => item.id === optionId);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    const failure = await onSubmit({
      kind,
      message: message.trim() || null,
      offer_option_id: optionId || null,
      counter_price_minor: counter ? toMinorUnits(price, offer.currency) : null,
    });
    setSaving(false);
    if (failure) setError(failure);
  }

  return (
    <form className="award-confirm" onSubmit={submit}>
      <p className="modal-copy">Ask <strong>{offer.sellerName}</strong> to change this offer. The seller can revise it, accept your counter price, or decline. Each offer can be negotiated up to {reference?.limits.maxNegotiationRoundsPerOffer} times.</p>
      <div className="request-form-grid">
        <label className="field-label">Type<select className="form-select" value={kind} onChange={(event) => setKind(event.target.value)}>{reference?.negotiationKinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        {offer.options?.length > 0 && <label className="field-label">Option<select className="form-select" value={optionId} onChange={(event) => setOptionId(event.target.value)}><option value="">{offer.optionLabel ?? 'Main option'}</option>{offer.options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
        {counter && <label className="field-label">{offer.kind === 'hotel_room' ? `Counter rate per room, per night (${offer.currency})` : `Counter total price (${offer.currency})`}<input className="form-input" type="number" min="0.01" step="any" value={price} onChange={(event) => setPrice(event.target.value)} required /></label>}
      </div>
      <small className="table-secondary">Current price: {formatOfferPrice(option ? { ...offer, ...option } : offer)}</small>
      <label className="field-label">{counter ? 'Note to the seller (optional)' : 'What should the seller change?'}<textarea className="form-input" value={message} onChange={(event) => setMessage(event.target.value)} maxLength="1000" minLength={counter ? undefined : 5} required={!counter} placeholder="For example: client prefers a private guide on day two" /></label>
      <small className="table-secondary">Do not include contact details or links.</small>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Back</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Sending...' : 'Send to seller'}</button></div>
    </form>
  );
}

function OfferOptionList({ offer, reference, canAward, onAward }) {
  if (!offer.options?.length) return null;
  return (
    <div className="offer-option-list">
      <small>Alternative options (same terms)</small>
      <ul>{offer.options.map((option) => {
        const details = offer.kind === 'hotel_room'
          ? [option.roomType, labelFor(reference?.mealPlans, option.mealPlan)]
          : [labelFor(reference?.hotelCategories, option.hotelCategory)];
        return (
          <li key={option.id}>
            <span><strong>{option.label}</strong> {[...details, option.notes].filter(Boolean).join(' / ')}</span>
            <span>{option.comparisonTotalMinor != null ? formatMinor(option.comparisonTotalMinor, offer.comparisonCurrency) : formatOfferPrice({ ...offer, ...option })}{option.comparisonPerTravellerMinor != null ? ` (${formatMinor(option.comparisonPerTravellerMinor, offer.comparisonCurrency)} per traveller)` : ''}</span>
            {canAward && <button className="secondary-button" disabled={offer.needsReconfirmation} onClick={() => onAward(option)}>Award this option</button>}
          </li>
        );
      })}</ul>
    </div>
  );
}

function NotificationPopover({ notifications, unreadCount, loading, onClose, onRead, onReadAll }) {
  return (
    <section className="notification-popover" aria-label="Notifications">
      <header><div><strong>Notifications</strong><small>{unreadCount} unread</small></div><button className="icon-button" aria-label="Close notifications" onClick={onClose}><X size={16} /></button></header>
      {unreadCount > 0 && <button className="notification-read-all" onClick={onReadAll}>Mark all as read</button>}
      <div className="notification-list">
        {loading ? <div className="notification-empty">Loading notifications...</div> : notifications.length ? notifications.map((notification) => <button className={`notification-item ${notification.readAt ? 'read' : 'unread'}`} key={notification.id} onClick={() => !notification.readAt && onRead(notification)}><span className="notification-dot" /><span><strong>{notification.title}</strong><small>{notification.message}</small><time>{new Date(notification.createdAt).toLocaleString()}</time></span></button>) : <div className="notification-empty">No notifications yet.</div>}
      </div>
    </section>
  );
}

function pageSubtitle(page, role) {
  if (page === 'Security') return 'Manage authenticator sign-in and recovery codes.';
  if (page === 'Integrations') return 'Send marketplace events to your CRM as signed webhooks.';
  if (page === 'Reports') return 'Track response, awards and savings against your request budgets.';
  if (page === 'Performance') return 'Review offer outcomes, response speed, loss reasons and verified ratings.';
  if (page === 'Verification') return 'Upload business documents so sellers see your agency as verified.';
  if (page === 'Bookings') return role === 'agency'
    ? 'Confirm awarded offers, share guest details and track seller confirmations.'
    : 'Won bookings, guest details shared by the agency and your confirmations.';
  if (role === 'dmc') {
    if (page === 'Matching requests') return 'Destination opportunities matched to your coverage.';
    if (page === 'My offers') return 'Track your submitted prices and response status.';
    return 'Manage your destination profile and verification.';
  }
  if (role === 'hotelier') {
    if (page === 'Booking requests') return 'Review room requirements and send availability-backed quotes.';
    if (page === 'Properties') return 'Manage your public property details and verification.';
    return 'Review and maintain room inventory by date.';
  }
  if (page === 'Requests') return 'Plan, publish and track your destination requests.';
  if (page === 'Offers') return 'Keep every seller response in view.';
  return 'Your verified destination specialists.';
}

function Overview({ requests, offers, loading, onOpenRequests, onOpenOffers, onOpenRequest }) {
  const openRequests = requests.filter((request) => request.status === 'open').length;
  const drafts = requests.filter((request) => request.status === 'draft').length;
  const awarded = requests.filter((request) => request.status === 'awarded').length;
  const offerCount = requests.reduce((total, request) => total + Number(request.offers ?? 0), 0);
  const recentOffers = offers.slice(0, 3).map((offer) => ({
    seller: offer.sellerName,
    destination: offer.destination,
    request: offer.requestCode,
    amount: formatOfferPrice(offer),
    received: new Date(offer.createdAt).toLocaleDateString(),
    tag: offer.status,
    initials: (offer.sellerName ?? 'S').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(),
    color: 'blue',
  }));
  return (
    <>
      <section className="metric-strip" aria-label="Workspace summary">
        <Metric label="Open requests" value={String(openRequests).padStart(2, '0')} note="Published by your agency" icon={FileText} />
        <Metric label="Verified offers" value={String(offerCount).padStart(2, '0')} note="From eligible sellers" icon={MessageSquareText} accent="teal" />
        <Metric label="Drafts" value={String(drafts).padStart(2, '0')} note="Not visible to sellers" icon={Clock3} />
        <Metric label="Awarded" value={String(awarded).padStart(2, '0')} note="Booking confirmation pending" icon={ArrowDownUp} />
      </section>

      <div className="overview-grid">
        <section className="surface-section requests-section">
          <div className="section-heading"><div><p className="eyebrow">YOUR PIPELINE</p><h2>Requests in motion</h2></div><button className="text-button" onClick={onOpenRequests}>All requests <ChevronRight size={15} /></button></div>
          {loading ? <div className="empty-state">Loading requests...</div> : requests.length ? <RequestTable requests={requests.slice(0, 4)} compact onOpenRequest={onOpenRequest} /> : <div className="empty-state"><FileText size={22} /><strong>No requests yet</strong><span>Create your first destination request.</span></div>}
        </section>
        <section className="surface-section offers-section">
          <div className="section-heading"><div><p className="eyebrow">LATEST RESPONSES</p><h2>Recent offers</h2></div><button className="icon-button" aria-label="View all offers" onClick={onOpenOffers}><ArrowUpRight size={17} /></button></div>
          <div className="recent-offers">{recentOffers.length ? recentOffers.map((offer) => <OfferRow key={`${offer.seller}-${offer.request}`} offer={offer} compact />) : <div className="empty-state compact-empty">No verified offers received.</div>}</div>
          <button className="offers-link" onClick={onOpenOffers}>Review all offers <ArrowUpRight size={15} /></button>
        </section>
      </div>

      <section className="market-note"><div className="market-note-icon"><Globe2 size={20} /></div><div><strong>Private by default</strong><span>Only verified, matched sellers can see published requests.</span></div><button className="text-button" onClick={onOpenRequests}>View requests <ArrowUpRight size={15} /></button></section>
    </>
  );
}

function Metric({ label, value, note, icon: Icon, accent }) {
  return (
    <div className="metric">
      <div className="metric-top"><span>{label}</span><Icon size={17} className={accent === 'teal' ? 'metric-icon teal' : 'metric-icon'} strokeWidth={1.8} /></div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function RequestWorkspace({ requests, loading, query, setQuery, statusFilter, setStatusFilter, onCreate, onCloneRequest, onOpenRequest, onExtendDeadline, onCancelRequest }) {
  const filters = [{ label: 'All requests', value: 'all' }, { label: 'Open', value: 'open' }, { label: 'Closed', value: 'closed' }, { label: 'Awarded', value: 'awarded' }, { label: 'Expired', value: 'expired' }, { label: 'Draft', value: 'draft' }];
  return (
    <section className="surface-section full-section">
      <div className="section-heading request-list-heading">
        <div><p className="eyebrow">AGENCY PIPELINE</p><h2>All requests <span className="heading-count">{requests.length}</span></h2></div>
      </div>
      <div className="table-toolbar">
        <div className="filter-tabs" role="group" aria-label="Filter requests by status">
          {filters.map((filter) => <button key={filter.value} className={statusFilter === filter.value ? 'selected' : ''} onClick={() => setStatusFilter(filter.value)}>{filter.label}</button>)}
        </div>
        <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search requests" aria-label="Search requests" /></label>
      </div>
      {loading ? <div className="empty-state">Loading requests...</div> : requests.length ? <RequestTable requests={requests} onOpenRequest={onOpenRequest} onCloneRequest={onCloneRequest} onExtendDeadline={onExtendDeadline} onCancelRequest={onCancelRequest} /> : <div className="empty-state"><FileText size={24} /><strong>No requests match</strong><span>Try another status or create a request.</span><button className="text-button" onClick={onCreate}><Plus size={15} />Create request</button></div>}
    </section>
  );
}

function RequestTable({ requests, compact = false, onOpenRequest, onCloneRequest, onExtendDeadline, onCancelRequest }) {
  return (
    <div className={`table-scroll ${compact ? 'compact-table' : ''}`}>
      <table className="request-table">
        <thead><tr><th>DESTINATION</th><th>TRAVEL DATES</th><th>TRAVELERS</th><th>OFFERS</th><th>STATUS</th><th><span className="visually-hidden">Open request</span></th></tr></thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td><div className="destination-cell">
                {request.image ? <img src={request.image} alt="" loading="lazy" /> : <span className="destination-placeholder"><MapPin size={16} /></span>}
                <span><strong>{request.destinations?.length > 1 ? routeText(request.destinations) : request.destination}</strong><small>{request.requestCode ?? request.id} <span className="dot-separator">/</span> {request.country ?? request.destinationCountry}</small></span>
              </div></td>
              <td><span className="table-primary">{request.dates}</span><small className="table-secondary">{request.deadline}</small></td>
              <td><span className="table-primary">{request.travelers}</span></td>
              <td><span className="offer-count">{Number(request.offers ?? 0).toString().padStart(2, '0')}</span><small className="table-secondary">responses</small></td>
              <td><span className={`status-pill ${request.status}`}><i />{request.status[0].toUpperCase()}{request.status.slice(1)}</span></td>
              <td className="request-row-actions">{onCloneRequest && <button className="icon-button" aria-label={`Copy ${request.destination} request`} title="Copy request to a new draft" onClick={() => onCloneRequest(request)}><Copy size={15} /></button>}{onExtendDeadline && request.status === 'open' && <button className="icon-button" aria-label={`Extend deadline for ${request.requestCode}`} title="Extend response deadline" onClick={() => onExtendDeadline(request)}><Clock3 size={15} /></button>}{onCancelRequest && ['draft', 'open', 'closed'].includes(request.status) && <button className="icon-button" aria-label={`Cancel ${request.requestCode}`} title="Cancel request" onClick={() => onCancelRequest(request)}><X size={15} /></button>}<button className="icon-button row-open" aria-label={`Open ${request.destination} request`} onClick={() => onOpenRequest?.(request)}><ArrowUpRight size={16} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OfferWorkspace({ offers, onCompare }) {
  const [sort, setSort] = useState('newest');
  const sortedOffers = [...offers].sort((left, right) => {
    if (sort === 'seller') return left.sellerName.localeCompare(right.sellerName);
    if (sort === 'expiry') return new Date(left.validityUntil) - new Date(right.validityUntil);
    return new Date(right.createdAt) - new Date(left.createdAt);
  });

  return (
    <section className="surface-section full-section">
      <div className="section-heading request-list-heading">
        <div><p className="eyebrow">SELLER RESPONSES</p><h2>Offers received <span className="heading-count">{offers.length}</span></h2></div>
        <label className="offer-sort-control"><span>Sort</span><select className="form-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="expiry">Validity ending soon</option><option value="seller">Seller name</option></select></label>
      </div>
      <div className="offer-list-head"><span>SELLER</span><span>REQUEST</span><span>OFFER PRICE</span><span>RECEIVED</span><span>STATUS</span><span /></div>
      <div className="offer-list">
        {sortedOffers.map((offer) => (
          <div className="offer-list-row" key={offer.id}>
            <div className="seller-cell"><span className="seller-avatar blue">{offer.sellerName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{offer.sellerName}</strong><small><BadgeCheck size={13} />Verified seller</small></span></div>
            <div><strong>{offer.destination}</strong><small>{offer.requestCode}</small></div>
            <div className="offer-price"><strong>{formatOfferPrice(offer)}</strong><small>{offer.kind === 'hotel_room' ? `${offer.roomType} / ${offer.mealPlan ?? 'meal plan flexible'}` : 'total package'}</small></div>
            <span className="received-time">{new Date(offer.createdAt).toLocaleDateString()}</span>
            <span className="offer-highlight">{offer.status}</span>
            <button className="secondary-button review-button" onClick={() => onCompare(offer)}>Compare <ArrowUpRight size={14} /></button>
          </div>
        ))}
      </div>
      {offers.length === 0 && <div className="empty-state"><MessageSquareText size={23} /><strong>No offers received</strong><span>Verified seller offers will appear here.</span></div>}
      <p className="privacy-note"><Globe2 size={15} />Seller rank and comparisons are private to your agency workspace.</p>
    </section>
  );
}

function OfferRow({ offer, compact }) {
  return (
    <div className={`offer-row ${compact ? 'compact' : ''}`}>
      <span className={`seller-avatar ${offer.color}`}>{offer.initials}</span>
      <div className="offer-row-main"><strong>{offer.seller}</strong><small>{offer.destination} <span className="dot-separator">/</span> {offer.received}</small></div>
      <div className="offer-row-price"><strong>{offer.amount}</strong><small>{offer.tag}</small></div>
    </div>
  );
}

function SupplierWorkspace() {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(0);
  const [showFavorites, setShowFavorites] = useState(false);
  const [directory, setDirectory] = useState({ suppliers: [], pagination: { limit: 25, offset: 0, total: 0 } });
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [favoriteBusy, setFavoriteBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    (showFavorites
      ? listPreferredSuppliers().then((result) => ({ suppliers: result.suppliers.map((supplier) => ({ ...supplier, verified: supplier.isEligible, isFavorite: true })), pagination: { limit: 25, offset: 0, total: result.suppliers.length } }))
      : listMarketplaceSuppliers({ search, country, limit: 25, offset: page * 25 }))
      .then((result) => {
        if (active) {
          setDirectory(result);
          setError('');
        }
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [search, country, page, showFavorites]);

  useEffect(() => {
    let active = true;
    listPreferredSuppliers().then((result) => active && setFavoriteCount(result.suppliers.length)).catch(() => {});
    return () => { active = false; };
  }, [directory.suppliers]);

  async function togglePreferred(supplier) {
    setFavoriteBusy(supplier.organizationId);
    setError('');
    try {
      await setPreferredSupplier(supplier.organizationId, !supplier.isFavorite);
      if (showFavorites && supplier.isFavorite) {
        setDirectory((current) => ({ ...current, suppliers: current.suppliers.filter((item) => item.organizationId !== supplier.organizationId), pagination: { ...current.pagination, total: Math.max(0, current.pagination.total - 1) } }));
      } else {
        setDirectory((current) => ({ ...current, suppliers: current.suppliers.map((item) => item.organizationId === supplier.organizationId ? { ...item, isFavorite: !supplier.isFavorite } : item) }));
      }
      const updated = await listPreferredSuppliers();
      setFavoriteCount(updated.suppliers.length);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setFavoriteBusy('');
    }
  }

  const suppliers = directory.suppliers;
  const total = directory.pagination.total;

  return (
    <section className="surface-section full-section">
      <div className="section-heading request-list-heading">
        <div><p className="eyebrow">DESTINATION PARTNERS</p><h2>{showFavorites ? 'Preferred suppliers' : 'Verified supplier directory'} <span className="heading-count">{showFavorites ? favoriteCount : total}</span></h2></div>
      </div>
      <div className="request-toolbar">
        <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search company or destination" aria-label="Search suppliers" /></label>
        <label className="supplier-country-filter"><span>Country</span><input className="form-input" value={country} onChange={(event) => { setCountry(event.target.value.toUpperCase().slice(0, 2)); setPage(0); }} placeholder="ISO code" aria-label="Filter by country code" maxLength="2" /></label>
        <label className="preferred-filter"><input type="checkbox" checked={showFavorites} onChange={(event) => { setShowFavorites(event.target.checked); setPage(0); }} />Preferred only</label>
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="supplier-grid">
        {suppliers.map((supplier) => (
          <article className="supplier-row" key={supplier.organizationId}>
            <span className="supplier-avatar blue"><Building2 size={20} /></span>
            <div className="supplier-info"><div className="supplier-title"><strong>{supplier.name}{supplier.isFavorite && <em className="preferred-label">Preferred</em>}</strong>{supplier.verified ? <span className="verified-mark" title="Verified supplier"><BadgeCheck size={15} /></span> : <span className="supplier-unavailable">Unavailable</span>}</div><span><MapPin size={13} />{supplier.propertyCity ? `${supplier.propertyCity}, ` : ''}${supplier.countryCode}</span><small>{supplier.type === 'dmc' ? `Coverage: ${supplier.coverageDestinations.join(', ') || 'Not specified'}` : 'Hotel partner'}</small></div>
            <button className={`icon-button supplier-favorite-button ${supplier.isFavorite ? 'is-favorite' : ''}`} aria-label={`${supplier.isFavorite ? 'Remove' : 'Add'} ${supplier.name} ${supplier.isFavorite ? 'from' : 'to'} preferred suppliers`} title={supplier.isFavorite ? 'Remove preferred supplier' : 'Save as preferred supplier'} disabled={favoriteBusy === supplier.organizationId} onClick={() => togglePreferred(supplier)}><Star size={16} fill={supplier.isFavorite ? 'currentColor' : 'none'} /></button>
          </article>
        ))}
      </div>
      {!loading && suppliers.length === 0 && <div className="empty-state"><UsersRound size={23} /><strong>{showFavorites ? 'No preferred suppliers yet' : 'No verified suppliers found'}</strong><span>{showFavorites ? 'Save a supplier from the directory to find it here and invite it faster.' : 'Try another destination or check back as partners complete verification.'}</span></div>}
      {loading && <div className="empty-state">Loading verified suppliers...</div>}
      <div className="supplier-pagination"><span>{total ? `${directory.pagination.offset + 1}-${Math.min(directory.pagination.offset + suppliers.length, total)} of ${total}` : '0 suppliers'}</span><div><button className="secondary-button" disabled={page === 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</button><button className="secondary-button" disabled={loading || (page + 1) * 25 >= total} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>
    </section>
  );
}

export default App;