import { useState } from 'react';
import { roleTagStyle } from '../data.js';
import { IconAlert, IconArrowRight } from '../icons.jsx';

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'IT';

export default function LoginScreen({ accounts, onLogin, onDemoLogin, onRequestPasswordReset, cloudEnabled = false }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const res = await onLogin(email.trim(), pass, remember);
    if (res?.error) setError(res.error);
    setSubmitting(false);
  };

  const signInDemo = async (acct) => {
    if (submitting) return;
    setSubmitting(true); setError('');
    const result = await onDemoLogin(acct.email, remember);
    if (result?.error) setError(result.error);
    setSubmitting(false);
  };

  const onKey = (event) => { if (event.key === 'Enter') submit(); };
  const requestReset = async () => {
    const target = resetEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(target)) { setResetError('Enter the campus email used for your account.'); return; }
    setResetSubmitting(true); setResetError('');
    const result = await onRequestPasswordReset(target);
    setResetSubmitting(false);
    if (result?.error) { setResetError(result.error); return; }
    setResetSent(true);
  };

  return (
    <main className="login-shell">
      <section className="login-visual-panel" aria-label="MSBM inventory operations">
        <div className="login-visual-grid" aria-hidden="true" />
        <div className="login-visual-orbit orbit-one" aria-hidden="true" />
        <div className="login-visual-orbit orbit-two" aria-hidden="true" />

        <div className="login-model-stage" aria-hidden="true">
          <div className="login-model-halo" />
          <div data-detail-model="generated/models/login-workstation.glb?v=5" data-detail-interactive="false" data-detail-spin="true" data-detail-fps="60" data-detail-scale="1.22" />
        </div>

        <div className="login-visual-copy">
          <span className="login-eyebrow"><i /> Campus technology, clearly controlled</span>
          <h2>One intelligent view of every asset.</h2>
          <p>Know what MSBM owns, where it is, who has it, and what needs attention—all from one beautifully organized workspace.</p>
          <div className="login-visual-metrics">
            <span><strong>39</strong><small>Equipment classes</small></span>
            <span><strong>8</strong><small>Campus buildings</small></span>
            <span><strong>Live</strong><small>Lifecycle control</small></span>
          </div>
        </div>

        <footer className="login-visual-footer"><span>The University of the West Indies, Mona</span><b>MSBM · IT Services</b></footer>
      </section>

      <section className="login-form-panel">
        <div className="login-form-atmosphere" aria-hidden="true" />
        <div className="login-form-card">
          <header className="login-form-heading">
            <img src="brand/msbm-lockup.png" alt="Mona School of Business & Management" />
            <span className="login-form-kicker">Secure inventory workspace</span>
            <h1>Welcome back</h1>
            <p>Sign in to manage equipment, loans, stock, maintenance, and campus operations.</p>
          </header>

          <div className="login-fields">
            <label className="login-field">
              <span>Campus email</span>
              <div><i aria-hidden="true">@</i><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} onKeyDown={onKey} placeholder="name@uwi.edu" autoComplete="username" /></div>
            </label>
            <label className="login-field">
              <span>Password</span>
              <div><i aria-hidden="true">●</i><input type={showPassword ? 'text' : 'password'} value={pass} onChange={(event) => { setPass(event.target.value); setError(''); }} onKeyDown={onKey} placeholder="Enter your password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div>
            </label>

            {!!error && <div className="login-error" role="alert"><IconAlert color="currentColor" /><span>{error}</span></div>}

            <div className="login-form-options">
              <label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>Keep me signed in</span></label>
              {cloudEnabled ? <button type="button" onClick={() => { setResetEmail(email); setResetError(''); setResetSent(false); setResetOpen(true); }}>Forgot password?</button> : <span>Authorized access only</span>}
            </div>

            <button type="button" className="login-submit" onClick={submit} disabled={submitting}>
              <span>{submitting ? 'Signing you in…' : 'Enter inventory console'}</span><IconArrowRight />
            </button>
          </div>

          {accounts.length > 0 && <section className="login-demo-section">
            <header><span><small>Quick access</small><strong>Demo accounts</strong></span><i>{accounts.length} available</i></header>
            <div className="login-demo-grid">
              {accounts.map((acct) => <button key={acct.email} type="button" disabled={submitting} onClick={() => signInDemo(acct)} aria-label={`Sign in as ${acct.name}, ${acct.role}`}>
                <span className="login-demo-avatar">{initials(acct.name)}</span>
                <span className="login-demo-copy"><strong>{acct.name}</strong><small>{acct.email}</small></span>
                <span className="login-demo-role" style={roleTagStyle(acct.role)}>{acct.role}</span>
                <span className="login-demo-arrow" aria-hidden="true">→</span>
              </button>)}
            </div>
          </section>}

          <footer className="login-trust"><span><i /> {cloudEnabled ? 'Protected by Supabase Auth' : 'Protected local workspace'}</span><small>MSBM IT Inventory · Version 1.0</small></footer>
        </div>
      </section>

      {resetOpen && <div className="password-reset-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setResetOpen(false); }}>
        <section className="password-reset-card" role="dialog" aria-modal="true" aria-labelledby="password-reset-title">
          <span className="password-reset-mark"><img src="brand/msbm-crest.png" alt="" /></span>
          {!resetSent ? <>
            <small>Secure account recovery</small>
            <h2 id="password-reset-title">Reset your password</h2>
            <p>We will send a secure recovery link to the email registered with your MSBM inventory account.</p>
            <label><span>Campus email</span><input autoFocus type="email" value={resetEmail} onChange={(event) => { setResetEmail(event.target.value); setResetError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') requestReset(); }} placeholder="name@uwi.edu" /></label>
            {!!resetError && <div className="password-reset-error" role="alert">{resetError}</div>}
            <div className="password-reset-actions"><button type="button" onClick={() => setResetOpen(false)}>Cancel</button><button type="button" className="primary" disabled={resetSubmitting} onClick={requestReset}>{resetSubmitting ? 'Sending…' : 'Send recovery link'}</button></div>
          </> : <>
            <small>Recovery email requested</small>
            <h2 id="password-reset-title">Check your inbox</h2>
            <p>If an account exists for <strong>{resetEmail.trim().toLowerCase()}</strong>, a secure password-reset link has been sent. The message may take a minute to arrive.</p>
            <div className="password-reset-actions"><button type="button" className="primary" onClick={() => setResetOpen(false)}>Return to sign in</button></div>
          </>}
        </section>
      </div>}
    </main>
  );
}
