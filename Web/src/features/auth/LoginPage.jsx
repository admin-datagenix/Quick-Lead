import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BarChart3, Lock, QrCode, WifiOff, MessageSquareText } from 'lucide-react';
import { api } from '../../lib/api';
import { fmt, validators } from '../../lib/format';
import { deviceId, useSession } from '../../context/SessionContext';
import { Button, Field } from '../../components/ui';
import { BrandMark } from '../../components/layout/AppShell';

export default function LoginPage() {
  const [step, setStep] = useState('mobile');
  const [mobile, setMobile] = useState('');
  const [otpInfo, setOtpInfo] = useState(null);

  return (
    <div className="auth">
      <section className="auth-art" aria-hidden="true">
        <div className="row"><BrandMark size={40} /><span className="brand-name" style={{ color: '#fff' }}>Quick<b style={{ color: '#BAE6FD' }}>Leads</b></span></div>
        <div style={{ marginTop: 'auto', display: 'grid', gap: 18 }}>
          <h1>Every visitor at your stall, captured in seconds.</h1>
          <p>Run your exhibition team from one dashboard: forms, salesmen, QR codes and every lead, live.</p>
        </div>
        <div className="pts">
          <div className="pt"><i><BarChart3 size={17} /></i>Live lead KPIs per form and salesman</div>
          <div className="pt"><i><QrCode size={17} /></i>Salesman QR codes that credit every scan</div>
          <div className="pt"><i><WifiOff size={17} /></i>Offline capture on the mobile app</div>
        </div>
        <div style={{ marginTop: 'auto', fontSize: 12.5, color: '#BAE6FD' }}>QuickLeads by DatagenixAI</div>
      </section>

      <section className="auth-panel">
        <div className="auth-box">
          {step === 'mobile' ? (
            <MobileStep mobile={mobile} setMobile={setMobile} onSent={(info) => { setOtpInfo(info); setStep('otp'); }} />
          ) : (
            <OtpStep mobile={otpInfo.mobile} info={otpInfo} onBack={() => setStep('mobile')} onResent={setOtpInfo} />
          )}
        </div>
      </section>
    </div>
  );
}

function MobileStep({ mobile, setMobile, onSent }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!validators.isMobile(mobile)) { setError('Enter a valid 10-digit mobile number.'); return; }
    setBusy(true); setError('');
    try {
      const r = await api.requestOtp(validators.normalizeMobile(mobile));
      onSent(r.data);
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 22 }} noValidate>
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">Sign in</span>
        <h1>Welcome to QuickLeads</h1>
        <p className="muted">Admins and salesmen sign in with their mobile number. No password needed.</p>
      </div>
      <Field label="Mobile number" htmlFor="mobile" error={error}>
        <div className="input-group">
          <span className="addon">+91</span>
          <input id="mobile" className={`input ${error ? 'invalid' : ''}`} inputMode="numeric" autoComplete="tel-national" autoFocus maxLength={10}
            placeholder="10-digit mobile number" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} />
        </div>
      </Field>
      <Button type="submit" size="lg" block loading={busy}>Get OTP <ArrowRight size={17} /></Button>
      <p className="row muted small"><Lock size={14} />We send a one-time password to verify your number.</p>
    </form>
  );
}

function OtpStep({ mobile, info, onBack, onResent }) {
  const s = useSession();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [left, setLeft] = useState(info.resendAfterSeconds || 30);
  const refs = useRef([]);

  useEffect(() => {
    const t = setInterval(() => setLeft((x) => (x > 0 ? x - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [info]);

  async function verify(code) {
    if (code.length !== 6) { setError('Enter the 6-digit OTP.'); return; }
    setBusy(true); setError('');
    try {
      const r = await api.verifyOtp(mobile, code, deviceId());
      await s.signedIn(r.data);
    } catch (err) {
      setError(err.message);
      setDigits(['', '', '', '', '', '']);
      refs.current[0]?.focus();
      setBusy(false);
    }
  }

  function setAt(i, v) {
    const clean = v.replace(/\D/g, '');
    if (clean.length > 1) { // paste
      const arr = clean.slice(0, 6).split('');
      const next = ['', '', '', '', '', ''].map((_, k) => arr[k] || '');
      setDigits(next);
      if (arr.length === 6) verify(arr.join('')); else refs.current[arr.length]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) verify(next.join(''));
  }

  async function resend() {
    try {
      const r = await api.requestOtp(mobile);
      onResent(r.data);
      setLeft(r.data.resendAfterSeconds);
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">Verify</span>
        <h1>Enter the OTP</h1>
        <p className="muted">We sent a 6-digit code to <b style={{ color: 'var(--ink)' }}>{fmt.mobile(mobile)}</b></p>
      </div>
      <div className="otp-row" role="group" aria-label="One-time password">
        {digits.map((d, i) => (
          <input key={i} ref={(el) => (refs.current[i] = el)} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${i + 1}`} autoFocus={i === 0} disabled={busy}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus(); }} />
        ))}
      </div>
      {error && <span className="error-text">{error}</span>}
      {info.devOtp && (
        <div className="banner info small">
          <MessageSquareText size={16} />Development OTP: <b>{info.devOtp}</b>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setAt(0, info.devOtp)}>Fill</button>
        </div>
      )}
      <Button size="lg" block loading={busy} onClick={() => verify(digits.join(''))}>Verify &amp; continue</Button>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>Change number</button>
        {left > 0 ? <span className="muted small">Resend in 00:{String(left).padStart(2, '0')}</span>
          : <button className="btn btn-ghost btn-sm" onClick={resend}>Resend OTP</button>}
      </div>
    </div>
  );
}
