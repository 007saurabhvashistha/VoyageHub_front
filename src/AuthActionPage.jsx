import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Globe2, LockKeyhole, Mail } from 'lucide-react';
import { completePasswordReset, requestEmailVerification, requestPasswordReset, verifyEmailToken } from './api.js';

const pageContent = {
  verify: { eyebrow: 'EMAIL VERIFICATION', title: 'Verify your business email', description: 'Confirm the email address on your Lead Exchange account.' },
  forgot: { eyebrow: 'ACCOUNT RECOVERY', title: 'Reset your password', description: 'We will send a one-time reset link if a verified account matches.' },
  reset: { eyebrow: 'ACCOUNT RECOVERY', title: 'Choose a new password', description: 'Reset links expire after 15 minutes and work once.' },
};

function AuthActionPage({ mode }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('ready');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const content = pageContent[mode];

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      if (mode === 'verify' && token) {
        await verifyEmailToken(token);
        setStatus('verified');
      } else if (mode === 'verify') {
        await requestEmailVerification(email);
        setNotice('If this address has an unverified account, a verification link will be sent when delivery is available.');
      } else if (mode === 'forgot') {
        await requestPasswordReset(email);
        setNotice('If a verified account matches, reset instructions will be sent when delivery is available.');
      } else {
        await completePasswordReset(token, password);
        setStatus('reset');
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <Link className="auth-brand" to="/login"><span className="brand-mark"><Globe2 size={20} /></span><span><strong>LEAD EXCHANGE</strong><small>by VoyageHub</small></span></Link>
        <Link to="/login"><ArrowLeft size={14} />Back to sign in</Link>
      </header>
      <section className="auth-action-layout">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{status === 'verified' ? 'Email verified' : status === 'reset' ? 'Password updated' : content.title}</h1>
        <p className="auth-action-description">{status === 'verified' ? 'Your account is ready. Sign in to continue.' : status === 'reset' ? 'All existing sessions were signed out. Sign in with your new password.' : content.description}</p>
        {status === 'verified' || status === 'reset' ? <Link className="auth-submit auth-action-link" to="/login"><span>Continue to sign in</span><Check size={17} /></Link> : null}
        {status === 'ready' && mode === 'verify' && token && <form className="auth-form" onSubmit={submit}>
          <p className="auth-action-description">Confirm that you control this email address. Opening the link alone will not verify the account.</p>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={submitting}>{submitting ? 'Confirming...' : 'Confirm email address'}<Check size={17} /></button>
        </form>}
        {status === 'ready' && ((mode === 'verify' && !token) || mode === 'forgot') && <form className="auth-form" onSubmit={submit}>
          <label className="auth-field"><span>Business email</span><span className="auth-input"><Mail size={16} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></span></label>
          {notice && <p className="auth-success" role="status">{notice}</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={submitting}>{submitting ? 'Please wait...' : mode === 'verify' ? 'Resend verification link' : 'Request reset link'}<ArrowRight size={17} /></button>
        </form>}
        {status === 'ready' && mode === 'reset' && <form className="auth-form" onSubmit={submit}>
          <label className="auth-field"><span>New password</span><span className="auth-input"><LockKeyhole size={16} /><input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} required /></span></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={submitting || !token}>{submitting ? 'Updating...' : 'Update password'}<Check size={17} /></button>
        </form>}
        <div className="auth-switch"><Link to="/login">Return to sign in</Link></div>
      </section>
      <footer className="auth-footer"><span>Lead Exchange by VoyageHub</span><span>Secure account access</span></footer>
    </main>
  );
}

export default AuthActionPage;