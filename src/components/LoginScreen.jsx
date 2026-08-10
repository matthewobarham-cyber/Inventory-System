import { useState } from 'react';
import { roleTagStyle } from '../data.js';
import { IconAlert, IconArrowRight } from '../icons.jsx';

export default function LoginScreen({ accounts, onLogin, onDemoLogin }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const res = await onLogin(email.trim(), pass, remember);
    if (res && res.error) setError(res.error);
    setSubmitting(false);
  };

  const signInDemo = async (acct) => {
    if (submitting) return;
    setSubmitting(true); setError('');
    const result = await onDemoLogin(acct.email, remember);
    if (result?.error) setError(result.error);
    setSubmitting(false);
  };
  const onKey = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', gridTemplateColumns: '1.02fr .98fr' }}>
      <div style={{ position: 'relative', background: '#171c22', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '44px 48px' }}>
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14 }}>
          <img src="brand/msbm-lockup-light.png" alt="Mona School of Business & Management, The University of the West Indies, Mona"
            style={{ width: 200, height: 'auto', flex: 'none', alignSelf: 'flex-start', display: 'block' }} />
          <span style={{ color: '#8d99a6', fontSize: 10.5, fontWeight: 600, letterSpacing: '.18em', textTransform: 'uppercase' }}>IT Inventory System</span>
        </div>
        <div data-detail-model="uploads/University-IT-Office-Equipment-GLB-Expansion/models/all-in-one-desktop.glb"
          data-detail-interactive="false" data-detail-scale="1.05"
          style={{ position: 'absolute', left: 0, right: 0, top: '12%', bottom: '16%', zIndex: 1 }}></div>
        <div style={{ position: 'absolute', left: '-14%', top: '8%', width: '120%', height: '70%', background: 'radial-gradient(closest-side,rgba(10,61,124,.55),rgba(23,28,34,0))' }}></div>
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 420 }}>
          <div style={{ fontSize: 34, lineHeight: 1.12, fontWeight: 600, color: '#fff', letterSpacing: '-.02em' }}>Every cable, cartridge and mixer on campus — accounted for.</div>
          <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6, color: '#96a2b0' }}>39 equipment classes, 8 buildings, live loan tracking.</div>
          <div style={{ marginTop: 22, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.12)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6f7a86' }}>The University of the West Indies, Mona</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 48px', background: '#f5f6f8', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 540, margin: 'auto 0' }}>
          <img src="brand/msbm-lockup.png" alt="Mona School of Business & Management, The University of the West Indies, Mona"
            style={{ width: 146, height: 'auto', flex: 'none', alignSelf: 'flex-start', display: 'block', marginBottom: 26 }} />
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: '#7b8794' }}>Sign in</div>
          <h1 style={{ margin: '10px 0 0', fontSize: 27, fontWeight: 600, letterSpacing: '-.02em' }}>Inventory console</h1>
          <div style={{ marginTop: 8, fontSize: 13.5, color: '#5b6672' }}>Use your campus credentials. Access follows your role.</div>

          <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#3f4a56' }}>Campus email</span>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} onKeyDown={onKey}
                placeholder="name@uwi.edu" autoComplete="username"
                style={{ height: 42, padding: '0 12px', background: '#fff', border: '1px solid #dfe3e9', borderRadius: 8, fontSize: 14, outline: 'none' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#3f4a56' }}>Password</span>
              <input type="password" value={pass} onChange={(e) => { setPass(e.target.value); setError(''); }} onKeyDown={onKey}
                placeholder="••••••••" autoComplete="current-password"
                style={{ height: 42, padding: '0 12px', background: '#fff', border: '1px solid #dfe3e9', borderRadius: 8, fontSize: 14, outline: 'none' }} />
            </label>
            {!!error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fdeceb', border: '1px solid #f4cdc9', borderRadius: 8, color: '#a01a12', fontSize: 12.5 }}>
                <IconAlert color="currentColor" />
                <span>{error}</span>
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: '#5b6672', cursor: 'pointer' }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#0a3d7c' }} />
              <span>Keep me signed in on this workstation</span>
            </label>
            <button type="button" className="btn-primary" onClick={submit} disabled={submitting}
              style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
              <span>{submitting ? 'Signing in…' : 'Sign in'}</span>
              <IconArrowRight />
            </button>
          </div>

          {accounts.length > 0 && <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid #dfe3e9' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#7b8794' }}>Demo accounts — click to sign in</div>
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {accounts.map((acct) => (
                <button key={acct.email} type="button" data-row="1" disabled={submitting} onClick={() => signInDemo(acct)} aria-label={`Sign in as ${acct.name}, ${acct.role}`}
                  style={{ minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 11px', background: '#fff', border: '1px solid #d7dce3', borderRadius: 8, cursor: submitting ? 'wait' : 'pointer', textAlign: 'left', boxShadow: '0 1px 2px rgba(23,28,34,.04)' }}>
                  <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 600 }}>{acct.name}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#7b8794' }}>{acct.email}</span>
                  </span>
                  <span style={{ ...roleTagStyle(acct.role), flex: 'none' }}>{acct.role}</span>
                </button>
              ))}
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}
