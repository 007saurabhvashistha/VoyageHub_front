# VoyageHub Frontend

Standalone Lead Exchange web application. This repository is independent from Aviat CRM.

## Requirements

- Node.js 20 or newer

## Run locally

Start the backend in another terminal first (`npm install` and `npm run dev` in `VoyageHub/backend`), then run:

```powershell
npm install
npm run dev
```

Vite serves the app at `http://localhost:5173` and proxies `/api` to the backend on port 4000.

Routes are `/register`, `/login`, `/workspace/agency/overview`, `/workspace/dmc/overview`, `/workspace/hotelier/overview`, and the promoted-admin route `/workspace/admin/verification`. Registration and login create real accounts through the backend and use an HttpOnly session cookie. Workspaces require an authenticated session.

## Build

```powershell
npm run build
```

Identity, organizations, marketplace requests, targeted seller inboxes, DMC package offers, hotel room quotes, awards, notifications, per-date hotel inventory, seller profile changes, matched agency-seller conversations and notification-outbox delivery state persist in PostgreSQL. Registration requires email verification; password recovery uses expiring, single-use links and revokes existing sessions. TOTP MFA uses one-use recovery codes, is mandatory for platform administrators, and can be managed from Security. Platform admins can inspect and requeue blocked/dead-letter entries. Agencies can search a paginated directory of manually verified sellers; the directory does not invent ratings or contact data. Seller profile edits are audited, withdraw active offers and require fresh manual verification. Actual email delivery remains blocked until a provider is configured. Verified booking confirmation, guest-data release and external integrations are not implemented yet.