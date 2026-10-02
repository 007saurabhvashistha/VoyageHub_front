import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Copy, KeyRound, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { confirmMfaEnrollment, disableMfa, getCurrentSession, getMfaStatus, rotateMfaRecoveryCodes, startMfaEnrollment, verifyMfaChallenge } from './api.js';

export function MfaChallengePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const account = await verifyMfaChallenge(code.trim());
      navigate(account.user.isPlatformAdmin ? '/workspace/admin/verification' : `/workspace/${account.organization.businessType}/overview`, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-topbar"><Link className="auth-brand" to="/login"><span className="brand-mark"><ShieldCheck size={20} /></span><span><strong>LEAD EXCHANGE</strong><small>Account security</small></span></Link></header>
      <section className="auth-action-layout">
        <p className="eyebrow">MULTI-FACTOR AUTHENTICATION</p><h1>Confirm it’s you</h1>
        <p className="auth-action-description">Enter a current authenticator code or one of your unused recovery codes.</p>
        <form className="auth-form" onSubmit={submit}>
          <label className="auth-field"><span>Authenticator or recovery code</span><span className="auth-input"><KeyRound size={16} /><input autoComplete="one-time-code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} required /></span></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={submitting || !code.trim()}>{submitting ? 'Verifying...' : 'Verify and continue'}<ArrowRight size={17} /></button>
        </form>
        <div className="auth-switch"><Link to="/login">Cancel and sign in again</Link></div>
      </section>
      <footer className="auth-footer"><span>Lead Exchange by VoyageHub</span><span>Secure account access</span></footer>
    </main>
  );
}

export function MfaSetupPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentSession()
      .then((session) => {
        if (!active) return;
        if (!session.user.isPlatformAdmin) {
          navigate(`/workspace/${session.organization.businessType}/security`, { replace: true });
          return;
        }
        if (session.user.mfaEnabled) {
          navigate('/workspace/admin/verification', { replace: true });
          return;
        }
        setAccount(session);
      })
      .catch(() => active && setUnavailable(true));
    return () => { active = false; };
  }, [navigate]);

  if (unavailable) return <main className="auth-wait"><section><h1>Sign in required</h1><p>Your administrator session is unavailable.</p><Link to="/login">Return to sign in</Link></section></main>;
  if (!account) return <main className="auth-wait">Checking administrator security...</main>;
  return <main className="auth-page"><header className="auth-topbar"><span className="auth-brand"><span className="brand-mark"><ShieldCheck size={20} /></span><span><strong>LEAD EXCHANGE</strong><small>Required administrator security</small></span></span></header><section className="auth-action-layout"><MfaSecurityPanel account={account} mandatory onCompleted={() => navigate('/workspace/admin/verification', { replace: true })} /></section></main>;
}

export function MfaSecurityPanel({ account, mandatory = false, onCompleted }) {
  const [status, setStatus] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refreshStatus() {
    setStatus(await getMfaStatus());
  }

  useEffect(() => {
    let active = true;
    getMfaStatus().then((result) => active && setStatus(result)).catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, []);

  async function beginEnrollment() {
    setBusy(true);
    setError('');
    try {
      setEnrollment(await startMfaEnrollment());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnrollment(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await confirmMfaEnrollment(code.trim());
      setEnrollment(null);
      setCode('');
      setRecoveryCodes(result.recoveryCodes);
      await refreshStatus();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function turnOff(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await disableMfa(code.trim());
      setCode('');
      await refreshStatus();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function rotateCodes(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await rotateMfaRecoveryCodes(code.trim());
      setRecoveryCodes(result.recoveryCodes);
      setCode('');
      await refreshStatus();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyRecoveryCodes() {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
    } catch {
      setError('Clipboard access is unavailable. Select and copy the recovery codes manually.');
    }
  }

  if (!status) return <div className="empty-state">Loading MFA status...</div>;
  return (
    <div className="mfa-security-panel">
      <p className="eyebrow">ACCOUNT SECURITY</p>
      <h1>{mandatory ? 'Enable MFA to continue' : 'Multi-factor authentication'}</h1>
      <p className="auth-action-description">Use an authenticator app for sign-in. Recovery codes work once each.</p>
      {mandatory && <p className="auth-success">Platform administrator tools stay locked until MFA is enabled.</p>}
      <div className="mfa-state-row"><ShieldCheck size={17} /><span>{status.enabled ? 'MFA enabled' : 'MFA not enabled'}</span>{status.enabled && <small>{status.recoveryCodesRemaining} recovery codes remaining</small>}</div>
      {!status.enabled && !enrollment && <button className="primary-button mfa-start-button" disabled={busy} onClick={beginEnrollment}>{busy ? 'Preparing...' : 'Set up authenticator'}<ArrowRight size={15} /></button>}
      {enrollment && <form className="mfa-enrollment-form" onSubmit={confirmEnrollment}>
        <p>Add this account to your authenticator app using the URI or enter the secret manually.</p>
        <div className="mfa-qr"><QRCodeSVG value={enrollment.otpauthUri} size={192} level="M" includeMargin aria-label="Authenticator setup QR code" /></div>
        <label className="field-label">Authenticator setup URI<input className="form-input" value={enrollment.otpauthUri} readOnly onFocus={(event) => event.target.select()} /></label>
        <label className="field-label">Manual setup key<code className="mfa-secret">{enrollment.secret}</code></label>
        <label className="auth-field"><span>Six-digit authenticator code</span><span className="auth-input"><KeyRound size={16} /><input autoComplete="one-time-code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} required /></span></label>
        <button className="primary-button" disabled={busy || code.trim().length !== 6}>{busy ? 'Verifying...' : 'Confirm and enable MFA'}<Check size={15} /></button>
      </form>}
      {recoveryCodes.length > 0 && <section className="mfa-recovery-codes"><h2>Save your recovery codes</h2><p>These are shown once. Store them somewhere private and separate from your authenticator.</p><textarea readOnly value={recoveryCodes.join('\n')} onFocus={(event) => event.target.select()} aria-label="Recovery codes" /><button className="secondary-button" onClick={copyRecoveryCodes}><Copy size={14} />Copy codes</button><button className="primary-button" onClick={() => { setRecoveryCodes([]); if (mandatory) onCompleted?.(); }}>I saved these codes</button></section>}
      {status.enabled && !mandatory && recoveryCodes.length === 0 && <form className="mfa-disable-form" onSubmit={rotateCodes}><label className="auth-field"><span>Current authenticator or recovery code</span><span className="auth-input"><KeyRound size={16} /><input value={code} onChange={(event) => setCode(event.target.value)} required /></span></label><div className="mfa-management-actions"><button className="secondary-button" disabled={busy || !code.trim()}>{busy ? 'Updating...' : 'Replace recovery codes'}</button>{!account?.user?.isPlatformAdmin && <button className="secondary-button" type="button" disabled={busy || !code.trim()} onClick={turnOff}>{busy ? 'Updating...' : 'Disable MFA'}</button>}</div></form>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <p className="privacy-note">MFA secrets are encrypted at rest. Platform administrator MFA cannot be disabled.</p>
    </div>
  );
}