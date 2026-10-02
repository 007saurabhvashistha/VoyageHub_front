import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Globe2, Hotel, LockKeyhole, Mail, MapPin, UserRound } from 'lucide-react';
import { loginAccount, registerAccount } from './api.js';

const accountTypes = [
  { id: 'agency', label: 'Travel agency', detail: 'Source and compare destination offers', icon: Building2 },
  { id: 'dmc', label: 'DMC', detail: 'Respond to matched travel requests', icon: Globe2 },
  { id: 'hotelier', label: 'Hotelier', detail: 'Manage room requests and availability', icon: Hotel },
];

const countries = [
  { code: 'IN', name: 'India' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'JP', name: 'Japan' },
  { code: 'PT', name: 'Portugal' },
  { code: 'MA', name: 'Morocco' },
  { code: 'ZA', name: 'South Africa' },
];

function AuthPage({ mode }) {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState('agency');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [notice, setNotice] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === 'register';

  async function submitAccount(event) {
    event.preventDefault();
    setError('');
    setErrorCode('');
    setNotice('');
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    setSubmittedEmail(String(form.get('email') ?? ''));
    const account = isRegister
      ? {
          full_name: form.get('fullName'),
          organization_name: form.get('businessName'),
          email: form.get('email'),
          country_code: form.get('country'),
          business_type: selectedRole,
          ...(selectedRole === 'dmc' ? { coverage_destinations: form.get('coverageDestinations') } : {}),
          ...(selectedRole === 'hotelier' ? { property_city: form.get('propertyCity') } : {}),
          password: form.get('password'),
        }
      : {
          email: form.get('email'),
          business_type: selectedRole,
          password: form.get('password'),
        };

    try {
      const session = isRegister ? await registerAccount(account) : await loginAccount(account);
      if (isRegister && session.verificationRequired) {
        setNotice(session.emailDeliveryStatus === 'queued'
          ? 'Account created. Your verification email is queued; verify your address before signing in.'
          : 'Account created, but email delivery is not configured. Verification is required before you can sign in.');
        return;
      }
      if (session.mfaRequired) {
        navigate('/mfa-challenge', { replace: true });
        return;
      }
      if (session.mfaSetupRequired) {
        navigate('/mfa-setup', { replace: true });
        return;
      }
      navigate(session.user.isPlatformAdmin ? '/workspace/admin/verification' : `/workspace/${session.organization.businessType}/overview`, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
      setErrorCode(requestError.code ?? '');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <Link className="auth-brand" to="/register">
          <span className="brand-mark"><Globe2 size={20} strokeWidth={1.8} /></span>
          <span><strong>LEAD EXCHANGE</strong><small>by VoyageHub</small></span>
        </Link>
        <div className="auth-top-actions"><span>International marketplace</span>{isRegister ? <Link to="/login">Sign in <ArrowRight size={14} /></Link> : <Link to="/register">Create account <ArrowRight size={14} /></Link>}</div>
      </header>

      <div className="auth-layout">
        <section className="auth-form-panel">
          <div className="auth-heading">
            <p className="eyebrow">{isRegister ? 'YOUR GLOBAL TRAVEL NETWORK' : 'WELCOME BACK'}</p>
            <h1>{isRegister ? 'Create your workspace' : 'Sign in to Lead Exchange'}</h1>
            <p>{isRegister ? 'Set up secure access for your business and team.' : 'Sign in to your business workspace.'}</p>
          </div>

          <form className="auth-form" onSubmit={submitAccount}>
            <fieldset className="role-picker">
              <legend>Business type</legend>
              <div className="role-options">
                {accountTypes.map(({ id, label, detail, icon: Icon }) => (
                  <button key={id} className={`role-option ${selectedRole === id ? 'selected' : ''}`} type="button" aria-pressed={selectedRole === id} onClick={() => setSelectedRole(id)}>
                    <span className="role-option-icon"><Icon size={17} /></span>
                    <span className="role-option-copy"><strong>{label}</strong><small>{detail}</small></span>
                    <span className="role-radio" />
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="auth-fields">
              {isRegister && <label className="auth-field"><span>Full name</span><span className="auth-input"><UserRound size={16} /><input name="fullName" autoComplete="name" placeholder="Your name" required /></span></label>}
              {isRegister && <label className="auth-field"><span>Business name</span><span className="auth-input"><Building2 size={16} /><input name="businessName" autoComplete="organization" placeholder="Company or property name" required /></span></label>}
              {isRegister && selectedRole === 'dmc' && <label className="auth-field"><span>Destination coverage</span><span className="auth-input"><Globe2 size={16} /><input name="coverageDestinations" placeholder="Kyoto, Japan, Morocco" required /></span></label>}
              {isRegister && selectedRole === 'hotelier' && <label className="auth-field"><span>Property city</span><span className="auth-input"><MapPin size={16} /><input name="propertyCity" placeholder="Kyoto" required /></span></label>}
              <label className="auth-field"><span>Business email</span><span className="auth-input"><Mail size={16} /><input name="email" type="email" autoComplete="email" placeholder="you@company.com" required /></span></label>
              {isRegister && <label className="auth-field"><span>Country or region</span><span className="auth-input"><MapPin size={16} /><select name="country" defaultValue="" required><option value="" disabled>Select country</option>{countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></span></label>}
              <label className="auth-field"><span>Password</span><span className="auth-input"><LockKeyhole size={16} /><input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={8} placeholder="At least 8 characters" required /></span></label>
            </div>

            {error && <p className="auth-error" role="alert">{error}</p>}
            {errorCode === 'EMAIL_NOT_VERIFIED' && <Link className="auth-inline-link" to={`/verify-email?email=${encodeURIComponent(submittedEmail)}`}>Resend verification email</Link>}
            {notice && <p className="auth-success" role="status">{notice} <Link to={`/verify-email?email=${encodeURIComponent(submittedEmail)}`}>Request verification email</Link></p>}
            <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Please wait...' : isRegister ? 'Create account' : 'Sign in'}<ArrowRight size={17} /></button>
          </form>

          <div className="auth-switch">{isRegister ? 'Already registered?' : 'New to Lead Exchange?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link>{!isRegister && <> <span>·</span> <Link to="/forgot-password">Forgot password?</Link></>}</div>
        </section>

        <aside className="auth-visual">
          <img src="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1400&q=85" alt="Traditional streets of Kyoto at dusk" />
          <div className="auth-visual-shade" />
          <div className="auth-visual-copy"><span className="auth-visual-kicker">LOCAL KNOWLEDGE, CONNECTED</span><h2>Better journeys begin with the right partner.</h2><div className="auth-visual-rule" /><p>One workspace for agencies, destination specialists and hotels.</p></div>
          <span className="auth-image-credit">KYOTO, JAPAN</span>
        </aside>
      </div>
      <footer className="auth-footer"><span>Lead Exchange by VoyageHub</span><span>Account access</span></footer>
    </main>
  );
}

export default AuthPage;