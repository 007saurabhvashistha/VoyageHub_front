import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDownUp,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  Check,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  Building2,
  Clock3,
  FileText,
  Flag,
  Globe2,
  LayoutDashboard,
  Hotel,
  LogOut,
  MapPin,
  MessageSquareText,
  Plus,
  Search,
  ShieldCheck,
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
import { OfferDetails, OfferFormModal } from './OfferForm.jsx';
import { ReportDialog } from './ReportDialog.jsx';
import { CapabilitiesContext, useCan } from './capabilities.js';
import { formatMinor, toMinorUnits } from './money.js';
import { labelFor, useReferenceData } from './referenceData.js';
import { MfaChallengePage, MfaSecurityPanel, MfaSetupPage } from './MfaSecurity.jsx';
import { CookieNotice, LegalAcceptanceGate, LegalLinks } from './Legal.jsx';
import { AccountPanel, DeletionPendingPage } from './AccountPanel.jsx';
import { DestinationPicker } from './DestinationPicker.jsx';
import { BookingsWorkspace } from './Bookings.jsx';
import { IntegrationsPanel } from './Integrations.jsx';
import {
  awardMarketplaceOffer,
  createMarketplaceRequest,
  getCurrentSession,
  getRequestMessages,
  listHotelInventory,
  getSellerProfile,
  listMarketplaceOffers,
  listMarketplaceRequests,
  listMarketplaceSuppliers,
  listNotifications,
  listRequestOffers,
  markAllNotificationsRead,
  markNotificationRead,
  logoutAccount,
  publishMarketplaceRequest,
  submitDmcOffer,
  submitHotelOffer,
  updateSellerProfile,
  saveHotelInventory,
  sendRequestMessage,
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
      { label: 'Suppliers', icon: UsersRound },
      { label: 'Team', icon: UserCog },
      { label: 'Integrations', icon: Webhook, capability: 'integration.manage' },
      { label: 'Security', icon: ShieldCheck },
    ],
    dmc: [
      { label: 'Overview', icon: LayoutDashboard },
      { label: 'Matching requests', icon: FileText },
      { label: 'My offers', icon: MessageSquareText },
      { label: 'Bookings', icon: ClipboardCheck },
      { label: 'Company profile', icon: Building2 },
      { label: 'Team', icon: UserCog },
      { label: 'Integrations', icon: Webhook, capability: 'integration.manage' },
      { label: 'Security', icon: ShieldCheck },
    ],
    hotelier: [
      { label: 'Overview', icon: LayoutDashboard },
      { label: 'Booking requests', icon: FileText },
      { label: 'Bookings', icon: ClipboardCheck },
      { label: 'Properties', icon: Hotel },
      { label: 'Availability', icon: CalendarDays },
      { label: 'Team', icon: UserCog },
      { label: 'Integrations', icon: Webhook, capability: 'integration.manage' },
      { label: 'Security', icon: ShieldCheck },
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

  async function saveSellerOffer(payload) {
    if (!responseTarget) return null;
    try {
      await (role === 'dmc' ? submitDmcOffer : submitHotelOffer)(responseTarget.id, payload);
      setResponseTarget(null);
      await syncMarketplace();
      setToast(role === 'hotelier' ? 'Room quote submitted to the requesting agency.' : 'Offer submitted to the requesting agency.');
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

        <div className="workspace-switcher">
          <span className="workspace-avatar">{details.initials[0]}</span>
          <span className="workspace-copy"><strong>{details.organization}</strong><small>{details.roleLabel}</small></span>
          <ChevronDown size={15} />
        </div>

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
              onOpenRequest={openComparison}
            />
          )}
          {role === 'agency' && activePage === 'Offers' && <OfferWorkspace offers={offers} onCompare={(offer) => openComparison(requests.find((item) => item.id === offer.requestId))} />}
          {role === 'agency' && activePage === 'Suppliers' && <SupplierWorkspace />}
          {activePage === 'Security' && <MfaSecurityPanel account={account} />}
          {activePage === 'Security' && <AccountPanel account={account} onDeleted={(result) => navigate('/login', { replace: true, state: { notice: `Account deletion scheduled for ${new Date(result.scheduledFor).toLocaleDateString()}. Sign in before then to cancel.` } })} />}
          {activePage === 'Team' && <TeamPanel account={account} />}
          {activePage === 'Integrations' && <IntegrationsPanel />}
          {activePage === 'Bookings' && <BookingsWorkspace />}
          {role === 'dmc' && activePage === 'Overview' && <DmcOverview requests={requests} offers={offers} sellerProfile={sellerProfile} loading={dataLoading} onOpenRequests={() => setActivePage('Matching requests')} onOpenOffers={() => setActivePage('My offers')} onRespond={setResponseTarget} />}
          {role === 'dmc' && activePage === 'Matching requests' && <DmcRequestWorkspace requests={requests} sellerProfile={sellerProfile} loading={dataLoading} onRespond={setResponseTarget} onReport={(request) => setReportTarget({ type: 'request', id: request.id, label: `request ${request.requestCode}` })} onMessage={(request) => setMessageThread({ requestId: request.id, requestCode: request.requestCode, peerName: request.agencyName })} />}
          {role === 'dmc' && activePage === 'My offers' && <DmcOffers offers={offers} loading={dataLoading} />}
          {role === 'dmc' && activePage === 'Company profile' && <RoleProfile role="dmc" profile={sellerProfile} organization={details.organization} onSave={saveSellerProfile} onDocumentsChanged={syncMarketplace} />}
          {role === 'hotelier' && activePage === 'Overview' && <HotelOverview requests={requests} offers={offers} sellerProfile={sellerProfile} loading={dataLoading} onOpenRequests={() => setActivePage('Booking requests')} onOpenAvailability={() => setActivePage('Availability')} onRespond={setResponseTarget} />}
          {role === 'hotelier' && activePage === 'Booking requests' && <HotelRequestWorkspace requests={requests} sellerProfile={sellerProfile} loading={dataLoading} onRespond={setResponseTarget} onReport={(request) => setReportTarget({ type: 'request', id: request.id, label: `request ${request.requestCode}` })} onMessage={(request) => setMessageThread({ requestId: request.id, requestCode: request.requestCode, peerName: request.agencyName })} />}
          {role === 'hotelier' && activePage === 'Properties' && <RoleProfile role="hotelier" profile={sellerProfile} organization={details.organization} onSave={saveSellerProfile} onDocumentsChanged={syncMarketplace} />}
          {role === 'hotelier' && activePage === 'Availability' && <HotelAvailability inventory={inventory} loading={dataLoading} onSave={saveInventory} />}

          <footer className="page-footer"><span>Lead Exchange</span><LegalLinks /></footer>
        </div>
      </main>

      {createOpen && <CreateRequestModal draft={draftToPublish} onClose={() => { setCreateOpen(false); setDraftToPublish(null); }} onCreate={saveRequestDraft} onPublish={publishDraft} />}

      {responseTarget && <OfferFormModal role={role} target={responseTarget} roomTypes={[...new Set(inventory.map((item) => item.roomType))]} onClose={() => setResponseTarget(null)} onSubmit={saveSellerOffer} />}
      {comparison && <OfferComparison request={comparison.request} offers={comparison.offers} onReport={(offer) => setReportTarget({ type: 'offer', id: offer.id, label: `offer from ${offer.sellerName}` })} onMessage={(offer) => setMessageThread({ requestId: comparison.request.id, requestCode: comparison.request.requestCode, sellerOrganizationId: offer.sellerOrganizationId, peerName: offer.sellerName })} onAward={async (offerId, notSelectedReason) => {
        try {
          await awardMarketplaceOffer(comparison.request.id, offerId, notSelectedReason);
          setComparison(null);
          await syncMarketplace();
          setToast('Offer awarded. Confirm the booking under Bookings to share guest details with the seller.');
        } catch (error) {
          setMarketplaceError(error.message);
        }
      }} onClose={() => setComparison(null)} />}
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
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timeout = window.setTimeout(() => {
      listMarketplaceSuppliers({ search: search.trim(), limit: 10 })
        .then((result) => { if (active) { setResults(result.suppliers); setError(''); } })
        .catch((requestError) => active && setError(requestError.message))
        .finally(() => active && setLoading(false));
    }, 250);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [search]);

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
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="invite-results">
        {loading ? <small className="table-secondary">Searching verified suppliers...</small> : results.length ? results.map((supplier) => (
          <label key={supplier.organizationId} className="invite-result">
            <input type="checkbox" checked={selectedIds.has(supplier.organizationId)} disabled={!selectedIds.has(supplier.organizationId) && selected.length >= maxInvited} onChange={() => toggle(supplier)} />
            <span><strong>{supplier.name}</strong><small>{supplier.type === 'hotelier' ? `Hotel / ${supplier.propertyCity ?? supplier.countryCode}` : `DMC / ${supplier.coverageDestinations.join(', ')}`}</small></span>
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
  const now = new Date();
  const deadlineLimits = reference?.limits.requestDeadline;
  const deadlineInputFormat = "yyyy-MM-dd'T'HH:mm";

  async function submitDraft(event) {
    event.preventDefault();
    setFormError('');
    const form = new FormData(event.currentTarget);
    const services = form.getAll('services');
    if (!destination.length) {
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
    if ((budgetMin && !budgetMax) || (!budgetMin && budgetMax)) {
      setFormError('Enter both budget limits or leave the budget blank.');
      return;
    }

    const fields = {
      destination_id: destination[0].id,
      travel_start_date: dateMode === 'exact' ? startDate : null,
      travel_end_date: dateMode === 'exact' ? endDate : null,
      travel_month: dateMode === 'month' ? form.get('travelMonth') : null,
      nights,
      adults: Number(form.get('adults')),
      children: Number(form.get('children')),
      infants: Number(form.get('infants')),
      group_type: form.get('groupType'),
      hotel_category: form.get('hotelCategory') ? Number(form.get('hotelCategory')) : null,
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
            <dl className="request-preview-list"><div><dt>Destination</dt><dd>{draft.destination}, {draft.destinationCountry}</dd></div><div><dt>Travel</dt><dd>{draft.dates} / {draft.nights} nights</dd></div><div><dt>Travelers</dt><dd>{draft.travelers}</dd></div><div><dt>Services</dt><dd>{draft.services.map((service) => labelFor(reference?.services, service)).join(', ')}</dd></div><div><dt>Response deadline</dt><dd>{new Date(draft.responseDeadline).toLocaleString()}</dd></div><div><dt>Visibility</dt><dd>{labelFor(reference?.requestVisibilities, draft.visibility)}</dd></div>{draft.invitedSellers?.length > 0 && <div><dt>Invited suppliers</dt><dd>{draft.invitedSellers.map((seller) => seller.name).join(', ')}</dd></div>}</dl>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Keep draft</button><button type="button" className="primary-button" onClick={onPublish}>Publish request</button></div>
          </>
        ) : !reference ? <div className="empty-state">{referenceError || 'Loading request options...'}</div> : (
          <form className="request-form" onSubmit={submitDraft}>
            <DestinationPicker label="Destination" value={destination} onChange={setDestination} placeholder="Search city, region or country" />
            <div className="request-form-grid"><label className="field-label">Date mode<select className="form-select" value={dateMode} onChange={(event) => setDateMode(event.target.value)}><option value="exact">Exact dates</option><option value="month">Month and nights</option></select></label>{dateMode === 'exact' ? <><label className="field-label">Arrival<input className="form-input" name="travelStartDate" type="date" min={format(now, 'yyyy-MM-dd')} required /></label><label className="field-label">Departure<input className="form-input" name="travelEndDate" type="date" min={format(now, 'yyyy-MM-dd')} required /></label></> : <><label className="field-label">Travel month<input className="form-input" name="travelMonth" type="month" min={format(now, 'yyyy-MM')} required /></label><label className="field-label">Nights<input className="form-input" name="nights" type="number" min="1" max="90" required /></label></>}
              <label className="field-label">Adults<input className="form-input" name="adults" type="number" min="1" max="100" defaultValue="2" required /></label><label className="field-label">Children<input className="form-input" name="children" type="number" min="0" max="80" defaultValue="0" /></label><label className="field-label">Infants<input className="form-input" name="infants" type="number" min="0" max="40" defaultValue="0" /></label><label className="field-label">Group type<select className="form-select" name="groupType">{reference.groupTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label className="field-label">Hotel category<select className="form-select" name="hotelCategory"><option value="">Any</option>{reference.hotelCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label className="field-label">Rooms<input className="form-input" name="roomCount" type="number" min="1" max="50" defaultValue="1" /></label><label className="field-label">Meal plan<select className="form-select" name="mealPlan"><option value="">Any</option>{reference.mealPlans.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}</select></label></div>
            <fieldset className="service-picker"><legend>Services requested</legend>{reference.services.map((service) => <label key={service.value}><input type="checkbox" name="services" value={service.value} />{service.label}</label>)}</fieldset>
            <p className="field-label budget-title">Optional budget range</p><div className="request-form-grid budget-grid"><select className="form-select" name="budgetCurrency" aria-label="Budget currency" defaultValue={reference.defaults.currency}>{reference.currencies.map((code) => <option key={code} value={code}>{code}</option>)}</select><input className="form-input" name="budgetMin" type="number" min="0" step="any" placeholder="Minimum" /><input className="form-input" name="budgetMax" type="number" min="0" step="any" placeholder="Maximum" /></div>
            <label className="field-label">Response deadline<input className="form-input" name="responseDeadline" type="datetime-local" required min={format(addHours(now, deadlineLimits.minHours), deadlineInputFormat)} max={format(addDays(now, deadlineLimits.maxDays), deadlineInputFormat)} defaultValue={format(addHours(now, deadlineLimits.defaultHours), deadlineInputFormat)} /></label>
            <label className="field-label">Who can see this request<select className="form-select" value={visibility} onChange={(event) => setVisibility(event.target.value)}>{reference.requestVisibilities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            {visibility !== 'open' && <SupplierInvitePicker selected={invitedSuppliers} onChange={setInvitedSuppliers} maxInvited={reference.limits.maxInvitedSuppliers} />}
            {formError && <p className="auth-error" role="alert">{formError}</p>}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save draft and preview'}</button></div>
          </form>
        )}
      </section>
    </div>
  );
}

function OfferComparison({ request, offers, onAward, onMessage, onReport, onClose }) {
  const { data: reference } = useReferenceData();
  const [awardTarget, setAwardTarget] = useState(null);
  const [notSelectedReason, setNotSelectedReason] = useState('');
  const [awarding, setAwarding] = useState(false);
  const canAwardRole = useCan('request.award');
  const canAward = ['open', 'closed'].includes(request.status) && canAwardRole;
  const canMessage = useCan('message.write');

  async function confirmAward() {
    setAwarding(true);
    await onAward(awardTarget.id, notSelectedReason);
    setAwarding(false);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal comparison-modal" role="dialog" aria-modal="true" aria-labelledby="comparison-title">
        <div className="modal-heading"><div><p className="eyebrow">AGENCY COMPARISON</p><h2 id="comparison-title">{request.destination} offers</h2></div><button className="icon-button" aria-label="Close comparison" onClick={onClose}><X size={18} /></button></div>
        {awardTarget ? (
          <div className="award-confirm">
            <p className="modal-copy">Award <strong>{awardTarget.sellerName}</strong> at <strong>{formatOfferPrice(awardTarget)}</strong>? Every other active offer will be marked not selected.</p>
            <label className="field-label" htmlFor="not-selected-reason">Optional reason shared with sellers who were not selected</label>
            <textarea id="not-selected-reason" className="form-input" value={notSelectedReason} onChange={(event) => setNotSelectedReason(event.target.value)} maxLength="300" placeholder="For example: client chose a higher hotel category" />
            <small className="table-secondary">Do not include contact details or links. {300 - notSelectedReason.length} characters left.</small>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setAwardTarget(null)} disabled={awarding}>Back</button><button type="button" className="primary-button" onClick={confirmAward} disabled={awarding}>{awarding ? 'Awarding...' : 'Confirm award'}</button></div>
          </div>
        ) : offers.length ? <div className="comparison-list">{offers.map((offer) => <article className="comparison-offer" key={offer.id}><div><strong>{offer.sellerName}</strong><small>{offer.kind === 'hotel_room' ? `${offer.roomType} / ${offer.roomCount ?? 1} room(s)` : 'Land package'} · valid through {new Date(offer.validityUntil).toLocaleDateString()}</small><span>{offer.inclusions.map((item) => labelFor(reference?.offerInclusions, item)).join(', ')}</span><OfferDetails offer={offer} /></div><div className="comparison-price-block"><strong className="comparison-price">{formatOfferPrice(offer)}</strong>{offer.kind === 'hotel_room' && offer.estimatedTotalMinor != null && <small>Est. stay {formatMinor(offer.estimatedTotalMinor, offer.currency)}</small>}{offer.perTravellerMinor != null && <small>{formatMinor(offer.perTravellerMinor, offer.currency)} per traveller ({offer.travellers})</small>}</div><div className="comparison-actions">{canMessage && <button className="secondary-button" onClick={() => onMessage(offer)}><MessageSquareText size={14} />Message</button>}{canAward && ['submitted', 'shortlisted'].includes(offer.status) && <button className="primary-button" onClick={() => setAwardTarget(offer)}>Award offer</button>}<button className="text-button report-link" onClick={() => onReport(offer)}><Flag size={13} />Report</button></div></article>)}</div> : <div className="empty-state"><MessageSquareText size={22} /><strong>No verified offers yet</strong><span>Offers from verified sellers will appear here.</span></div>}
        <p className="privacy-note">Awarding does not confirm a booking or release guest details.</p>
      </section>
    </div>
  );
}

function MessageThreadModal({ requestId, requestCode, sellerOrganizationId = '', peerName, onReport, onClose }) {
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
    if (!message.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const result = await sendRequestMessage(requestId, message, sellerOrganizationId);
      setMessages((current) => [...current, result.message]);
      setMessage('');
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
          {loading ? <div className="empty-state">Loading conversation...</div> : messages.length ? messages.map((item) => <article className={`message-bubble ${item.isMine ? 'mine' : ''}`} key={item.id}><strong>{item.isMine ? 'You' : item.senderName}</strong><p>{item.body}</p><time>{new Date(item.createdAt).toLocaleString()}</time>{!item.isMine && onReport && <button className="text-button report-link" onClick={() => onReport(item)}><Flag size={12} />Report</button>}</article>) : <div className="empty-state"><MessageSquareText size={22} /><strong>No messages yet</strong><span>Ask a question about this request or offer.</span></div>}
        </div>
        <form className="message-compose" onSubmit={submit}>
          <label className="visually-hidden" htmlFor="marketplace-message">Message</label>
          <textarea id="marketplace-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength="4000" placeholder="Write a message about this request" required />
          <div><small>Keep traveler contact details and external links out of marketplace messages.</small><button className="primary-button" disabled={sending || !message.trim()}>{sending ? 'Sending...' : 'Send message'}</button></div>
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

function RequestWorkspace({ requests, loading, query, setQuery, statusFilter, setStatusFilter, onCreate, onOpenRequest }) {
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
      {loading ? <div className="empty-state">Loading requests...</div> : requests.length ? <RequestTable requests={requests} onOpenRequest={onOpenRequest} /> : <div className="empty-state"><FileText size={24} /><strong>No requests match</strong><span>Try another status or create a request.</span><button className="text-button" onClick={onCreate}><Plus size={15} />Create request</button></div>}
    </section>
  );
}

function RequestTable({ requests, compact = false, onOpenRequest }) {
  return (
    <div className={`table-scroll ${compact ? 'compact-table' : ''}`}>
      <table className="request-table">
        <thead><tr><th>DESTINATION</th><th>TRAVEL DATES</th><th>TRAVELERS</th><th>OFFERS</th><th>STATUS</th><th><span className="visually-hidden">Open request</span></th></tr></thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td><div className="destination-cell">
                {request.image ? <img src={request.image} alt="" loading="lazy" /> : <span className="destination-placeholder"><MapPin size={16} /></span>}
                <span><strong>{request.destination}</strong><small>{request.requestCode ?? request.id} <span className="dot-separator">/</span> {request.country ?? request.destinationCountry}</small></span>
              </div></td>
              <td><span className="table-primary">{request.dates}</span><small className="table-secondary">{request.deadline}</small></td>
              <td><span className="table-primary">{request.travelers}</span></td>
              <td><span className="offer-count">{Number(request.offers ?? 0).toString().padStart(2, '0')}</span><small className="table-secondary">responses</small></td>
              <td><span className={`status-pill ${request.status}`}><i />{request.status[0].toUpperCase()}{request.status.slice(1)}</span></td>
              <td><button className="icon-button row-open" aria-label={`Open ${request.destination} request`} onClick={() => onOpenRequest?.(request)}><ArrowUpRight size={16} /></button></td>
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
  const [directory, setDirectory] = useState({ suppliers: [], pagination: { limit: 25, offset: 0, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    listMarketplaceSuppliers({ search, country, limit: 25, offset: page * 25 })
      .then((result) => {
        if (active) {
          setDirectory(result);
          setError('');
        }
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [search, country, page]);

  const suppliers = directory.suppliers;
  const total = directory.pagination.total;

  return (
    <section className="surface-section full-section">
      <div className="section-heading request-list-heading">
        <div><p className="eyebrow">DESTINATION PARTNERS</p><h2>Verified supplier directory <span className="heading-count">{total}</span></h2></div>
      </div>
      <div className="request-toolbar">
        <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search company or destination" aria-label="Search suppliers" /></label>
        <label className="supplier-country-filter"><span>Country</span><input className="form-input" value={country} onChange={(event) => { setCountry(event.target.value.toUpperCase().slice(0, 2)); setPage(0); }} placeholder="ISO code" aria-label="Filter by country code" maxLength="2" /></label>
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="supplier-grid">
        {suppliers.map((supplier) => (
          <article className="supplier-row" key={supplier.organizationId}>
            <span className="supplier-avatar blue"><Building2 size={20} /></span>
            <div className="supplier-info"><div className="supplier-title"><strong>{supplier.name}</strong><span className="verified-mark" title="Verified supplier"><BadgeCheck size={15} /></span></div><span><MapPin size={13} />{supplier.propertyCity ? `${supplier.propertyCity}, ` : ''}${supplier.countryCode}</span><small>{supplier.type === 'dmc' ? `Coverage: ${supplier.coverageDestinations.join(', ') || 'Not specified'}` : 'Hotel partner'}</small></div>
          </article>
        ))}
      </div>
      {!loading && suppliers.length === 0 && <div className="empty-state"><UsersRound size={23} /><strong>No verified suppliers found</strong><span>Try another destination or check back as partners complete verification.</span></div>}
      {loading && <div className="empty-state">Loading verified suppliers...</div>}
      <div className="supplier-pagination"><span>{total ? `${directory.pagination.offset + 1}-${Math.min(directory.pagination.offset + suppliers.length, total)} of ${total}` : '0 suppliers'}</span><div><button className="secondary-button" disabled={page === 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</button><button className="secondary-button" disabled={loading || (page + 1) * 25 >= total} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>
    </section>
  );
}

export default App;