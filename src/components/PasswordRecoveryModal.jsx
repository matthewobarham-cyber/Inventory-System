import { useState } from 'react';

export default function PasswordRecoveryModal({ onSave }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (password.length < 8) { setError('Use at least 8 characters for your new password.'); return; }
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    setSubmitting(true); setError('');
    const result = await onSave(password);
    setSubmitting(false);
    if (result?.error) setError(result.error);
  };

  return <div className="password-recovery-screen">
    <section className="password-recovery-card" role="dialog" aria-modal="true" aria-labelledby="password-recovery-title">
      <header><img src="brand/msbm-lockup.png" alt="Mona School of Business & Management" /><small>Verified recovery session</small><h1 id="password-recovery-title">Choose a new password</h1><p>Your recovery link was accepted. Create a new password to secure your inventory account.</p></header>
      <div className="password-recovery-fields">
        <label><span>New password</span><div><input autoFocus type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} autoComplete="new-password" /><button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
        <label><span>Confirm new password</span><div><input type={showPassword ? 'text' : 'password'} value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') submit(); }} autoComplete="new-password" /></div></label>
        <small className="password-strength-note">Minimum 8 characters. A longer, unique passphrase is recommended.</small>
        {!!error && <div className="password-reset-error" role="alert">{error}</div>}
        <button type="button" className="login-submit" disabled={submitting} onClick={submit}>{submitting ? 'Updating password…' : 'Save new password'}</button>
      </div>
    </section>
  </div>;
}
